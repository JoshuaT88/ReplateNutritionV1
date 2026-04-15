import prisma from '../config/database.js';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import * as aiService from './ai.service.js';
import { searchNearbyStores } from './store.service.js';
import { emailNotificationsConfigured, sendShoppingAlertEmail } from './notification.service.js';

// Hardcoded grocery category lookup to avoid AI calls per ingredient
const GROCERY_CATEGORY_MAP: Record<string, string[]> = {
  'Produce': [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'strawberry', 'blueberry', 'raspberry',
    'blackberry', 'mango', 'pineapple', 'watermelon', 'cantaloupe', 'peach', 'pear', 'plum', 'cherry',
    'avocado', 'tomato', 'potato', 'sweet potato', 'onion', 'garlic', 'ginger', 'carrot', 'celery',
    'broccoli', 'cauliflower', 'spinach', 'kale', 'lettuce', 'romaine', 'arugula', 'cabbage', 'cucumber',
    'zucchini', 'squash', 'bell pepper', 'pepper', 'jalapeno', 'mushroom', 'corn', 'green bean',
    'asparagus', 'artichoke', 'beet', 'radish', 'turnip', 'parsnip', 'eggplant', 'pea', 'edamame',
    'cilantro', 'parsley', 'basil', 'mint', 'dill', 'thyme', 'rosemary', 'sage', 'chive', 'scallion',
    'green onion', 'shallot', 'leek', 'fennel', 'bok choy', 'collard', 'swiss chard',
  ],
  'Dairy': [
    'milk', 'cheese', 'butter', 'yogurt', 'cream', 'sour cream', 'cream cheese', 'cottage cheese',
    'ricotta', 'mozzarella', 'cheddar', 'parmesan', 'feta', 'gouda', 'brie', 'goat cheese',
    'whipped cream', 'half and half', 'buttermilk', 'ghee', 'egg', 'eggs',
  ],
  'Meat & Seafood': [
    'chicken', 'beef', 'pork', 'turkey', 'lamb', 'veal', 'bison', 'duck', 'steak', 'ground beef',
    'ground turkey', 'ground pork', 'bacon', 'sausage', 'ham', 'salami', 'prosciutto', 'pepperoni',
    'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'halibut', 'mahi', 'crab', 'lobster', 'scallop',
    'clam', 'mussel', 'oyster', 'sardine', 'anchovy', 'trout', 'catfish', 'fish', 'filet mignon',
    'ribeye', 'sirloin', 'tenderloin', 'chuck', 'brisket', 'ribs', 'wing', 'thigh', 'breast',
    'drumstick',
  ],
  'Pantry': [
    'rice', 'pasta', 'noodle', 'flour', 'sugar', 'salt', 'oil', 'olive oil', 'coconut oil',
    'vegetable oil', 'vinegar', 'soy sauce', 'balsamic', 'honey', 'maple syrup', 'molasses',
    'cereal', 'oat', 'oatmeal', 'granola', 'quinoa', 'couscous', 'barley', 'lentil', 'bean',
    'chickpea', 'black bean', 'kidney bean', 'pinto bean', 'canned', 'broth', 'stock', 'soup',
    'tomato sauce', 'tomato paste', 'salsa', 'hot sauce', 'ketchup', 'mustard', 'mayonnaise',
    'peanut butter', 'almond butter', 'jam', 'jelly', 'nutella', 'chocolate', 'cocoa', 'vanilla',
    'baking soda', 'baking powder', 'yeast', 'cornstarch', 'breadcrumb', 'crouton', 'nut',
    'almond', 'walnut', 'pecan', 'cashew', 'peanut', 'pistachio', 'seed', 'chia', 'flax',
    'sunflower', 'sesame', 'coconut', 'dried fruit', 'raisin', 'cranberry', 'spice', 'cinnamon',
    'cumin', 'paprika', 'turmeric', 'oregano', 'chili powder', 'curry', 'bay leaf', 'nutmeg',
    'clove', 'cardamom', 'coriander', 'black pepper', 'red pepper', 'garlic powder', 'onion powder',
    'tortilla', 'wrap', 'taco shell', 'cracker', 'chip',
  ],
  'Bakery': [
    'bread', 'bagel', 'muffin', 'croissant', 'roll', 'baguette', 'pita', 'naan', 'bun', 'cake',
    'pie', 'pastry', 'donut', 'cookie', 'brownie', 'scone', 'danish', 'sourdough', 'rye',
    'brioche', 'english muffin', 'flatbread', 'cornbread',
  ],
  'Frozen': [
    'frozen', 'ice cream', 'popsicle', 'frozen pizza', 'frozen dinner', 'frozen vegetable',
    'frozen fruit', 'frozen waffle', 'frozen fish', 'frozen chicken', 'sorbet', 'gelato',
  ],
  'Beverages': [
    'juice', 'water', 'soda', 'coffee', 'tea', 'kombucha', 'smoothie', 'lemonade', 'coconut water',
    'almond milk', 'oat milk', 'soy milk', 'energy drink', 'sparkling water', 'seltzer', 'wine',
    'beer', 'cider',
  ],
  'Snacks': [
    'chips', 'popcorn', 'pretzel', 'trail mix', 'granola bar', 'protein bar', 'jerky', 'dried',
    'rice cake', 'fruit snack', 'gummy', 'candy',
  ],
  'Condiments': [
    'dressing', 'ranch', 'marinade', 'bbq sauce', 'teriyaki', 'worcestershire', 'fish sauce',
    'oyster sauce', 'hoisin', 'sriracha', 'tahini', 'hummus', 'guacamole', 'relish', 'chutney',
    'pickle', 'olive', 'caper', 'anchovy paste',
  ],
  'Pet Food': [
    'dog food', 'cat food', 'kibble', 'pet treat', 'dog treat', 'cat treat', 'pet food',
  ],
};

function categorizeGroceryItem(itemName: string): string {
  const lower = itemName.toLowerCase();
  for (const [category, keywords] of Object.entries(GROCERY_CATEGORY_MAP)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return category;
    }
  }
  return 'Other';
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
    created,
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
    where: { itemName_storeName: { itemName: item.itemName, storeName } },
    update: { aisleLocation },
    create: { itemName: item.itemName, storeName, aisleLocation },
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
