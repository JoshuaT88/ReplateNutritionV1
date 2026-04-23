import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { saveSubscription, removeSubscription, getVapidPublicKey, pushConfigured } from '../services/push.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Public: get VAPID public key (needed by service worker to subscribe)
router.get('/vapid-public-key', (_req, res) => {
  if (!pushConfigured()) {
    return res.json({ configured: false, publicKey: null });
  }
  res.json({ configured: true, publicKey: getVapidPublicKey() });
});

router.use(authenticate);

// POST /api/push/subscribe
router.post('/subscribe', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new AppError(400, 'endpoint and keys (p256dh, auth) are required');
    }
    const sub = await saveSubscription(req.user!.userId, { endpoint, keys });
    res.status(201).json({ success: true, id: sub.id });
  } catch (err) { next(err); }
});

// DELETE /api/push/subscribe
router.delete('/subscribe', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) throw new AppError(400, 'endpoint is required');
    await removeSubscription(endpoint);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
