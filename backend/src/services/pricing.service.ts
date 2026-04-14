import prisma from '../config/database.js';

export async function submitPrice(userId: string, data: {
  itemName: string;
  storeName: string;
  zipRegion: string;
  actualPrice: number;
  quantity?: number;
  unit?: string;
}) {
  return prisma.priceSubmission.create({
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
}

export async function getEstimate(itemName: string, storeName: string, zipRegion: string) {
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

  return {
    price: null,
    confidence: 'ai_estimate',
    submissionCount: 0,
    source: 'ai_estimate',
  };
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

    const avgPrice = weightedSum / weightTotal;
    const { itemName, storeName, zipRegion } = subs[0];

    await prisma.storeItemAverage.upsert({
      where: { itemName_storeName_zipRegion: { itemName, storeName, zipRegion } },
      update: {
        avgPrice: Math.round(avgPrice * 100) / 100,
        submissionCount: subs.length,
        lastUpdated: new Date(),
      },
      create: {
        itemName,
        storeName,
        zipRegion,
        avgPrice: Math.round(avgPrice * 100) / 100,
        submissionCount: subs.length,
      },
    });
  }

  // Clean up old submissions
  await prisma.priceSubmission.deleteMany({
    where: { submittedAt: { lt: ninetyDaysAgo } },
  });

  return { groupsProcessed: groups.size };
}
