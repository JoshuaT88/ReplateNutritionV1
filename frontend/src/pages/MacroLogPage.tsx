import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Trash2, Loader2, Activity, Download, User, Sparkles, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { fmtDate } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { MealPlan } from '@/types';
import { PageTutorial } from '@/components/shared/PageTutorial';

interface MacroFormState {
  mealName: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  notes: string;
}

const EMPTY_FORM: MacroFormState = {
  mealName: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', notes: '',
};

const MACRO_COLORS = {
  calories: 'bg-orange-100 text-orange-700',
  protein: 'bg-blue-100 text-blue-700',
  carbs: 'bg-amber-100 text-amber-700',
  fat: 'bg-rose-100 text-rose-700',
  fiber: 'bg-emerald-100 text-emerald-700',
};

export default function MacroLogPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [importShowRecent, setImportShowRecent] = useState(false);
  const [form, setForm] = useState<MacroFormState>(EMPTY_FORM);
  const [estimatingMacros, setEstimatingMacros] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
  });

  const humanProfiles = profiles?.filter((p) => p.type === 'HUMAN') ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['macros', selectedDate, selectedProfileId],
    queryFn: () => api.getMacros(selectedDate, selectedProfileId || undefined),
  });

  const logMutation = useMutation({
    mutationFn: () => api.logMacro({
      date: selectedDate,
      mealName: form.mealName,
      calories: form.calories ? parseInt(form.calories) : undefined,
      protein: form.protein ? parseFloat(form.protein) : undefined,
      carbs: form.carbs ? parseFloat(form.carbs) : undefined,
      fat: form.fat ? parseFloat(form.fat) : undefined,
      fiber: form.fiber ? parseFloat(form.fiber) : undefined,
      notes: form.notes || undefined,
      profileId: selectedProfileId || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['macros'] });
      toast('success', 'Logged!');
      setShowAdd(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: Error) => toast('error', 'Failed to log', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMacro(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['macros'] }),
  });

  const totals = data?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

  // T45: Meal plan import — fetch recent meals for the selected profile
  const { data: mealPlanData } = useQuery({
    queryKey: ['mealPlans', { profileId: selectedProfileId || undefined }],
    queryFn: () => api.getMealPlans({ profileId: selectedProfileId || undefined }),
    enabled: showImport,
  });

  // Meals matching search
  const filteredMeals = (mealPlanData ?? []).filter((m: MealPlan) =>
    !importSearch || m.mealName.toLowerCase().includes(importSearch.toLowerCase())
  ).slice(0, 20);

  // Recent completed: meals with a date in the past, sorted newest first
  const recentMeals = (mealPlanData ?? [])
    .filter((m: MealPlan) => new Date(m.date) < new Date())
    .sort((a: MealPlan, b: MealPlan) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15);

  const handleEstimateMacros = async () => {
    if (!form.mealName.trim()) return;
    setEstimatingMacros(true);
    try {
      const result = await api.estimateMealMacros(form.mealName.trim());
      setForm((f) => ({
        ...f,
        calories: result.calories != null ? String(result.calories) : f.calories,
        protein: result.protein != null ? String(result.protein) : f.protein,
        carbs: result.carbs != null ? String(result.carbs) : f.carbs,
        fat: result.fat != null ? String(result.fat) : f.fat,
        fiber: result.fiber != null ? String(result.fiber) : f.fiber,
      }));
      toast('success', 'Macros estimated!');
    } catch {
      toast('error', 'Could not estimate macros');
    } finally {
      setEstimatingMacros(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageTutorial pageKey="nutrition-log" steps={[
        { title: 'Select profile & date', description: 'Choose a household member and the date you want to log nutrition for.' },
        { title: 'Log a meal', description: 'Add meals manually or use the AI estimator to auto-fill macros from a meal name.' },
        { title: 'Import from Meal Plan', description: 'Pull in meals already in your plan to auto-populate calorie and macro data.' },
      ]} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> Nutrition Log
          </h1>
          <p className="text-sm text-muted mt-0.5">Track daily macros and calories</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {humanProfiles.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#283447] rounded-xl px-3 py-1.5">
              <User className="h-3.5 w-3.5 text-muted shrink-0" />
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="bg-transparent dark:text-foreground text-sm font-medium focus:outline-none dark:[color-scheme:dark]"
              >
                <option value="">All profiles</option>
                {humanProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40 dark:[color-scheme:dark]"
          />
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Download className="h-4 w-4" /> Import
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Log Meal
          </Button>
        </div>
      </div>

      {/* Daily Totals */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            {fmtDate(new Date(selectedDate + 'T12:00:00'))} · Daily Totals
          </p>
          <div className="grid grid-cols-5 gap-1 sm:gap-2">
            {(['calories', 'protein', 'carbs', 'fat', 'fiber'] as const).map((key) => (
              <div key={key} className={cn('rounded-xl px-1.5 sm:px-3 py-2 text-center', MACRO_COLORS[key])}>
                <p className="text-base sm:text-lg font-bold leading-tight">
                  {key === 'calories' ? Math.round(totals.calories) : (totals[key] ?? 0).toFixed(1)}
                </p>
                <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide leading-tight">
                  {key === 'calories' ? 'Kcal' : key.charAt(0).toUpperCase() + key.slice(1)}
                </p>
                {key !== 'calories' && <p className="text-[8px] opacity-60 italic leading-none">g</p>}
              </div>
            ))}
          </div>

          {/* Macro proportion bars */}
          {totals.calories > 0 && (
            <div className="mt-3 space-y-1.5">
              {[
                { key: 'protein', color: 'bg-blue-500', kcalPer: 4 },
                { key: 'carbs', color: 'bg-amber-500', kcalPer: 4 },
                { key: 'fat', color: 'bg-rose-500', kcalPer: 9 },
              ].map(({ key, color, kcalPer }) => {
                const val = totals[key as keyof typeof totals] ?? 0;
                const kcal = val * kcalPer;
                const pct = totals.calories > 0 ? Math.round((kcal / totals.calories) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted w-12 shrink-0 capitalize">{key}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted w-8 text-right shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Entries */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
        ) : !data?.logs.length ? (
          <div className="text-center py-10 text-muted">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No meals logged for this day</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" /> Log first meal
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {data.logs.map((log: any) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <Card key={log.id} className={cn('transition-all', isExpanded && 'ring-1 ring-primary/30')}>
                  <CardContent className="p-3">
                    {/* Header row — always visible, click to expand */}
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium">{log.mealName}</p>
                            <ChevronDown className={cn('h-3.5 w-3.5 text-muted shrink-0 transition-transform', isExpanded && 'rotate-180')} />
                          </div>
                          {log.notes && <p className="text-xs text-muted mt-0.5 truncate">{log.notes}</p>}
                          {/* Compact chips summary when collapsed */}
                          {!isExpanded && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {log.calories != null && (
                                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', MACRO_COLORS.calories)}>
                                  {log.calories} kcal
                                </span>
                              )}
                              {log.protein != null && (
                                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', MACRO_COLORS.protein)}>
                                  P {log.protein}g
                                </span>
                              )}
                              {log.carbs != null && (
                                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', MACRO_COLORS.carbs)}>
                                  C {log.carbs}g
                                </span>
                              )}
                              {log.fat != null && (
                                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', MACRO_COLORS.fat)}>
                                  F {log.fat}g
                                </span>
                              )}
                              {log.fiber != null && (
                                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', MACRO_COLORS.fiber)}>
                                  Fiber {log.fiber}g
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(log.id); }}
                          className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-card-border space-y-3">
                        {/* Full macro breakdown grid */}
                        <div className="grid grid-cols-5 gap-1.5">
                          {(['calories', 'protein', 'carbs', 'fat', 'fiber'] as const).map((k) => {
                            const val = log[k];
                            if (val == null) return null;
                            return (
                              <div key={k} className={cn('rounded-lg px-1.5 py-2 text-center', MACRO_COLORS[k])}>
                                <p className="text-sm font-bold leading-tight">{k === 'calories' ? Math.round(val) : Number(val).toFixed(1)}</p>
                                <p className="text-[9px] font-semibold uppercase tracking-wide">{k === 'calories' ? 'Kcal' : k.charAt(0).toUpperCase() + k.slice(1)}</p>
                                {k !== 'calories' && <p className="text-[8px] opacity-60 italic leading-none">g</p>}
                              </div>
                            );
                          })}
                        </div>
                        {/* Notes full */}
                        {log.notes && (
                          <div className="bg-slate-50 dark:bg-[#1e2a38] rounded-lg p-2.5">
                            <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Notes</p>
                            <p className="text-xs text-text-secondary">{log.notes}</p>
                          </div>
                        )}
                        {/* Logged at */}
                        {log.createdAt && (
                          <p className="text-[10px] text-muted">
                            Logged: {new Date(log.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Add Macro Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a Meal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-4">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Meal name *</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., Oatmeal with berries"
                  value={form.mealName}
                  onChange={(e) => setForm((f) => ({ ...f, mealName: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1 text-xs"
                  onClick={handleEstimateMacros}
                  disabled={!form.mealName.trim() || estimatingMacros}
                  title="Auto-estimate macros using AI"
                >
                  {estimatingMacros
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <><Sparkles className="h-3.5 w-3.5" /> Est.</>}
                </Button>
              </div>
              <p className="text-[10px] text-muted mt-1">Enter a meal name then tap Est. to auto-fill macros</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Calories (kcal)</label>
                <Input type="number" min="0" placeholder="350" value={form.calories}
                  onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Fiber (g)</label>
                <Input type="number" min="0" step="0.1" placeholder="4" value={form.fiber}
                  onChange={(e) => setForm((f) => ({ ...f, fiber: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Protein (g)</label>
                <Input type="number" min="0" step="0.1" placeholder="20" value={form.protein}
                  onChange={(e) => setForm((f) => ({ ...f, protein: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Carbs (g)</label>
                <Input type="number" min="0" step="0.1" placeholder="45" value={form.carbs}
                  onChange={(e) => setForm((f) => ({ ...f, carbs: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Fat (g)</label>
                <Input type="number" min="0" step="0.1" placeholder="12" value={form.fat}
                  onChange={(e) => setForm((f) => ({ ...f, fat: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Notes (optional)</label>
              <Input placeholder="e.g., post-workout" value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={() => logMutation.mutate()}
              disabled={!form.mealName.trim() || logMutation.isPending}
            >
              {logMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log Meal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* T45: Import from Meal Plan dialog */}
      <Dialog open={showImport} onOpenChange={(o) => { setShowImport(o); if (!o) { setImportSearch(''); setImportShowRecent(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import from Meal Plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search meals by name..."
              value={importSearch}
              onChange={(e) => setImportSearch(e.target.value)}
              autoFocus
            />
            {/* Search results */}
            {importSearch && (
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {filteredMeals.length === 0 ? (
                  <p className="text-sm text-muted text-center py-4">No meals found</p>
                ) : (
                  filteredMeals.map((meal: MealPlan) => (
                    <MealImportRow key={meal.id} meal={meal} onSelect={() => {
                      setForm({ mealName: meal.mealName, calories: meal.calories ? String(meal.calories) : '', protein: '', carbs: '', fat: '', fiber: '', notes: meal.preparationNotes || '' });
                      setShowImport(false); setShowAdd(true);
                    }} />
                  ))
                )}
              </div>
            )}
            {/* Recent completed meals section */}
            <button
              onClick={() => setImportShowRecent((v) => !v)}
              className="flex items-center justify-between w-full px-1 py-1 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              <span>Recent completed meals</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', importShowRecent && 'rotate-180')} />
            </button>
            {importShowRecent && (
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {recentMeals.length === 0 ? (
                  <p className="text-sm text-muted text-center py-4">No recent meals</p>
                ) : (
                  recentMeals.map((meal: MealPlan) => (
                    <MealImportRow key={meal.id} meal={meal} onSelect={() => {
                      setForm({ mealName: meal.mealName, calories: meal.calories ? String(meal.calories) : '', protein: '', carbs: '', fat: '', fiber: '', notes: meal.preparationNotes || '' });
                      setShowImport(false); setShowAdd(true);
                    }} />
                  ))
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MealImportRow({ meal, onSelect }: { meal: MealPlan; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-3 py-2.5 rounded-xl border border-card-border dark:border-[#374151] hover:bg-slate-50 dark:hover:bg-[#283447] transition-colors"
    >
      <p className="text-sm font-medium">{meal.mealName}</p>
      <p className="text-xs text-muted capitalize">
        {meal.mealType.replace(/_/g, ' ')} · {new Date(meal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        {meal.calories ? ` · ${meal.calories} cal` : ''}
      </p>
    </button>
  );
}
