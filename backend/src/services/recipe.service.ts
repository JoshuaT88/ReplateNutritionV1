/**
 * Recipe service using TheMealDB (free, no API key required).
 * https://www.themealdb.com/api.php
 *
 * Also supports caching fetched recipes in the DB (SavedRecipe model)
 * to avoid redundant external calls and enable offline use.
 */

import prisma from '../config/database.js';

const BASE = 'https://www.themealdb.com/api/json/v1/1';

function parseMealIngredients(meal: any): { name: string; measure: string }[] {
  const ingredients: { name: string; measure: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim();
    const measure = meal[`strMeasure${i}`]?.trim() || '';
    if (name) ingredients.push({ name, measure });
  }
  return ingredients;
}

function mealToRecipe(meal: any) {
  return {
    externalId: meal.idMeal,
    source: 'themealdb',
    name: meal.strMeal,
    category: meal.strCategory || null,
    cuisine: meal.strArea || null,
    instructions: meal.strInstructions || null,
    thumbnail: meal.strMealThumb || null,
    ingredients: parseMealIngredients(meal),
    tags: meal.strTags ? meal.strTags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
  };
}

async function cacheRecipe(data: ReturnType<typeof mealToRecipe>) {
  return prisma.savedRecipe.upsert({
    where: { externalId_source: { externalId: data.externalId!, source: data.source } },
    create: data,
    update: {
      name: data.name,
      category: data.category,
      cuisine: data.cuisine,
      thumbnail: data.thumbnail,
      ingredients: data.ingredients as any,
      tags: data.tags,
    },
  });
}

export async function searchRecipes(query: string): Promise<any[]> {
  // Check DB cache first
  const cached = await prisma.savedRecipe.findMany({
    where: {
      source: 'themealdb',
      name: { contains: query, mode: 'insensitive' },
    },
    take: 20,
  });
  if (cached.length > 0) return cached;

  try {
    const res = await fetch(`${BASE}/search.php?s=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json() as any;
    if (!data.meals) return [];

    const recipes = data.meals.map(mealToRecipe);
    // Cache in background (don't await)
    Promise.all(recipes.map(cacheRecipe)).catch(() => {});
    return recipes;
  } catch {
    return [];
  }
}

export async function getRecipeById(externalId: string): Promise<any | null> {
  // Check cache
  const cached = await prisma.savedRecipe.findFirst({
    where: { externalId, source: 'themealdb' },
  });
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE}/lookup.php?i=${externalId}`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (!data.meals?.[0]) return null;

    const recipe = mealToRecipe(data.meals[0]);
    return cacheRecipe(recipe);
  } catch {
    return null;
  }
}

export async function getRecipesByCategory(category: string): Promise<any[]> {
  const cached = await prisma.savedRecipe.findMany({
    where: { category: { equals: category, mode: 'insensitive' }, source: 'themealdb' },
    take: 30,
  });
  if (cached.length >= 5) return cached;

  try {
    const res = await fetch(`${BASE}/filter.php?c=${encodeURIComponent(category)}`);
    if (!res.ok) return [];
    const data = await res.json() as any;
    if (!data.meals) return [];

    // filter.php only returns partial data — fetch full for top 10
    const top10 = data.meals.slice(0, 10);
    const full = await Promise.all(
      top10.map((m: any) => getRecipeById(m.idMeal).catch(() => null))
    );
    return full.filter(Boolean);
  } catch {
    return [];
  }
}

export async function listCategories(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/list.php?c=list`);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return data.meals?.map((m: any) => m.strCategory) ?? [];
  } catch {
    return [];
  }
}

/** Convert a recipe's ingredient list to shopping list items */
export function recipeToShoppingItems(recipe: any, servingMultiplier = 1) {
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : (recipe.ingredients as any[]) || [];

  return ingredients.map((ing: { name: string; measure: string }) => ({
    itemName: ing.name,
    quantity: servingMultiplier === 1 ? ing.measure : scaleMeasure(ing.measure, servingMultiplier),
    category: null, // will be auto-categorized
    sourceRef: `recipe:${recipe.externalId || recipe.id}`,
  }));
}

function scaleMeasure(measure: string, multiplier: number): string {
  const match = measure.match(/^([\d./]+)\s*(.*)/);
  if (!match) return measure;
  const num = eval(match[1]); // handles fractions like "1/2"
  return `${Math.round(num * multiplier * 100) / 100} ${match[2]}`.trim();
}
