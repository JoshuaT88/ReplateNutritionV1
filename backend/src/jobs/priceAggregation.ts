import cron from 'node-cron';
import { aggregatePrices, purgeExpiredPriceCache } from '../services/pricing.service.js';
import prisma from '../config/database.js';
import { emailNotificationsConfigured, sendPriceDropEmail } from '../services/notification.service.js';

type PriceDrop = {
  itemName: string;
  storeName: string;
  zipRegion: string;
  oldPrice: number;
  newPrice: number;
};

function extractItemNames(items: unknown) {
  if (!Array.isArray(items)) {
    return [] as string[];
  }

  return items
    .map((item) => (item && typeof item === 'object' && 'itemName' in item ? item.itemName : null))
    .filter((itemName): itemName is string => typeof itemName === 'string' && itemName.trim().length > 0)
    .map((itemName) => itemName.trim().toLowerCase());
}

async function notifyPriceDrops(priceDrops: PriceDrop[]) {
  if (!priceDrops.length || !emailNotificationsConfigured()) return;

  // Group drops by zip region so we can match them to users
  const dropsByRegion = new Map<string, typeof priceDrops>();
  for (const drop of priceDrops) {
    if (!dropsByRegion.has(drop.zipRegion)) dropsByRegion.set(drop.zipRegion, []);
    dropsByRegion.get(drop.zipRegion)!.push(drop);
  }

  // Find users opted in to price-drop alerts
  const optedInUsers = await prisma.userPreferences.findMany({
    where: {
      emailNotificationsEnabled: true,
      emailNotificationsDisclosureAccepted: true,
      priceDropAlerts: true,
      zipCode: { not: null },
    },
    include: { user: { select: { email: true, fullName: true } } },
  });

  for (const prefs of optedInUsers) {
    const userRegion = prefs.zipCode!.slice(0, 3);
    const regionDrops = dropsByRegion.get(userRegion);
    if (!regionDrops?.length) continue;

    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 90);

    const [shoppingList, shoppingHistory] = await Promise.all([
      prisma.shoppingList.findMany({
        where: { userId: prefs.userId },
        select: { itemName: true },
      }),
      prisma.shoppingHistory.findMany({
        where: {
          userId: prefs.userId,
          shoppingDate: { gte: recentCutoff },
        },
        select: {
          itemsPickedUp: true,
          itemsOutOfStock: true,
          itemsTooExpensive: true,
        },
      }),
    ]);

    const trackedItems = new Set<string>(
      shoppingList.map((item) => item.itemName.trim().toLowerCase())
    );

    for (const trip of shoppingHistory) {
      for (const itemName of extractItemNames(trip.itemsPickedUp)) trackedItems.add(itemName);
      for (const itemName of extractItemNames(trip.itemsOutOfStock)) trackedItems.add(itemName);
      for (const itemName of extractItemNames(trip.itemsTooExpensive)) trackedItems.add(itemName);
    }

    const relevantDrops = regionDrops.filter((drop) => trackedItems.has(drop.itemName.trim().toLowerCase()));
    if (!relevantDrops.length) continue;

    try {
      await sendPriceDropEmail(
        { email: prefs.user.email, fullName: prefs.user.fullName },
        relevantDrops.slice(0, 12).map((d) => ({
          itemName: d.itemName,
          storeName: d.storeName,
          oldPrice: d.oldPrice,
          newPrice: d.newPrice,
        }))
      );
    } catch (err) {
      console.warn(`[CRON] Price drop email failed for ${prefs.user.email}:`, err);
    }
  }
}

export function startPriceAggregationJob() {
  // Run nightly at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Starting nightly price aggregation...');
    try {
      const result = await aggregatePrices();
      console.log(`[CRON] Price aggregation complete. Processed ${result.groupsProcessed} groups, ${result.priceDrops.length} price drops detected.`);

      if (result.priceDrops.length > 0) {
        await notifyPriceDrops(result.priceDrops);
      }

      // Purge stale price cache entries
      const { count } = await purgeExpiredPriceCache();
      if (count > 0) console.log(`[CRON] Purged ${count} expired price cache entries.`);
    } catch (err) {
      console.error('[CRON] Price aggregation failed:', err);
    }
  });

  console.log('[CRON] Price aggregation job scheduled (nightly at 2:00 AM)');
}
