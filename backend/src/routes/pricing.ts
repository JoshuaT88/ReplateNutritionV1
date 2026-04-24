import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as pricingService from '../services/pricing.service.js';
import { firstParam } from '../utils/http.js';

const router = Router();
router.use(authenticate);

const safeString = (max: number) =>
  z.string().min(1).max(max).regex(/^[\p{L}\p{N}\s\-.,/()'&%#!]+$/u);

const priceSubmitSchema = z.object({
  itemName: safeString(150),
  storeName: safeString(100),
  zipRegion: z.string().min(1).max(20).regex(/^[a-zA-Z0-9\s\-]+$/),
  actualPrice: z.number().nonnegative().max(9999),
  unit: z.string().max(30).optional(),
  salePrice: z.number().nonnegative().max(9999).optional(),
  notes: z.string().max(500).optional(),
});

router.post('/submit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = priceSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid submission data', details: parsed.error.flatten() });
      return;
    }
    const submission = await pricingService.submitPrice(req.user!.userId, parsed.data);
    res.status(201).json(submission);
  } catch (err) { next(err); }
});

router.get('/estimate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { itemName, storeName, zipRegion } = req.query;
    const estimate = await pricingService.getEstimate(
      itemName as string,
      storeName as string,
      zipRegion as string
    );
    res.json(estimate);
  } catch (err) { next(err); }
});

router.get('/stores/:storeName/items/:itemName', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const storeName = firstParam(req.params.storeName);
    const itemName = firstParam(req.params.itemName);
    const data = await pricingService.getStoreItemPrice(storeName!, itemName!);
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
