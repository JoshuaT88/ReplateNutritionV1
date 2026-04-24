import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as pantryService from '../services/pantry.service.js';
import { firstParam } from '../utils/http.js';
import { logActivity } from '../services/activity.service.js';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const items = await pantryService.getPantryItems(req.user!.userId);
  res.json(items);
});

router.get('/expiring', authenticate, async (req: AuthRequest, res: Response) => {
  const days = parseInt(firstParam(req.query.days as string | string[] | undefined) || '3', 10);
  const items = await pantryService.getExpiringItems(req.user!.userId, days);
  res.json(items);
});

router.post('/check', authenticate, async (req: AuthRequest, res: Response) => {
  const { itemNames } = req.body as { itemNames: string[] };
  if (!Array.isArray(itemNames)) return res.status(400).json({ error: 'itemNames array required' });
  const result = await pantryService.checkPantryForItems(req.user!.userId, itemNames);
  res.json(result);
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const item = await pantryService.addPantryItem(req.user!.userId, req.body);
  logActivity({ userId: req.user!.userId, entityType: 'pantry', entityId: item.id, action: 'updated', metadata: { itemName: item.itemName, change: 'added' } }).catch(() => {});
  res.status(201).json(item);
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const item = await pantryService.updatePantryItem(req.user!.userId, firstParam(req.params.id)!, req.body);
    logActivity({ userId: req.user!.userId, entityType: 'pantry', entityId: item.id, action: 'updated', metadata: { itemName: item.itemName, change: 'edited' } }).catch(() => {});
    res.json(item);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  await pantryService.deletePantryItem(req.user!.userId, firstParam(req.params.id)!);
  res.json({ success: true });
});

export default router;
