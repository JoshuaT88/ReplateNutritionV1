import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Loader2, Check, Trash2,
  Sparkles, Clock, Users, UtensilsCrossed
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

import { ErrorCard } from '@/components/shared/ErrorCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cn, formatDate } from '@/lib/utils';
import type { MealPlan } from '@/types';

type ViewMode = 'day' | 'week' | '2weeks' | 'month';

const ALL_KNOWN_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'dessert', 'morning_feed', 'evening_feed', 'treat_time'];
const MEAL_COLORS: Record<string, string> = {
  breakfast: 'bg-amber-50 border-amber-200 text-amber-800',
  lunch: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  dinner: 'bg-violet-50 border-violet-200 text-violet-800',
  snack: 'bg-sky-50 border-sky-200 text-sky-800',
  beverage: 'bg-cyan-50 border-cyan-200 text-cyan-800',
  dessert: 'bg-pink-50 border-pink-200 text-pink-800',
  morning_feed: 'bg-orange-50 border-orange-200 text-orange-800',
  evening_feed: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  treat_time: 'bg-rose-50 border-rose-200 text-rose-800',
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

  const generateMutation = useMutation({
    mutationFn: () => {
      const mealTypes = selectedMealTypes.length > 0 ? selectedMealTypes : ['breakfast', 'lunch', 'dinner', 'snack'];
      return api.generateMealPlan(selectedProfiles, generateStartDate, mealTypes, generateDays, dietaryGoals || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      toast('success', 'Meal plan generated!');
      setShowGenerate(false);
    },
    onError: (err: Error) => toast('error', 'Failed to generate', err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.updateMealPlan(id, { completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mealPlans'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMealPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      toast('success', 'Meal removed');
    },
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
          <Button onClick={() => setShowGenerate(true)}>
            <Sparkles className="h-4 w-4" /> Generate Plan
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="2weeks">2 Weeks</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
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
            <div key={i} className="rounded-2xl border border-card-border bg-white p-5">
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
        <div className={cn(
          'gap-3',
          view === 'day' ? 'grid grid-cols-1' :
          view === 'month' ? 'grid grid-cols-7' :
          view === 'week' ? '' :   // week uses its own layout below
          'grid grid-cols-1'
        )}>
          {view === 'week' ? (
            <div className="overflow-x-auto -mx-1 px-1 pb-2">
              <div className="grid grid-cols-7 gap-2 min-w-[560px]">
                {dates.map((date) => {
                  const meals = getMealsForDate(date);
                  const isToday = isSameDay(date, today);
                  return (
                    <WeekColumn
                      key={date.toISOString()}
                      date={date}
                      meals={meals}
                      isToday={isToday}
                      onToggle={(id, completed) => toggleMutation.mutate({ id, completed })}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  );
                })}
              </div>
            </div>
          ) : dates.map((date) => {
            const meals = getMealsForDate(date);
            const isToday = isSameDay(date, today);

            if (view === 'month') {
              return (
                <MonthCell
                  key={date.toISOString()}
                  date={date}
                  meals={meals}
                  isToday={isToday}
                />
              );
            }

            return (
              <DayRow
                key={date.toISOString()}
                date={date}
                meals={meals}
                isToday={isToday}
                onToggle={(id, completed) => toggleMutation.mutate({ id, completed })}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            );
          })}
        </div>
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
                {profiles?.map((p) => (
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
                className="flex h-10 w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
                className="flex h-10 w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || selectedProfiles.length === 0}
            >
              {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WeekColumn({ date, meals, isToday, onToggle, onDelete }: {
  date: Date; meals: MealPlan[]; isToday: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = date.getDate();

  return (
    <div className={cn(
      'flex flex-col rounded-2xl border bg-white min-w-0',
      isToday ? 'border-primary/40 ring-1 ring-primary/20' : 'border-card-border'
    )}>
      {/* Day header */}
      <div className={cn(
        'px-2 py-2 text-center rounded-t-2xl',
        isToday ? 'bg-primary text-white' : 'bg-slate-50'
      )}>
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{dayName}</p>
        <p className={cn('text-lg font-bold leading-none mt-0.5', isToday ? 'text-white' : 'text-foreground')}>{dayNum}</p>
      </div>

      {/* Meal chips */}
      <div className="flex flex-col gap-1 p-1.5 flex-1">
        {meals.length === 0 ? (
          <div className="flex items-center justify-center flex-1 py-4">
            <UtensilsCrossed className="h-4 w-4 text-slate-200" />
          </div>
        ) : meals.map((meal) => (
          <div key={meal.id}>
            <button
              onClick={() => setExpandedId(expandedId === meal.id ? null : meal.id)}
              className={cn(
                'w-full text-left px-1.5 py-1 rounded-lg text-[10px] font-medium border transition-all truncate',
                MEAL_COLORS[meal.mealType] || 'bg-slate-50 border-slate-200 text-slate-700',
                meal.completed && 'opacity-50 line-through'
              )}
              title={meal.mealName}
            >
              {meal.mealName}
            </button>
            {expandedId === meal.id && (
              <div className="mt-1 px-1.5 pb-1 space-y-0.5">
                {meal.calories && <p className="text-[9px] text-muted">{meal.calories} cal</p>}
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => onToggle(meal.id, !meal.completed)}
                    className="flex-1 flex items-center justify-center gap-0.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-medium hover:bg-emerald-100 transition-colors"
                  >
                    <Check className="h-2.5 w-2.5" />
                    {meal.completed ? 'Undo' : 'Done'}
                  </button>
                  <button
                    onClick={() => onDelete(meal.id)}
                    className="p-0.5 rounded bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Meal count badge */}
      {meals.length > 0 && (
        <div className="px-2 pb-1.5 text-center">
          <span className="text-[9px] text-muted">{meals.filter(m => m.completed).length}/{meals.length}</span>
        </div>
      )}
    </div>
  );
}

function DayRow({ date, meals, isToday, onToggle, onDelete }: {
  date: Date; meals: MealPlan[]; isToday: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
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
          isToday ? 'bg-primary text-white' : 'bg-slate-100 text-foreground'
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
            return <Badge key={type} variant="secondary" className={cn('text-[10px]', MEAL_COLORS[type] || 'bg-slate-50 border-slate-200 text-slate-800')}>{type.replace('_', ' ').split(' ').map(w => w[0].toUpperCase()).join('')}</Badge>;
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
                            MEAL_COLORS[type] || 'bg-slate-50 border-slate-200',
                            meal.completed && 'opacity-60'
                          )}
                        >
                          <button
                            onClick={() => onToggle(meal.id, !meal.completed)}
                            className={cn(
                              'w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors',
                              meal.completed ? 'bg-primary border-primary' : 'border-slate-300 hover:border-primary'
                            )}
                          >
                            {meal.completed && <Check className="h-3 w-3 text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium', meal.completed && 'line-through')}>{meal.mealName}</p>
                            {meal.servings && (
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted">
                                <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {meal.servings} servings</span>
                                {meal.prepTime && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {meal.prepTime}m</span>}
                              </div>
                            )}
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(meal.id)}>
                            <Trash2 className="h-3 w-3 text-muted" />
                          </Button>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function MonthCell({ date, meals, isToday }: { date: Date; meals: MealPlan[]; isToday: boolean }) {
  return (
    <div className={cn(
      'border border-card-border rounded-xl p-2 min-h-[80px]',
      isToday ? 'bg-primary/5 border-primary/30' : 'bg-white'
    )}>
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
            className={cn('text-[9px] px-1.5 py-0.5 rounded truncate', MEAL_COLORS[meal.mealType] || 'bg-slate-50')}
          >
            {meal.mealName}
          </div>
        ))}
        {meals.length > 3 && (
          <p className="text-[9px] text-muted text-center">+{meals.length - 3} more</p>
        )}
      </div>
    </div>
  );
}
