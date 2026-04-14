import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import * as aiService from './ai.service.js';

export async function getMealPlans(userId: string, profileId?: string, startDate?: string, endDate?: string) {
  const where: any = { userId };
  if (profileId) where.profileId = profileId;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate + 'T00:00:00');
    if (endDate) where.date.lte = new Date(endDate + 'T23:59:59');
  }

  return prisma.mealPlan.findMany({
    where,
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    include: { profile: { select: { name: true, type: true } } },
  });
}

export async function createMealPlan(userId: string, data: any) {
  return prisma.mealPlan.create({
    data: { ...data, userId, date: new Date(data.date + 'T12:00:00') },
  });
}

export async function generateMealPlan(
  userId: string,
  profileIds: string[],
  date: string,
  mealTypes: string[]
) {
  const profiles = await prisma.profile.findMany({
    where: { id: { in: profileIds }, userId },
  });

  if (profiles.length === 0) throw new AppError(404, 'No valid profiles found');

  // Fetch recent meals to avoid repetition
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentMeals = await prisma.mealPlan.findMany({
    where: {
      userId,
      profileId: { in: profileIds },
      date: { gte: weekAgo },
    },
    select: { mealName: true },
  });

  const profileContexts = profiles.map((p) => ({
    name: p.name,
    type: p.type,
    petType: p.petType || undefined,
    age: p.age || undefined,
    allergies: p.allergies,
    intolerances: p.intolerances,
    dietaryRestrictions: p.dietaryRestrictions,
    specialConditions: p.specialConditions,
    foodPreferences: p.foodPreferences,
    foodDislikes: p.foodDislikes,
  }));

  const aiMeals = await aiService.generateMeals(
    profileContexts,
    date,
    mealTypes,
    recentMeals.map((m) => m.mealName)
  );

  const savedMeals = [];
  for (const meal of aiMeals) {
    const profile = profiles.find((p) => p.name === meal.profileName);
    if (!profile) continue;

    const saved = await prisma.mealPlan.create({
      data: {
        userId,
        profileId: profile.id,
        date: new Date(date + 'T12:00:00'),
        mealType: meal.mealType,
        mealName: meal.mealName,
        ingredients: meal.ingredients || [],
        preparationNotes: meal.preparationNotes,
        calories: meal.calories,
      },
    });
    savedMeals.push(saved);
  }

  return savedMeals;
}

export async function updateMealPlan(userId: string, id: string, data: any) {
  const meal = await prisma.mealPlan.findFirst({ where: { id, userId } });
  if (!meal) throw new AppError(404, 'Meal plan not found');

  if (data.date) data.date = new Date(data.date);
  return prisma.mealPlan.update({ where: { id }, data });
}

export async function deleteMealPlan(userId: string, id: string) {
  const meal = await prisma.mealPlan.findFirst({ where: { id, userId } });
  if (!meal) throw new AppError(404, 'Meal plan not found');

  await prisma.mealPlan.delete({ where: { id } });
}
