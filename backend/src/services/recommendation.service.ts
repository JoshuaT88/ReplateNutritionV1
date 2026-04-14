import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import * as aiService from './ai.service.js';

export async function getRecommendations(userId: string, profileId?: string) {
  const where: any = { userId };
  if (profileId) where.profileId = profileId;
  return prisma.recommendation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { profile: { select: { name: true, type: true } } },
  });
}

export async function generateRecommendations(
  userId: string,
  profileIds: string[],
  categories: string[]
) {
  const profiles = await prisma.profile.findMany({
    where: { id: { in: profileIds }, userId },
  });

  if (profiles.length === 0) throw new AppError(404, 'No valid profiles found');

  const allRecs: any[] = [];

  for (const profile of profiles) {
    const aiRecs = await aiService.generateRecommendations(
      {
        name: profile.name,
        type: profile.type,
        petType: profile.petType || undefined,
        age: profile.age || undefined,
        allergies: profile.allergies,
        intolerances: profile.intolerances,
        dietaryRestrictions: profile.dietaryRestrictions,
        specialConditions: profile.specialConditions,
        foodPreferences: profile.foodPreferences,
        foodDislikes: profile.foodDislikes,
      },
      categories
    );

    const savedRecs = await prisma.recommendation.createManyAndReturn({
      data: aiRecs.map((rec: any) => ({
        userId,
        profileId: profile.id,
        itemName: rec.itemName,
        itemType: rec.itemType,
        category: rec.category,
        reason: rec.reason,
        ingredients: rec.ingredients || [],
        alternatives: rec.alternatives || [],
        priceRange: rec.priceRange,
        nutrition: rec.nutrition,
        texture: rec.texture,
      })),
    });

    allRecs.push(...savedRecs);
  }

  return allRecs;
}

export async function updateRecommendation(userId: string, id: string, data: any) {
  const rec = await prisma.recommendation.findFirst({ where: { id, userId } });
  if (!rec) throw new AppError(404, 'Recommendation not found');

  return prisma.recommendation.update({
    where: { id },
    data,
  });
}

export async function deleteRecommendation(userId: string, id: string) {
  const rec = await prisma.recommendation.findFirst({ where: { id, userId } });
  if (!rec) throw new AppError(404, 'Recommendation not found');

  await prisma.recommendation.delete({ where: { id } });
}
