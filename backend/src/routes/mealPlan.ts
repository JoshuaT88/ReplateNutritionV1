import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as mealPlanService from '../services/mealPlan.service.js';

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
    const { profileIds, date, mealTypes } = req.body;
    const meals = await mealPlanService.generateMealPlan(req.user!.userId, profileIds, date, mealTypes);
    res.status(201).json(meals);
  } catch (err) { next(err); }
});

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meal = await mealPlanService.updateMealPlan(req.user!.userId, req.params.id, req.body);
    res.json(meal);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await mealPlanService.deleteMealPlan(req.user!.userId, req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
