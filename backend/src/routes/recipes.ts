import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as recipeService from '../services/recipe.service.js';
import * as shoppingService from '../services/shopping.service.js';
import { firstParam } from '../utils/http.js';
import { checkItemSafety } from '../services/allergenSafety.service.js';
import prisma from '../config/database.js';

const router = Router();

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
