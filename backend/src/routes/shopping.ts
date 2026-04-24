import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as shoppingService from '../services/shopping.service.js';
import { searchNearbyStores } from '../services/store.service.js';
import { firstParam } from '../utils/http.js';
import prisma from '../config/database.js';
import { logActivity } from '../services/activity.service.js';

const router = Router();
router.use(authenticate);

router.get('/list', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await shoppingService.getShoppingList(req.user!.userId);
    res.json(items);
  } catch (err) { next(err); }
});

router.post('/list', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const item = await shoppingService.addShoppingItem(req.user!.userId, req.body);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.put('/list/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const itemId = firstParam(req.params.id);
    const item = await shoppingService.updateShoppingItem(req.user!.userId, itemId!, req.body);
    res.json(item);
  } catch (err) { next(err); }
});

router.delete('/list/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const itemId = firstParam(req.params.id);
    await shoppingService.deleteShoppingItem(req.user!.userId, itemId!);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/generate-from-meals', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { profileIds, days } = req.body;
    const items = await shoppingService.generateFromMealPlans(req.user!.userId, profileIds, days || 7);
    res.status(201).json(items);
  } catch (err) { next(err); }
});

router.post('/add-ingredients', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await shoppingService.addIngredientsToList(req.user!.userId, req.body);
    res.status(201).json(items);
  } catch (err) { next(err); }
});

router.post('/find-stores', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { zipCode } = req.body;
    const stores = await shoppingService.findStores(req.user!.userId, zipCode);
    res.json(stores);
  } catch (err) { next(err); }
});

router.post('/session', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeName } = req.body;
    const session = await shoppingService.startShoppingSession(req.user!.userId, storeName);
    logActivity({ userId: req.user!.userId, entityType: 'session', entityId: session.id, action: 'started', metadata: { storeName } }).catch(() => {});
    res.status(201).json(session);
  } catch (err) { next(err); }
});

router.get('/session/:sessionId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = firstParam(req.params.sessionId);
    const session = await shoppingService.getShoppingSession(req.user!.userId, sessionId!);
    res.json(session);
  } catch (err) { next(err); }
});

router.put('/session/:sessionId/items/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = firstParam(req.params.sessionId);
    const itemId = firstParam(req.params.itemId);
    const result = await shoppingService.updateSessionItem(
      req.user!.userId, sessionId!, itemId!, req.body
    );
    if (req.body.status) {
      logActivity({ userId: req.user!.userId, entityType: 'shopping_item', entityId: itemId!, action: 'checked_off', metadata: { status: req.body.status, sessionId } }).catch(() => {});
    }
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/session/:sessionId/items/:itemId/price', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { price } = req.body;
    const sessionId = firstParam(req.params.sessionId);
    const itemId = firstParam(req.params.itemId);
    const result = await shoppingService.submitSessionPrice(
      req.user!.userId, sessionId!, itemId!, price
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/session/:sessionId/items/:itemId/aisle', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { aisle } = req.body;
    const sessionId = firstParam(req.params.sessionId);
    const itemId = firstParam(req.params.itemId);
    const result = await shoppingService.saveAisleLocation(
      req.user!.userId, sessionId!, itemId!, aisle
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/session/:sessionId/end', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = firstParam(req.params.sessionId);
    const durationSeconds = typeof req.body.durationSeconds === 'number' ? req.body.durationSeconds : undefined;
    const history = await shoppingService.endShoppingSession(req.user!.userId, sessionId!, durationSeconds);
    logActivity({ userId: req.user!.userId, entityType: 'session', entityId: sessionId!, action: 'ended', metadata: { durationSeconds, totalSpend: history.actualCost } }).catch(() => {});
    res.json(history);
  } catch (err) { next(err); }
});

router.post('/session/:sessionId/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = firstParam(req.params.sessionId);
    await shoppingService.cancelShoppingSession(req.user!.userId, sessionId!);
    logActivity({ userId: req.user!.userId, entityType: 'session', entityId: sessionId!, action: 'cancelled' }).catch(() => {});
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /shopping/session/:sessionId/add-item — add an item mid-session
router.post('/session/:sessionId/add-item', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = firstParam(req.params.sessionId);
    const { itemName, quantity, category, notes } = req.body;
    if (!itemName?.trim()) {
      res.status(400).json({ error: 'itemName is required' }); return;
    }
    // Add to the user's shopping list first, then the session picks it up on next refresh
    const item = await shoppingService.addShoppingItem(req.user!.userId, {
      itemName: itemName.trim(),
      quantity: quantity || null,
      category: category || null,
      notes: notes || null,
      priority: 'MEDIUM',
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

/**
 * GET /api/shopping/reorder-suggestions
 *
 * Analyzes shopping history to detect items purchased on a recurring basis.
 * Items appearing in >= 2 trips and last seen >= 7 days ago are surfaced.
 */
router.get('/reorder-suggestions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const histories = await prisma.shoppingHistory.findMany({
      where: { userId: req.user!.userId },
      orderBy: { shoppingDate: 'desc' },
      take: 30,
      select: { shoppingDate: true, itemsPickedUp: true },
    });

    const itemStats = new Map<string, { itemName: string; category: string | null; count: number; lastSeen: Date }>();

    for (const history of histories) {
      const sessionDate = history.shoppingDate;
      const items = Array.isArray(history.itemsPickedUp) ? history.itemsPickedUp : [];
      for (const item of items as any[]) {
        const name = item?.itemName || item?.name;
        if (!name) continue;
        const key = name.toLowerCase().trim();
        const existing = itemStats.get(key);
        if (!existing) {
          itemStats.set(key, { itemName: name, category: item?.category || null, count: 1, lastSeen: sessionDate });
        } else {
          existing.count += 1;
          if (sessionDate > existing.lastSeen) existing.lastSeen = sessionDate;
        }
      }
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const suggestions = [...itemStats.values()]
      .filter((s) => s.count >= 2 && s.lastSeen <= sevenDaysAgo)
      .sort((a, b) => b.count - a.count || a.lastSeen.getTime() - b.lastSeen.getTime())
      .slice(0, 10)
      .map((s) => ({
        itemName: s.itemName,
        category: s.category,
        purchaseCount: s.count,
        lastPurchased: s.lastSeen,
        daysSinceLastPurchase: Math.floor((now.getTime() - s.lastSeen.getTime()) / (24 * 60 * 60 * 1000)),
      }));

    res.json(suggestions);
  } catch (err) { next(err); }
});

// Search nearby grocery stores (T17 — preferred store selector)
router.get('/stores', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = firstParam(req.query.q as string | string[] | undefined);
    if (!query) return res.json([]);
    const results = await searchNearbyStores(query);
    res.json(results);
  } catch (err) { next(err); }
});

export default router;
