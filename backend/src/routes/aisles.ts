import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import * as aiService from '../services/ai.service.js';
import { logInfo } from '../services/monitoring.service.js';
import { seedAislesFromKroger, findKrogerStores, krogerConfigured } from '../services/kroger.service.js';
import { firstParam } from '../utils/http.js';

const router = Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// Self-healing threshold: if 10 users report the SAME new aisle for an item,
// automatically promote that new value as the canonical location.
// ---------------------------------------------------------------------------
const SELF_HEAL_THRESHOLD = 10;

/**
 * Tracks pending corrections: Map<`${itemName}::${storeName}::${newAisle}`, count>
 * When count reaches SELF_HEAL_THRESHOLD, the DB record is updated.
 */
const pendingCorrections = new Map<string, number>();

async function recordAisleCorrection(
  itemName: string,
  storeName: string,
  zipRegion: string,
  newAisle: string
) {
  const key = `${itemName}::${storeName}::${zipRegion}::${newAisle}`;
  const count = (pendingCorrections.get(key) ?? 0) + 1;
  pendingCorrections.set(key, count);

  if (count >= SELF_HEAL_THRESHOLD) {
    pendingCorrections.delete(key);
    // Upsert the now-confirmed correction
    await prisma.aisleLocation.upsert({
      where: { itemName_storeName_zipRegion: { itemName, storeName, zipRegion } },
      update: { aisleLocation: newAisle, verifiedCount: { increment: SELF_HEAL_THRESHOLD }, lastVerifiedDate: new Date() },
      create: { itemName, storeName, zipRegion, aisleLocation: newAisle, verifiedCount: SELF_HEAL_THRESHOLD },
    });
    logInfo(`[Aisle Self-Heal] Auto-updated "${itemName}" at ${storeName} → "${newAisle}" after ${SELF_HEAL_THRESHOLD} confirmations`);
  }
}

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { itemName, storeName } = req.query;
    const where: any = {};
    if (itemName) where.itemName = itemName;
    if (storeName) where.storeName = storeName;

    const aisles = await prisma.aisleLocation.findMany({ where });
    res.json(aisles);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { itemName, storeName, aisleLocation } = req.body;
    const zipRegion = (req.body.zipRegion || '').toString().slice(0, 5);

    const existing = await prisma.aisleLocation.findUnique({
      where: { itemName_storeName_zipRegion: { itemName, storeName, zipRegion } },
    });

    if (existing) {
      // If the new location differs from the stored one, it's a correction
      if (existing.aisleLocation !== aisleLocation) {
        await recordAisleCorrection(itemName, storeName, zipRegion, aisleLocation);
      }

      const updated = await prisma.aisleLocation.update({
        where: { id: existing.id },
        data: {
          aisleLocation,
          verifiedCount: existing.verifiedCount + 1,
          lastVerifiedDate: new Date(),
        },
      });
      res.json({ ...updated, correctionTracked: existing.aisleLocation !== aisleLocation });
    } else {
      const created = await prisma.aisleLocation.create({
        data: { itemName, storeName, zipRegion, aisleLocation, createdBy: req.user!.userId },
      });
      res.status(201).json(created);
    }
  } catch (err) { next(err); }
});

// POST /api/aisles/correct — lightweight correction endpoint called from shopping session
router.post('/correct', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { itemName, storeName, newAisle, zipRegion: rawZip } = req.body;
    if (!itemName || !storeName || !newAisle) {
      res.status(400).json({ error: 'itemName, storeName, and newAisle are required' });
      return;
    }
    const zipRegion = (rawZip || '').toString().slice(0, 5);
    await recordAisleCorrection(itemName, storeName, zipRegion, newAisle);
    res.json({ success: true, message: 'Correction noted. Thank you for improving the data!' });
  } catch (err) { next(err); }
});

router.post('/predict', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { itemName, storeName } = req.body;
    const zipRegion = (req.body.zipRegion || '').toString().slice(0, 5);

    const existing =
      await prisma.aisleLocation.findUnique({
        where: { itemName_storeName_zipRegion: { itemName, storeName, zipRegion } },
      }) ??
      await prisma.aisleLocation.findFirst({
        where: { itemName, storeName },
        orderBy: { verifiedCount: 'desc' },
      });

    if (existing) {
      res.json({ aisle: existing.aisleLocation, source: 'verified', verifiedCount: existing.verifiedCount });
      return;
    }

    const aisle = await aiService.predictAisleLocation(itemName, storeName);
    res.json({ aisle, source: 'ai_prediction' });
  } catch (err) { next(err); }
});

// POST /api/aisles/seed-kroger — seed aisle data from Kroger API for current shopping list
router.post('/seed-kroger', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!krogerConfigured()) {
      return res.status(503).json({ error: 'Kroger API not configured (KROGER_CLIENT_SECRET missing)' });
    }
    const { zipCode, storeName } = req.body;
    if (!zipCode || !storeName) throw new Error('zipCode and storeName are required');

    const zipRegion = zipCode.toString().slice(0, 5);

    // Find the Kroger location ID that best matches storeName
    const locations = await findKrogerStores(zipRegion, 15);
    const match = locations.find((l) =>
      l.name.toLowerCase().includes(storeName.toLowerCase()) ||
      storeName.toLowerCase().includes(l.name.toLowerCase()) ||
      l.chain.toLowerCase().includes(storeName.toLowerCase())
    );

    if (!match) {
      return res.json({ seeded: 0, message: 'No matching Kroger-family store found in that ZIP code' });
    }

    const result = await seedAislesFromKroger(req.user!.userId, match.locationId, storeName, zipRegion);
    logInfo(`[Kroger Seed] ${result.seeded} aisles seeded for "${storeName}" (${zipRegion})`);
    res.json({ ...result, krogerStoreName: match.name, locationId: match.locationId });
  } catch (err) { next(err); }
});

// GET /api/aisles/kroger-stores?zipCode=XXXXX — find nearby Kroger stores
router.get('/kroger-stores', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const zipCode = firstParam(req.query.zipCode as string);
    if (!zipCode) return res.status(400).json({ error: 'zipCode is required' });
    if (!krogerConfigured()) return res.json([]);
    const stores = await findKrogerStores(zipCode, 15);
    res.json(stores);
  } catch (err) { next(err); }
});

export default router;

