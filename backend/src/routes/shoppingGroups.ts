import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import { firstParam } from '../utils/http.js';

const router = Router();

// Get all groups for user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const groups = await prisma.shoppingListGroup.findMany({
    where: { userId: req.user!.userId },
    include: { _count: { select: { items: true } } },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });
  res.json(groups);
});

// Create group
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { name, storeName, storeAddress, isDefault } = req.body as {
    name: string; storeName?: string; storeAddress?: string; isDefault?: boolean;
  };
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  // If setting as default, unset others
  if (isDefault) {
    await prisma.shoppingListGroup.updateMany({
      where: { userId: req.user!.userId },
      data: { isDefault: false },
    });
  }

  const group = await prisma.shoppingListGroup.create({
    data: { userId: req.user!.userId, name, storeName, storeAddress, isDefault: isDefault ?? false },
  });
  res.status(201).json(group);
});

// Update group
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const id = firstParam(req.params.id)!;
  const existing = await prisma.shoppingListGroup.findFirst({ where: { id, userId: req.user!.userId } });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { name, storeName, storeAddress, isDefault } = req.body;

  if (isDefault) {
    await prisma.shoppingListGroup.updateMany({
      where: { userId: req.user!.userId, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.shoppingListGroup.update({
    where: { id },
    data: { name, storeName, storeAddress, isDefault },
  });
  res.json(updated);
});

// Delete group (items become ungrouped)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const id = firstParam(req.params.id)!;
  await prisma.shoppingListGroup.deleteMany({ where: { id, userId: req.user!.userId } });
  res.json({ success: true });
});

// Get items for a specific group
router.get('/:id/items', authenticate, async (req: AuthRequest, res: Response) => {
  const id = firstParam(req.params.id)!;
  const items = await prisma.shoppingList.findMany({
    where: { userId: req.user!.userId, listGroupId: id },
    orderBy: [{ checked: 'asc' }, { category: 'asc' }, { createdAt: 'desc' }],
  });
  res.json(items);
});

// Move item to different group
router.put('/items/:itemId/move', authenticate, async (req: AuthRequest, res: Response) => {
  const itemId = firstParam(req.params.itemId)!;
  const { listGroupId } = req.body as { listGroupId: string | null };

  const item = await prisma.shoppingList.findFirst({
    where: { id: itemId, userId: req.user!.userId },
  });
  if (!item) return res.status(404).json({ error: 'Not found' });

  const updated = await prisma.shoppingList.update({
    where: { id: itemId },
    data: { listGroupId: listGroupId || null },
  });
  res.json(updated);
});

/**
 * GET /api/shopping-groups/recommend-store?zipCode=XXXXX
 *
 * Returns stores ranked by affordability based on crowd-sourced
 * StoreItemAverage data for the user's current shopping list items.
 * Falls back to AisleLocation coverage as a secondary signal.
 */
router.get('/recommend-store', authenticate, async (req: AuthRequest, res: Response) => {
  const zipCode = firstParam(req.query.zipCode as string | string[] | undefined);
  const listGroupId = firstParam(req.query.listGroupId as string | string[] | undefined) || undefined;

  // Get the user's current unchecked items
  const items = await prisma.shoppingList.findMany({
    where: {
      userId: req.user!.userId,
      checked: false,
      ...(listGroupId ? { listGroupId } : {}),
    },
    select: { itemName: true },
  });

  if (items.length === 0) return res.json([]);

  const itemNames = items.map((i) => i.itemName);
  const zipRegion = zipCode ? zipCode.substring(0, 3) : '';

  // Get all price data for these items in this zip region
  const priceData = await prisma.storeItemAverage.findMany({
    where: {
      itemName: { in: itemNames },
      zipRegion: { startsWith: zipRegion },
    },
  });

  // Also get aisle coverage (signals that a store stocks the item)
  const aisleData = await prisma.aisleLocation.findMany({
    where: {
      itemName: { in: itemNames },
      zipRegion: { startsWith: zipRegion },
      confidenceScore: { gte: 0.4 },
    },
    select: { storeName: true, itemName: true, confidenceScore: true },
  });

  // Build per-store scores
  const storeMap = new Map<string, {
    storeName: string;
    totalCost: number;
    itemsCovered: number;
    avgConfidence: number;
    priceCount: number;
  }>();

  for (const p of priceData) {
    const key = p.storeName;
    if (!storeMap.has(key)) {
      storeMap.set(key, { storeName: p.storeName, totalCost: 0, itemsCovered: 0, avgConfidence: 0, priceCount: 0 });
    }
    const s = storeMap.get(key)!;
    s.totalCost += p.avgPrice;
    s.itemsCovered += 1;
    s.priceCount += 1;
  }

  // Add aisle coverage bonus
  for (const a of aisleData) {
    if (!storeMap.has(a.storeName)) {
      storeMap.set(a.storeName, { storeName: a.storeName, totalCost: 0, itemsCovered: 0, avgConfidence: 0, priceCount: 0 });
    }
    const s = storeMap.get(a.storeName)!;
    s.itemsCovered = Math.max(s.itemsCovered, s.itemsCovered + (s.priceCount === 0 ? 0.5 : 0));
    s.avgConfidence += a.confidenceScore;
  }

  const totalItems = itemNames.length;

  const ranked = [...storeMap.values()]
    .map((s) => ({
      storeName: s.storeName,
      estimatedTotal: s.totalCost,
      itemsCovered: s.itemsCovered,
      coveragePct: Math.round((s.itemsCovered / totalItems) * 100),
      avgConfidence: s.priceCount > 0 ? Math.round((s.avgConfidence / s.priceCount) * 100) / 100 : null,
      dataPoints: s.priceCount,
    }))
    .filter((s) => s.itemsCovered >= Math.min(3, totalItems * 0.2))
    .sort((a, b) => {
      // Primary: coverage; Secondary: cost
      if (b.itemsCovered !== a.itemsCovered) return b.itemsCovered - a.itemsCovered;
      return a.estimatedTotal - b.estimatedTotal;
    })
    .slice(0, 5);

  res.json({ recommendations: ranked, itemCount: totalItems });
});

export default router;
