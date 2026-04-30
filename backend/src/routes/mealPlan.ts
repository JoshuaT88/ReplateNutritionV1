import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as mealPlanService from '../services/mealPlan.service.js';
import prisma from '../config/database.js';
import { firstParam } from '../utils/http.js';
import { AppError } from '../middleware/errorHandler.js';
import { logActivity } from '../services/activity.service.js';
import { env } from '../config/env.js';

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

// POST /meal-plan/generate-stream — SSE streaming meal plan generation (T67)
router.post('/generate-stream', async (req: AuthRequest, res: Response) => {
  const { profileIds, date, mealTypes, days, dietaryGoals } = req.body;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const meals = await mealPlanService.generateMealPlan(
      req.user!.userId, profileIds, date, mealTypes, days || 7, dietaryGoals,
      (meal: any) => sendEvent({ meal, done: false })
    );
    sendEvent({ done: true, total: meals.length });
  } catch (err: any) {
    sendEvent({ error: err.message || 'Generation failed', done: true });
  } finally {
    res.end();
  }
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
      // Auto-log to activity
      logActivity({
        userId: req.user!.userId,
        profileId: meal.profileId ?? undefined,
        entityType: 'meal',
        entityId: mealId!,
        action: 'completed',
        metadata: { mealName: meal.mealName, mealType: meal.mealType, date: meal.date },
      }).catch(() => {});

      // Auto-log to MacroLog (Nutrition Log) for the linked profile
      if (meal.profileId) {
        const mealDate = meal.date instanceof Date ? meal.date : new Date(meal.date as string);
        const dateOnly = new Date(Date.UTC(mealDate.getUTCFullYear(), mealDate.getUTCMonth(), mealDate.getUTCDate()));
        prisma.macroLog.create({
          data: {
            userId: req.user!.userId,
            profileId: meal.profileId,
            date: dateOnly,
            mealName: meal.mealName,
            calories: meal.calories ?? null,
            protein: meal.protein ?? null,
            carbs: meal.carbs ?? null,
            fat: meal.fat ?? null,
            fiber: meal.fiber ?? null,
            notes: `Auto-logged from meal plan (${meal.mealType.replace(/_/g, ' ')})`,
          },
        }).catch(() => {});

        // Activity log for nutrition log entry
        logActivity({
          userId: req.user!.userId,
          profileId: meal.profileId,
          entityType: 'nutrition_log',
          action: 'auto_logged',
          metadata: { mealName: meal.mealName, mealType: meal.mealType, date: meal.date, source: 'meal_plan' },
        }).catch(() => {});
      }
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
    const { skipDuplicateCheck, ...data } = req.body;

    // Duplicate detection — check for same name (case-insensitive) for this user
    if (!skipDuplicateCheck && data.name?.trim()) {
      const existing = await prisma.customMeal.findFirst({
        where: {
          userId: req.user!.userId,
          name: { equals: data.name.trim(), mode: 'insensitive' },
        },
        select: { id: true, name: true, mealType: true, createdAt: true },
      });
      if (existing) {
        return res.status(409).json({
          error: 'duplicate',
          message: `A recipe named "${existing.name}" already exists in your library.`,
          existing,
        });
      }
    }

    const meal = await prisma.customMeal.create({
      data: { ...data, userId: req.user!.userId },
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

// POST /meal-plan/custom-meals/sync-from-plan — bulk-upsert meals from meal plan into library
router.post('/custom-meals/sync-from-plan', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meals: Array<{
      name: string; mealType: string; ingredients: string[];
      preparationNotes?: string | null; calories?: number | null;
      protein?: number | null; carbs?: number | null; fat?: number | null; fiber?: number | null;
      servings?: number | null;
    }> = req.body.meals ?? [];

    if (!Array.isArray(meals) || meals.length === 0) {
      res.json({ synced: 0, skipped: 0 }); return;
    }

    let synced = 0; let skipped = 0;
    for (const meal of meals) {
      if (!meal.name?.trim()) { skipped++; continue; }
      const exists = await prisma.customMeal.findFirst({
        where: { userId: req.user!.userId, name: { equals: meal.name.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (exists) { skipped++; continue; }
      await prisma.customMeal.create({
        data: {
          userId: req.user!.userId,
          name: meal.name.trim(),
          mealType: meal.mealType ?? 'dinner',
          ingredients: meal.ingredients ?? [],
          preparationNotes: meal.preparationNotes ?? null,
          calories: meal.calories ?? null,
          protein: meal.protein ?? null,
          carbs: meal.carbs ?? null,
          fat: meal.fat ?? null,
          fiber: meal.fiber ?? null,
          servings: meal.servings ?? 1,
        },
      });
      synced++;
    }
    res.json({ synced, skipped });
  } catch (err) { next(err); }
});

// POST /meal-plan/custom-meals/:id/annotate-scaling — AI-annotate each ingredient with scaling category
router.post('/custom-meals/:id/annotate-scaling', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id);
    const meal = await prisma.customMeal.findFirst({
      where: { id, userId: req.user!.userId },
      select: { id: true, name: true, ingredients: true },
    });
    if (!meal) { next(new AppError(404, 'Custom meal not found')); return; }
    if (!meal.ingredients.length) { res.json({ ingredientScaling: {} }); return; }

    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `For each ingredient below, classify how it should scale when changing serving count:
- "proportional": scales 1:1 (proteins, vegetables, grains, dairy)
- "moderate": scales at ~50-70% (cooking fats/oils, acidic ingredients)
- "fixed": barely changes (salt, spices, leavening agents, flavor extracts)

Ingredients: ${meal.ingredients.join(' | ')}

Reply with ONLY valid JSON: {"scaling": {"<ingredient>": "proportional"|"moderate"|"fixed"}}
Use the exact ingredient string as the key.`,
      }],
    });
    const raw = resp.choices[0].message.content?.trim() ?? '{}';
    const parsed = JSON.parse(raw) as { scaling?: Record<string, string> };
    const ingredientScaling = parsed.scaling ?? {};

    await prisma.customMeal.update({ where: { id: meal.id }, data: { ingredientScaling } });
    res.json({ ingredientScaling });
  } catch (err) { next(err); }
});

router.post('/estimate-calories', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ingredients, servings } = req.body as { ingredients?: string[]; servings?: number };
    if (!ingredients?.length) { res.json({ calories: null }); return; }
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: `Estimate total calories for a meal with these ingredients: ${ingredients.join(', ')}. Servings: ${servings || 1}. Reply with ONLY a number (total calories for all servings combined). No units, no text.`,
      }],
    });
    const cal = parseInt(resp.choices[0].message.content?.trim() ?? '', 10);
    res.json({ calories: Number.isNaN(cal) ? null : cal });
  } catch (err) { next(err); }
});

// POST /meal-plan/estimate-macros — estimate full macros from a meal name
router.post('/estimate-macros', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mealName } = req.body as { mealName?: string };
    if (!mealName?.trim()) { res.json({ calories: null, protein: null, carbs: null, fat: null, fiber: null }); return; }
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 60,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `Estimate macros for a typical single serving of "${mealName}". Reply with ONLY valid JSON: {"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number}. Use integers for calories, one decimal for others.`,
      }],
    });
    const raw = resp.choices[0].message.content?.trim() ?? '{}';
    const parsed = JSON.parse(raw);
    res.json({
      calories: typeof parsed.calories === 'number' ? Math.round(parsed.calories) : null,
      protein: typeof parsed.protein === 'number' ? Math.round(parsed.protein * 10) / 10 : null,
      carbs: typeof parsed.carbs === 'number' ? Math.round(parsed.carbs * 10) / 10 : null,
      fat: typeof parsed.fat === 'number' ? Math.round(parsed.fat * 10) / 10 : null,
      fiber: typeof parsed.fiber === 'number' ? Math.round(parsed.fiber * 10) / 10 : null,
    });
  } catch (err) { next(err); }
});

export default router;
