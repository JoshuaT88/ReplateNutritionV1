import crypto from 'crypto';
import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import * as aiService from './ai.service.js';
import { validateAndFilterItems } from './allergenSafety.service.js';
import { getRedis } from '../utils/redis.js';

function recCacheKey(profileId: string, categories: string[]) {
  const hash = crypto.createHash('sha256').update([...categories].sort().join(',')).digest('hex').slice(0, 12);
  return `ai_rec:${profileId}:${hash}`;
}

export async function invalidateRecCache(profileId: string) {
  try {
    const redis = getRedis();
    if (!redis) return;
    const keys = await redis.keys(`ai_rec:${profileId}:*`);
    if (keys.length > 0) await redis.del(...(keys as [string, ...string[]]));
  } catch { /* non-critical */ }
}

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
  let redis: ReturnType<typeof getRedis> | null = null;
  try { redis = getRedis(); } catch { /* Redis unavailable — proceed without cache */ }

  for (const profile of profiles) {
    // Check Redis cache — skip AI call if generated within last 24hr
    const cacheKey = recCacheKey(profile.id, categories);
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const existing = await prisma.recommendation.findMany({
            where: { userId, profileId: profile.id, category: { in: categories } },
            orderBy: { createdAt: 'desc' },
            take: 30,
            include: { profile: { select: { name: true, type: true } } },
          });
          allRecs.push(...existing);
          continue;
        }
      } catch {
        redis = null; // disable for remainder of request
      }
    }

    const aiRecs = await aiService.generateRecommendations(
      {
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
      },
      categories
    );

    // Deterministic + AI second-pass allergen safety validation
    const safeRecs = await validateAndFilterItems(
      aiRecs.map((rec: any) => ({ ...rec, ingredients: rec.ingredients || [] })),
      {
        name: profile.name,
        type: profile.type,
        criticalAllergies: profile.criticalAllergies,
        allergies: profile.allergies,
        intolerances: profile.intolerances,
      }
    );

    const savedRecs = await prisma.recommendation.createManyAndReturn({
      data: safeRecs.map((rec: any) => ({
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
        safetyFlag: rec.safetyFlag ?? null,
      })),
    });

    allRecs.push(...savedRecs);

    // Set cache flag — 24hr TTL
    if (redis) {
      try { await redis.set(cacheKey, '1', 'EX', 86400); } catch { /* ignore */ }
    }
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
