import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { firstParam } from '../utils/http.js';

const router = Router();
router.use(authenticate);

// GET /api/macros?date=YYYY-MM-DD&profileId=xxx  (defaults to today)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const dateStr = firstParam(req.query.date as string) || new Date().toISOString().split('T')[0];
    const profileId = firstParam(req.query.profileId as string) || undefined;
    const date = new Date(dateStr + 'T00:00:00.000Z');
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const logs = await prisma.macroLog.findMany({
      where: {
        userId,
        ...(profileId ? { profileId } : {}),
        date: { gte: date, lt: nextDay },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totals = logs.reduce(
      (acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein || 0),
        carbs: acc.carbs + (log.carbs || 0),
        fat: acc.fat + (log.fat || 0),
        fiber: acc.fiber + (log.fiber || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );

    res.json({ logs, totals, date: dateStr });
  } catch (err) { next(err); }
});

// GET /api/macros/summary?days=7
router.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const days = Math.min(30, parseInt(firstParam(req.query.days as string) || '7', 10));
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const logs = await prisma.macroLog.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    // Group by date string
    const byDate: Record<string, { calories: number; protein: number; carbs: number; fat: number; fiber: number }> = {};
    for (const log of logs) {
      const key = log.date.toISOString().split('T')[0];
      if (!byDate[key]) byDate[key] = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      byDate[key].calories += log.calories || 0;
      byDate[key].protein += log.protein || 0;
      byDate[key].carbs += log.carbs || 0;
      byDate[key].fat += log.fat || 0;
      byDate[key].fiber += log.fiber || 0;
    }

    res.json({ summary: byDate, days });
  } catch (err) { next(err); }
});

// POST /api/macros
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { date, mealName, calories, protein, carbs, fat, fiber, notes, profileId } = req.body;
    if (!mealName) throw new AppError(400, 'mealName is required');

    const dateObj = date ? new Date(date + 'T00:00:00.000Z') : (() => {
      const d = new Date(); d.setHours(0, 0, 0, 0); return d;
    })();

    const log = await prisma.macroLog.create({
      data: {
        userId,
        profileId: profileId || null,
        date: dateObj,
        mealName,
        calories: calories != null ? parseInt(calories, 10) : null,
        protein: protein != null ? parseFloat(protein) : null,
        carbs: carbs != null ? parseFloat(carbs) : null,
        fat: fat != null ? parseFloat(fat) : null,
        fiber: fiber != null ? parseFloat(fiber) : null,
        notes: notes || null,
      },
    });

    res.status(201).json(log);
  } catch (err) { next(err); }
});

// PUT /api/macros/:id
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id)!;
    const userId = req.user!.userId;
    const existing = await prisma.macroLog.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Macro log not found');

    const { mealName, calories, protein, carbs, fat, fiber, notes } = req.body;
    const updated = await prisma.macroLog.update({
      where: { id },
      data: {
        mealName: mealName ?? existing.mealName,
        calories: calories != null ? parseInt(calories, 10) : existing.calories,
        protein: protein != null ? parseFloat(protein) : existing.protein,
        carbs: carbs != null ? parseFloat(carbs) : existing.carbs,
        fat: fat != null ? parseFloat(fat) : existing.fat,
        fiber: fiber != null ? parseFloat(fiber) : existing.fiber,
        notes: notes ?? existing.notes,
      },
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/macros/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id)!;
    const userId = req.user!.userId;
    const existing = await prisma.macroLog.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Macro log not found');
    await prisma.macroLog.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
