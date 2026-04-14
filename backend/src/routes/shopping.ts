import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as shoppingService from '../services/shopping.service.js';

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
    const item = await shoppingService.updateShoppingItem(req.user!.userId, req.params.id, req.body);
    res.json(item);
  } catch (err) { next(err); }
});

router.delete('/list/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await shoppingService.deleteShoppingItem(req.user!.userId, req.params.id);
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
    res.status(201).json(session);
  } catch (err) { next(err); }
});

router.get('/session/:sessionId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await shoppingService.getShoppingSession(req.user!.userId, req.params.sessionId);
    res.json(session);
  } catch (err) { next(err); }
});

router.put('/session/:sessionId/items/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await shoppingService.updateSessionItem(
      req.user!.userId, req.params.sessionId, req.params.itemId, req.body
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/session/:sessionId/items/:itemId/price', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { price } = req.body;
    const result = await shoppingService.submitSessionPrice(
      req.user!.userId, req.params.sessionId, req.params.itemId, price
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/session/:sessionId/end', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const history = await shoppingService.endShoppingSession(req.user!.userId, req.params.sessionId);
    res.json(history);
  } catch (err) { next(err); }
});

export default router;
