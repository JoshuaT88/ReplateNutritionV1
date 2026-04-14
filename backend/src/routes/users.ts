import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

router.put('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fullName } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { fullName },
      select: { id: true, email: true, fullName: true, role: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

router.get('/me/preferences', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let prefs = await prisma.userPreferences.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!prefs) {
      prefs = await prisma.userPreferences.create({
        data: { userId: req.user!.userId },
      });
    }
    res.json(prefs);
  } catch (err) { next(err); }
});

router.put('/me/preferences', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: req.user!.userId },
      update: req.body,
      create: { userId: req.user!.userId, ...req.body },
    });
    res.json(prefs);
  } catch (err) { next(err); }
});

router.put('/me/password', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw new AppError(404, 'User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError(400, 'Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/me/export', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const [user, preferences, profiles, recommendations, mealPlans, shoppingList, shoppingHistory] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true, createdAt: true } }),
      prisma.userPreferences.findUnique({ where: { userId } }),
      prisma.profile.findMany({ where: { userId } }),
      prisma.recommendation.findMany({ where: { userId } }),
      prisma.mealPlan.findMany({ where: { userId } }),
      prisma.shoppingList.findMany({ where: { userId } }),
      prisma.shoppingHistory.findMany({ where: { userId } }),
    ]);
    res.json({ user, preferences, profiles, recommendations, mealPlans, shoppingList, shoppingHistory, exportedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});

router.delete('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.user.delete({ where: { id: req.user!.userId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
