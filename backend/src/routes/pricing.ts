import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as pricingService from '../services/pricing.service.js';
import { firstParam } from '../utils/http.js';

const router = Router();
router.use(authenticate);

router.post('/submit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const submission = await pricingService.submitPrice(req.user!.userId, req.body);
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
