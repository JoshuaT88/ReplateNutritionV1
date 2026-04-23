import prisma from '../config/database.js';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import * as aiService from './ai.service.js';
import { searchNearbyStores } from './store.service.js';
import { emailNotificationsConfigured, sendShoppingAlertEmail } from './notification.service.js';
import { categorizeItem } from '../data/groceryReferenceData.js';

function categorizeGroceryItem(itemName: string): string {
  return categorizeItem(itemName) ?? 'Other';
}

async function sendShoppingAlertIfEnabled(
  userId: string,
  items: Array<{ itemName: string; quantity?: string | null; category?: string | null }>,
  sourceLabel: string
) {
  if (!items.length || !emailNotificationsConfigured()) {
    return;
  }

  const prefs = await prisma.userPreferences.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  });

  if (!prefs?.emailNotificationsEnabled || !prefs.emailNotificationsDisclosureAccepted || !prefs.shoppingAlerts) {
    return;
  }

  try {
    await sendShoppingAlertEmail(
      {
        email: prefs.user.email,
        fullName: prefs.user.fullName,
      },
      items,
      sourceLabel
    );
  } catch (err) {
    console.warn('Shopping alert email skipped:', err);
  }
}

export async function getShoppingList(userId: string) {
  return prisma.shoppingList.findMany({
    where: { userId },
    orderBy: [{ checked: 'asc' }, { category: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function addShoppingItem(userId: string, data: any) {
  // Use hardcoded category first; only call AI for validation if no category provided or found
  let suggestedCategory = categorizeGroceryItem(data.itemName);
  if (suggestedCategory === 'Other' && !data.category) {
    try {
      const validation = await aiService.validateGroceryItem(data.itemName);
      if (!validation.isValid) {
        throw new AppError(400, `"${data.itemName}" doesn't appear to be a grocery item: ${validation.reason}`);
      }
      if (validation.suggestedCategory) suggestedCategory = validation.suggestedCategory;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.warn('AI validation skipped:', err.message);
    }
  }

  const saved = await prisma.shoppingList.create({
    data: {
      userId,
      itemName: data.itemName,
      category: data.category || suggestedCategory || 'Other',
      quantity: data.quantity != null ? String(data.quantity) : null,
      profileIds: data.profileIds || [],
      priority: data.priority || 'MEDIUM',
      notes: data.notes,
    },
  });

  await sendShoppingAlertIfEnabled(userId, [saved], 'an item was added to your shopping list');

  return saved;
}

export async function updateShoppingItem(userId: string, id: string, data: any) {
  const item = await prisma.shoppingList.findFirst({ where: { id, userId } });
  if (!item) throw new AppError(404, 'Shopping item not found');

  return prisma.shoppingList.update({ where: { id }, data });
}

export async function deleteShoppingItem(userId: string, id: string) {
  const item = await prisma.shoppingList.findFirst({ where: { id, userId } });
  if (!item) throw new AppError(404, 'Shopping item not found');

  await prisma.shoppingList.delete({ where: { id } });
}

export async function generateFromMealPlans(userId: string, profileIds: string[], days: number) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const meals = await prisma.mealPlan.findMany({
    where: {
      userId,
      profileId: { in: profileIds },
      date: { gte: startDate, lte: endDate },
    },
  });

  const allIngredients = meals.flatMap((m) => m.ingredients);
  if (allIngredients.length === 0) throw new AppError(400, 'No meals found for the selected period');

  // Find the earliest meal date so we can auto-adjust priority
  const earliestMealDate = meals.reduce((earliest, m) => {
    const d = new Date(m.date);
    return d < earliest ? d : earliest;
  }, new Date(meals[0].date));
  const priority = calculatePriorityFromDate(earliestMealDate.toISOString());

  const items = await aiService.generateShoppingListFromMeals(allIngredients);

  const created = [];
  for (const item of items) {
    const saved = await prisma.shoppingList.create({
      data: {
        userId,
        itemName: item.itemName,
        category: item.category,
        quantity: item.quantity,
        profileIds,
        priority,
        sourceRef: `Meal plan (${days} day${days > 1 ? 's' : ''})`,
      },
    });
    created.push(saved);
  }

  await sendShoppingAlertIfEnabled(
    userId,
    created.map((i) => ({ itemName: i.itemName, quantity: i.quantity, category: i.category })),
    `items were added from your meal plan for the next ${days} day${days > 1 ? 's' : ''}`
  );

  return created;
}

export async function findStores(userId: string, zipCode: string) {
  const items = await prisma.shoppingList.findMany({
    where: { userId, checked: false },
  });

  if (items.length === 0) throw new AppError(400, 'Your shopping list is empty');

  const zipRegion = zipCode.slice(0, 3);

  // Get crowd-sourced prices
  const crowdSourcedPrices: Record<string, Record<string, number>> = {};
  const averages = await prisma.storeItemAverage.findMany({
    where: {
      zipRegion,
      itemName: { in: items.map((i) => i.itemName) },
    },
  });

  for (const avg of averages) {
    if (!crowdSourcedPrices[avg.storeName]) crowdSourcedPrices[avg.storeName] = {};
    crowdSourcedPrices[avg.storeName][avg.itemName] = avg.avgPrice;
  }

  // Get real stores from Google Places API
  let realStores: { name: string; address: string; phone?: string; rating?: number; hours?: string[]; placeId: string }[] = [];
  try {
    realStores = await searchNearbyStores(zipCode);
  } catch (err) {
    console.warn('Google Places lookup failed, falling back to AI-only:', err);
  }

  // If we have real store data, use AI only for price estimation with the known stores
  const stores = await aiService.findNearbyStores(
    items.map((i) => ({ name: i.itemName, quantity: i.quantity || '1' })),
    zipCode,
    crowdSourcedPrices,
    realStores.length > 0
      ? realStores.map((s) => ({ name: s.name, address: s.address, phone: s.phone, rating: s.rating, hours: s.hours }))
      : undefined
  );

  return stores;
}

export async function startShoppingSession(userId: string, storeName?: string) {
  const items = await prisma.shoppingList.findMany({
    where: { userId, checked: false },
    orderBy: [{ priority: 'asc' }, { category: 'asc' }],
  });

  if (items.length === 0) throw new AppError(400, 'Your shopping list is empty');

  // Get user preferences for zip code
  const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
  const zipRegion = prefs?.zipCode?.slice(0, 3) || '000';

  // Fetch crowd-sourced price estimates if store is known
  const priceMap: Record<string, number> = {};
  if (storeName) {
    const averages = await prisma.storeItemAverage.findMany({
      where: {
        zipRegion,
        storeName,
        itemName: { in: items.map((i) => i.itemName) },
      },
    });
    for (const avg of averages) {
      priceMap[avg.itemName] = avg.avgPrice;
    }
  }

  // Build initial item statuses and enrich with aisle hints + price estimates
  const itemStatuses: Record<string, string> = {};
  const itemPrices: Record<string, number> = {};
  const sessionItems = [];

  for (const item of items) {
    itemStatuses[item.id] = 'PENDING';

    let aisleHint = 'Unknown';
    if (storeName) {
      // Check DB for known aisle
      const known = await prisma.aisleLocation.findFirst({
        where: { itemName: item.itemName, storeName },
        orderBy: { verifiedCount: 'desc' },
      });
      if (known) {
        aisleHint = known.aisleLocation;
      } else {
        try {
          aisleHint = await aiService.predictAisleLocation(item.itemName, storeName);
        } catch {
          aisleHint = item.category || 'Unknown';
        }
      }
    }

    const estimatedPrice = priceMap[item.itemName] || null;

    sessionItems.push({
      id: item.id,
      itemName: item.itemName,
      category: item.category,
      quantity: item.quantity,
      priority: item.priority,
      notes: item.notes,
      sourceRef: item.sourceRef,
      aisleHint,
      estimatedPrice,
    });
  }

  const session = await prisma.shoppingSession.create({
    data: {
      userId,
      selectedStore: storeName ? { name: storeName } : Prisma.JsonNull,
      itemStatuses,
      itemPrices,
      sessionDate: new Date(),
    },
  });

  return { ...session, items: sessionItems, storeName };
}

export async function getShoppingSession(userId: string, sessionId: string) {
  const session = await prisma.shoppingSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new AppError(404, 'Shopping session not found');

  const storeName = (session.selectedStore as any)?.name;
  const items = await prisma.shoppingList.findMany({
    where: { userId },
    orderBy: [{ priority: 'asc' }, { category: 'asc' }],
  });

  const statuses = (session.itemStatuses as Record<string, string>) || {};
  const prices = (session.itemPrices as Record<string, number>) || {};

  // Fetch price estimates
  const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
  const zipRegion = prefs?.zipCode?.slice(0, 3) || '000';
  const priceMap: Record<string, number> = {};
  if (storeName) {
    const averages = await prisma.storeItemAverage.findMany({
      where: {
        zipRegion,
        storeName,
        itemName: { in: items.map((i) => i.itemName) },
      },
    });
    for (const avg of averages) {
      priceMap[avg.itemName] = avg.avgPrice;
    }
  }

  const sessionItems = await Promise.all(
    items
      .filter((item) => statuses[item.id] !== undefined)
      .map(async (item) => {
        let aisleHint = item.category || 'Unknown';
        if (storeName) {
          const known = await prisma.aisleLocation.findFirst({
            where: { itemName: item.itemName, storeName },
            orderBy: { verifiedCount: 'desc' },
          });
          if (known) aisleHint = known.aisleLocation;
        }
        return {
          id: item.id,
          itemName: item.itemName,
          category: item.category,
          quantity: item.quantity,
          priority: item.priority,
          notes: item.notes,
          sourceRef: item.sourceRef,
          aisleHint,
          estimatedPrice: priceMap[item.itemName] || null,
          actualPrice: prices[item.id] || null,
          status: statuses[item.id] || 'PENDING',
        };
      })
  );

  return { ...session, items: sessionItems, storeName };
}

export async function updateSessionItem(
  userId: string,
  sessionId: string,
  itemId: string,
  data: { status?: string; actualPrice?: number }
) {
  const session = await prisma.shoppingSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new AppError(404, 'Shopping session not found');

  const statuses = (session.itemStatuses as Record<string, string>) || {};
  const prices = (session.itemPrices as Record<string, number>) || {};

  if (data.status) statuses[itemId] = data.status;
  if (data.actualPrice != null) prices[itemId] = data.actualPrice;

  // If item is picked up, mark it as checked on the shopping list
  if (data.status === 'PICKED_UP') {
    await prisma.shoppingList.update({ where: { id: itemId }, data: { checked: true } }).catch(() => {});
  } else if (data.status === 'PENDING') {
    await prisma.shoppingList.update({ where: { id: itemId }, data: { checked: false } }).catch(() => {});
  }

  return prisma.shoppingSession.update({
    where: { id: sessionId },
    data: { itemStatuses: statuses, itemPrices: prices },
  });
}

export async function submitSessionPrice(
  userId: string,
  sessionId: string,
  itemId: string,
  price: number
) {
  // Basic sanity check
  if (price < 0 || price > 9999) {
    throw new AppError(400, 'Price must be between $0 and $9,999');
  }

  const session = await prisma.shoppingSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new AppError(404, 'Shopping session not found');

  const item = await prisma.shoppingList.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new AppError(404, 'Item not found');

  const storeName = (session.selectedStore as any)?.name || 'Unknown';

  // Update session price (always saved so the user's review screen shows it)
  const prices = (session.itemPrices as Record<string, number>) || {};
  prices[itemId] = price;
  await prisma.shoppingSession.update({
    where: { id: sessionId },
    data: { itemPrices: prices },
  });

  // Outlier detection: compare against existing crowd-sourced average
  const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
  const zipRegion = prefs?.zipCode?.slice(0, 3) || '000';

  let flaggedOutlier = false;
  const existing = await prisma.storeItemAverage.findUnique({
    where: { itemName_storeName_zipRegion: { itemName: item.itemName, storeName, zipRegion } },
  });

  if (existing && existing.submissionCount >= 3) {
    // Flag as outlier if price is more than 5x or less than 1/5 of the average
    const ratio = price / existing.avgPrice;
    if (ratio > 5 || ratio < 0.2) {
      flaggedOutlier = true;
    }
  }

  // Submit to crowd-sourced price DB (skip outliers to protect data quality)
  if (!flaggedOutlier) {
    await prisma.priceSubmission.create({
      data: {
        userId,
        itemName: item.itemName,
        storeName,
        zipRegion,
        actualPrice: price,
      },
    });
  }

  return { success: true, flaggedOutlier };
}

export async function endShoppingSession(userId: string, sessionId: string) {
  const session = await prisma.shoppingSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new AppError(404, 'Shopping session not found');

  const statuses = (session.itemStatuses as Record<string, string>) || {};
  const prices = (session.itemPrices as Record<string, number>) || {};
  const storeName = (session.selectedStore as any)?.name || 'Unknown';

  const items = await prisma.shoppingList.findMany({ where: { userId } });
  const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));

  const pickedUp: any[] = [];
  const outOfStock: any[] = [];
  const tooExpensive: any[] = [];

  for (const [id, status] of Object.entries(statuses)) {
    const item = itemMap[id];
    if (!item) continue;
    const entry = { itemName: item.itemName, quantity: item.quantity, actualPrice: prices[id] || null };
    if (status === 'PICKED_UP') pickedUp.push(entry);
    else if (status === 'OUT_OF_STOCK') outOfStock.push(entry);
    else if (status === 'TOO_EXPENSIVE') tooExpensive.push(entry);
  }

  const actualTotal = Object.values(prices).reduce((sum, p) => sum + p, 0);

  // Create shopping history
  const history = await prisma.shoppingHistory.create({
    data: {
      userId,
      storeName,
      shoppingDate: session.sessionDate,
      actualCost: actualTotal || null,
      itemsPickedUp: pickedUp,
      itemsOutOfStock: outOfStock,
      itemsTooExpensive: tooExpensive,
    },
  });

  // Mark session as completed
  await prisma.shoppingSession.update({
    where: { id: sessionId },
    data: { completed: true },
  });

  // Remove picked-up items from shopping list
  const pickedUpIds = Object.entries(statuses)
    .filter(([_, s]) => s === 'PICKED_UP')
    .map(([id]) => id);
  if (pickedUpIds.length > 0) {
    await prisma.shoppingList.deleteMany({ where: { id: { in: pickedUpIds }, userId } });
  }

  return history;
}

function calculatePriorityFromDate(mealDate: string | undefined): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (!mealDate) return 'MEDIUM';
  const now = new Date();
  const target = new Date(mealDate);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 2) return 'HIGH';
  if (diffDays <= 5) return 'MEDIUM';
  return 'LOW';
}

export async function saveAisleLocation(
  userId: string,
  sessionId: string,
  itemId: string,
  aisleLocation: string
) {
  const session = await prisma.shoppingSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new AppError(404, 'Shopping session not found');

  const item = await prisma.shoppingList.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new AppError(404, 'Item not found');

  const storeName = (session.selectedStore as any)?.name || 'Unknown';

  // Upsert aisle location for this item+store combo
  await prisma.aisleLocation.upsert({
    where: { itemName_storeName_zipRegion: { itemName: item.itemName, storeName, zipRegion: '' } },
    update: { aisleLocation },
    create: { itemName: item.itemName, storeName, zipRegion: '', aisleLocation },
  });

  return { success: true };
}

export async function addIngredientsToList(
  userId: string,
  data: { ingredients: string[]; mealName: string; mealDate?: string; profileId?: string; category?: string }
) {
  if (!data.ingredients || data.ingredients.length === 0) {
    throw new AppError(400, 'No ingredients provided');
  }

  const priority = calculatePriorityFromDate(data.mealDate);
  const sourceRef = data.mealDate
    ? `${data.mealName} (${new Date(data.mealDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
    : data.mealName;

  const created = [];
  for (const ingredient of data.ingredients) {
    // Use hardcoded category lookup instead of AI
    const groceryCategory = categorizeGroceryItem(ingredient);

    const saved = await prisma.shoppingList.create({
      data: {
        userId,
        itemName: ingredient,
        category: groceryCategory,
        profileIds: data.profileId ? [data.profileId] : [],
        priority,
        sourceRef,
        notes: `For: ${data.mealName}`,
      },
    });
    created.push(saved);
  }

  await sendShoppingAlertIfEnabled(userId, created, `ingredients from ${data.mealName} were added to your shopping list`);

  return created;
}
