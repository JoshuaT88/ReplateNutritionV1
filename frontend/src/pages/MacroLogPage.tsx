import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Trash2, Loader2, Activity, Download, User } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { fmtDate } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { MealPlan } from '@/types';

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
  const [form, setForm] = useState<MacroFormState>(EMPTY_FORM);

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

  const filteredMeals = (mealPlanData ?? []).filter((m: MealPlan) =>
    !importSearch || m.mealName.toLowerCase().includes(importSearch.toLowerCase())
  ).slice(0, 20);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> Nutrition Log
          </h1>
          <p className="text-sm text-muted mt-0.5">Track daily macros and calories</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {humanProfiles.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5">
              <User className="h-3.5 w-3.5 text-muted shrink-0" />
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="bg-transparent text-sm font-medium focus:outline-none"
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
            className="w-40"
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
                <p className="text-[9px] sm:text-[10px] font-medium capitalize">{key === 'calories' ? 'kcal' : `${key}g`}</p>
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
            {data.logs.map((log: any) => (
              <Card key={log.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{log.mealName}</p>
                      {log.notes && <p className="text-xs text-muted mt-0.5">{log.notes}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {log.calories && (
                          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', MACRO_COLORS.calories)}>
                            {log.calories} kcal
                          </span>
                        )}
                        {log.protein && (
                          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', MACRO_COLORS.protein)}>
                            P: {log.protein}g
                          </span>
                        )}
                        {log.carbs && (
                          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', MACRO_COLORS.carbs)}>
                            C: {log.carbs}g
                          </span>
                        )}
                        {log.fat && (
                          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', MACRO_COLORS.fat)}>
                            F: {log.fat}g
                          </span>
                        )}
                        {log.fiber && (
                          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', MACRO_COLORS.fiber)}>
                            Fiber: {log.fiber}g
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(log.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
              <Input
                placeholder="e.g., Oatmeal with berries"
                value={form.mealName}
                onChange={(e) => setForm((f) => ({ ...f, mealName: e.target.value }))}
              />
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
      <Dialog open={showImport} onOpenChange={(o) => { setShowImport(o); if (!o) setImportSearch(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import from Meal Plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search meals by name..."
              value={importSearch}
              onChange={(e) => setImportSearch(e.target.value)}
              autoFocus
            />
            <div className="max-h-72 overflow-y-auto space-y-1.5">
              {filteredMeals.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">No meals found</p>
              ) : (
                filteredMeals.map((meal: MealPlan) => (
                  <button
                    key={meal.id}
                    onClick={() => {
                      setForm({
                        mealName: meal.mealName,
                        calories: meal.calories ? String(meal.calories) : '',
                        protein: '', carbs: '', fat: '', fiber: '',
                        notes: meal.preparationNotes || '',
                      });
                      setShowImport(false);
                      setShowAdd(true);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-card-border hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm font-medium">{meal.mealName}</p>
                    <p className="text-xs text-muted capitalize">
                      {meal.mealType.replace(/_/g, ' ')} · {new Date(meal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {meal.calories ? ` · ${meal.calories} cal` : ''}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
