import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import * as aiService from './ai.service.js';
import { validateAndFilterItems } from './allergenSafety.service.js';

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
  mealTypes: string[],
  days: number = 7,
  dietaryGoals?: string,
  onMeal?: (meal: any) => void   // T67: streaming callback
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
    criticalAllergies: p.criticalAllergies,
    allergies: p.allergies,
    intolerances: p.intolerances,
    dietaryRestrictions: p.dietaryRestrictions,
    specialConditions: p.specialConditions,
    foodPreferences: p.foodPreferences,
    foodDislikes: p.foodDislikes,
  }));

  // Generate dates for the requested range
  const dateList: string[] = [];
  const startD = new Date(date + 'T12:00:00');
  for (let i = 0; i < days; i++) {
    const d = new Date(startD);
    d.setDate(d.getDate() + i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dateList.push(ds);
  }

  // Batch generation: max 2 days per AI call to stay under token limits
  const BATCH_SIZE = 2;
  const allAiMeals: any[] = [];
  const usedMealNames = recentMeals.map((m) => m.mealName);

  for (let i = 0; i < dateList.length; i += BATCH_SIZE) {
    const batchDates = dateList.slice(i, i + BATCH_SIZE);
    const batchMeals = await aiService.generateMeals(
      profileContexts,
      batchDates,
      mealTypes,
      [...usedMealNames, ...allAiMeals.map((m) => m.mealName)],
      dietaryGoals
    );

    // Ensure every meal has a valid date from this batch
    const mealsPerDate: Record<string, number> = {};
    for (const d of batchDates) mealsPerDate[d] = 0;

    for (const meal of batchMeals) {
      // Normalize the date: trim, validate YYYY-MM-DD format, ensure it's in this batch
      const trimmedDate = (meal.date || '').trim();
      const isValidBatchDate = /^\d{4}-\d{2}-\d{2}$/.test(trimmedDate) && batchDates.includes(trimmedDate);
      if (!isValidBatchDate) {
        // Assign to the batch date with the fewest meals so far
        const minDate = batchDates.reduce((min, d) =>
          (mealsPerDate[d] ?? 0) < (mealsPerDate[min] ?? 0) ? d : min
        , batchDates[0]);
        meal.date = minDate;
      } else {
        meal.date = trimmedDate;
      }
      mealsPerDate[meal.date] = (mealsPerDate[meal.date] ?? 0) + 1;
    }

    allAiMeals.push(...batchMeals);
  }

  const savedMeals = [];
  for (const meal of allAiMeals) {
    // Case-insensitive + trimmed profile name matching
    const profile = profiles.find(
      (p) => p.name.trim().toLowerCase() === (meal.profileName || '').trim().toLowerCase()
    );
    if (!profile) {
      console.warn(`[MealPlan] No profile matched for AI-returned profileName: "${meal.profileName}". Skipping.`);
      continue;
    }

    // Allergen safety check for each meal before saving
    const [safeMeal] = await validateAndFilterItems(
      [{ itemName: meal.mealName, ingredients: meal.ingredients || [] }],
      {
        name: profile.name,
        type: profile.type,
        criticalAllergies: profile.criticalAllergies,
        allergies: profile.allergies,
        intolerances: profile.intolerances,
      }
    );

    // If blocked (critical allergen hit), skip this meal entirely
    if (!safeMeal) continue;

    // Use the date from the AI response, falling back to the start date
    const mealDate = meal.date || date;
    const saved = await prisma.mealPlan.create({
      data: {
        userId,
        profileId: profile.id,
        date: new Date(mealDate + 'T12:00:00'),
        mealType: meal.mealType,
        mealName: meal.mealName,
        ingredients: meal.ingredients || [],
        preparationNotes: meal.preparationNotes,
        calories: meal.calories ?? null,
        protein: meal.protein ?? null,
        carbs: meal.carbs ?? null,
        fat: meal.fat ?? null,
        fiber: meal.fiber ?? null,
        safetyFlag: safeMeal.safetyFlag ?? null,
      },
    });
    savedMeals.push(saved);
    if (onMeal) onMeal(saved);   // T67: stream each meal as saved
  }

  return savedMeals;
}

export async function updateMealPlan(userId: string, id: string, data: any) {
  const meal = await prisma.mealPlan.findFirst({ where: { id, userId } });
  if (!meal) throw new AppError(404, 'Meal plan not found');

  if (data.date) data.date = new Date(data.date);
  return prisma.mealPlan.update({ where: { id }, data });
}

export async function regenerateSingleMeal(userId: string, id: string, dietaryGoals?: string) {
  const meal = await prisma.mealPlan.findFirst({ where: { id, userId } });
  if (!meal) throw new AppError(404, 'Meal plan not found');

  const profile = await prisma.profile.findFirst({ where: { id: meal.profileId, userId } });
  if (!profile) throw new AppError(404, 'Profile not found');

  const dateStr = meal.date.toISOString().split('T')[0];

  const [generated] = await aiService.generateMeals(
    [{
      name: profile.name,
      type: profile.type,
      petType: profile.petType || undefined,
      age: profile.age || undefined,
      criticalAllergies: profile.criticalAllergies,
      allergies: profile.allergies,
      intolerances: profile.intolerances,
      dietaryRestrictions: profile.dietaryRestrictions,
      specialConditions: profile.specialConditions,
      foodPreferences: profile.foodPreferences,
      foodDislikes: profile.foodDislikes,
    }],
    [dateStr],
    [meal.mealType],
    [meal.mealName], // exclude current meal name
    dietaryGoals
  );

  if (!generated) throw new AppError(500, 'AI could not regenerate this meal');

  return prisma.mealPlan.update({
    where: { id },
    data: {
      mealName: generated.mealName,
      ingredients: generated.ingredients || [],
      preparationNotes: generated.preparationNotes ?? meal.preparationNotes,
      calories: generated.calories ?? meal.calories,
    },
  });
}

export async function deleteMealPlan(userId: string, id: string) {
  const meal = await prisma.mealPlan.findFirst({ where: { id, userId } });
  if (!meal) throw new AppError(404, 'Meal plan not found');

  await prisma.mealPlan.delete({ where: { id } });
}
