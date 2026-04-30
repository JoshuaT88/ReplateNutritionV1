import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as recipeService from '../services/recipe.service.js';
import * as shoppingService from '../services/shopping.service.js';
import { firstParam } from '../utils/http.js';
import { checkItemSafety } from '../services/allergenSafety.service.js';
import { generateCookingRecipe, scanRecipeFromImage } from '../services/ai.service.js';
import prisma from '../config/database.js';

const router = Router();

// ── Multer setup for recipe photos ───────────────────────────────────────────
const recipePhotosDir = path.resolve('uploads/recipe-photos');
fs.mkdirSync(recipePhotosDir, { recursive: true });

const recipePhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, recipePhotosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const recipePhotoUpload = multer({
  storage: recipePhotoStorage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Search recipes (TheMealDB)
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  const q = firstParam(req.query.q as string | string[] | undefined) || '';
  if (!q.trim()) return res.json([]);
  const results = await recipeService.searchRecipes(q);
  res.json(results);
});

// Get categories list
router.get('/categories', authenticate, async (_req: AuthRequest, res: Response) => {
  const cats = await recipeService.listCategories();
  res.json(cats);
});

// Get by category
router.get('/by-category/:category', authenticate, async (req: AuthRequest, res: Response) => {
  const results = await recipeService.getRecipesByCategory(firstParam(req.params.category)!);
  res.json(results);
});

// POST /recipes/generate-instructions — AI-generated step-by-step cooking instructions
router.post('/generate-instructions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, ingredients, mealType, servings = 2 } = req.body as {
      name?: string;
      ingredients?: string[];
      mealType?: string;
      servings?: number;
    };
    if (!name?.trim() || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'name and ingredients are required' });
    }
    const result = await generateCookingRecipe(
      name.trim(),
      ingredients.slice(0, 20), // cap to prevent overly long prompts
      mealType || 'dinner',
      Number(servings) || 2,
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate recipe instructions' });
  }
});

// POST /recipes/photo-upload — Upload a photo for a saved meal and save the URL
router.post('/photo-upload', authenticate, recipePhotoUpload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const { mealId } = req.body as { mealId?: string };
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const photoUrl = `/uploads/recipe-photos/${req.file.filename}`;

    if (mealId) {
      // Verify ownership before updating
      const meal = await prisma.customMeal.findFirst({ where: { id: mealId, userId: req.user!.userId } });
      if (!meal) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Meal not found' });
      }
      // Delete old photo if it exists and is a local upload
      if (meal.photoUrl?.startsWith('/uploads/')) {
        const oldPath = path.resolve(meal.photoUrl.slice(1));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      await prisma.customMeal.update({ where: { id: mealId }, data: { photoUrl } });
    }

    res.json({ photoUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// POST /recipes/scan — OCR + AI to auto-fill recipe form from a photo of a written recipe
router.post('/scan', authenticate, recipePhotoUpload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const imageBuffer = fs.readFileSync(req.file.path);
    const base64 = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';

    const result = await scanRecipeFromImage(base64, mimeType);

    // Clean up the temp file (we don't store scan images)
    fs.unlinkSync(req.file.path);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to scan recipe' });
  }
});

// POST /recipes/check-duplicate — Check if a recipe name already exists for this user
router.post('/check-duplicate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) return res.json({ isDuplicate: false });

    const existing = await prisma.customMeal.findFirst({
      where: {
        userId: req.user!.userId,
        name: { equals: name.trim(), mode: 'insensitive' },
      },
      select: { id: true, name: true, mealType: true, createdAt: true },
    });

    res.json({ isDuplicate: !!existing, existing: existing ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single recipe detail
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const recipe = await recipeService.getRecipeById(firstParam(req.params.id)!);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  res.json(recipe);
});

// Add recipe ingredients to shopping list
router.post('/:id/add-to-list', authenticate, async (req: AuthRequest, res: Response) => {
  const { servings = 1, listGroupId, profileId } = req.body as { servings?: number; listGroupId?: string; profileId?: string };

  const recipe = await recipeService.getRecipeById(firstParam(req.params.id)!);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  // If a profileId is provided, run allergen safety check on the recipe
  if (profileId) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: req.user!.userId },
    });

    if (profile) {
      const ingredientNames = recipe.ingredients.map((i: any) => i.name);
      const check = await checkItemSafety(
        recipe.name,
        ingredientNames,
        {
          name: profile.name,
          type: profile.type,
          criticalAllergies: profile.criticalAllergies,
          allergies: profile.allergies,
          intolerances: profile.intolerances,
        }
      );

      if (check.block) {
        return res.status(409).json({
          error: 'allergen_conflict',
          severity: 'CRITICAL',
          message: `This recipe cannot be added: ${check.reason}`,
          flaggedAllergens: check.flaggedAllergens,
        });
      }

      if (!check.safe) {
        // Return a warning but still allow adding (WARNING level, not critical)
        // The response includes warning data for the UI to show
        const items = recipeService.recipeToShoppingItems(recipe, servings);
        const added = await Promise.all(
          items.map((item: any) =>
            shoppingService.addShoppingItem(req.user!.userId, { ...item, listGroupId }).catch(() => null)
          )
        );
        const count = added.filter(Boolean).length;
        return res.json({
          added: count,
          recipeName: recipe.name,
          message: `${count} ingredients added to your shopping list`,
          warning: check.reason,
          flaggedAllergens: check.flaggedAllergens,
        });
      }
    }
  }

  const items = recipeService.recipeToShoppingItems(recipe, servings);

  const added = await Promise.all(
    items.map((item: any) =>
      shoppingService.addShoppingItem(req.user!.userId, { ...item, listGroupId }).catch(() => null)
    )
  );

  const count = added.filter(Boolean).length;
  res.json({ added: count, recipeName: recipe.name, message: `${count} ingredients added to your shopping list` });
});

export default router;
