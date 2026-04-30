import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

export async function submitPrice(userId: string, data: {
  itemName: string;
  storeName: string;
  zipRegion: string;
  actualPrice: number;
  quantity?: number;
  unit?: string;
}) {
  if (data.actualPrice < 0 || data.actualPrice > 9999) {
    throw new AppError(400, 'Price must be between $0 and $9,999');
  }

  // Outlier detection against existing average
  const existing = await prisma.storeItemAverage.findUnique({
    where: {
      itemName_storeName_zipRegion: {
        itemName: data.itemName,
        storeName: data.storeName,
        zipRegion: data.zipRegion,
      },
    },
  });

  let flaggedOutlier = false;
  if (existing && existing.submissionCount >= 3) {
    const ratio = data.actualPrice / existing.avgPrice;
    if (ratio > 5 || ratio < 0.2) {
      flaggedOutlier = true;
    }
  }

  if (flaggedOutlier) {
    return { flaggedOutlier: true, submitted: false };
  }

  const submission = await prisma.priceSubmission.create({
    data: {
      userId,
      itemName: data.itemName,
      storeName: data.storeName,
      zipRegion: data.zipRegion,
      actualPrice: data.actualPrice,
      quantity: data.quantity || 1,
      unit: data.unit,
    },
  });

  return { ...submission, flaggedOutlier: false };
}

export async function getEstimate(itemName: string, storeName: string, zipRegion: string) {
  // 1. Check crowd-sourced averages first (highest priority)
  const avg = await prisma.storeItemAverage.findUnique({
    where: {
      itemName_storeName_zipRegion: { itemName, storeName, zipRegion },
    },
  });

  if (avg) {
    return {
      price: avg.avgPrice,
      confidence: avg.submissionCount >= 20 ? 'high' : avg.submissionCount >= 5 ? 'medium' : 'low',
      submissionCount: avg.submissionCount,
      lastUpdated: avg.lastUpdated,
      source: 'crowd_sourced',
    };
  }

  // 2. Check DB price cache (AI estimates from recent lookups)
  const cacheKey = `${itemName.toLowerCase()}::${storeName.toLowerCase()}::${zipRegion}`;
  const cached = await prisma.priceCache.findUnique({ where: { cacheKey } });
  if (cached && cached.expiresAt > new Date()) {
    return {
      price: cached.estimatedPrice,
      confidence: 'ai_estimate',
      submissionCount: 0,
      source: 'ai_cached',
      cachedAt: cached.createdAt,
    };
  }

  return {
    price: null,
    confidence: 'ai_estimate',
    submissionCount: 0,
    source: 'ai_estimate',
  };
}

// Write an AI-estimated price into the cache (called from shopping list estimation)
export async function cacheAiEstimate(itemName: string, storeName: string, zipRegion: string, price: number) {
  const cacheKey = `${itemName.toLowerCase()}::${storeName.toLowerCase()}::${zipRegion}`;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour TTL
  await prisma.priceCache.upsert({
    where: { cacheKey },
    update: { estimatedPrice: price, expiresAt, createdAt: new Date() },
    create: { cacheKey, itemName, storeName, zipRegion, estimatedPrice: price, source: 'ai', expiresAt },
  }).catch(() => {}); // fire-and-forget, non-critical
}

// Purge expired price cache entries (called by priceAggregation job)
export async function purgeExpiredPriceCache() {
  return prisma.priceCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

export async function getStoreItemPrice(storeName: string, itemName: string) {
  return prisma.storeItemAverage.findMany({
    where: { storeName, itemName },
    orderBy: { lastUpdated: 'desc' },
  });
}

export async function aggregatePrices() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get all unique item-store-region combinations from recent submissions
  const submissions = await prisma.priceSubmission.findMany({
    where: { submittedAt: { gte: ninetyDaysAgo } },
    orderBy: { submittedAt: 'desc' },
  });

  const groups = new Map<string, typeof submissions>();
  for (const sub of submissions) {
    const key = `${sub.itemName}::${sub.storeName}::${sub.zipRegion}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(sub);
  }

  const priceDrops: { itemName: string; storeName: string; zipRegion: string; oldPrice: number; newPrice: number }[] = [];

  for (const [, subs] of groups) {
    if (subs.length === 0) continue;

    const now = Date.now();
    let weightedSum = 0;
    let weightTotal = 0;

    for (const sub of subs) {
      const daysOld = (now - sub.submittedAt.getTime()) / (1000 * 60 * 60 * 24);
      const weight = Math.exp(-daysOld / 30); // Exponential decay, half-life ~30 days
      weightedSum += sub.actualPrice * weight;
      weightTotal += weight;
    }

    const avgPrice = Math.round((weightedSum / weightTotal) * 100) / 100;
    const { itemName, storeName, zipRegion } = subs[0];

    // Get the current average to save as previousAvgPrice
    const existing = await prisma.storeItemAverage.findUnique({
      where: { itemName_storeName_zipRegion: { itemName, storeName, zipRegion } },
    });

    const previousAvgPrice = existing?.avgPrice ?? null;

    // Track significant drops (>10% decrease with enough data)
    if (previousAvgPrice && subs.length >= 3 && avgPrice < previousAvgPrice * 0.9) {
      priceDrops.push({ itemName, storeName, zipRegion, oldPrice: previousAvgPrice, newPrice: avgPrice });
    }

    await prisma.storeItemAverage.upsert({
      where: { itemName_storeName_zipRegion: { itemName, storeName, zipRegion } },
      update: {
        avgPrice,
        previousAvgPrice,
        submissionCount: subs.length,
        lastUpdated: new Date(),
      },
      create: {
        itemName,
        storeName,
        zipRegion,
        avgPrice,
        previousAvgPrice: null,
        submissionCount: subs.length,
      },
    });
  }

  // Clean up old submissions
  await prisma.priceSubmission.deleteMany({
    where: { submittedAt: { lt: ninetyDaysAgo } },
  });

  return { groupsProcessed: groups.size, priceDrops };
}
