import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { firstParam } from '../utils/http.js';

const router = Router();

// ─── Public: resolve share token (no auth) ────────────────────────────────

router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = firstParam(req.params.token);
    if (!token) throw new AppError(400, 'Token is required');

    const share = await prisma.shareToken.findUnique({ where: { token } });
    if (!share) throw new AppError(404, 'Share link not found or expired');
    if (share.expiresAt < new Date()) throw new AppError(410, 'Share link has expired');

    res.json({ snapshot: share.snapshot, createdAt: share.createdAt, expiresAt: share.expiresAt });
  } catch (err) { next(err); }
});

// ─── Authenticated: create share token ────────────────────────────────────

router.use(authenticate);

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const items = await prisma.shoppingList.findMany({
      where: { userId, checked: false },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });

    if (!items.length) throw new AppError(400, 'No unchecked items to share');

    // Expire in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const share = await prisma.shareToken.create({
      data: {
        userId,
        snapshot: items as any,
        expiresAt,
      },
    });

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${share.token}`;
    res.status(201).json({ token: share.token, url: shareUrl, expiresAt: share.expiresAt });
  } catch (err) { next(err); }
});

router.delete('/:token', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = firstParam(req.params.token);
    await prisma.shareToken.deleteMany({ where: { token, userId: req.user!.userId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
