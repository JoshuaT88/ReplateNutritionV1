import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as shoppingService from '../services/shopping.service.js';
import { firstParam } from '../utils/http.js';

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
    const history = await shoppingService.endShoppingSession(req.user!.userId, sessionId!);
    res.json(history);
  } catch (err) { next(err); }
});

export default router;
