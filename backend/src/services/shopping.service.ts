import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import * as aiService from './ai.service.js';

export async function getShoppingList(userId: string) {
  return prisma.shoppingList.findMany({
    where: { userId },
    orderBy: [{ checked: 'asc' }, { category: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function addShoppingItem(userId: string, data: any) {
  // Validate item with AI (optional - skip if AI is unavailable)
  let suggestedCategory: string | undefined;
  try {
    const validation = await aiService.validateGroceryItem(data.itemName);
    if (!validation.isValid) {
      throw new AppError(400, `"${data.itemName}" doesn't appear to be a grocery item: ${validation.reason}`);
    }
    suggestedCategory = validation.suggestedCategory;
  } catch (err: any) {
    // Only re-throw if it's our own validation error (AppError)
    if (err instanceof AppError) throw err;
    // Otherwise skip AI validation (quota exceeded, network error, etc.)
    console.warn('AI validation skipped:', err.message);
  }

  return prisma.shoppingList.create({
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
        priority: 'MEDIUM',
      },
    });
    created.push(saved);
  }

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

  const stores = await aiService.findNearbyStores(
    items.map((i) => ({ name: i.itemName, quantity: i.quantity || '1' })),
    zipCode,
    crowdSourcedPrices
  );

  return stores;
}

export async function startShoppingSession(userId: string, storeName?: string) {
  const items = await prisma.shoppingList.findMany({
    where: { userId, checked: false },
    orderBy: [{ priority: 'asc' }, { category: 'asc' }],
  });

  if (items.length === 0) throw new AppError(400, 'Your shopping list is empty');

  // Build initial item statuses and enrich with aisle hints
  const itemStatuses: Record<string, string> = {};
  const itemPrices: Record<string, number> = {};
  const sessionItems = [];

  for (const item of items) {
    itemStatuses[item.id] = 'PENDING';

    let aisleHint = 'Unknown';
    if (storeName) {
      // Check DB for known aisle
      const known = await prisma.aisleLocation.findUnique({
        where: { itemName_storeName: { itemName: item.itemName, storeName } },
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

    sessionItems.push({
      id: item.id,
      itemName: item.itemName,
      category: item.category,
      quantity: item.quantity,
      priority: item.priority,
      notes: item.notes,
      aisleHint,
      estimatedPrice: null,
    });
  }

  const session = await prisma.shoppingSession.create({
    data: {
      userId,
      selectedStore: storeName ? { name: storeName } : null,
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

  const sessionItems = await Promise.all(
    items
      .filter((item) => statuses[item.id] !== undefined)
      .map(async (item) => {
        let aisleHint = item.category || 'Unknown';
        if (storeName) {
          const known = await prisma.aisleLocation.findUnique({
            where: { itemName_storeName: { itemName: item.itemName, storeName } },
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
          aisleHint,
          estimatedPrice: null,
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
  const session = await prisma.shoppingSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new AppError(404, 'Shopping session not found');

  const item = await prisma.shoppingList.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new AppError(404, 'Item not found');

  const storeName = (session.selectedStore as any)?.name || 'Unknown';

  // Update session price
  const prices = (session.itemPrices as Record<string, number>) || {};
  prices[itemId] = price;
  await prisma.shoppingSession.update({
    where: { id: sessionId },
    data: { itemPrices: prices },
  });

  // Submit to crowd-sourced price DB
  const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
  const zipRegion = prefs?.zipCode?.slice(0, 3) || '000';

  await prisma.priceSubmission.create({
    data: {
      userId,
      itemName: item.itemName,
      storeName,
      zipRegion,
      actualPrice: price,
    },
  });

  return { success: true };
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
