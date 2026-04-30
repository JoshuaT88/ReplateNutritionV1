import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import {
  getNotifications,
  countUnread,
  markRead,
  markAllRead,
} from '../services/inAppNotification.service.js';

const router = Router();

// GET /api/notifications
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const unreadOnly = req.query.unreadOnly === 'true';
  const notifications = await getNotifications(req.user!.userId, unreadOnly);
  const unreadCount = await countUnread(req.user!.userId);
  res.json({ notifications, unreadCount });
});

// GET /api/notifications/count
router.get('/count', authenticate, async (req: AuthRequest, res: Response) => {
  const count = await countUnread(req.user!.userId);
  res.json({ count });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  await markAllRead(req.user!.userId);
  res.json({ success: true });
});

// PATCH /api/notifications/read
router.patch('/read', authenticate, async (req: AuthRequest, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids must be a non-empty array' });
    return;
  }
  await markRead(req.user!.userId, ids);
  res.json({ success: true });
});

export default router;
