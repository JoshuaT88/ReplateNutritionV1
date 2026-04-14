import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import * as aiService from '../services/ai.service.js';

const router = Router();
router.use(authenticate);

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

    const existing = await prisma.aisleLocation.findUnique({
      where: { itemName_storeName: { itemName, storeName } },
    });

    if (existing) {
      const updated = await prisma.aisleLocation.update({
        where: { id: existing.id },
        data: {
          aisleLocation,
          verifiedCount: existing.verifiedCount + 1,
          lastVerifiedDate: new Date(),
        },
      });
      res.json(updated);
    } else {
      const created = await prisma.aisleLocation.create({
        data: { itemName, storeName, aisleLocation, createdBy: req.user!.userId },
      });
      res.status(201).json(created);
    }
  } catch (err) { next(err); }
});

router.post('/predict', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { itemName, storeName } = req.body;

    // Check DB first
    const existing = await prisma.aisleLocation.findUnique({
      where: { itemName_storeName: { itemName, storeName } },
    });

    if (existing) {
      res.json({ aisle: existing.aisleLocation, source: 'verified', verifiedCount: existing.verifiedCount });
      return;
    }

    // Fall back to AI prediction
    const aisle = await aiService.predictAisleLocation(itemName, storeName);
    res.json({ aisle, source: 'ai_prediction' });
  } catch (err) { next(err); }
});

export default router;
