import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as mealPlanService from '../services/mealPlan.service.js';
import prisma from '../config/database.js';
import { firstParam } from '../utils/http.js';
import { AppError } from '../middleware/errorHandler.js';
import { logActivity } from '../services/activity.service.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { profileId, startDate, endDate } = req.query;
    const meals = await mealPlanService.getMealPlans(
      req.user!.userId,
      profileId as string,
      startDate as string,
      endDate as string
    );
    res.json(meals);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meal = await mealPlanService.createMealPlan(req.user!.userId, req.body);
    res.status(201).json(meal);
  } catch (err) { next(err); }
});

router.post('/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { profileIds, date, mealTypes, days, dietaryGoals } = req.body;
    const meals = await mealPlanService.generateMealPlan(req.user!.userId, profileIds, date, mealTypes, days || 7, dietaryGoals);
    res.status(201).json(meals);
  } catch (err) { next(err); }
});

// POST /meal-plan/:id/regenerate — regenerate a single meal slot
router.post('/:id/regenerate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mealId = firstParam(req.params.id);
    const meal = await mealPlanService.regenerateSingleMeal(req.user!.userId, mealId!, req.body.dietaryGoals);
    res.json(meal);
  } catch (err) { next(err); }
});

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mealId = firstParam(req.params.id);
    const meal = await mealPlanService.updateMealPlan(req.user!.userId, mealId!, req.body);
    if (req.body.completed === true) {
      logActivity({
        userId: req.user!.userId,
        profileId: meal.profileId ?? undefined,
        entityType: 'meal',
        entityId: mealId!,
        action: 'completed',
        metadata: { mealName: meal.mealName, mealType: meal.mealType, date: meal.date },
      }).catch(() => {});
    }
    res.json(meal);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mealId = firstParam(req.params.id);
    await mealPlanService.deleteMealPlan(req.user!.userId, mealId!);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// === Custom Meals Library ===
router.get('/custom-meals', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meals = await prisma.customMeal.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(meals);
  } catch (err) { next(err); }
});

router.post('/custom-meals', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meal = await prisma.customMeal.create({
      data: { ...req.body, userId: req.user!.userId },
    });
    res.status(201).json(meal);
  } catch (err) { next(err); }
});

router.put('/custom-meals/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id);
    const existing = await prisma.customMeal.findFirst({ where: { id, userId: req.user!.userId } });
    if (!existing) { next(new AppError(404, 'Custom meal not found')); return; }
    const meal = await prisma.customMeal.update({ where: { id }, data: req.body });
    res.json(meal);
  } catch (err) { next(err); }
});

router.delete('/custom-meals/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id);
    const existing = await prisma.customMeal.findFirst({ where: { id, userId: req.user!.userId } });
    if (!existing) { next(new AppError(404, 'Custom meal not found')); return; }
    await prisma.customMeal.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
