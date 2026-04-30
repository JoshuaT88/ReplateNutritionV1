import { useState, useCallback } from 'react';

export interface RecipeTemplate {
  id: string;
  mealId: string;
  mealName: string;
  mealType: string;
  photoUrl: string | null;
  servings: number;
  savedAt: string;
  linkedMealPlanDate?: string;
  linkedMealPlanType?: string;
  linkedProfileName?: string;
}

const KEY = 'replate_recipe_templates';
const MAX = 50;

function load(): RecipeTemplate[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function persist(entries: RecipeTemplate[]) {
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* quota — ignore */ }
}

export function useRecipeTemplates() {
  const [templates, setTemplates] = useState<RecipeTemplate[]>(() => load());

  const saveTemplate = useCallback((t: Omit<RecipeTemplate, 'id' | 'savedAt'>) => {
    setTemplates((prev) => {
      const filtered = prev.filter((e) => e.mealId !== t.mealId); // dedup by meal
      const updated = [
        { ...t, id: `tpl-${Date.now()}`, savedAt: new Date().toISOString() },
        ...filtered,
      ].slice(0, MAX);
      persist(updated);
      return updated;
    });
  }, []);

  const removeTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      persist(updated);
      return updated;
    });
  }, []);

  const clearTemplates = useCallback(() => {
    persist([]);
    setTemplates([]);
  }, []);

  return { templates, saveTemplate, removeTemplate, clearTemplates };
}
