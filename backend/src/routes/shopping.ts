import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as shoppingService from '../services/shopping.service.js';
import { searchNearbyStores, searchStoresByName, searchStoresByNameAndLocation, searchPreferredStoresByCityState } from '../services/store.service.js';
import { firstParam } from '../utils/http.js';
import prisma from '../config/database.js';
import { logActivity } from '../services/activity.service.js';
import { isKrogerStore, findKrogerLocationId, searchKrogerProducts } from '../services/kroger.service.js';

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
    const { profileIds, days, assignedStore } = req.body;
    const items = await shoppingService.generateFromMealPlans(req.user!.userId, profileIds, days || 7, assignedStore);
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

// POST /shopping/find-other-stores — search stores by name + radius (no shopping list required)
router.post('/find-other-stores', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeName, radiusLabel, originZip, originCityState } = req.body;
    if (!storeName?.trim()) { res.status(400).json({ error: 'storeName is required' }); return; }
    if (!radiusLabel) { res.status(400).json({ error: 'radiusLabel is required' }); return; }
    // Fall back to user saved zip if no origin provided
    let resolvedZip = originZip;
    if (!resolvedZip && !originCityState) {
      const prefs = await prisma.userPreferences.findUnique({ where: { userId: req.user!.userId } });
      resolvedZip = prefs?.zipCode || undefined;
    }
    const results = await searchStoresByNameAndLocation({ storeName: storeName.trim(), radiusLabel, originZip: resolvedZip, originCityState });
    res.json(results);
  } catch (err) { next(err); }
});

// GET /shopping/saved-stores — list user's saved stores
router.get('/saved-stores', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stores = await prisma.savedStore.findMany({
      where: { userId: req.user!.userId },
      orderBy: [{ isPreferred: 'desc' }, { name: 'asc' }],
    });
    res.json(stores);
  } catch (err) { next(err); }
});

// POST /shopping/saved-stores — save a store
router.post('/saved-stores', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, address, city, state, zipCode, placeId, lat, lng, distance, isPreferred, taxRate, source } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const store = await prisma.savedStore.upsert({
      where: { userId_name: { userId: req.user!.userId, name: name.trim() } },
      create: {
        userId: req.user!.userId,
        name: name.trim(), address, city, state, zipCode, placeId,
        lat: lat ?? null, lng: lng ?? null, distance: distance ?? null,
        isPreferred: isPreferred ?? false,
        taxRate: taxRate ?? null,
        source: source ?? 'search',
        lastVerified: new Date(),
      },
      update: {
        address, city, state, zipCode, placeId,
        lat: lat ?? undefined, lng: lng ?? undefined, distance: distance ?? undefined,
        isPreferred: isPreferred ?? undefined,
        taxRate: taxRate ?? undefined,
        source: source ?? undefined,
        lastVerified: new Date(),
      },
    });
    res.status(201).json(store);
  } catch (err) { next(err); }
});

// PATCH /shopping/saved-stores/:id — update a saved store (e.g. toggle preferred)
router.patch('/saved-stores/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id)!;
    const existing = await prisma.savedStore.findFirst({ where: { id, userId: req.user!.userId } });
    if (!existing) { res.status(404).json({ error: 'Store not found' }); return; }
    const { isPreferred, aisleData, priceData, taxRate } = req.body;
    const store = await prisma.savedStore.update({
      where: { id },
      data: {
        ...(isPreferred !== undefined && { isPreferred }),
        ...(aisleData !== undefined && { aisleData }),
        ...(priceData !== undefined && { priceData }),
        ...(taxRate !== undefined && { taxRate }),
      },
    });
    res.json(store);
  } catch (err) { next(err); }
});

// DELETE /shopping/saved-stores/:id
router.delete('/saved-stores/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id)!;
    const existing = await prisma.savedStore.findFirst({ where: { id, userId: req.user!.userId } });
    if (!existing) { res.status(404).json({ error: 'Store not found' }); return; }
    await prisma.savedStore.delete({ where: { id } });
    res.json({ success: true });
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
    const { itemName, quantity, category, notes, dealNote } = req.body;
    if (!itemName?.trim()) {
      res.status(400).json({ error: 'itemName is required' }); return;
    }
    // Add to the user's shopping list first, then the session picks it up on next refresh
    const item = await shoppingService.addShoppingItem(req.user!.userId, {
      itemName: itemName.trim(),
      quantity: quantity || null,
      category: category || null,
      notes: notes || null,
      dealNote: dealNote || null,
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

// T70: Kroger live product search — GET /api/shopping/kroger-products?storeName=X&zipCode=Y&itemName=Z
router.get('/kroger-products', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const storeName = firstParam(req.query.storeName as string | string[] | undefined) || '';
    const zipCode = firstParam(req.query.zipCode as string | string[] | undefined) || '';
    const itemName = firstParam(req.query.itemName as string | string[] | undefined) || '';

    if (!isKrogerStore(storeName)) {
      return res.json({ supported: false, reason: 'not_kroger' });
    }
    if (!zipCode || !itemName) {
      return res.json({ supported: true, products: [] });
    }

    const locationId = await findKrogerLocationId(zipCode);
    if (!locationId) {
      return res.json({ supported: true, locationId: null, products: [] });
    }

    const products = await searchKrogerProducts(itemName, locationId);
    res.json({ supported: true, locationId, products });
  } catch (err) { next(err); }
});

// T71: Check if store name is a Kroger-family banner — GET /api/shopping/kroger-check?storeName=X
router.get('/kroger-check', async (req: AuthRequest, res: Response) => {
  const storeName = firstParam(req.query.storeName as string | string[] | undefined) || '';
  res.json({ isKroger: isKrogerStore(storeName) });
});

// Bug 7: Search stores by name (for preferred stores in Settings) — GET /api/shopping/search-stores?q=Walmart
router.get('/search-stores', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = firstParam(req.query.q as string | string[] | undefined) || '';
    if (!q.trim()) { res.json([]); return; }
    const results = await searchStoresByName(q.trim());
    res.json(results ?? []);
  } catch (err) { next(err); }
});

// POST /shopping/preferred-store-search — Settings-side store search (requires city/state/zip, optional store name scope)
router.post('/preferred-store-search', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { cityStateZip, storeName } = req.body;
    if (!cityStateZip?.trim()) { res.status(400).json({ error: 'cityStateZip is required' }); return; }
    const results = await searchPreferredStoresByCityState({ cityStateZip: cityStateZip.trim(), storeName: storeName?.trim() });
    res.json(results ?? []);
  } catch (err) { next(err); }
});

// GET /api/shopping/stores-by-zip?zip=... — nearby stores by ZIP, no shopping list required
router.get('/stores-by-zip', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const zip = firstParam(req.query.zip as string | string[] | undefined) || '';
    if (!/^\d{5}$/.test(zip)) { res.json([]); return; }
    const stores = await searchNearbyStores(zip);
    res.json((stores ?? []).map((s) => ({ name: s.name, address: s.address })));
  } catch (err) { next(err); }
});

export default router;

