import prisma from '../config/database.js';
import { categorizeItem } from '../data/groceryReferenceData.js';

export async function getPantryItems(userId: string) {
  const items = await prisma.pantryItem.findMany({
    where: { userId },
    orderBy: [{ expiresAt: 'asc' }, { category: 'asc' }, { itemName: 'asc' }],
  });

  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  return items.map((item) => ({
    ...item,
    isExpiringSoon: item.expiresAt ? item.expiresAt <= threeDays && item.expiresAt >= now : false,
    isExpired: item.expiresAt ? item.expiresAt < now : false,
  }));
}

export async function addPantryItem(userId: string, data: {
  itemName: string;
  category?: string;
  quantity?: string;
  unit?: string;
  expiresAt?: string;
  purchasedAt?: string;
  notes?: string;
  lowStockAlert?: boolean;
}) {
  const category = data.category || categorizeItem(data.itemName) || 'Other';
  return prisma.pantryItem.create({
    data: {
      userId,
      itemName: data.itemName,
      category,
      quantity: data.quantity,
      unit: data.unit,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      purchasedAt: data.purchasedAt ? new Date(data.purchasedAt) : new Date(),
      notes: data.notes,
      lowStockAlert: data.lowStockAlert ?? false,
    },
  });
}

export async function updatePantryItem(userId: string, itemId: string, data: Partial<{
  itemName: string;
  category: string;
  quantity: string;
  unit: string;
  expiresAt: string | null;
  purchasedAt: string;
  notes: string;
  lowStockAlert: boolean;
}>) {
  const item = await prisma.pantryItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new Error('Not found');

  return prisma.pantryItem.update({
    where: { id: itemId },
    data: {
      ...(data.itemName && { itemName: data.itemName }),
      ...(data.category && { category: data.category }),
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }),
      ...(data.purchasedAt && { purchasedAt: new Date(data.purchasedAt) }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.lowStockAlert !== undefined && { lowStockAlert: data.lowStockAlert }),
    },
  });
}

export async function deletePantryItem(userId: string, itemId: string) {
  await prisma.pantryItem.deleteMany({ where: { id: itemId, userId } });
}

export async function addPantryItemsFromShopping(userId: string, items: { itemName: string; category?: string | null; quantity?: string | null }[]) {
  const now = new Date();
  await prisma.pantryItem.createMany({
    data: items.map((i) => ({
      userId,
      itemName: i.itemName,
      category: i.category || categorizeItem(i.itemName) || 'Other',
      quantity: i.quantity ?? null,
      purchasedAt: now,
    })),
    skipDuplicates: false,
  });
}

/** Check which shopping list items the user already has in pantry */
export async function checkPantryForItems(userId: string, itemNames: string[]) {
  const normalized = itemNames.map((n) => n.toLowerCase().trim());
  const pantry = await prisma.pantryItem.findMany({
    where: { userId },
    select: { itemName: true, quantity: true },
  });
  const pantrySet = new Set(pantry.map((p) => p.itemName.toLowerCase().trim()));
  return itemNames.map((name) => ({
    itemName: name,
    inPantry: pantrySet.has(name.toLowerCase().trim()),
  }));
}

/** Get items expiring soon (within N days) */
export async function getExpiringItems(userId: string, days = 3) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return prisma.pantryItem.findMany({
    where: {
      userId,
      expiresAt: { not: null, lte: cutoff },
    },
    orderBy: { expiresAt: 'asc' },
  });
}
