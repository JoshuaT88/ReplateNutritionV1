import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, ChefHat, Plus, X, CalendarDays, BookMarked, Trash2, Loader2,
  Clock, ShoppingCart, CheckCircle2, Wand2, Lightbulb, Camera, ScanLine,
  FilePlus, Minus, ImagePlus, AlertTriangle, Bookmark, ExternalLink,
  Settings2, Layers3, History, PlayCircle, ChevronDown as ChevronDownIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Recipe, CustomMeal } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { MeasurementConverter } from '@/components/shared/MeasurementConverter';
import { useRecentRecipes, safeFmtDate, safeFmtDateTime } from '@/lib/useRecentRecipes';
import { useRecipeTemplates } from '@/lib/useRecipeTemplates';
import type { RecipeTemplate } from '@/lib/useRecipeTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip brand prefixes and adjectives so TheMealDB has a better chance of matching */
function simplifyMealName(name: string): string {
  // Remove "Firstname Lastname " style brand prefix (e.g. "Deliciously Ella ")
  let s = name.replace(/^[A-Z][a-z]+'?s?\s+[A-Z][a-z]+\s+/g, '');
  // Remove common adjective starters
  s = s.replace(
    /^(easy|simple|classic|homemade|quick|healthy|hearty|creamy|spicy|sweet|savory|fresh|tasty|best|perfect|ultimate|traditional|slow\s*cooker|instant\s*pot|one[\s-]pan|sheet\s*pan)\s+/gi,
    ''
  );
  // Keep first 4 meaningful words
  return s.split(/\s+/).slice(0, 4).join(' ');
}

/** Detect whether preparationNotes contains real cooking steps (vs an AI description) */
function hasRealSteps(notes: string | null): boolean {
  if (!notes) return false;
  // At least 2 numbered items
  const numbered = notes.match(/\d+[.)]\s+.{15,}/g);
  if (numbered && numbered.length >= 3) return true;
  // Multiple non-trivial lines
  const lines = notes.split(/\n+/).filter((l) => l.trim().length > 25);
  return lines.length >= 4;
}

/** Parse a block of text into an array of step strings */
function parseSteps(notes: string): string[] {
  const numbered = notes.match(/\d+[.)]\s+[^\n]{5,}/g);
  if (numbered && numbered.length >= 2) {
    return numbered.map((s) => s.replace(/^\d+[.)]\s+/, '').trim());
  }
  return notes.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 5);
}

/** Parse a leading number/fraction from an ingredient string */
function parseFraction(s: string): number {
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  return parseFloat(s);
}

/** Format a number as a nice fraction/decimal for ingredients */
function fmtAmount(n: number): string {
  if (n <= 0) return '';
  const FRACS: [number, string][] = [[0.25,'¼'],[0.5,'½'],[0.75,'¾'],[0.33,'⅓'],[0.67,'⅔'],[0.125,'⅛']];
  const whole = Math.floor(n);
  const rem = n - whole;
  const frac = FRACS.find(([v]) => Math.abs(rem - v) < 0.07);
  if (whole > 0 && frac) return `${whole} ${frac[1]}`;
  if (!whole && frac) return frac[1];
  // Round to 1 decimal, strip .0
  const r = Math.round(n * 10) / 10;
  return r % 1 === 0 ? String(Math.round(r)) : String(r);
}

/** Scale an ingredient string by a ratio, optionally respecting its scaling category */
function scaleIngredient(ingredient: string, ratio: number, category?: 'proportional' | 'moderate' | 'fixed'): string {
  if (Math.abs(ratio - 1) < 0.01) return ingredient;
  // Apply scaling factor based on category
  let effectiveRatio = ratio;
  if (category === 'fixed') {
    effectiveRatio = 1; // don't scale at all
  } else if (category === 'moderate') {
    // Scale at ~60% of the ratio change  e.g. ×2 → ×1.6, ×0.5 → ×0.7
    effectiveRatio = 1 + (ratio - 1) * 0.6;
  }
  if (Math.abs(effectiveRatio - 1) < 0.01) return ingredient;
  // Match leading quantity (e.g. "1 1/2", "2", "1/4")
  const m = ingredient.match(/^(\d+(?:[./\s]\d+)?)\s+(.*)/);
  if (!m) return ingredient;
  const original = parseFraction(m[1].trim());
  if (!original || isNaN(original)) return ingredient;
  return `${fmtAmount(original * effectiveRatio)} ${m[2]}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const MEAL_TYPE_CONFIG: Record<string, { grad: string; emoji: string }> = {
  breakfast: { grad: 'from-amber-400 to-orange-500', emoji: '🍳' },
  lunch:     { grad: 'from-emerald-400 to-teal-500', emoji: '🥗' },
  dinner:    { grad: 'from-indigo-400 to-violet-600', emoji: '🍽️' },
  snack:     { grad: 'from-purple-400 to-pink-500', emoji: '🍎' },
  dessert:   { grad: 'from-pink-400 to-rose-500', emoji: '🍰' },
};

function MealTypePlaceholder({ mealType, name }: { mealType: string; name: string }) {
  const cfg = MEAL_TYPE_CONFIG[mealType.toLowerCase()] ?? { grad: 'from-slate-400 to-slate-600', emoji: '🍴' };
  return (
    <div className={cn('w-full h-28 bg-gradient-to-br flex flex-col items-center justify-center gap-1', cfg.grad)}>
      <span className="text-3xl leading-none">{cfg.emoji}</span>
      <p className="text-white/80 text-[10px] text-center px-2 line-clamp-1 max-w-[90%]">{name}</p>
    </div>
  );
}

function SavedMealCard({ meal, onClick, onDelete }: { meal: CustomMeal; onClick: () => void; onDelete: () => void }) {
  const hasSteps = hasRealSteps(meal.preparationNotes);
  return (
    <div
      className="relative rounded-xl overflow-hidden border border-card-border bg-surface hover:shadow-md transition-all cursor-pointer group"
      onClick={onClick}
    >
      {meal.photoUrl ? (
        <img src={meal.photoUrl} alt={meal.name} className="w-full h-28 object-cover" />
      ) : (
        <MealTypePlaceholder mealType={meal.mealType} name={meal.name} />
      )}
      {hasSteps && (
        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          Recipe Ready
        </div>
      )}
      <div className="p-2 pb-3">
        <p className="text-sm font-semibold text-text-primary line-clamp-2 leading-tight">{meal.name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {meal.calories && (
            <span className="text-[10px] text-muted">{meal.calories} cal</span>
          )}
          {meal.prepTime && (
            <span className="text-[10px] text-muted flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" /> {meal.prepTime}m
            </span>
          )}
          {meal.ingredients.length > 0 && (
            <span className="text-[10px] text-muted">{meal.ingredients.length} ingredients</span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute bottom-2 right-2 p-1 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        title="Remove"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

/** Checkable ingredient row for the cooking guide */
function IngredientCheckItem({ ingredient, checked: externalChecked, onToggle }: { ingredient: string; checked?: boolean; onToggle?: (ingredient: string, checked: boolean) => void }) {
  const [internalChecked, setInternalChecked] = useState(externalChecked ?? false);
  const checked = externalChecked ?? internalChecked;
  const toggle = () => {
    const next = !checked;
    if (onToggle) onToggle(ingredient, next);
    else setInternalChecked(next);
  };
  return (
    <li
      className={cn('flex items-start gap-2.5 text-sm cursor-pointer select-none py-0.5', checked && 'opacity-50')}
      onClick={toggle}
    >
      <div className={cn(
        'h-4 w-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all',
        checked ? 'bg-emerald-500 border-emerald-500' : 'border-text-muted dark:border-slate-500'
      )}>
        {checked && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
      </div>
      <span className={cn('text-text-primary leading-snug flex-1', checked && 'line-through text-text-muted')}>{ingredient}</span>
    </li>
  );
}

const MEAL_TABS = ['all', 'breakfast', 'lunch', 'dinner', 'snack', 'dessert'] as const;
type MealTab = typeof MEAL_TABS[number];

export default function RecipesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { recent, history, recordOpen, updateSettings, updateEntry, removeEntry } = useRecentRecipes();
  const { templates, saveTemplate, removeTemplate } = useRecipeTemplates();

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Saved meals category tab
  const [activeTab, setActiveTab] = useState<MealTab>('all');
  // Browse section sub-tab
  const [browseTab, setBrowseTab] = useState<'recipes' | 'templates' | 'active' | 'history'>('recipes');
  // Delete confirm for recently used entry
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [activeChangelogId, setActiveChangelogId] = useState<string | null>(null);

  // TheMealDB recipe dialog
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [servings, setServings] = useState(4);
  const [showAddToMealPlan, setShowAddToMealPlan] = useState(false);
  const [mealPlanDate, setMealPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mealPlanType, setMealPlanType] = useState('dinner');

  // Saved meal dialog
  const [selectedCustomMeal, setSelectedCustomMeal] = useState<CustomMeal | null>(null);
  const [customMealServings, setCustomMealServings] = useState(2);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [showCustomMealPlan, setShowCustomMealPlan] = useState(false);
  const [customMealPlanDate, setCustomMealPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customMealPlanType, setCustomMealPlanType] = useState('dinner');
  const [uploadingDialogPhoto, setUploadingDialogPhoto] = useState(false);

  // Recipe guide workflow state
  const [recipeGuideMode, setRecipeGuideMode] = useState(false);
  const [linkedMealPlan, setLinkedMealPlan] = useState<import('@/types').MealPlan | null>(null);
  const [showMealPlanLinker, setShowMealPlanLinker] = useState(false);

  // Manual recipe form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formMealType, setFormMealType] = useState('dinner');
  const [formServings, setFormServings] = useState(2);
  const [formCalories, setFormCalories] = useState('');
  const [formPrepTime, setFormPrepTime] = useState('');
  const [formIngredients, setFormIngredients] = useState<string[]>(['']);
  const [formInstructions, setFormInstructions] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [formDuplicate, setFormDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [scanning, setScanning] = useState(false);

  // Refs for file inputs
  const scanInputRef = useRef<HTMLInputElement>(null);
  const formPhotoInputRef = useRef<HTMLInputElement>(null);
  const dialogPhotoRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setFormName(''); setFormMealType('dinner'); setFormServings(2);
    setFormCalories(''); setFormPrepTime(''); setFormIngredients(['']);
    setFormInstructions(''); setFormTags('');
    setFormPhotoFile(null); setFormPhotoPreview(null); setFormDuplicate(null);
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['recipe-categories'],
    queryFn: () => api.getRecipeCategories(),
    staleTime: 1000 * 60 * 60,
  });

  const { data: results = [], isFetching: searching, isError: searchFailed } = useQuery<Recipe[]>({
    queryKey: ['recipes', 'search', searchQuery],
    queryFn: () => api.searchRecipes(searchQuery),
    enabled: searchQuery.length > 0,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const { data: savedMeals = [] } = useQuery<CustomMeal[]>({
    queryKey: ['custom-meals'],
    queryFn: () => api.getCustomMeals(),
  });

  // Fetch current + upcoming week meal plan for "already in meal plan" detection
  const todayStr = new Date().toISOString().slice(0, 10);
  const futureStr = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const { data: upcomingMealPlan = [] } = useQuery<import('@/types').MealPlan[]>({
    queryKey: ['meal-plan-upcoming'],
    queryFn: () => api.getMealPlans({ startDate: todayStr, endDate: futureStr }),
    staleTime: 1000 * 60 * 5,
  });

  // Photo + TheMealDB instructions for the open saved meal
  const { data: mealDbData, isFetching: loadingPhoto } = useQuery<{ photo: string | null; instructions: string | null }>({
    queryKey: ['meal-photo', selectedCustomMeal?.name],
    queryFn: async () => {
      // If meal has its own uploaded photo, skip TheMealDB search
      if (selectedCustomMeal!.photoUrl) return { photo: selectedCustomMeal!.photoUrl, instructions: null };

      try {
        const simplified = simplifyMealName(selectedCustomMeal!.name);

        // Strategy 1: simplified name
        const r1 = await fetch(
          `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(simplified)}`
        );
        const d1 = await r1.json();
        if (d1.meals?.[0]) {
          return { photo: d1.meals[0].strMealThumb, instructions: d1.meals[0].strInstructions };
        }

        // Strategy 2: first ingredient keyword
        const kw = selectedCustomMeal!.ingredients[0]?.split(/\s+/).filter((w) => w.length > 3).pop() ?? '';
        if (kw) {
          const r2 = await fetch(
            `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(kw)}`
          );
          const d2 = await r2.json();
          if (d2.meals?.[0]) {
            return { photo: d2.meals[0].strMealThumb, instructions: null };
          }
        }
      } catch {
        // Network blocked or offline — return gracefully
      }

      return { photo: null, instructions: null };
    },
    enabled: !!selectedCustomMeal,
    staleTime: Infinity,
    retry: false,
  });

  // Estimated macros for open dialog — skip AI if macros already stored on the meal
  const hasSavedMacros = !!(selectedCustomMeal?.protein != null || selectedCustomMeal?.carbs != null);
  const { data: estimatedMacros } = useQuery({
    queryKey: ['recipe-macros', selectedCustomMeal?.name],
    queryFn: () => api.estimateMealMacros(selectedCustomMeal!.name),
    enabled: !!selectedCustomMeal && !hasSavedMacros,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: false,
  });

  // Auto-persist estimated macros to DB once fetched (if not already stored)
  const persistMacrosMutation = useMutation({
    mutationFn: (macros: { calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null; fiber?: number | null }) =>
      api.updateCustomMeal(selectedCustomMeal!.id, macros),
    onSuccess: (updated) => {
      queryClient.setQueryData<typeof updated[]>(['custom-meals'], (old) =>
        old?.map((m) => m.id === updated.id ? updated : m) ?? old
      );
      setSelectedCustomMeal((prev) => prev ? { ...prev, ...updated } : null);
    },
  });

  // Fire-and-forget: persist macros once AI estimate comes back
  const macrosPersisted = useRef<string | null>(null);
  if (estimatedMacros && selectedCustomMeal && !hasSavedMacros && macrosPersisted.current !== selectedCustomMeal.id && !persistMacrosMutation.isPending) {
    macrosPersisted.current = selectedCustomMeal.id;
    persistMacrosMutation.mutate({
      calories: estimatedMacros.calories,
      protein: estimatedMacros.protein,
      carbs: estimatedMacros.carbs,
      fat: estimatedMacros.fat,
      fiber: estimatedMacros.fiber,
    });
  }

  // Annotation mutation — runs AI to classify each ingredient's scaling category
  const annotateScalingMutation = useMutation({
    mutationFn: () => api.annotateIngredientScaling(selectedCustomMeal!.id),
    onSuccess: (data) => {
      queryClient.setQueryData<ReturnType<typeof api.getCustomMeals> extends Promise<infer T> ? T : never>(['custom-meals'], (old: any) =>
        old?.map((m: any) => m.id === selectedCustomMeal!.id ? { ...m, ingredientScaling: data.ingredientScaling } : m) ?? old
      );
      setSelectedCustomMeal((prev) => prev ? { ...prev, ingredientScaling: data.ingredientScaling } : null);
      toast('success', 'Ingredient scaling annotated!');
    },
    onError: (e: any) => toast('error', 'Could not annotate scaling', e.message),
  });

  // Best available instructions: TheMealDB > stored real steps > null
  const storedHasSteps = hasRealSteps(selectedCustomMeal?.preparationNotes ?? null);
  const displayInstructions = mealDbData?.instructions
    || (storedHasSteps ? selectedCustomMeal?.preparationNotes ?? null : null);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const deleteSavedMealMutation = useMutation({
    mutationFn: (id: string) => api.deleteCustomMeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-meals'] });
      toast('success', 'Removed from My Recipes');
    },
  });

  /** Generate AI cooking steps for the open saved meal and persist them */
  const generateStepsMutation = useMutation({
    mutationFn: () =>
      api.generateRecipeInstructions({
        name: selectedCustomMeal!.name,
        ingredients: selectedCustomMeal!.ingredients,
        mealType: selectedCustomMeal!.mealType,
        servings: customMealServings,
      }),
    onSuccess: async (data) => {
      const formatted = data.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
      const totalTime = (data.prepTime || 0) + (data.cookTime || 0);
      await api.updateCustomMeal(selectedCustomMeal!.id, {
        preparationNotes: formatted,
        prepTime: totalTime || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['custom-meals'] });
      setSelectedCustomMeal((prev) =>
        prev ? { ...prev, preparationNotes: formatted, prepTime: totalTime || prev.prepTime } : null
      );
      toast('success', 'Recipe steps generated!');
    },
    onError: (e: any) => toast('error', 'Could not generate steps', e.message),
  });

  const addCustomMealToListMutation = useMutation({
    mutationFn: () =>
      api.addIngredientsToList({
        ingredients: selectedCustomMeal!.ingredients,
        mealName: selectedCustomMeal!.name,
        servings: customMealServings,
      }),
    onSuccess: (data: any) => {
      toast('success', data.message ?? 'Ingredients added to list');
      setSelectedCustomMeal(null);
    },
    onError: (e: any) => toast('error', e.message),
  });

  const addCustomMealToMealPlanMutation = useMutation({
    mutationFn: () =>
      api.createMealPlan({
        date: customMealPlanDate,
        mealType: customMealPlanType as any,
        mealName: selectedCustomMeal!.name,
        ingredients: selectedCustomMeal!.ingredients,
        preparationNotes: selectedCustomMeal!.preparationNotes ?? undefined,
        calories: selectedCustomMeal!.calories ?? undefined,
      }),
    onSuccess: () => {
      toast('success', 'Added to meal plan!');
      setShowCustomMealPlan(false);
      setSelectedCustomMeal(null);
    },
    onError: (e: any) => toast('error', e.message),
  });

  const addToListMutation = useMutation({
    mutationFn: ({ id, servings }: { id: string; servings: number }) =>
      api.addRecipeToList(id, { servings }),
    onSuccess: (data) => {
      toast('success', data.message);
      setSelectedRecipe(null);
    },
    onError: (e: any) => toast('error', e.message),
  });

  /** Upload a photo to an already-saved meal */
  const uploadPhotoMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => api.uploadRecipePhoto(id, file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['custom-meals'] });
      // Update local dialog state so the photo shows immediately
      setSelectedCustomMeal((prev) => prev ? { ...prev, photoUrl: data.photoUrl } : null);
      // Propagate to the recent entry so the scrollable row re-renders with the new photo
      if (selectedCustomMeal) updateEntry(selectedCustomMeal.id, { photoUrl: data.photoUrl });
      // Also invalidate the photo query cache so the dialog re-fetches
      queryClient.invalidateQueries({ queryKey: ['meal-photo', selectedCustomMeal?.name] });
      toast('success', 'Photo updated!');
      setUploadingDialogPhoto(false);
    },
    onError: (e: any) => { toast('error', 'Photo upload failed', e.message); setUploadingDialogPhoto(false); },
  });

  /** Create a new custom meal from the manual entry form */
  const createMealMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createCustomMeal>[0]) => api.createCustomMeal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-meals'] });
      toast('success', 'Recipe added to My Recipes!');
      resetForm();
      setShowAddForm(false);
    },
    onError: (e: any) => toast('error', 'Failed to save recipe', e.message),
  });

  const addToMealPlanMutation = useMutation({
    mutationFn: () =>
      api.createMealPlan({
        date: mealPlanDate,
        mealType: mealPlanType as any,
        mealName: selectedRecipe!.name,
        ingredients: (selectedRecipe!.ingredients || []).map((ing) =>
          typeof ing === 'string' ? ing : `${ing.measure ? ing.measure + ' ' : ''}${ing.name}`
        ),
      }),
    onSuccess: () => {
      toast('success', 'Added to meal plan!');
      setShowAddToMealPlan(false);
    },
    onError: (e: any) => toast('error', e.message),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearchQuery(searchInput.trim());
  };

  const clearSearch = () => { setSearchInput(''); setSearchQuery(''); };

  function openCustomMeal(meal: CustomMeal, templateOverride?: RecipeTemplate) {
    const recentEntry = recent.find((e) => e.mealId === meal.id);

    // Resolve settings & link FIRST so we can use the linked meal's servings
    const settingsSaved = templateOverride ? true : (recentEntry?.settings?.settingsSaved === true);
    const linkedDate = templateOverride?.linkedMealPlanDate ?? recentEntry?.settings?.linkedMealPlanDate;
    const linkedType = templateOverride?.linkedMealPlanType ?? recentEntry?.settings?.linkedMealPlanType;

    let linked: import('@/types').MealPlan | null = null;
    if (settingsSaved && linkedDate) {
      linked = upcomingMealPlan.find(
        (mp) => mp.date === linkedDate && mp.mealType === linkedType
      ) ?? null;
    }

    // Servings priority: template override → linked meal plan servings → saved recent settings → meal default → 2
    const servings = templateOverride?.servings
      ?? (linked?.servings ?? null)
      ?? recentEntry?.settings?.servings
      ?? meal.servings
      ?? 2;

    setCustomMealServings(servings);
    setShowCustomMealPlan(false);
    setShowMealPlanLinker(false);
    setLinkedMealPlan(linked);
    setRecipeGuideMode(settingsSaved);
    // Restore previously checked ingredients
    setCheckedIngredients(new Set(recentEntry?.settings?.lastCheckedIngredients ?? []));
    setSelectedCustomMeal(meal);
    recordOpen({ mealId: meal.id, name: meal.name, mealType: meal.mealType, photoUrl: meal.photoUrl ?? null, userId: user?.id });
  }

  async function handleScanRecipe(file: File) {
    setScanning(true);
    try {
      const result = await api.scanRecipeFromPhoto(file);
      if (result.name) setFormName(result.name);
      if (result.mealType) setFormMealType(result.mealType);
      if (result.servings) setFormServings(result.servings);
      if (result.calories) setFormCalories(String(result.calories));
      if (result.prepTime) setFormPrepTime(String(result.prepTime));
      if (result.ingredients.length > 0) setFormIngredients(result.ingredients);
      if (result.preparationNotes) setFormInstructions(result.preparationNotes);
      if (result.tags.length > 0) setFormTags(result.tags.join(', '));
      toast('success', 'Recipe scanned! Review and save.');
    } catch (e: any) {
      toast('error', 'Could not scan recipe', e.message);
    } finally {
      setScanning(false);
    }
  }

  async function handleFormPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormPhotoFile(file);
    const url = URL.createObjectURL(file);
    setFormPhotoPreview(url);
  }

  async function handleSubmitForm(skipDuplicateCheck = false) {
    if (!formName.trim()) { toast('error', 'Recipe name is required'); return; }

    if (!skipDuplicateCheck) {
      try {
        const check = await api.checkRecipeDuplicate(formName.trim());
        if (check.isDuplicate && check.existing) {
          setFormDuplicate(check.existing);
          return;
        }
      } catch { /* non-critical — proceed */ }
    }

    const ingredients = formIngredients.map((i) => i.trim()).filter(Boolean);
    const tags = formTags.split(',').map((t) => t.trim()).filter(Boolean);

    const mealData: Parameters<typeof api.createCustomMeal>[0] = {
      name: formName.trim(),
      mealType: formMealType,
      servings: formServings,
      calories: formCalories ? Number(formCalories) : undefined,
      prepTime: formPrepTime ? Number(formPrepTime) : undefined,
      ingredients,
      preparationNotes: formInstructions.trim() || null,
      tags,
      skipDuplicateCheck,
    };

    if (formPhotoFile) {
      // Upload photo first, then create meal with photoUrl
      try {
        const { photoUrl } = await api.uploadRecipePhotoOnly(formPhotoFile);
        mealData.photoUrl = photoUrl;
      } catch { /* photo upload failed — proceed without it */ }
    }

    createMealMutation.mutate(mealData);
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const recipes = searchQuery ? results : [];
  const matchedSavedMeals = searchQuery
    ? savedMeals.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];
  const filteredSavedMeals = activeTab === 'all'
    ? savedMeals
    : savedMeals.filter((m) => m.mealType.toLowerCase() === activeTab);
  const tabCount = (tab: MealTab) =>
    tab === 'all' ? savedMeals.length : savedMeals.filter((m) => m.mealType.toLowerCase() === tab).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Recipes</h1>
        <p className="text-sm text-text-secondary mt-0.5">Your saved meals and a searchable recipe database</p>
      </div>

      {/* ── Search bar ── */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search your recipes or discover new ones…"
          className="flex-1"
        />
        {searchQuery && (
          <Button type="button" variant="ghost" onClick={clearSearch} className="px-3">
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button type="submit" disabled={searching}>
          <Search className="h-4 w-4 mr-1" /> Search
        </Button>
      </form>

      {/* ══════════════════════════════════════════
          SEARCH RESULTS VIEW
      ══════════════════════════════════════════ */}
      {searchQuery && (
        <div className="space-y-6">
          {/* My Recipes matches */}
          {matchedSavedMeals.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BookMarked className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">From My Recipes</h2>
                <span className="text-xs text-muted bg-slate-100 dark:bg-[#283447] rounded-full px-2 py-0.5">{matchedSavedMeals.length}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {matchedSavedMeals.map((meal) => (
                  <SavedMealCard
                    key={meal.id}
                    meal={meal}
                    onClick={() => openCustomMeal(meal)}
                    onDelete={() => deleteSavedMealMutation.mutate(meal.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* TheMealDB results */}
          {searching && (
            <section>
              <h2 className="text-sm font-semibold mb-3">Recipe Database</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[1,2,3,4,5,6].map((n) => <Skeleton key={n} className="h-36 rounded-xl" />)}
              </div>
            </section>
          )}
          {!searching && searchFailed && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ChefHat className="h-4 w-4 text-text-muted" />
                <h2 className="text-sm font-semibold">Recipe Database</h2>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <span>Recipe database is currently unavailable on this network. Your saved recipes still work.</span>
              </div>
            </section>
          )}
          {!searching && !searchFailed && recipes.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ChefHat className="h-4 w-4 text-text-muted" />
                <h2 className="text-sm font-semibold">Recipe Database</h2>
                <span className="text-xs text-muted bg-slate-100 dark:bg-[#283447] rounded-full px-2 py-0.5">{recipes.length}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {recipes.map((recipe) => (
                  <button
                    key={recipe.externalId || recipe.id}
                    onClick={() => setSelectedRecipe(recipe)}
                    className="text-left rounded-xl overflow-hidden border border-card-border bg-surface hover:shadow-md transition-shadow"
                  >
                    {recipe.thumbnail ? (
                      <img src={recipe.thumbnail} alt={recipe.name} className="w-full h-28 object-cover" />
                    ) : (
                      <div className="w-full h-28 bg-surface-hover flex items-center justify-center">
                        <ChefHat className="h-8 w-8 text-text-muted" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-sm font-medium text-text-primary line-clamp-2">{recipe.name}</p>
                      {recipe.category && <p className="text-xs text-text-muted mt-0.5">{recipe.category}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
          {!searching && !searchFailed && recipes.length === 0 && matchedSavedMeals.length === 0 && (
            <div className="text-center py-12">
              <ChefHat className="h-12 w-12 mx-auto text-text-muted mb-3" />
              <p className="text-text-secondary">No results for "{searchQuery}"</p>
              <p className="text-text-muted text-sm mt-1">Try a shorter search term, or check My Recipes.</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          BROWSE VIEW (no search)
      ══════════════════════════════════════════ */}
      {!searchQuery && (
        <div className="space-y-6">

          {/* ── Recently Used horizontal scroll (always visible) ── */}
          {recent.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-semibold">Recently Used</h2>
                <span className="text-xs text-muted bg-slate-100 dark:bg-[#283447] rounded-full px-2 py-0.5">{recent.length}</span>
                <button
                  onClick={() => setBrowseTab('active')}
                  className="ml-auto text-[11px] text-primary hover:underline font-medium"
                >
                  View all →
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {recent.map((entry) => {
                  const meal = savedMeals.find((m) => m.id === entry.mealId);
                  const isConfirming = removeConfirmId === entry.mealId;
                  return (
                    <div key={entry.mealId} className="flex-shrink-0 w-28 group relative">
                      <button
                        onClick={() => meal && openCustomMeal(meal)}
                        disabled={!meal}
                        className="w-full rounded-xl overflow-hidden border border-card-border bg-surface hover:shadow-md transition-all text-left disabled:opacity-40"
                      >
                        {/* Use live meal.photoUrl if available, fallback to cached entry.photoUrl */}
                        {(meal?.photoUrl ?? entry.photoUrl) ? (
                          <img src={(meal?.photoUrl ?? entry.photoUrl)!} alt={entry.name} className="w-full h-20 object-cover" />
                        ) : (
                          <div className={cn('w-full h-20 bg-gradient-to-br flex items-center justify-center',
                            MEAL_TYPE_CONFIG[entry.mealType]?.grad ?? 'from-slate-400 to-slate-600')}>
                            <span className="text-2xl">{MEAL_TYPE_CONFIG[entry.mealType]?.emoji ?? '🍴'}</span>
                          </div>
                        )}
                        <div className="p-1.5">
                          <p className="text-[11px] font-medium text-text-primary line-clamp-2 leading-tight">{entry.name}</p>
                          <p className="text-[9px] text-muted mt-0.5" title={safeFmtDateTime(entry.openedAt)}>
                            {safeFmtDate(entry.openedAt, { month: 'short', day: 'numeric' })}
                          </p>
                          {entry.userId && (
                            <p className="text-[8px] text-text-muted/60 mt-0.5 truncate" title={user?.email ?? entry.userId}>
                              {user?.fullName ?? user?.email ?? entry.userId.slice(0, 8)}
                            </p>
                          )}
                        </div>
                      </button>
                      {/* Delete button */}
                      {isConfirming ? (
                        <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-1 p-1">
                          <p className="text-white text-[9px] text-center font-medium leading-tight">Remove from recent?</p>
                          <div className="flex gap-1 mt-0.5">
                            <button onClick={() => { removeEntry(entry.mealId); setRemoveConfirmId(null); }}
                              className="px-2 py-0.5 bg-red-500 text-white text-[9px] rounded font-bold">Yes</button>
                            <button onClick={() => setRemoveConfirmId(null)}
                              className="px-2 py-0.5 bg-white/20 text-white text-[9px] rounded">No</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setRemoveConfirmId(entry.mealId); }}
                          className="absolute top-1 right-1 p-0.5 rounded bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"
                          title="Remove from recently used"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Section sub-tab navigator ── */}
          <div className="flex items-center gap-1 border-b border-card-border">
            {[
              { key: 'recipes', label: 'My Recipes', count: savedMeals.length, icon: <BookMarked className="h-3.5 w-3.5" /> },
              { key: 'active', label: 'Active', count: recent.length, icon: <PlayCircle className="h-3.5 w-3.5" /> },
              { key: 'templates', label: 'Templates', count: templates.length, icon: <Layers3 className="h-3.5 w-3.5" /> },
              { key: 'history', label: 'History', count: (history?.length ?? 0), icon: <History className="h-3.5 w-3.5" /> },
            ].map(({ key, label, count, icon }) => (
              <button
                key={key}
                onClick={() => setBrowseTab(key as typeof browseTab)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  browseTab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                )}
              >
                {icon} {label}
                {count > 0 && (
                  <span className={cn('rounded-full px-1.5 text-[10px]',
                    browseTab === key ? 'bg-primary/15 text-primary' : 'bg-slate-100 dark:bg-[#283447] text-muted')}>
                    {count}
                  </span>
                )}
              </button>
            ))}
            <div className="ml-auto pb-1">
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)} className="h-7 text-xs gap-1">
                <FilePlus className="h-3.5 w-3.5" /> Add Recipe
              </Button>
            </div>
          </div>

          {/* ── My Recipes tab ── */}
          {browseTab === 'recipes' && (
            <section className="space-y-4">
              {savedMeals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-card-border p-6 text-center">
                  <BookMarked className="h-8 w-8 mx-auto text-text-muted mb-2" />
                  <p className="text-sm text-text-secondary font-medium">No saved recipes yet</p>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Recipes are automatically saved when you use the AI Recommendations page.<br />
                    Tap <strong>Add Recipe</strong> above to add one manually.
                  </p>
                </div>
              ) : (
                <>
                  {/* Category tabs */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {MEAL_TABS.map((tab) => {
                      const count = tabCount(tab);
                      if (tab !== 'all' && count === 0) return null;
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={cn(
                            'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                            activeTab === tab
                              ? 'bg-primary text-white'
                              : 'bg-surface-hover border border-card-border text-text-secondary hover:border-primary/40'
                          )}
                        >
                          {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                          {count > 0 && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', activeTab === tab ? 'bg-white/20' : 'bg-slate-200 dark:bg-[#374151]')}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {filteredSavedMeals.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {filteredSavedMeals.map((meal) => (
                        <SavedMealCard
                          key={meal.id}
                          meal={meal}
                          onClick={() => openCustomMeal(meal)}
                          onDelete={() => deleteSavedMealMutation.mutate(meal.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted text-center py-6">No {activeTab} recipes saved yet.</p>
                  )}
                </>
              )}

              {/* Discover section lives inside My Recipes tab */}
              <div className="pt-4 border-t border-card-border">
                <div className="flex items-center gap-2 mb-2">
                  <ChefHat className="h-4 w-4 text-text-muted" />
                  <h2 className="text-sm font-semibold text-text-secondary">Discover Recipes</h2>
                </div>
                <p className="text-xs text-text-muted mb-3">Search above or browse a category.</p>
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 20).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setSearchInput(cat); setSearchQuery(cat); }}
                      className="px-3 py-1 rounded-full text-sm bg-surface-hover border border-card-border hover:bg-primary hover:text-white transition-colors"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Templates tab ── */}
          {browseTab === 'templates' && (
            <section>
              {templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-card-border p-6 text-center">
                  <Layers3 className="h-8 w-8 mx-auto text-text-muted mb-2" />
                  <p className="text-sm text-text-secondary font-medium">No saved templates yet</p>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Open any recipe, configure servings &amp; a meal plan link, then tap <strong>Save Template</strong> in the guide.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-text-muted mb-3">Tap a template to open with pre-configured servings and meal plan link.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {templates.map((tpl) => {
                      const meal = savedMeals.find((m) => m.id === tpl.mealId);
                      const tplCfg = MEAL_TYPE_CONFIG[tpl.mealType.toLowerCase()] ?? { grad: 'from-slate-400 to-slate-600', emoji: '🍴' };
                      return (
                        <div key={tpl.id} className="relative rounded-xl overflow-hidden border border-card-border bg-surface group">
                          <button className="w-full text-left" onClick={() => meal && openCustomMeal(meal, tpl)} disabled={!meal}>
                            {tpl.photoUrl ? (
                              <img src={tpl.photoUrl} alt={tpl.mealName} className="w-full h-24 object-cover" />
                            ) : (
                              <div className={cn('w-full h-24 bg-gradient-to-br flex items-center justify-center', tplCfg.grad)}>
                                <span className="text-3xl">{tplCfg.emoji}</span>
                              </div>
                            )}
                            <div className="p-2">
                              <p className="text-xs font-semibold text-text-primary line-clamp-1">{tpl.mealName}</p>
                              <p className="text-[10px] text-muted mt-0.5">{tpl.servings} serving{tpl.servings !== 1 ? 's' : ''}{tpl.linkedMealPlanDate ? ' · Linked' : ''}</p>
                              {tpl.savedAt && <p className="text-[9px] text-text-muted/60 mt-0.5">{safeFmtDate(tpl.savedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                              {!meal && <p className="text-[10px] text-amber-500 mt-0.5">Recipe removed</p>}
                            </div>
                          </button>
                          <button onClick={() => removeTemplate(tpl.id)}
                            className="absolute top-1.5 right-1.5 p-1 rounded bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── Active Recipes tab ── */}
          {browseTab === 'active' && (
            <section>
              {recent.length === 0 ? (
                <div className="rounded-xl border border-dashed border-card-border p-6 text-center">
                  <PlayCircle className="h-8 w-8 mx-auto text-text-muted mb-2" />
                  <p className="text-sm text-text-secondary font-medium">No active recipes yet</p>
                  <p className="text-xs text-text-muted mt-1">Recipes you open and interact with in the last 7 days appear here. The recently used row is a quick link to these.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-text-muted mb-3">Your active recipes from the last 7 days. The recently used row links directly here. Click a recipe to resume where you left off.</p>
                  <div className="space-y-3">
                    {recent.map((entry) => {
                      const meal = savedMeals.find((m) => m.id === entry.mealId);
                      const cfg = MEAL_TYPE_CONFIG[entry.mealType] ?? { grad: 'from-slate-400 to-slate-600', emoji: '🍴' };
                      const hasSavedSettings = entry.settings?.settingsSaved;
                      const changelogOpen = activeChangelogId === entry.mealId;
                      return (
                        <div key={entry.mealId} className={cn('rounded-xl border bg-surface overflow-hidden', hasSavedSettings ? 'border-primary/30 ring-1 ring-primary/15' : 'border-card-border')}>
                          <div className="flex items-stretch gap-0">
                            {/* Thumbnail */}
                            {(meal?.photoUrl ?? entry.photoUrl) ? (
                              <img src={(meal?.photoUrl ?? entry.photoUrl)!} alt={entry.name} className="w-16 h-16 object-cover flex-shrink-0" />
                            ) : (
                              <div className={cn('w-16 h-16 bg-gradient-to-br flex items-center justify-center flex-shrink-0', cfg.grad)}>
                                <span className="text-2xl">{cfg.emoji}</span>
                              </div>
                            )}
                            {/* Main content */}
                            <div className="flex-1 min-w-0 p-2.5">
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-text-primary line-clamp-1">{entry.name}</p>
                                  <p className="text-[10px] text-muted capitalize">{entry.mealType}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {hasSavedSettings && (
                                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">Saved</span>
                                  )}
                                  <button
                                    onClick={() => meal && openCustomMeal(meal)}
                                    disabled={!meal}
                                    className="text-[10px] font-medium bg-primary text-white px-2.5 py-1 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40"
                                  >
                                    {hasSavedSettings ? 'Resume →' : 'Open'}
                                  </button>
                                </div>
                              </div>
                              {/* State summary */}
                              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-muted">
                                {entry.settings?.servings && (
                                  <span>{entry.settings.servings} serving{entry.settings.servings !== 1 ? 's' : ''}</span>
                                )}
                                {entry.settings?.linkedMealPlanDate && (
                                  <span className="text-primary">Linked · {entry.settings.linkedProfileName ?? entry.settings.linkedMealPlanType}</span>
                                )}
                                {entry.settings?.lastCheckedIngredients?.length ? (
                                  <span className="text-emerald-600">{entry.settings.lastCheckedIngredients.length} checked</span>
                                ) : null}
                                {entry.settings?.lastStep != null && (
                                  <span>Step {entry.settings.lastStep + 1}</span>
                                )}
                                <span className="ml-auto text-[9px]">Last used {safeFmtDate(entry.openedAt, { month: 'short', day: 'numeric' })}</span>
                              </div>
                            </div>
                          </div>
                          {/* Changelog toggle */}
                          <button
                            onClick={() => setActiveChangelogId(changelogOpen ? null : entry.mealId)}
                            className="w-full flex items-center justify-between px-3 py-1.5 border-t border-card-border text-[10px] text-muted hover:bg-surface-hover transition-colors"
                          >
                            <span>Session details &amp; changes</span>
                            <ChevronDownIcon className={cn('h-3 w-3 transition-transform', changelogOpen && 'rotate-180')} />
                          </button>
                          {changelogOpen && (
                            <div className="px-3 py-2 bg-slate-50 dark:bg-[#1e2a38] text-[10px] text-muted space-y-1">
                              <div className="flex justify-between">
                                <span>First opened</span>
                                <span>{safeFmtDateTime(entry.openedAt)}</span>
                              </div>
                              {entry.settings?.lastUpdatedAt && (
                                <div className="flex justify-between">
                                  <span>Settings last saved</span>
                                  <span>{safeFmtDateTime(entry.settings.lastUpdatedAt)}</span>
                                </div>
                              )}
                              {entry.settings?.servings && (
                                <div className="flex justify-between">
                                  <span>Serving count</span>
                                  <span>{entry.settings.servings}</span>
                                </div>
                              )}
                              {entry.settings?.linkedMealPlanDate && (
                                <div className="flex justify-between">
                                  <span>Linked meal</span>
                                  <span className="capitalize">{entry.settings.linkedMealPlanType} on {safeFmtDate(entry.settings.linkedMealPlanDate + 'T12:00', { month: 'short', day: 'numeric' })}</span>
                                </div>
                              )}
                              {entry.settings?.lastCheckedIngredients?.length ? (
                                <div>
                                  <p className="font-medium mb-0.5">Checked ingredients ({entry.settings.lastCheckedIngredients.length}):</p>
                                  <ul className="space-y-0.5 pl-2">
                                    {entry.settings.lastCheckedIngredients.map((ing) => (
                                      <li key={ing} className="flex items-center gap-1">
                                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" /> {ing}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              <div className="pt-1 border-t border-card-border">
                                <button
                                  onClick={() => { removeEntry(entry.mealId); }}
                                  className="text-red-400 hover:text-red-600 font-medium"
                                >
                                  Remove from Active
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── History tab (>7 days ago) ── */}
          {browseTab === 'history' && (
            <section>
              {history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-card-border p-6 text-center">
                  <History className="h-8 w-8 mx-auto text-text-muted mb-2" />
                  <p className="text-sm text-text-secondary font-medium">No recipe history yet</p>
                  <p className="text-xs text-text-muted mt-1">Recipes you cooked more than 7 days ago will appear here.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-text-muted mb-3">Recipes opened more than 7 days ago. Find them in <button className="underline" onClick={() => setBrowseTab('recipes')}>My Recipes</button> to cook again.</p>
                  <div className="space-y-2">
                    {history.map((entry) => (
                      <div key={entry.mealId} className="flex items-center gap-3 p-3 rounded-xl border border-card-border bg-surface">
                        {entry.photoUrl ? (
                          <img src={entry.photoUrl} alt={entry.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br',
                            MEAL_TYPE_CONFIG[entry.mealType]?.grad ?? 'from-slate-400 to-slate-600')}>
                            <span className="text-lg">{MEAL_TYPE_CONFIG[entry.mealType]?.emoji ?? '🍴'}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary line-clamp-1">{entry.name}</p>
                          <p className="text-xs text-text-muted capitalize">
                            {entry.mealType} · {safeFmtDate(entry.openedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          {entry.userId && <p className="text-[9px] text-text-muted/60 mt-0.5">UID: {entry.userId.slice(0, 8)}…</p>}
                        </div>
                        <span className="text-[10px] text-text-muted bg-surface-hover px-2 py-0.5 rounded-full shrink-0">Past</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          SAVED MEAL DETAIL DIALOG — RECIPE GUIDE
      ══════════════════════════════════════════ */}
      <Dialog
        open={!!selectedCustomMeal}
        onOpenChange={(v) => {
          if (!v) {
            setSelectedCustomMeal(null);
            setShowCustomMealPlan(false);
            setShowMealPlanLinker(false);
            setRecipeGuideMode(false);
            setLinkedMealPlan(null);
          }
        }}
      >
        {selectedCustomMeal && (() => {
          const mealPlanMatches = upcomingMealPlan.filter(
            (mp) => mp.mealName.toLowerCase() === selectedCustomMeal.name.toLowerCase()
          );
          const alreadyPlanned = mealPlanMatches.length > 0;
          const cfg = MEAL_TYPE_CONFIG[selectedCustomMeal.mealType.toLowerCase()] ?? { grad: 'from-slate-400 to-slate-600', emoji: '🍴' };
          const heroPhoto = selectedCustomMeal.photoUrl || mealDbData?.photo;

          return (
            <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0 [&>button:last-child]:hidden">
              {/* ── Hero photo, full-bleed ── */}
              <div className="relative w-full h-56 overflow-hidden flex-shrink-0 bg-surface-hover">
                {loadingPhoto ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-muted animate-spin" />
                  </div>
                ) : heroPhoto ? (
                  <img src={heroPhoto} alt={selectedCustomMeal.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={cn('w-full h-full bg-gradient-to-br flex flex-col items-center justify-center gap-2', cfg.grad)}>
                    <span className="text-7xl">{cfg.emoji}</span>
                  </div>
                )}
                {/* Bottom gradient for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {/* Meal name over gradient */}
                <div className="absolute bottom-3 left-4 right-12">
                  <h2 className="text-lg font-bold text-white leading-tight drop-shadow">{selectedCustomMeal.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-white/80 text-xs capitalize">{selectedCustomMeal.mealType}</span>
                    {selectedCustomMeal.calories && <span className="text-white/70 text-xs">{selectedCustomMeal.calories} cal/serving</span>}
                    {selectedCustomMeal.prepTime && <span className="text-white/70 text-xs flex items-center gap-0.5"><Clock className="h-3 w-3" /> {selectedCustomMeal.prepTime}m</span>}
                  </div>
                </div>
                {/* Tags */}
                <div className="absolute top-3 left-3 flex gap-1 flex-wrap max-w-[60%]">
                  {selectedCustomMeal.tags?.filter((t) => t).slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/40 text-white backdrop-blur-sm">{tag}</span>
                  ))}
                </div>
                {/* Photo upload button */}
                <button
                  onClick={() => dialogPhotoRef.current?.click()}
                  disabled={uploadingDialogPhoto}
                  className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-black/50 text-white text-xs hover:bg-black/70 transition-colors backdrop-blur-sm"
                >
                  {uploadingDialogPhoto ? <><Loader2 className="h-3 w-3 animate-spin" /> Uploading</> : <><Camera className="h-3 w-3" /> {selectedCustomMeal.photoUrl ? 'Change' : 'Add Photo'}</>}
                </button>
                <input ref={dialogPhotoRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; setUploadingDialogPhoto(true); uploadPhotoMutation.mutate({ id: selectedCustomMeal.id, file }); }} />
                {/* Close */}
                <button onClick={() => { setSelectedCustomMeal(null); setRecipeGuideMode(false); setLinkedMealPlan(null); }}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* ── Macros per-serving strip ── */}
              {(() => {
                // Prefer stored macros; fall back to AI estimate
                const cal = selectedCustomMeal.calories ?? estimatedMacros?.calories;
                const pro = selectedCustomMeal.protein ?? estimatedMacros?.protein;
                const crb = selectedCustomMeal.carbs ?? estimatedMacros?.carbs;
                const fat = selectedCustomMeal.fat ?? estimatedMacros?.fat;
                const fib = selectedCustomMeal.fiber ?? estimatedMacros?.fiber;
                const isStored = selectedCustomMeal.protein != null;
                if (!cal && !pro) return null;
                return (
                  <div className="flex items-center justify-around gap-1 px-4 py-2.5 bg-surface-hover border-b border-card-border">
                    {cal && <div className="text-center"><p className="text-sm font-bold text-text-primary">{cal}</p><p className="text-[9px] text-muted uppercase tracking-wide">Cal</p></div>}
                    {pro && <><div className="w-px h-6 bg-card-border" /><div className="text-center"><p className="text-sm font-bold text-text-primary">{pro}g</p><p className="text-[9px] text-muted uppercase tracking-wide">Protein</p></div></>}
                    {crb && <><div className="w-px h-6 bg-card-border" /><div className="text-center"><p className="text-sm font-bold text-text-primary">{crb}g</p><p className="text-[9px] text-muted uppercase tracking-wide">Carbs</p></div></>}
                    {fat && <><div className="w-px h-6 bg-card-border" /><div className="text-center"><p className="text-sm font-bold text-text-primary">{fat}g</p><p className="text-[9px] text-muted uppercase tracking-wide">Fat</p></div></>}
                    {fib && <><div className="w-px h-6 bg-card-border" /><div className="text-center"><p className="text-sm font-bold text-text-primary">{fib}g</p><p className="text-[9px] text-muted uppercase tracking-wide">Fiber</p></div></>}
                    <p className="text-[8px] text-text-muted/50 ml-auto italic">per serving · {isStored ? 'saved' : 'estimated'}</p>
                  </div>
                );
              })()}

              {/* ── Content area ── */}
              <div className="p-5">
                {recipeGuideMode ? (
                  /* ════════════════════════════ GUIDE MODE ════════════════════════════ */
                  <>
                    {/* Settings summary bar */}
                    <div className="flex items-center gap-2 mb-5 p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl">
                      <div className="flex-1 min-w-0 text-xs">
                        <span className="font-bold text-primary">{customMealServings} serving{customMealServings !== 1 ? 's' : ''}</span>
                        {linkedMealPlan && (
                          <span className="text-text-secondary ml-1.5">
                            · Linked: <span className="capitalize">{linkedMealPlan.mealType}</span> on {safeFmtDate(linkedMealPlan.date + 'T12:00', { month: 'short', day: 'numeric' })}
                            {linkedMealPlan.profile?.name ? ` (${linkedMealPlan.profile.name})` : ''}
                          </span>
                        )}
                      </div>
                      <button onClick={() => setRecipeGuideMode(false)}
                        className="text-[11px] text-primary hover:underline shrink-0 font-medium">Edit Settings</button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-7 shrink-0"
                        onClick={() => {
                          saveTemplate({ mealId: selectedCustomMeal.id, mealName: selectedCustomMeal.name, mealType: selectedCustomMeal.mealType, photoUrl: selectedCustomMeal.photoUrl ?? null, servings: customMealServings, linkedMealPlanDate: linkedMealPlan?.date, linkedMealPlanType: linkedMealPlan?.mealType, linkedProfileName: linkedMealPlan?.profile?.name });
                          toast('success', 'Saved as Template!');
                        }}
                      >
                        <Bookmark className="h-3.5 w-3.5" /> Save as Template
                      </Button>
                    </div>

                    {/* Ingredients with checkboxes + smart scaling */}
                    {(() => {
                      const ratio = customMealServings / Math.max(selectedCustomMeal.servings ?? 1, 1);
                      const scaling = selectedCustomMeal.ingredientScaling ?? null;
                      const isScaled = Math.abs(ratio - 1) > 0.05;
                      const hasAnnotations = scaling && Object.keys(scaling).length > 0;
                      return (
                        <div className="mb-5">
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 flex-wrap">
                            <ShoppingCart className="h-4 w-4 text-primary" />
                            Ingredients
                            <span className="text-xs font-normal text-muted">({selectedCustomMeal.ingredients.length} items · tap to check off)</span>
                            {isScaled && (
                              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                                {ratio > 1 ? `×${Math.round(ratio * 10) / 10}` : `÷${Math.round((1/ratio) * 10) / 10}`} {hasAnnotations ? 'smart-scaled' : 'scaled'}
                              </span>
                            )}
                            {isScaled && !hasAnnotations && (
                              <button
                                onClick={() => annotateScalingMutation.mutate()}
                                disabled={annotateScalingMutation.isPending}
                                className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1"
                              >
                                {annotateScalingMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" /> Annotating…</> : '✦ Smart Scale'}
                              </button>
                            )}
                          </h3>
                          {isScaled && hasAnnotations && (
                            <div className="flex items-center gap-3 mb-2 text-[9px] text-muted">
                              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" /> Scales with servings</span>
                              <span className="flex items-center gap-1"><span className="inline-block px-1 py-0 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded text-[9px]">~</span> Partially adjusts</span>
                              <span className="flex items-center gap-1"><span className="inline-block px-1 py-0 bg-slate-100 dark:bg-slate-800 text-muted rounded text-[9px]">fixed</span> Stays the same</span>
                            </div>
                          )}
                          <ul className="space-y-1">
                            {selectedCustomMeal.ingredients.map((ing, i) => {
                              const category = scaling?.[ing] ?? undefined;
                              const scaled = scaleIngredient(ing, ratio, category);
                              const isFixed = category === 'fixed' && isScaled;
                              const isModerate = category === 'moderate' && isScaled;
                              return (
                                <div key={i} className="flex items-center gap-1.5">
                                  <div className="flex-1 min-w-0">
                                    <IngredientCheckItem
                                      ingredient={scaled}
                                      checked={checkedIngredients.has(scaled)}
                                      onToggle={(ingName, isChecked) => {
                                        setCheckedIngredients((prev) => {
                                          const next = new Set(prev);
                                          if (isChecked) next.add(ingName); else next.delete(ingName);
                                          if (selectedCustomMeal) {
                                            updateSettings(selectedCustomMeal.id, { lastCheckedIngredients: Array.from(next), lastUpdatedAt: new Date().toISOString() });
                                          }
                                          return next;
                                        });
                                      }}
                                    />
                                  </div>
                                  {isFixed && <span title="Amount stays the same regardless of servings (e.g. salt, spices, seasonings)" className="text-[9px] text-muted bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">fixed</span>}
                                  {isModerate && <span title="Amount partially adjusts — doesn't scale fully with servings (e.g. oil, butter, aromatics)" className="text-[9px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded shrink-0">~&nbsp;partial</span>}
                                </div>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* Measurement Converter */}
                    <div className="mb-5">
                      <MeasurementConverter />
                    </div>

                    {/* Step-by-step instructions */}
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Wand2 className="h-4 w-4 text-primary" />
                          Step-by-Step Instructions
                        </h3>
                        {!mealDbData?.instructions && storedHasSteps && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-text-muted" onClick={() => generateStepsMutation.mutate()} disabled={generateStepsMutation.isPending}>
                            <Wand2 className="h-3 w-3" /> Regenerate
                          </Button>
                        )}
                      </div>

                      {generateStepsMutation.isPending ? (
                        <div className="rounded-xl bg-surface-hover p-5 flex items-center gap-3">
                          <Loader2 className="h-6 w-6 text-primary animate-spin shrink-0" />
                          <div>
                            <p className="text-sm font-semibold">Writing your recipe guide…</p>
                            <p className="text-xs text-muted mt-0.5">Creating clear, beginner-friendly step-by-step instructions. Takes ~10 seconds.</p>
                          </div>
                        </div>
                      ) : displayInstructions ? (
                        (() => {
                          const steps = parseSteps(displayInstructions);
                          return steps.length > 1 ? (
                            <ol className="space-y-4">
                              {steps.map((step, i) => (
                                <li key={i} className="flex gap-3">
                                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center mt-0.5 shadow-sm">{i + 1}</span>
                                  <div className="flex-1 pt-1.5">
                                    <p className="text-sm text-text-primary leading-relaxed">{step}</p>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{displayInstructions}</p>
                          );
                        })()
                      ) : (
                        <div className="rounded-xl border-2 border-dashed border-primary/20 p-5 text-center bg-primary/5 dark:bg-primary/10">
                          <Wand2 className="h-7 w-7 mx-auto text-primary mb-2" />
                          <p className="text-sm font-semibold text-text-primary">Generate Your Recipe Guide</p>
                          <p className="text-xs text-text-muted mt-1 mb-4 max-w-xs mx-auto leading-relaxed">
                            Get a clear, beginner-friendly step-by-step cooking guide written specifically for this meal.
                          </p>
                          <Button onClick={() => generateStepsMutation.mutate()} className="gap-1.5">
                            <Wand2 className="h-4 w-4" /> Generate Recipe Guide
                          </Button>
                        </div>
                      )}

                      {/* AI reason note (if no real steps yet) */}
                      {!displayInstructions && !generateStepsMutation.isPending && selectedCustomMeal.preparationNotes && !storedHasSteps && (
                        <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Why this meal was recommended</p>
                          </div>
                          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{selectedCustomMeal.preparationNotes}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="space-y-2 pt-2 border-t border-card-border">
                      <Button className="w-full" onClick={() => addCustomMealToListMutation.mutate()} disabled={addCustomMealToListMutation.isPending}>
                        {addCustomMealToListMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                        {addCustomMealToListMutation.isPending ? 'Adding to List…' : `Add ${selectedCustomMeal.ingredients.length} Ingredients to Shopping List`}
                      </Button>

                      {alreadyPlanned ? (
                        <>
                          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30">
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Already in your Meal Plan</p>
                            {mealPlanMatches.slice(0, 3).map((mp) => (
                              <p key={mp.id} className="text-xs text-emerald-600 dark:text-emerald-300">
                                <span className="capitalize font-medium">{mp.mealType}</span> · {safeFmtDate(mp.date + 'T12:00', { weekday: 'short', month: 'short', day: 'numeric' })}
                                {mp.profile?.name ? ` · ${mp.profile.name}` : ''}
                              </p>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" disabled className="flex-1 opacity-40 cursor-not-allowed">
                              <CalendarDays className="h-4 w-4 mr-2" /> Already Planned
                            </Button>
                            <Button variant="secondary" onClick={() => { setSelectedCustomMeal(null); navigate('/meal-plan'); }} className="flex-1 gap-1.5">
                              <ExternalLink className="h-4 w-4" /> View in Meal Plan
                            </Button>
                          </div>
                        </>
                      ) : !showCustomMealPlan ? (
                        <Button variant="outline" className="w-full" onClick={() => setShowCustomMealPlan(true)}>
                          <CalendarDays className="h-4 w-4 mr-2" /> Add to Meal Plan
                        </Button>
                      ) : (
                        <div className="border border-card-border rounded-xl p-3 space-y-2">
                          <p className="text-xs font-medium text-muted">Schedule in Meal Plan</p>
                          <div className="flex gap-2">
                            <Input type="date" value={customMealPlanDate} onChange={(e) => setCustomMealPlanDate(e.target.value)} className="flex-1" />
                            <select value={customMealPlanType} onChange={(e) => setCustomMealPlanType(e.target.value)}
                              className="border border-card-border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/30">
                              <option value="breakfast">Breakfast</option>
                              <option value="lunch">Lunch</option>
                              <option value="dinner">Dinner</option>
                              <option value="snack">Snack</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowCustomMealPlan(false)} className="flex-1">Cancel</Button>
                            <Button size="sm" onClick={() => addCustomMealToMealPlanMutation.mutate()} disabled={addCustomMealToMealPlanMutation.isPending} className="flex-1">
                              {addCustomMealToMealPlanMutation.isPending ? 'Adding…' : 'Confirm'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* ════════════════════════════ CONFIGURE MODE ════════════════════════════ */
                  <>
                    <div className="border border-primary/25 rounded-xl p-4 mb-5 bg-primary/5 dark:bg-primary/10">
                      <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
                        <Settings2 className="h-4 w-4" /> Configure This Recipe
                      </h3>

                      {/* Servings */}
                      <div className="mb-4">
                        <label className="text-xs font-medium text-text-secondary block mb-2">How many servings are you making?</label>
                        <div className="flex items-center gap-3">
                          <button className="w-9 h-9 rounded-full border border-card-border bg-white dark:bg-[#1F2937] flex items-center justify-center text-lg font-bold hover:border-primary/60 transition-colors"
                            onClick={() => setCustomMealServings((s) => Math.max(1, s - 1))}>−</button>
                          <span className="text-3xl font-bold text-text-primary w-10 text-center">{customMealServings}</span>
                          <button className="w-9 h-9 rounded-full border border-card-border bg-white dark:bg-[#1F2937] flex items-center justify-center text-lg font-bold hover:border-primary/60 transition-colors"
                            onClick={() => setCustomMealServings((s) => s + 1)}>+</button>
                          <span className="text-sm text-muted ml-1">serving{customMealServings !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Link to meal plan */}
                      <div className="mb-5">
                        <label className="text-xs font-medium text-text-secondary block mb-2">
                          Link to a Meal Plan Entry <span className="text-text-muted font-normal">(optional)</span>
                        </label>
                        <p className="text-[11px] text-text-muted mb-2 leading-relaxed">
                          Linking lets you reference profile dietary restrictions and keeps your recipe connected to a specific meal.
                        </p>
                        {linkedMealPlan ? (
                          <div className="flex items-start gap-2 p-2.5 bg-white dark:bg-[#1F2937] rounded-xl border border-card-border">
                            <CalendarDays className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div className="flex-1 text-xs">
                              <p className="font-semibold text-text-primary capitalize">{linkedMealPlan.mealType} · {safeFmtDate(linkedMealPlan.date + 'T12:00', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                              {linkedMealPlan.profile?.name && <p className="text-text-muted mt-0.5">Profile: {linkedMealPlan.profile.name}</p>}
                              {(linkedMealPlan.profile as any)?.type === 'baby' && <p className="text-amber-600 dark:text-amber-400 text-[10px] mt-0.5 font-medium">⚠ Baby/toddler profile — review ingredient safety</p>}
                            </div>
                            <button onClick={() => setLinkedMealPlan(null)} className="text-text-muted hover:text-red-500 p-1 transition-colors"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : showMealPlanLinker ? (
                          <div>
                            {(() => {
                              const nameLower = selectedCustomMeal.name.toLowerCase();
                              const firstWord = nameLower.split(' ')[0];
                              const relevant = upcomingMealPlan.filter((mp) => mp.mealName.toLowerCase().includes(firstWord));
                              const others = upcomingMealPlan.filter((mp) => !mp.mealName.toLowerCase().includes(firstWord));
                              const renderRow = (mp: import('@/types').MealPlan, highlight?: boolean) => (
                                <button key={mp.id}
                                  onClick={() => {
                                    setLinkedMealPlan(mp);
                                    // Inherit servings from the linked meal plan entry
                                    if (mp.servings) setCustomMealServings(mp.servings);
                                    setShowMealPlanLinker(false);
                                  }}
                                  className={cn('w-full text-left px-3 py-2 rounded-lg transition-colors text-xs flex items-center gap-2',
                                    highlight ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-hover')}>
                                  {highlight && <span className="shrink-0 text-[9px] bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">Match</span>}
                                  <span className="font-semibold capitalize text-primary shrink-0">{mp.mealType}</span>
                                  <span className="text-text-muted shrink-0">{safeFmtDate(mp.date + 'T12:00', { month: 'short', day: 'numeric' })}</span>
                                  <span className="text-text-secondary line-clamp-1 flex-1">{mp.mealName}</span>
                                  {mp.servings && mp.servings > 1 && <span className="text-text-muted shrink-0 text-[10px]">{mp.servings}×</span>}
                                  {mp.profile?.name && <span className="text-text-muted shrink-0 text-[10px]">({mp.profile.name})</span>}
                                </button>
                              );
                              return (
                                <div className="space-y-0.5 max-h-48 overflow-y-auto border border-card-border rounded-xl p-1.5">
                                  {upcomingMealPlan.length === 0 ? (
                                    <p className="text-xs text-text-muted text-center py-3">No upcoming meal plan entries found.</p>
                                  ) : (
                                    <>
                                      {relevant.map((mp) => renderRow(mp, true))}
                                      {relevant.length > 0 && others.length > 0 && (
                                        <p className="text-[10px] text-text-muted px-2 pt-1 pb-0.5">Other entries</p>
                                      )}
                                      {others.map((mp) => renderRow(mp, false))}
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                            <button onClick={() => setShowMealPlanLinker(false)} className="text-xs text-text-muted hover:text-text-primary mt-1.5 ml-1">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setShowMealPlanLinker(true)}
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                            <Plus className="h-3.5 w-3.5" /> Link to a meal plan entry
                          </button>
                        )}
                      </div>

                      <Button className="w-full gap-2"
                        onClick={() => {
                          updateSettings(selectedCustomMeal.id, {
                            servings: customMealServings, settingsSaved: true,
                            linkedMealPlanId: linkedMealPlan?.id,
                            linkedMealPlanDate: linkedMealPlan?.date,
                            linkedMealPlanType: linkedMealPlan?.mealType,
                            linkedProfileName: linkedMealPlan?.profile?.name,
                            linkedProfileId: linkedMealPlan?.profileId,
                            lastUpdatedAt: new Date().toISOString(),
                          });
                          setRecipeGuideMode(true);
                          if (!displayInstructions && !generateStepsMutation.isPending) {
                            generateStepsMutation.mutate();
                          }
                        }}
                      >
                        Start Cooking →
                      </Button>
                    </div>

                    {/* Ingredients preview */}
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                        Ingredients ({selectedCustomMeal.ingredients.length})
                      </h3>
                      <ul className="space-y-1.5">
                        {selectedCustomMeal.ingredients.map((ing, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-text-primary">{ing}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button variant="outline" className="w-full" onClick={() => addCustomMealToListMutation.mutate()} disabled={addCustomMealToListMutation.isPending}>
                      {addCustomMealToListMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                      Add Ingredients to Shopping List
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>

      {/* ══════════════════════════════════════════
          THEMEALDB RECIPE DETAIL DIALOG
      ══════════════════════════════════════════ */}
      <Dialog open={!!selectedRecipe} onOpenChange={(v) => !v && setSelectedRecipe(null)}>
        {selectedRecipe && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            {selectedRecipe.thumbnail && (
              <img src={selectedRecipe.thumbnail} alt={selectedRecipe.name} className="w-full h-48 object-cover rounded-xl mb-4" />
            )}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 className="text-xl font-bold text-text-primary">{selectedRecipe.name}</h2>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {selectedRecipe.category && <Badge variant="secondary">{selectedRecipe.category}</Badge>}
                  {selectedRecipe.cuisine && <Badge variant="outline">{selectedRecipe.cuisine}</Badge>}
                </div>
              </div>
              <button onClick={() => setSelectedRecipe(null)} className="text-text-muted hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold text-text-primary text-sm mb-2">
                Ingredients ({selectedRecipe.ingredients.length})
              </h3>
              <ul className="space-y-1">
                {selectedRecipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="text-text-primary">{ing.name}</span>
                    <span className="text-text-secondary ml-4 shrink-0">{ing.measure}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-3 mb-4 p-3 bg-surface-hover rounded-xl">
              <label className="text-sm font-medium text-text-secondary">Servings:</label>
              <div className="flex items-center gap-2">
                <button
                  className="w-7 h-7 rounded-full border border-card-border flex items-center justify-center text-sm"
                  onClick={() => setServings((s) => Math.max(1, s - 1))}
                >−</button>
                <span className="text-sm font-bold w-6 text-center">{servings}</span>
                <button
                  className="w-7 h-7 rounded-full border border-card-border flex items-center justify-center text-sm"
                  onClick={() => setServings((s) => s + 1)}
                >+</button>
              </div>
            </div>

            <Button
              className="w-full mb-2"
              onClick={() => addToListMutation.mutate({ id: (selectedRecipe.externalId || selectedRecipe.id)!, servings })}
              disabled={addToListMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              {addToListMutation.isPending ? 'Adding…' : `Add ${selectedRecipe.ingredients.length} Ingredients to List`}
            </Button>

            {!showAddToMealPlan ? (
              <Button variant="outline" className="w-full" onClick={() => setShowAddToMealPlan(true)}>
                <CalendarDays className="h-4 w-4 mr-2" /> Add to Meal Plan
              </Button>
            ) : (
              <div className="border border-card-border rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium text-muted">Add to Meal Plan</p>
                <div className="flex gap-2">
                  <Input type="date" value={mealPlanDate} onChange={(e) => setMealPlanDate(e.target.value)} className="flex-1" />
                  <select
                    value={mealPlanType}
                    onChange={(e) => setMealPlanType(e.target.value)}
                    className="border border-card-border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddToMealPlan(false)} className="flex-1">Cancel</Button>
                  <Button size="sm" onClick={() => addToMealPlanMutation.mutate()} disabled={addToMealPlanMutation.isPending} className="flex-1">
                    {addToMealPlanMutation.isPending ? 'Adding…' : 'Confirm'}
                  </Button>
                </div>
              </div>
            )}

            {selectedRecipe.instructions && (
              <div className="mt-5">
                <h3 className="font-semibold text-text-primary text-sm mb-3">Step-by-Step Instructions</h3>
                {(() => {
                  const steps = parseSteps(selectedRecipe.instructions);
                  return steps.length > 1 ? (
                    <ol className="space-y-3">
                      {steps.map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-sm text-text-secondary leading-relaxed pt-1">{step}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{selectedRecipe.instructions}</p>
                  );
                })()}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>

      {/* ══════════════════════════════════════════
          MANUAL RECIPE ENTRY FORM
      ══════════════════════════════════════════ */}
      <Dialog open={showAddForm} onOpenChange={(v) => { if (!v) { resetForm(); setShowAddForm(false); } }}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <FilePlus className="h-5 w-5 text-primary" /> Add Recipe
            </h2>
            <button onClick={() => { resetForm(); setShowAddForm(false); }} className="text-text-muted hover:text-text-primary">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scan button */}
          <div className="mb-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2 text-sm"
              onClick={() => scanInputRef.current?.click()}
              disabled={scanning}
            >
              {scanning
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning…</>
                : <><ScanLine className="h-4 w-4" /> Scan Recipe Photo</>
              }
            </Button>
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScanRecipe(file);
              }}
            />
          </div>

          {/* Duplicate warning */}
          {formDuplicate && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Recipe already exists</p>
                  <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">
                    You already have a recipe named "{formDuplicate.name}" in your library.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setFormDuplicate(null)}>Cancel</Button>
                    <Button size="sm" className="h-6 text-xs" onClick={() => { setFormDuplicate(null); handleSubmitForm(true); }}>Save Anyway</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Recipe Name *</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Lemon Garlic Chicken" />
            </div>

            {/* Meal type + servings row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Meal Type</label>
                <select
                  value={formMealType}
                  onChange={(e) => setFormMealType(e.target.value)}
                  className="w-full border border-card-border rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                  <option value="dessert">Dessert</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Servings</label>
                <div className="flex items-center gap-2 border border-card-border rounded-lg px-3 py-1.5">
                  <button type="button" onClick={() => setFormServings((s) => Math.max(1, s - 1))} className="text-text-muted hover:text-text-primary">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-sm font-bold flex-1 text-center">{formServings}</span>
                  <button type="button" onClick={() => setFormServings((s) => s + 1)} className="text-text-muted hover:text-text-primary">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calories + Prep Time row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Calories / serving (optional)</label>
                <Input type="number" value={formCalories} onChange={(e) => setFormCalories(e.target.value)} placeholder="e.g. 450" min={0} />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Prep Time (minutes)</label>
                <Input type="number" value={formPrepTime} onChange={(e) => setFormPrepTime(e.target.value)} placeholder="e.g. 30" min={0} />
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Ingredients</label>
              <div className="space-y-2">
                {formIngredients.map((ing, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={ing}
                      onChange={(e) => {
                        const updated = [...formIngredients];
                        updated[i] = e.target.value;
                        setFormIngredients(updated);
                      }}
                      placeholder={`Ingredient ${i + 1} (e.g. 2 cups flour)`}
                      className="flex-1"
                    />
                    {formIngredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormIngredients((prev) => prev.filter((_, j) => j !== i))}
                        className="p-2 rounded text-text-muted hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1 h-7"
                  onClick={() => setFormIngredients((prev) => [...prev, ''])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Ingredient
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Instructions (optional)</label>
              <textarea
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
                placeholder={"1. Preheat oven to 375°F\n2. Mix ingredients...\n3. Bake for 30 minutes"}
                rows={6}
                className="w-full border border-card-border rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y min-h-[100px]"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Tags (optional, comma-separated)</label>
              <Input value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="e.g. vegan, gluten-free, high-protein" />
            </div>

            {/* Photo upload */}
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Photo (optional)</label>
              {formPhotoPreview ? (
                <div className="relative">
                  <img src={formPhotoPreview} alt="preview" className="w-full h-36 object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => { setFormPhotoFile(null); setFormPhotoPreview(null); }}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => formPhotoInputRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-card-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-text-muted hover:text-primary transition-colors"
                >
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">Click to upload a photo</span>
                </button>
              )}
              <input ref={formPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFormPhotoSelect} />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button variant="outline" onClick={() => { resetForm(); setShowAddForm(false); }} className="flex-1">Cancel</Button>
            <Button
              onClick={() => handleSubmitForm(false)}
              disabled={createMealMutation.isPending || !formName.trim()}
              className="flex-1"
            >
              {createMealMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</> : 'Save Recipe'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
