import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Loader2, Check, Trash2,
  Sparkles, Clock, Users, UtensilsCrossed, AlertTriangle,
  Pencil, RefreshCw, Plus, List, LayoutGrid, BookMarked, ShoppingCart
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cn, formatDate } from '@/lib/utils';
import { PageTutorial } from '@/components/shared/PageTutorial';
import type { MealPlan, Profile } from '@/types';

// T38: Check meal ingredient compatibility against all human profiles
function checkMealCompatibility(meal: MealPlan, profiles: Profile[]) {
  const humanProfiles = profiles.filter((p) => p.type === 'human');
  return humanProfiles.map((profile) => {
    const conflictTerms = [
      ...profile.allergies,
      ...profile.criticalAllergies,
      ...profile.intolerances,
    ].map((a) => a.toLowerCase().trim()).filter(Boolean);

    const conflicts = conflictTerms.filter((term) =>
      meal.ingredients.some((ing) => ing.toLowerCase().includes(term))
    );

    return {
      profileId: profile.id,
      profileName: profile.name,
      isMealProfile: meal.profileId === profile.id,
      isCompatible: conflicts.length === 0,
      conflicts,
    };
  });
}

type ViewMode = 'day' | 'week' | '2weeks' | 'month';
type LayoutMode = 'list' | 'grid';

const ALL_KNOWN_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'dessert', 'morning_feed', 'evening_feed', 'treat_time'];
const MEAL_COLORS: Record<string, string> = {
  breakfast: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-300',
  lunch: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700/40 dark:text-emerald-300',
  dinner: 'bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-900/20 dark:border-violet-700/40 dark:text-violet-300',
  snack: 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-900/20 dark:border-sky-700/40 dark:text-sky-300',
  beverage: 'bg-cyan-50 border-cyan-200 text-cyan-800 dark:bg-cyan-900/20 dark:border-cyan-700/40 dark:text-cyan-300',
  dessert: 'bg-pink-50 border-pink-200 text-pink-800 dark:bg-pink-900/20 dark:border-pink-700/40 dark:text-pink-300',
  morning_feed: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-700/40 dark:text-orange-300',
  evening_feed: 'bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-900/20 dark:border-indigo-700/40 dark:text-indigo-300',
  treat_time: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:border-rose-700/40 dark:text-rose-300',
};

function getWeekDates(baseDate: Date, view: ViewMode): Date[] {
  const dates: Date[] = [];
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);

  if (view === 'day') {
    dates.push(new Date(start));
  } else {
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);
    const count = view === 'week' ? 7 : view === '2weeks' ? 14 : 28;
    for (let i = 0; i < count; i++) {
      dates.push(new Date(start));
      start.setDate(start.getDate() + 1);
    }
  }
  return dates;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Parse a meal date string (UTC from DB) to a local YYYY-MM-DD for comparison
function mealDateToLocalStr(dateStr: string): string {
  // DB stores as @db.Date, returned as "2026-04-14T00:00:00.000Z" — take just the date part
  return dateStr.split('T')[0];
}

function localDateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MealPlanPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>('week');
  const [baseDate, setBaseDate] = useState(() => new Date());
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateDays, setGenerateDays] = useState(7);
  const [generateStartDate, setGenerateStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectedMealTypes, setSelectedMealTypes] = useState<string[]>(['breakfast', 'lunch', 'dinner', 'snack']);
  const [dietaryGoals, setDietaryGoals] = useState('');
  const [filterProfileId, setFilterProfileId] = useState<string>('all');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('list');

  // Edit meal state
  const [editingMeal, setEditingMeal] = useState<MealPlan | null>(null);
  const [editName, setEditName] = useState('');
  const [editIngredients, setEditIngredients] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editServings, setEditServings] = useState('1');
  const [editCalories, setEditCalories] = useState('');
  const [caloriesEstimating, setCaloriesEstimating] = useState(false);

  // Add meal state
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [addMealDate, setAddMealDate] = useState('');
  const [addMealType, setAddMealType] = useState('dinner');
  const [addMealName, setAddMealName] = useState('');
  const [addMealIngredients, setAddMealIngredients] = useState('');
  const [addMealNotes, setAddMealNotes] = useState('');
  const [addMealServings, setAddMealServings] = useState('1');
  const [addMealCalories, setAddMealCalories] = useState('');
  const [addMealProfileId, setAddMealProfileId] = useState('');
  const [addMealSaveToLibrary, setAddMealSaveToLibrary] = useState(false);

  // Month day selection for interactive MonthCell
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date | null>(null);
  const [selectedMonthMeals, setSelectedMonthMeals] = useState<MealPlan[]>([]);

  // Delete confirm (with library check)
  const [deleteConfirmMeal, setDeleteConfirmMeal] = useState<MealPlan | null>(null);

  // T36: Custom Meals Library
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [editingCustomMeal, setEditingCustomMeal] = useState<any | null>(null);
  const [libraryAddMealDate, setLibraryAddMealDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [libraryAddMealType, setLibraryAddMealType] = useState('dinner');
  const [libraryAddTarget, setLibraryAddTarget] = useState<any | null>(null);

  const dates = useMemo(() => getWeekDates(baseDate, view), [baseDate, view]);
  const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const startStr = dates[0] ? toLocalDateStr(dates[0]) : '';
  const endStr = dates[dates.length - 1] ? toLocalDateStr(dates[dates.length - 1]) : '';

  const { data: mealPlans, isLoading, error, refetch } = useQuery({
    queryKey: ['mealPlans', startStr, endStr],
    queryFn: () => api.getMealPlans({ startDate: startStr, endDate: endStr }),
    enabled: !!startStr,
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
  });

  // T36
  const { data: customMeals } = useQuery({
    queryKey: ['custom-meals'],
    queryFn: () => api.getCustomMeals(),
    staleTime: 5 * 60_000,
  });
  const deleteCustomMealMutation = useMutation({
    mutationFn: (id: string) => api.deleteCustomMeal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-meals'] }),
  });
  const addCustomToMealPlanMutation = useMutation({
    mutationFn: (cm: any) => api.createMealPlan({
      profileId: cm.profileId ?? (profiles?.[0]?.id ?? ''),
      date: libraryAddMealDate,
      mealType: libraryAddMealType as any,
      mealName: cm.name,
      ingredients: cm.ingredients ?? [],
      preparationNotes: cm.preparationNotes ?? null,
      servings: cm.servings ?? 1,
      calories: cm.calories ?? null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      toast('success', 'Meal added to plan!');
      setLibraryAddTarget(null);
    },
    onError: (err: Error) => toast('error', 'Failed to add', err.message),
  });

  const [streaming, setStreaming] = useState(false);
  const [streamCount, setStreamCount] = useState(0);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const mealTypes = selectedMealTypes.length > 0 ? selectedMealTypes : ['breakfast', 'lunch', 'dinner', 'snack'];
      setStreaming(true);
      setStreamCount(0);
      const generatedMeals: MealPlan[] = [];
      try {
        for await (const event of api.generateMealPlanStream(selectedProfiles, generateStartDate, mealTypes, generateDays, dietaryGoals || undefined)) {
          if (event.error) throw new Error(event.error);
          if (event.meal) {
            setStreamCount((c) => c + 1);
            generatedMeals.push(event.meal);
            queryClient.setQueryData(['mealPlans', startStr, endStr], (old: MealPlan[] | undefined) =>
              [...(old ?? []), event.meal!]
            );
          }
          if (event.done) break;
        }
      } finally {
        setStreaming(false);
      }
      return generatedMeals;
    },
    onSuccess: (generatedMeals) => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      toast('success', 'Meal plan generated!');
      setShowGenerate(false);
      setStreamCount(0);
      // Auto-sync new meals to the Recipe Library in the background
      if (generatedMeals.length > 0) {
        syncToLibraryMutation.mutate(generatedMeals);
      }
    },
    onError: (err: Error) => { setStreaming(false); toast('error', 'Failed to generate', err.message); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.updateMealPlan(id, { completed }),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['mealPlans'] });
      const snapshot = queryClient.getQueriesData<MealPlan[]>({ queryKey: ['mealPlans'] });
      queryClient.setQueriesData<MealPlan[]>({ queryKey: ['mealPlans'] }, (old) =>
        old?.map((m) => m.id === id ? { ...m, completed } : m)
      );
      return { snapshot };
    },
    onSuccess: (_data, { completed }) => {
      if (completed) toast('success', 'Meal completed — nutrition log updated ✓');
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['mealPlans'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMealPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      queryClient.invalidateQueries({ queryKey: ['custom-meals'] });
      toast('success', 'Meal removed');
      setDeleteConfirmMeal(null);
    },
  });

  const syncToLibraryMutation = useMutation({
    mutationFn: (meals: MealPlan[]) => api.syncMealsToLibrary(
      meals.map((m) => ({
        name: m.mealName,
        mealType: m.mealType,
        ingredients: m.ingredients,
        preparationNotes: m.preparationNotes ?? null,
        calories: m.calories ?? null,
        protein: m.protein ?? null,
        carbs: m.carbs ?? null,
        fat: m.fat ?? null,
        fiber: m.fiber ?? null,
        servings: m.servings ?? 1,
      }))
    ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['custom-meals'] });
      toast('success', `Synced ${data.synced} meal${data.synced !== 1 ? 's' : ''} to Recipe Library${data.skipped > 0 ? ` (${data.skipped} already existed)` : ''}`);
    },
    onError: (err: Error) => toast('error', 'Sync failed', err.message),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MealPlan> }) => api.updateMealPlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      toast('success', 'Meal updated');
      setEditingMeal(null);
    },
    onError: (err: Error) => toast('error', 'Failed to update', err.message),
  });

  const addMealMutation = useMutation({
    mutationFn: async () => {
      const data = {
        profileId: addMealProfileId || (profiles?.[0]?.id ?? ''),
        date: addMealDate,
        mealType: addMealType as any,
        mealName: addMealName,
        ingredients: addMealIngredients.split(',').map((s) => s.trim()).filter(Boolean),
        preparationNotes: addMealNotes || null,
        servings: addMealServings ? parseInt(addMealServings) : 1,
        calories: addMealCalories ? parseInt(addMealCalories) : null,
      };
      const meal = await api.createMealPlan(data);
      if (addMealSaveToLibrary) {
        await api.createCustomMeal({
          name: addMealName,
          mealType: addMealType as any,
          ingredients: data.ingredients,
          preparationNotes: addMealNotes || null,
          servings: data.servings,
          calories: data.calories,
        });
      }
      return meal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      toast('success', 'Meal added!');
      setShowAddMeal(false);
      setAddMealName('');
      setAddMealIngredients('');
      setAddMealNotes('');
      setAddMealServings('1');
      setAddMealCalories('');
      setAddMealSaveToLibrary(false);
    },
    onError: (err: Error) => toast('error', 'Failed to add meal', err.message),
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => api.regenerateMealPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      toast('success', 'Meal regenerated!');
    },
    onError: (err: Error) => toast('error', 'Failed to regenerate', err.message),
  });

  const addToShoppingMutation = useMutation({
    mutationFn: (meal: MealPlan) => api.addIngredientsToList({
      ingredients: meal.ingredients,
      mealName: meal.mealName,
      mealDate: meal.date,
      profileId: meal.profileId,
      servings: meal.servings ?? 1,
    }),
    onSuccess: () => toast('success', 'Ingredients added to shopping list!'),
    onError: (err: Error) => toast('error', 'Failed to add to shopping', err.message),
  });

  const navigateDate = (dir: number) => {
    const next = new Date(baseDate);
    const step = view === 'day' ? 1 : view === 'week' ? 7 : view === '2weeks' ? 14 : 28;
    next.setDate(next.getDate() + dir * step);
    setBaseDate(next);
  };

  const goToday = () => setBaseDate(new Date());

  const getMealsForDate = (date: Date) => {
    const dateStr = localDateToStr(date);
    return mealPlans?.filter((m) =>
      mealDateToLocalStr(m.date) === dateStr &&
      (filterProfileId === 'all' || m.profileId === filterProfileId)
    ) || [];
  };

  const today = new Date();

  return (
    <div className="space-y-6">
      {/* T75 Page Tutorial */}
      <PageTutorial pageKey="meal-plan" steps={[
        { title: 'Generate meals', description: 'Click Generate to let the AI create a personalized meal plan for your profiles and selected time range.' },
        { title: 'View & edit', description: 'Switch between Day, Week, and Month views. Tap any meal to edit, regenerate, or mark it complete.' },
        { title: 'Add to shopping', description: 'Use the shopping cart icon on any meal to add its ingredients to your shopping list.' },
      ]} />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Meal Plan</h1>
          <p className="text-sm text-muted mt-0.5">
            {dates.length === 1
              ? formatDate(dates[0])
              : `${formatDate(dates[0])} — ${formatDate(dates[dates.length - 1])}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setShowLibrary(true)}>
            <BookMarked className="h-4 w-4" /> My Meals
          </Button>
          {mealPlans && mealPlans.length > 0 && (
            <Button variant="outline" size="sm"
              onClick={() => syncToLibraryMutation.mutate(mealPlans)}
              disabled={syncToLibraryMutation.isPending}
              title="Sync visible meals to Recipe Library"
            >
              {syncToLibraryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookMarked className="h-4 w-4" />}
              {syncToLibraryMutation.isPending ? 'Syncing…' : 'Sync to Library'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => {
            const d = new Date();
            setAddMealDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
            setShowAddMeal(true);
          }}>
            <Plus className="h-4 w-4" /> Add Meal
          </Button>
          <Button onClick={() => setShowGenerate(true)}>
            <Sparkles className="h-4 w-4" /> Generate Plan
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#283447] rounded-xl p-1">
            <button
              onClick={() => setLayoutMode('list')}
              className={cn('flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                layoutMode === 'list' ? 'bg-white dark:bg-[#374151] shadow-sm text-foreground' : 'text-muted hover:text-foreground'
              )}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button
              onClick={() => setLayoutMode('grid')}
              className={cn('flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                layoutMode === 'grid' ? 'bg-white dark:bg-[#374151] shadow-sm text-foreground' : 'text-muted hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </button>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="2weeks">2 Wks</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Profile Filter */}
      {profiles && profiles.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted">Filter:</span>
          <button
            onClick={() => setFilterProfileId('all')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-all',
              filterProfileId === 'all'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-card-border text-muted hover:border-slate-300'
            )}
          >
            All Profiles
          </button>
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setFilterProfileId(filterProfileId === p.id ? 'all' : p.id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                filterProfileId === p.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-card-border text-muted hover:border-slate-300'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {error ? (
        <ErrorCard onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="rounded-2xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#1F2937] p-5">
              <Skeleton className="h-5 w-32 mb-3" />
              <div className="flex gap-2">
                <Skeleton className="h-16 flex-1 rounded-xl" />
                <Skeleton className="h-16 flex-1 rounded-xl" />
                <Skeleton className="h-16 flex-1 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {view === 'month' && (
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center text-[11px] font-semibold text-muted py-1">{d}</div>
              ))}
            </div>
          )}
          <div className={cn(
            'gap-3',
            view === 'day' ? 'grid grid-cols-1' :
            view === 'month' ? 'grid grid-cols-7 gap-1' :
            layoutMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 items-start' :
            'grid grid-cols-1'
          )}>
          {dates.map((date) => {
            const meals = getMealsForDate(date);
            const isToday = isSameDay(date, today);

            if (view === 'month') {
              return (
                <MonthCell
                  key={date.toISOString()}
                  date={date}
                  meals={meals}
                  isToday={isToday}
                  onSelect={(d, m) => { setSelectedMonthDate(d); setSelectedMonthMeals(m); }}
                />
              );
            }

            return (
              <DayRow
                key={date.toISOString()}
                date={date}
                meals={meals}
                isToday={isToday}
                profiles={profiles ?? []}
                onToggle={(id, completed) => toggleMutation.mutate({ id, completed })}
                onDelete={(id) => {
                  const meal = mealPlans?.find((m) => m.id === id);
                  if (meal) setDeleteConfirmMeal(meal);
                  else deleteMutation.mutate(id);
                }}
                onEdit={(meal) => {
                  setEditingMeal(meal);
                  setEditName(meal.mealName);
                  setEditIngredients(meal.ingredients.join(', '));
                  setEditNotes(meal.preparationNotes || '');
                  setEditServings(String(meal.servings ?? 1));
                  setEditCalories(String(meal.calories ?? ''));
                }}
                onRegenerate={(id) => regenerateMutation.mutate(id)}
                onAddToShopping={(meal) => addToShoppingMutation.mutate(meal)}
                onAddMeal={(date) => {
                  setAddMealDate(localDateToStr(date));
                  setShowAddMeal(true);
                }}
                isRegenerating={regenerateMutation.isPending}
              />
            );
          })}
          </div>
        </>
      )}

      {/* Generate Dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Meal Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div>
              <p className="text-sm font-medium mb-2">Profiles to include</p>
              <div className="flex flex-wrap gap-2">
                {profiles?.filter((p) => !(p.type === 'PET' && p.dietType === 'Kibble')).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfiles((s) =>
                      s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]
                    )}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all',
                      selectedProfiles.includes(p.id)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-card-border text-muted hover:border-slate-300'
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Start date</p>
              <input
                type="date"
                value={generateStartDate}
                onChange={(e) => setGenerateStartDate(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#283447] dark:text-[#F9FAFB] px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Number of days</p>
              <div className="flex gap-2">
                {[3, 5, 7, 14].map((d) => (
                  <button
                    key={d}
                    onClick={() => setGenerateDays(d)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all',
                      generateDays === d
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-card-border text-muted hover:border-slate-300'
                    )}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Meal types</p>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const selectedProfileObjs = profiles?.filter((p) => selectedProfiles.includes(p.id)) || [];
                  const hasPets = selectedProfileObjs.some((p) => p.type === 'PET');
                  const hasHumans = selectedProfileObjs.some((p) => p.type === 'HUMAN');
                  const types = [
                    ...(hasHumans || selectedProfiles.length === 0 ? ['breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'dessert'] : []),
                    ...(hasPets ? ['morning_feed', 'evening_feed', 'treat_time'] : []),
                  ];
                  return types.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedMealTypes((s) =>
                        s.includes(t) ? s.filter((x) => x !== t) : [...s, t]
                      )}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all capitalize',
                        selectedMealTypes.includes(t)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-card-border text-muted hover:border-slate-300'
                      )}
                    >
                      {t.replace('_', ' ')}
                    </button>
                  ));
                })()}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Dietary goals <span className="text-muted font-normal">(optional)</span></p>
              <input
                type="text"
                value={dietaryGoals}
                onChange={(e) => setDietaryGoals(e.target.value)}
                placeholder="e.g., high protein, low carb, keto, Mediterranean..."
                className="flex h-10 w-full rounded-xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#283447] dark:text-[#F9FAFB] px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || selectedProfiles.length === 0}
            >
              {generateMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {streaming && streamCount > 0 ? `Generated ${streamCount} meals…` : 'Generating…'}</>
                : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Meal Dialog */}
      <Dialog open={!!editingMeal} onOpenChange={(o) => !o && setEditingMeal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Meal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Meal Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Ingredients <span className="text-muted font-normal">(comma-separated)</span></label>
              <Input value={editIngredients} onChange={(e) => setEditIngredients(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Servings</label>
                <Input type="number" value={editServings} onChange={(e) => setEditServings(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Calories</label>
                <div className="flex gap-1 mt-1">
                  <Input type="number" value={editCalories} onChange={(e) => setEditCalories(e.target.value)} placeholder="Auto-estimate" />
                  <Button
                    type="button" size="sm" variant="outline"
                    className="shrink-0 px-2 text-xs"
                    disabled={!editIngredients.trim() || caloriesEstimating}
                    onClick={async () => {
                      setCaloriesEstimating(true);
                      try {
                        const result = await api.estimateMealCalories(editIngredients.split(',').map(s => s.trim()).filter(Boolean), editServings ? parseInt(editServings) : 1);
                        setEditCalories(String(result.calories));
                      } catch { /* ignore */ } finally { setCaloriesEstimating(false); }
                    }}
                  >
                    {caloriesEstimating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Est.'}
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Preparation Notes</label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMeal(null)}>Cancel</Button>
            <Button
              onClick={() => editingMeal && editMutation.mutate({ id: editingMeal.id, data: {
                mealName: editName,
                ingredients: editIngredients.split(',').map((s) => s.trim()).filter(Boolean),
                preparationNotes: editNotes || null,
                servings: editServings ? parseInt(editServings) : undefined,
                calories: editCalories ? parseInt(editCalories) : undefined,
              }})}
              disabled={editMutation.isPending || !editName.trim()}
            >
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Meal Dialog */}
      <Dialog open={showAddMeal} onOpenChange={setShowAddMeal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Meal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={addMealDate} onChange={(e) => setAddMealDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={addMealType}
                  onChange={(e) => setAddMealType(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#283447] dark:text-[#F9FAFB] px-3 py-2 text-sm"
                >
                  {ALL_KNOWN_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            {profiles && profiles.length > 0 && (
              <div>
                <label className="text-sm font-medium">Profile</label>
                <select
                  value={addMealProfileId || profiles[0]?.id}
                  onChange={(e) => setAddMealProfileId(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#283447] dark:text-[#F9FAFB] px-3 py-2 text-sm"
                >
                  {profiles.filter((p) => (p as any).dietType !== 'kibble').map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Meal Name</label>
              <Input value={addMealName} onChange={(e) => setAddMealName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Ingredients <span className="text-muted font-normal">(comma-separated)</span></label>
              <Input value={addMealIngredients} onChange={(e) => setAddMealIngredients(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Servings</label>
                <Input type="number" value={addMealServings} onChange={(e) => setAddMealServings(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Calories</label>
                <div className="flex gap-1 mt-1">
                  <Input type="number" value={addMealCalories} onChange={(e) => setAddMealCalories(e.target.value)} placeholder="Auto-estimate" />
                  <Button
                    type="button" size="sm" variant="outline"
                    className="shrink-0 px-2 text-xs"
                    disabled={!addMealIngredients.trim() || caloriesEstimating}
                    onClick={async () => {
                      setCaloriesEstimating(true);
                      try {
                        const result = await api.estimateMealCalories(addMealIngredients.split(',').map(s => s.trim()).filter(Boolean), addMealServings ? parseInt(addMealServings) : 1);
                        setAddMealCalories(String(result.calories));
                      } catch { /* ignore */ } finally { setCaloriesEstimating(false); }
                    }}
                  >
                    {caloriesEstimating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Est.'}
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Prep Notes</label>
              <Input value={addMealNotes} onChange={(e) => setAddMealNotes(e.target.value)} className="mt-1" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={addMealSaveToLibrary}
                onChange={(e) => setAddMealSaveToLibrary(e.target.checked)}
                className="rounded"
              />
              <BookMarked className="h-3.5 w-3.5 text-primary" /> Save to My Meals Library
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMeal(false)}>Cancel</Button>
            <Button
              onClick={() => addMealMutation.mutate()}
              disabled={addMealMutation.isPending || !addMealName.trim() || !addMealDate}
            >
              {addMealMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Meal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* T36: Custom Meals Library Dialog */}
      <Dialog open={showLibrary} onOpenChange={setShowLibrary}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>My Meals Library</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search saved meals..."
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            className="shrink-0"
          />
          <div className="flex-1 overflow-y-auto space-y-2 mt-2">
            {(customMeals ?? []).filter((cm) =>
              !librarySearch || cm.name.toLowerCase().includes(librarySearch.toLowerCase())
            ).length === 0 ? (
              <p className="text-sm text-muted text-center py-8">
                {customMeals?.length === 0
                  ? 'No saved meals yet. Use "Save to My Meals Library" when adding a meal.'
                  : 'No meals match your search.'}
              </p>
            ) : (
              (customMeals ?? [])
                .filter((cm) => !librarySearch || cm.name.toLowerCase().includes(librarySearch.toLowerCase()))
                .map((cm) => (
                  <div key={cm.id} className="border border-card-border dark:border-[#374151] rounded-xl p-3">
                    {libraryAddTarget?.id === cm.id ? (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">{cm.name}</p>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={libraryAddMealDate}
                            onChange={(e) => setLibraryAddMealDate(e.target.value)}
                            className="flex-1 border border-card-border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-[#283447] dark:border-[#374151] dark:text-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <select
                            value={libraryAddMealType}
                            onChange={(e) => setLibraryAddMealType(e.target.value)}
                            className="border border-card-border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-[#283447] dark:border-[#374151] dark:text-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            <option value="breakfast">Breakfast</option>
                            <option value="lunch">Lunch</option>
                            <option value="dinner">Dinner</option>
                            <option value="snack">Snack</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => setLibraryAddTarget(null)}>Cancel</Button>
                          <Button size="sm" className="flex-1" onClick={() => addCustomToMealPlanMutation.mutate(cm)} disabled={addCustomToMealPlanMutation.isPending}>
                            {addCustomToMealPlanMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add to Plan'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{cm.name}</p>
                          <p className="text-xs text-muted">
                            {cm.mealType} · {cm.servings ?? 1} serving{(cm.servings ?? 1) !== 1 ? 's' : ''}
                            {cm.calories ? ` · ${cm.calories} cal` : ''}
                            {cm.ingredients?.length ? ` · ${cm.ingredients.length} ingredients` : ''}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => { setLibraryAddTarget(cm); setLibraryAddMealDate(new Date().toISOString().split('T')[0]); }}>
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-red-400 hover:text-red-600" onClick={() => deleteCustomMealMutation.mutate(cm.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Month Day Detail Dialog */}
      <Dialog open={!!selectedMonthDate} onOpenChange={(o) => !o && setSelectedMonthDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedMonthDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {selectedMonthMeals.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">No meals planned</p>
            ) : (
              selectedMonthMeals.map((meal) => (
                <div key={meal.id} className={cn('flex items-start gap-3 px-3 py-2.5 rounded-xl border', MEAL_COLORS[meal.mealType] || 'bg-slate-50 border-slate-200')}>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{meal.mealName}</p>
                    <p className="text-xs text-muted capitalize">{meal.mealType.replace(/_/g, ' ')}</p>
                  </div>
                  {meal.completed && <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (selectedMonthDate) {
                setAddMealDate(localDateToStr(selectedMonthDate));
                setSelectedMonthDate(null);
                setShowAddMeal(true);
              }
            }}>
              <Plus className="h-4 w-4" /> Add Meal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmMeal} onOpenChange={(o) => !o && setDeleteConfirmMeal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove meal from plan?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted py-2">
            <span className="font-semibold text-text-primary">{deleteConfirmMeal?.mealName}</span> will be removed from your meal plan.
          </p>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmMeal(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirmMeal && deleteMutation.mutate(deleteConfirmMeal.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DayRow({ date, meals, isToday, onToggle, onDelete, onEdit, onRegenerate, onAddToShopping, onAddMeal, isRegenerating, profiles }: {
  date: Date; meals: MealPlan[]; isToday: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (meal: MealPlan) => void;
  onRegenerate: (id: string) => void;
  onAddToShopping: (meal: MealPlan) => void;
  onAddMeal: (date: Date) => void;
  isRegenerating: boolean;
  profiles?: Profile[];
}) {
  const [expanded, setExpanded] = useState(isToday);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = date.getDate();
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });
  const completedCount = meals.filter((m) => m.completed).length;

  // Derive ordered meal types from actual data (known types first, then any extras)
  const uniqueTypes = [...new Set(meals.map(m => m.mealType))] as string[];
  const orderedTypes = [
    ...ALL_KNOWN_TYPES.filter(t => uniqueTypes.includes(t)),
    ...uniqueTypes.filter(t => !ALL_KNOWN_TYPES.includes(t))
  ];

  return (
    <Card className={cn(isToday && 'ring-2 ring-primary/30')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        <div className={cn(
          'w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0',
          isToday ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-[#283447] text-foreground'
        )}>
          <span className="text-[10px] font-medium uppercase leading-none">{dayName}</span>
          <span className="text-lg font-bold leading-none mt-0.5">{dayNum}</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{monthName} {dayNum}</span>
          <p className="text-xs text-muted">
            {meals.length === 0
              ? 'No meals planned'
              : `${meals.length} meal${meals.length > 1 ? 's' : ''} · ${completedCount} done`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {orderedTypes.map((type) => {
            const count = meals.filter((m) => m.mealType === type).length;
            if (count === 0) return null;
            return <Badge key={type} variant="secondary" className={cn('text-[10px]', MEAL_COLORS[type] || 'bg-slate-50 dark:bg-[#283447] border-slate-200 dark:border-[#374151] text-slate-800 dark:text-[#E5E7EB]')}>{type.replace('_', ' ').split(' ').map(w => w[0].toUpperCase()).join('')}</Badge>;
          })}
        </div>
        <ChevronLeft className={cn('h-4 w-4 text-muted transition-transform', expanded && '-rotate-90')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-2">
              {orderedTypes.map((type) => {
                const typeMeals = meals.filter((m) => m.mealType === type);
                if (typeMeals.length === 0) return null;
                return (
                  <div key={type}>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted mb-1.5">{type.replace(/_/g, ' ')}</p>
                    <div className="space-y-1.5">
                      {typeMeals.map((meal) => (
                        <div
                          key={meal.id}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all',
                            MEAL_COLORS[type] || 'bg-slate-50 dark:bg-[#283447] border-slate-200 dark:border-[#374151]',
                            meal.completed && 'opacity-60'
                          )}
                        >
                          <button
                            onClick={() => onToggle(meal.id, !meal.completed)}
                            className={cn(
                              'w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors',
                              meal.completed ? 'bg-primary border-primary' : 'border-slate-300 dark:border-[#374151] hover:border-primary'
                            )}
                          >
                            {meal.completed && <Check className="h-3 w-3 text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className={cn('text-sm font-medium', meal.completed && 'line-through')}>{meal.mealName}</p>
                              {meal.safetyFlag?.startsWith('WARNING') && (
                                <span title={`Allergen flag: ${meal.safetyFlag.replace('WARNING:', '')}`}>
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                </span>
                              )}
                            </div>
                            {/* T38: Multi-profile compatibility chips */}
                            {profiles && profiles.filter((p) => p.type === 'human').length > 1 && (() => {
                              const compat = checkMealCompatibility(meal, profiles);
                              const hasConflict = compat.some((c) => !c.isCompatible);
                              if (!hasConflict && !compat.some((c) => !c.isMealProfile)) return null;
                              return (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {compat.map((c) => (
                                    <span
                                      key={c.profileId}
                                      title={c.isCompatible ? `${c.profileName}: compatible` : `${c.profileName}: conflicts with ${c.conflicts.join(', ')}`}
                                      className={cn(
                                        'inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full border',
                                        c.isCompatible
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                          : 'bg-red-50 border-red-200 text-red-700'
                                      )}
                                    >
                                      {c.isCompatible
                                        ? <Check className="h-2.5 w-2.5" />
                                        : <AlertTriangle className="h-2.5 w-2.5" />}
                                      {c.profileName.split(' ')[0]}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                            {meal.servings && (
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted">
                                <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {meal.servings} servings</span>
                                {meal.prepTime && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {meal.prepTime}m</span>}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(meal)} title="Edit">
                              <Pencil className="h-3 w-3 text-muted" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRegenerate(meal.id)} title="Regenerate" disabled={isRegenerating}>
                              <RefreshCw className={cn('h-3 w-3 text-muted', isRegenerating && 'animate-spin')} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onAddToShopping(meal)} title="Add to shopping list">
                              <ShoppingCart className="h-3 w-3 text-muted" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(meal.id)} title="Delete">
                              <Trash2 className="h-3 w-3 text-muted" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {meals.length === 0 && (
                <div className="flex items-center justify-center py-6 text-sm text-muted">
                  <UtensilsCrossed className="h-4 w-4 mr-2" /> No meals planned for this day
                </div>
              )}
              <button
                onClick={() => onAddMeal(date)}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted hover:text-foreground hover:bg-slate-50 dark:hover:bg-[#283447] rounded-lg border border-dashed dark:border-[#374151] transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Meal
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function MonthCell({ date, meals, isToday, onSelect }: {
  date: Date; meals: MealPlan[]; isToday: boolean;
  onSelect: (date: Date, meals: MealPlan[]) => void;
}) {
  return (
    <button
      onClick={() => onSelect(date, meals)}
      className={cn(
        'border border-card-border rounded-xl p-2 min-h-[80px] text-left w-full hover:shadow-sm transition-shadow',
        isToday ? 'bg-primary/5 border-primary/30' : 'bg-white dark:bg-[#283447]'
      )}
    >
      <p className={cn(
        'text-xs font-semibold mb-1',
        isToday ? 'text-primary' : 'text-muted'
      )}>
        {date.getDate()}
      </p>
      <div className="space-y-0.5">
        {meals.slice(0, 3).map((meal) => (
          <div
            key={meal.id}
            className={cn('text-[9px] px-1.5 py-0.5 rounded truncate', MEAL_COLORS[meal.mealType] || 'bg-slate-50 dark:bg-[#374151] text-slate-700 dark:text-[#D1D5DB]')}
          >
            {meal.mealName}
          </div>
        ))}
        {meals.length > 3 && (
          <p className="text-[9px] text-muted text-center">+{meals.length - 3} more</p>
        )}
      </div>
    </button>
  );
}
