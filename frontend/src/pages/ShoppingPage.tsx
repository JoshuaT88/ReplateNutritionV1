import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Sparkles, Trash2, Store, PlayCircle, Loader2,
  Search, ChevronDown, MapPin, DollarSign, AlertTriangle, Package, Pencil, Check, X,
  Navigation, Calendar, Flag, Star, StarOff
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { cn, formatCurrency } from '@/lib/utils';
import { getTaxRate } from '@/lib/stateTaxRates';

const KROGER_BANNERS = ['kroger','fred meyer','king soopers','ralphs',"smith's","fry's",'harris teeter','dillons',"baker's",'city market','gerbes','jay c','food 4 less','foods co','pick n save',"mariano's",'pay-less'];
const isKrogerStore = (name: string) => { const l = name.toLowerCase(); return KROGER_BANNERS.some((b) => l.includes(b)); };
import { PageTutorial } from '@/components/shared/PageTutorial';
import type { ShoppingItem, SavedStore } from '@/types';

const RADIUS_OPTIONS = ['5mi', '10mi', '20mi', '30mi', '50mi'] as const;

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300',
  MEDIUM: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300',
  LOW: 'bg-slate-50 dark:bg-[#283447]/60 border-slate-200 dark:border-[#374151] text-slate-600 dark:text-slate-300',
};

export default function ShoppingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showBudgetOpen, setShowBudgetOpen] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem('active_session_id');
    if (id) setActiveSessionId(id);
  }, []);
  const [showGenerateFromMeals, setShowGenerateFromMeals] = useState(false);
  const [generateStore, setGenerateStore] = useState<string>(''); // store chosen in From Meals dialog
  const [showStoreFinder, setShowStoreFinder] = useState(false);
  // Find Other Stores state
  const [otherStoreName, setOtherStoreName] = useState('');
  const [otherStoreRadius, setOtherStoreRadius] = useState<string>('10mi');
  const [otherStoreOrigin, setOtherStoreOrigin] = useState('');
  const [otherStoreResults, setOtherStoreResults] = useState<any[]>([]);
  const [otherStoreSearching, setOtherStoreSearching] = useState(false);
  const [otherStoreSelectedIdx, setOtherStoreSelectedIdx] = useState<number | null>(null);
  const [otherStoreAssignIds, setOtherStoreAssignIds] = useState<Set<string>>(new Set());
  // Start Shopping store-selector modal
  const [showStartShopping, setShowStartShopping] = useState(false);
  const [startShoppingStore, setStartShoppingStore] = useState<string>('');
  const [showBudgetWarning, setShowBudgetWarning] = useState(false);
  const [pendingStoreName, setPendingStoreName] = useState<string | undefined>(undefined);
  const [selectedStoreIdx, setSelectedStoreIdx] = useState<number | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemPriority, setNewItemPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [newItemMeal, setNewItemMeal] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [newItemDealNote, setNewItemDealNote] = useState('');
  const [newItemEstPrice, setNewItemEstPrice] = useState('');
  const [newItemStore, setNewItemStore] = useState<string>(''); // replaces listStore for add item dialog
  const [search, setSearch] = useState('');
  const [filterStore, setFilterStore] = useState<string>('all');
  const [storeSearch, setStoreSearch] = useState('');
  const [customStoreAddress, setCustomStoreAddress] = useState('');
  const [budgetPromptDismissed] = useState(() => localStorage.getItem('budget_prompt_dismissed') === '1');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingStore, setReportingStore] = useState<{ name: string; address: string } | null>(null);
  const [reportCorrection, setReportCorrection] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [showPantryWarning, setShowPantryWarning] = useState(false);
  const [pantryConflictItem, setPantryConflictItem] = useState<string | null>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateExistingItem, setDuplicateExistingItem] = useState<any | null>(null);

  const { data: shoppingList, isLoading, error, refetch } = useQuery({
    queryKey: ['shoppingList'],
    queryFn: () => api.getShoppingList(),
  });

  const { data: pantryItems } = useQuery({
    queryKey: ['pantryItems'],
    queryFn: () => api.getPantryItems(),
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
  });

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.getPreferences(),
  });

  const { data: savedStores = [] } = useQuery<SavedStore[]>({
    queryKey: ['savedStores'],
    queryFn: () => api.getSavedStores(),
  });

  const { data: mealPlans } = useQuery({
    queryKey: ['mealPlans'],
    queryFn: () => api.getMealPlans(),
  });

  const { data: shoppingHistory } = useQuery({
    queryKey: ['shoppingHistory'],
    queryFn: () => api.getShoppingHistory(),
  });

  const addItemMutation = useMutation({
    mutationFn: () => api.addShoppingItem({
      itemName: newItemName,
      quantity: parseInt(newItemQty) as any,
      category: newItemCategory || undefined,
      priority: newItemPriority,
      sourceRef: newItemMeal || undefined,
      notes: newItemNotes || undefined,
      dealNote: newItemDealNote || undefined,
      estimatedPrice: newItemEstPrice ? parseFloat(newItemEstPrice) : undefined,
      assignedStore: newItemStore || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      setNewItemName('');
      setNewItemQty('1');
      setNewItemCategory('');
      setNewItemPriority('MEDIUM');
      setNewItemMeal('');
      setNewItemNotes('');
      setNewItemDealNote('');
      setNewItemEstPrice('');
      setNewItemStore('');
      setShowAddItem(false);
      toast('success', 'Item added');
    },
    onError: (err: Error) => toast('error', 'Failed to add item', err.message),
  });

  const generateFromMealsMutation = useMutation({
    mutationFn: () => {
      const profileIds = profiles?.map((p) => p.id) || [];
      return api.generateShoppingFromMeals(profileIds, 7, generateStore || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      toast('success', 'Shopping list generated from meal plan!');
      setShowGenerateFromMeals(false);
      setGenerateStore('');
    },
    onError: (err: Error) => toast('error', 'Failed to generate', err.message),
  });

  const removeItemMutation = useMutation({
    mutationFn: (id: string) => api.removeShoppingItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoppingList'] }),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ShoppingItem> }) =>
      api.updateShoppingItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      toast('success', 'Item updated');
    },
    onError: (err: Error) => toast('error', 'Failed to update', err.message),
  });

  const startSessionMutation = useMutation({
    mutationFn: (storeName?: string) => api.startShoppingSession(storeName),
    onSuccess: (session) => {
      localStorage.setItem('active_session_id', session.id);
      navigate(`/shopping/session/${session.id}`);
    },
    onError: (err: Error) => toast('error', 'Failed to start session', err.message),
  });

  const reportAddressMutation = useMutation({
    mutationFn: () => api.reportStoreAddress(
      reportingStore!.name,
      reportingStore!.address,
      reportCorrection,
      reportNotes || undefined,
    ),
    onSuccess: () => {
      setShowReportModal(false);
      setReportCorrection('');
      setReportNotes('');
      setReportingStore(null);
      toast('success', 'Report submitted', 'Thanks! We\'ll review the address correction.');
    },
    onError: (err: Error) => toast('error', 'Failed to submit report', err.message),
  });

  const tryStartSession = (storeName?: string, storeEstimate?: number) => {
    const tripBudget = preferences?.perTripBudgetAllocation || preferences?.budget || 0;
    const estimate = storeEstimate || totalEstimate || 0;
    if (tripBudget > 0 && estimate > 0 && estimate > tripBudget) {
      setPendingStoreName(storeName);
      setShowBudgetWarning(true);
    } else {
      startSessionMutation.mutate(storeName);
    }
  };

  const perTripBudget = preferences?.perTripBudgetAllocation ||
    (preferences?.budget
      ? preferences.budget / (preferences.shoppingFrequency === 'biweekly' ? 2 : preferences.shoppingFrequency === 'monthly' ? 1 : 4)
      : 0);

  const preferredStores: string[] = Array.isArray(preferences?.preferredStoreIds)
    ? (preferences!.preferredStoreIds as string[])
    : [];

  const getDirectionsUrl = (address: string) => {
    const enc = encodeURIComponent(address);
    switch (preferences?.gpsAppPreference) {
      case 'apple': return `https://maps.apple.com/?daddr=${enc}`;
      case 'waze': return `https://waze.com/ul?q=${enc}`;
      default: return `https://www.google.com/maps/dir/?api=1&destination=${enc}`;
    }
  };

  const items = shoppingList || [];
  const filtered = items.filter((item) => {
    const matchesSearch = item.itemName.toLowerCase().includes(search.toLowerCase());
    const matchesStore = filterStore === 'all' || (item as any).assignedStore === filterStore || (!((item as any).assignedStore) && filterStore === 'unassigned');
    return matchesSearch && matchesStore;
  });

  // Group by assigned store, then by category within each store
  const groupedByStore = filtered.reduce<Record<string, typeof filtered>>((acc, item) => {
    const store = (item as any).assignedStore || 'Unassigned';
    if (!acc[store]) acc[store] = [];
    acc[store].push(item);
    return acc;
  }, {});

  const totalEstimate = items.reduce((sum, i) => sum + (i.estimatedPrice || 0), 0);

  // Monthly spending from history
  const monthlyBudget = preferences?.budget || 0;
  const monthlySpent = (() => {
    if (!shoppingHistory) return 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return shoppingHistory
      .filter((h: any) => new Date(h.shoppingDate) >= startOfMonth)
      .reduce((sum: number, h: any) => sum + (h.actualCost || 0), 0);
  })();
  const budgetRemaining = monthlyBudget > 0 ? monthlyBudget - monthlySpent : 0;

  // T80c: compute next shopping trip days away
  const daysUntilNextTrip = (() => {
    if (!preferences?.shoppingDay) return null;
    const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const target = dayNames.indexOf(preferences.shoppingDay.toLowerCase());
    if (target === -1) return null;
    const now = new Date();
    const diff = (target - now.getDay() + 7) % 7;
    return diff === 0 ? 7 : diff;
  })();
  const pantryBannerKey = `pantry_banner_dismissed_${new Date().toISOString().slice(0, 7)}`;
  const [pantryBannerDismissed, setPantryBannerDismissed] = useState(() =>
    localStorage.getItem(pantryBannerKey) === '1'
  );
  const showPantryBanner =
    !pantryBannerDismissed &&
    daysUntilNextTrip !== null &&
    daysUntilNextTrip <= 2 &&
    pantryItems && pantryItems.length > 0;

  return (
    <div className="space-y-6">
      {/* T75 Page Tutorial */}
      <PageTutorial pageKey="shopping" steps={[
        { title: 'Add items', description: 'Use \'Add Item\' to add groceries manually, or \'From Meals\' to generate from your meal plan.' },
        { title: 'Find stores', description: 'Enter your ZIP code to compare estimated costs at nearby stores.' },
        { title: 'Start shopping', description: 'Pick a store and tap \'Start Shopping\' to open a guided in-store session.' },
      ]} />
      {/* T80c Pre-shopping pantry banner */}
      {showPantryBanner && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">
              Your next shopping trip is in {daysUntilNextTrip} day{daysUntilNextTrip !== 1 ? 's' : ''} — check your pantry first!
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/pantry')}>Review Pantry</Button>
            <Button size="sm" variant="outline" onClick={() => {
              localStorage.setItem(pantryBannerKey, '1');
              setPantryBannerDismissed(true);
            }}>Dismiss</Button>
          </div>
        </div>
      )}
      {/* Budget setup prompt — shown once if budget/frequency not configured */}
      {!budgetPromptDismissed && preferences && (!preferences.budget || !preferences.shoppingFrequency) && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">Set your budget to track spending per trip</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/settings')}>Set Up</Button>
            <Button size="sm" variant="outline" onClick={() => {
              localStorage.setItem('budget_prompt_dismissed', '1');
              window.location.reload();
            }}>Later</Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shopping List</h1>
          <p className="text-sm text-muted mt-0.5">
            {items.length} item{items.length !== 1 ? 's' : ''}
            {totalEstimate > 0 && <> · Est. {formatCurrency(totalEstimate)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowStoreFinder(true)}>
            <Store className="h-4 w-4" /> Find Other Stores
          </Button>
          <Button variant="outline" onClick={() => setShowGenerateFromMeals(true)}>
            <Sparkles className="h-4 w-4" /> From Meals
          </Button>
          <Button variant="outline" onClick={() => setShowAddItem(true)}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
          <Button
            onClick={() => setShowStartShopping(true)}
            disabled={items.length === 0 || startSessionMutation.isPending}
          >
            <PlayCircle className="h-4 w-4" /> Start Shopping
          </Button>
        </div>
      </div>

      {/* Active Session Resume Banner */}
      {activeSessionId && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-primary">You have an active shopping session</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => navigate(`/shopping/session/${activeSessionId}`)}
            >
              Resume
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                localStorage.removeItem('active_session_id');
                setActiveSessionId(null);
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Budget / Schedule + Saved Stores cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget & Schedule card */}
        <div className="rounded-2xl border border-card-border overflow-hidden">
          <button
            onClick={() => setShowBudgetOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted shrink-0" />
              <span className="text-sm font-medium">Budget &amp; Schedule</span>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-muted transition-transform shrink-0', showBudgetOpen && 'rotate-180')} />
          </button>
          <AnimatePresence initial={false}>
            {showBudgetOpen && (
              <motion.div key="budget-panel" initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-4 pb-4 pt-3 border-t border-card-border space-y-4">
                  {monthlyBudget > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">Monthly Budget</span>
                        <span className={cn('text-xs font-bold', budgetRemaining > 0 ? 'text-emerald-600' : 'text-red-600')}>{formatCurrency(budgetRemaining)} remaining</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-[#374151] overflow-hidden">
                        <div className={cn('h-full rounded-full', monthlySpent / monthlyBudget > 0.9 ? 'bg-red-500' : monthlySpent / monthlyBudget > 0.7 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, (monthlySpent / monthlyBudget) * 100)}%` }} />
                      </div>
                      <div className="flex justify-between mt-0.5 text-[10px] text-muted">
                        <span>Spent: {formatCurrency(monthlySpent)}</span>
                        <span>Budget: {formatCurrency(monthlyBudget)}</span>
                      </div>
                    </div>
                  )}
                  {perTripBudget > 0 && totalEstimate > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">This Trip</span>
                        <span className={cn('text-xs font-bold', totalEstimate > perTripBudget ? 'text-red-600' : 'text-emerald-600')}>
                          {totalEstimate > perTripBudget ? `${formatCurrency(totalEstimate - perTripBudget)} over` : `${formatCurrency(perTripBudget - totalEstimate)} left`}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-[#374151] overflow-hidden">
                        <div className={cn('h-full rounded-full', totalEstimate / perTripBudget >= 1 ? 'bg-red-500' : totalEstimate / perTripBudget >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, (totalEstimate / perTripBudget) * 100)}%` }} />
                      </div>
                      <div className="flex justify-between mt-0.5 text-[10px] text-muted">
                        <span>List: {formatCurrency(totalEstimate)}</span>
                        <span>Per-trip: {formatCurrency(perTripBudget)}</span>
                      </div>
                    </div>
                  )}
                  {monthlyBudget === 0 && !(perTripBudget > 0 && totalEstimate > 0) && (
                    <p className="text-xs text-muted">No budget configured.</p>
                  )}
                  {(preferences?.shoppingDay || daysUntilNextTrip !== null) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted shrink-0" />
                      <span>
                        {preferences?.shoppingDay && <strong className="capitalize">{preferences.shoppingDay}s</strong>}
                        {daysUntilNextTrip !== null && (
                          <span className="text-muted"> — next trip in <strong className="text-foreground">{daysUntilNextTrip} day{daysUntilNextTrip !== 1 ? 's' : ''}</strong></span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="pt-1 border-t border-card-border">
                    <button onClick={() => navigate('/settings')} className="text-xs text-primary hover:underline">Manage settings →</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Saved Stores card */}
        <SavedStoresCard
          savedStores={savedStores}
          items={items}
          onFindOtherStores={() => setShowStoreFinder(true)}
          onStartShopping={(storeName) => startSessionMutation.mutate(storeName)}
          onSave={(data) => api.getSavedStores().then(() => {})}
          onUpdate={(id, data) => api.updateSavedStore(id, data).then(() => queryClient.invalidateQueries({ queryKey: ['savedStores'] }))}
          onDelete={(id) => api.deleteSavedStore(id).then(() => queryClient.invalidateQueries({ queryKey: ['savedStores'] }))}
          onAssign={(storeName, itemIds) => {
            Promise.all(itemIds.map(id => api.updateShoppingItem(id, { assignedStore: storeName } as any))).then(() => queryClient.invalidateQueries({ queryKey: ['shoppingList'] }));
          }}
        />
      </div>

      {/* Search + Store filter */}
      <div className="flex flex-col gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="flex h-10 w-full rounded-xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#283447] dark:text-[#F9FAFB] pl-9 pr-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        {preferredStores.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted font-medium">Filter:</span>
            <button
              onClick={() => setFilterStore('all')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                filterStore === 'all'
                  ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
                  : 'border-card-border text-muted hover:border-slate-300 dark:hover:border-slate-500'
              )}
            >
              All
            </button>
            {preferredStores.map((s) => (
              <button
                key={s}
                onClick={() => setFilterStore(filterStore === s ? 'all' : s)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                  filterStore === s
                    ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
                    : 'border-card-border text-muted hover:border-slate-300 dark:hover:border-slate-500'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {error ? (
        <ErrorCard onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-card-border bg-white p-5">
              <Skeleton className="h-5 w-32 mb-3" />
              <Skeleton className="h-12 w-full rounded-xl mb-2" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Your shopping list is empty"
          description="Add items manually or generate from your meal plan."
          actionLabel="Add first item"
          onAction={() => setShowAddItem(true)}
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByStore).sort(([a], [b]) => {
            if (a === 'Unassigned') return 1;
            if (b === 'Unassigned') return -1;
            return a.localeCompare(b);
          }).map(([storeName, storeItems]) => (
              <StoreGroup
                key={storeName}
                storeName={storeName}
                storeItems={storeItems}
                onRemove={(id) => removeItemMutation.mutate(id)}
                onUpdate={(id, data) => updateItemMutation.mutate({ id, data })}
                preferredStores={preferredStores}
                showHeader={true}
                onStartShopping={(s) => tryStartSession(s)}
              />
          ))}
        </div>
      )}

      {/* Add Item Dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-4">
            <Input
              placeholder="Item name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                min="1"
                placeholder="Quantity"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
              />
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">Category (auto)</option>
                {['Produce', 'Dairy', 'Meat & Seafood', 'Pantry', 'Bakery', 'Frozen', 'Beverages', 'Snacks', 'Condiments', 'Pet Food', 'Other'].map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            {/* Optional meal association */}
            {mealPlans && mealPlans.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted block mb-1">For meal (optional)</label>
                <select
                  value={newItemMeal}
                  onChange={(e) => setNewItemMeal(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">No meal</option>
                  {[...new Set(mealPlans.map((m: any) => m.mealName))].slice(0, 20).map((name: string) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted mb-1.5">Priority</p>
              <div className="flex gap-2">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewItemPriority(p)}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all capitalize',
                      newItemPriority === p
                        ? p === 'HIGH' ? 'border-red-400 bg-red-50 text-red-700'
                          : p === 'LOW' ? 'border-slate-400 bg-slate-50 text-slate-700'
                          : 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-card-border text-muted hover:border-slate-300'
                    )}
                  >
                    {p.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Est. price (optional)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="$0.00"
                  value={newItemEstPrice}
                  onChange={(e) => setNewItemEstPrice(e.target.value)}
                />
              </div>
              <div>
                  <label className="text-xs font-medium text-muted block mb-1">Assign to store</label>
                  <select
                    value={listStore}
                    onChange={(e) => { setListStore(e.target.value); localStorage.setItem('list_store', e.target.value); }}
                    className="flex h-10 w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">No store</option>
                    {preferredStores.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Notes (optional)</label>
              <Input
                placeholder="e.g. organic, name brand, aisle 5..."
                value={newItemNotes}
                onChange={(e) => setNewItemNotes(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Deal / Coupon / Promo (optional)</label>
              <Input
                placeholder="e.g. Buy 1 Get 1 Free, $0.50 off coupon"
                value={newItemDealNote}
                onChange={(e) => setNewItemDealNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
            <Button
              onClick={() => {
                // Check for duplicate in current list (same name + same assigned store)
                const duplicate = items.find((i) =>
                  i.itemName.toLowerCase().trim() === newItemName.toLowerCase().trim() &&
                  ((i as any).assignedStore || '') === (listStore || '')
                );
                if (duplicate) {
                  setDuplicateExistingItem(duplicate);
                  setShowDuplicateWarning(true);
                  return;
                }
                // T80a: Check pantry for same/similar item before adding
                const match = pantryItems?.find((p: any) =>
                  p.itemName.toLowerCase().includes(newItemName.toLowerCase().trim()) ||
                  newItemName.toLowerCase().trim().includes(p.itemName.toLowerCase())
                );
                if (match) {
                  setPantryConflictItem(match.itemName);
                  setShowPantryWarning(true);
                } else {
                  addItemMutation.mutate();
                }
              }}
              disabled={!newItemName.trim() || addItemMutation.isPending}
            >
              {addItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate from Meals Dialog */}
      <Dialog open={showGenerateFromMeals} onOpenChange={(o) => { setShowGenerateFromMeals(o); if (!o) setGenerateStore(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate from Meal Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-4">
            <p className="text-sm text-muted">
              This will analyze your upcoming meal plan and create a shopping list with all required ingredients,
              grouped by category with estimated prices.
            </p>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Assign all generated items to store</Label>
              <select
                value={generateStore}
                onChange={(e) => setGenerateStore(e.target.value)}
                className="flex h-9 w-full rounded-xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#283447] dark:text-[#F9FAFB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">No store (unassigned)</option>
                {savedStores.filter(s => s.isPreferred).map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
                {savedStores.filter(s => !s.isPreferred).map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            {perTripBudget > 0 && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  Generated items will be priced against your <strong>{formatCurrency(perTripBudget)}</strong> per-trip budget.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateFromMeals(false)}>Cancel</Button>
            <Button onClick={() => generateFromMealsMutation.mutate()} disabled={generateFromMealsMutation.isPending}>
              {generateFromMealsMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                : <><Sparkles className="h-4 w-4" /> Generate</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Find Other Stores Dialog */}
      <Dialog open={showStoreFinder} onOpenChange={(open) => {
        setShowStoreFinder(open);
        if (!open) { setOtherStoreName(''); setOtherStoreResults([]); setOtherStoreAssignIds(new Set()); }
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Find Other Stores</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Store name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. Whole Foods"
                  value={otherStoreName}
                  onChange={(e) => setOtherStoreName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Radius <span className="text-red-500">*</span></Label>
                <select
                  value={otherStoreRadius}
                  onChange={(e) => setOtherStoreRadius(e.target.value)}
                  className="flex h-9 w-full rounded-xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#283447] dark:text-[#F9FAFB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  {RADIUS_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">City, state, or ZIP <span className="text-muted font-normal">(optional — uses your saved location)</span></Label>
              <Input
                placeholder="e.g. Nashville, TN or 37920"
                value={otherStoreOrigin}
                onChange={(e) => setOtherStoreOrigin(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!otherStoreName.trim() || otherStoreSearching}
              onClick={async () => {
                setOtherStoreSearching(true);
                setOtherStoreResults([]);
                try {
                  const results = await api.findOtherStores({
                    storeName: otherStoreName.trim(),
                    radiusLabel: otherStoreRadius,
                    originCityState: otherStoreOrigin.trim() || undefined,
                    originZip: preferences?.zipCode || undefined,
                  });
                  setOtherStoreResults(results);
                } catch (e: any) {
                  toast('error', 'Search failed', e.message);
                } finally {
                  setOtherStoreSearching(false);
                }
              }}
            >
              {otherStoreSearching ? <><Loader2 className="h-4 w-4 animate-spin" /> Searching...</> : <><Search className="h-4 w-4" /> Search</>}
            </Button>

            {otherStoreResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted font-medium">{otherStoreResults.length} result{otherStoreResults.length !== 1 ? 's' : ''}</p>
                {otherStoreResults.map((store: any, idx: number) => {
                  const alreadySaved = savedStores.some(s => s.name === store.name);
                  const unassignedItems = items.filter((i: any) => !i.assignedStore);
                  const isExpanded = otherStoreSelectedIdx === idx;
                  return (
                    <div key={store.placeId || idx} className="rounded-xl border border-card-border overflow-hidden">
                      <div className="p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{store.name}</p>
                          {store.address && <p className="text-xs text-muted mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{store.address}</p>}
                          {store.distance && <p className="text-[10px] text-muted mt-0.5">{store.distance} away</p>}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {alreadySaved ? (
                            <Badge variant="secondary" className="text-[10px]">Saved</Badge>
                          ) : (
                            <Button size="sm" variant="outline" className="text-xs h-7 px-2"
                              onClick={async () => {
                                await api.saveStore({ name: store.name, address: store.address, placeId: store.placeId, distance: store.distance, source: 'find_other' });
                                queryClient.invalidateQueries({ queryKey: ['savedStores'] });
                                toast('success', `${store.name} saved`);
                              }}
                            >
                              <Star className="h-3 w-3 mr-1" /> Save
                            </Button>
                          )}
                          {unassignedItems.length > 0 && (
                            <Button size="sm" variant="outline" className="text-xs h-7 px-2"
                              onClick={() => {
                                setOtherStoreSelectedIdx(isExpanded ? null : idx);
                                setOtherStoreAssignIds(new Set(unassignedItems.map((i: any) => i.id)));
                              }}
                            >
                              Assign Items
                            </Button>
                          )}
                        </div>
                      </div>
                      {isExpanded && unassignedItems.length > 0 && (
                        <div className="border-t border-card-border px-3 pb-3 pt-2 space-y-2">
                          <p className="text-xs font-medium text-muted">Select unassigned items to assign to {store.name}:</p>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {unassignedItems.map((item: any) => (
                              <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-[#283447] rounded px-1 py-0.5">
                                <input type="checkbox" checked={otherStoreAssignIds.has(item.id)} onChange={(e) => {
                                  const next = new Set(otherStoreAssignIds);
                                  e.target.checked ? next.add(item.id) : next.delete(item.id);
                                  setOtherStoreAssignIds(next);
                                }} className="rounded" />
                                <span className="truncate">{item.itemName}</span>
                              </label>
                            ))}
                          </div>
                          <Button size="sm" className="w-full text-xs"
                            disabled={otherStoreAssignIds.size === 0}
                            onClick={async () => {
                              await Promise.all(Array.from(otherStoreAssignIds).map(id => api.updateShoppingItem(id, { assignedStore: store.name } as any)));
                              queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
                              toast('success', `${otherStoreAssignIds.size} items assigned to ${store.name}`);
                              setOtherStoreSelectedIdx(null);
                            }}
                          >
                            Assign {otherStoreAssignIds.size} item{otherStoreAssignIds.size !== 1 ? 's' : ''}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!otherStoreSearching && otherStoreResults.length === 0 && otherStoreName && (
              <p className="text-sm text-muted text-center py-2">No results yet — hit Search to find stores.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Start Shopping Store Selector */}
      <Dialog open={showStartShopping} onOpenChange={setShowStartShopping}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Shopping</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 my-4">
            <p className="text-xs text-muted mb-3">Choose which store's items you want to shop for:</p>
            {Object.entries(groupedByStore).sort(([a], [b]) => {
              if (a === 'Unassigned') return 1;
              if (b === 'Unassigned') return -1;
              return a.localeCompare(b);
            }).map(([storeName, storeItems]) => {
              const est = storeItems.reduce((s: number, i: any) => s + (i.estimatedPrice || 0), 0);
              return (
                <button
                  key={storeName}
                  onClick={() => { setShowStartShopping(false); tryStartSession(storeName === 'Unassigned' ? undefined : storeName); }}
                  className={cn(
                    'w-full text-left rounded-xl border px-4 py-3 transition-all hover:border-primary hover:bg-primary/5',
                    startShoppingStore === storeName ? 'border-primary bg-primary/10' : 'border-card-border'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{storeName}</p>
                      <p className="text-xs text-muted">{storeItems.length} item{storeItems.length !== 1 ? 's' : ''}</p>
                    </div>
                    {est > 0 && <span className="text-sm font-semibold text-primary">{formatCurrency(est)}</span>}
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => { setShowStartShopping(false); tryStartSession(); }}
              className="w-full text-left rounded-xl border border-dashed border-card-border px-4 py-3 hover:border-primary hover:bg-primary/5 transition-all"
            >
              <p className="text-sm font-medium">Shop all items</p>
              <p className="text-xs text-muted">No store filter — show everything</p>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartShopping(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Incorrect Address Modal (T64) */}
      <Dialog open={showReportModal} onOpenChange={(open) => {
        setShowReportModal(open);
        if (!open) { setReportCorrection(''); setReportNotes(''); setReportingStore(null); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-amber-500" /> Report Incorrect Address
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-2">
            <div>
              <Label className="text-xs text-muted">Store</Label>
              <p className="text-sm font-medium mt-0.5">{reportingStore?.name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted">Current address on file</Label>
              <p className="text-sm mt-0.5 text-red-600">{reportingStore?.address}</p>
            </div>
            <div>
              <Label htmlFor="report-correction" className="text-xs font-medium">Correct address <span className="text-red-500">*</span></Label>
              <Input
                id="report-correction"
                value={reportCorrection}
                onChange={(e) => setReportCorrection(e.target.value)}
                placeholder="Enter the correct address"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="report-notes" className="text-xs font-medium">Notes (optional)</Label>
              <Textarea
                id="report-notes"
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Additional details about the correction…"
                className="mt-1 resize-none text-sm"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowReportModal(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => reportAddressMutation.mutate()}
              disabled={!reportCorrection.trim() || reportAddressMutation.isPending}
            >
              {reportAddressMutation.isPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…</>
                : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget Warning Dialog */}
      <Dialog open={showBudgetWarning} onOpenChange={setShowBudgetWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Budget Exceeded
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-4">
            <p className="text-sm text-muted">
              Your shopping list estimate ({formatCurrency(totalEstimate)}) exceeds your monthly budget
              of {formatCurrency(preferences?.budget || 0)}.
            </p>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-medium text-amber-800">
                You can filter to only high-priority items, or continue with your full list.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                // Filter to HIGH priority items only
                items.forEach((item) => {
                  if (item.priority !== 'HIGH') {
                    removeItemMutation.mutate(item.id);
                  }
                });
                setShowBudgetWarning(false);
                toast('success', 'Filtered to high-priority items');
              }}
            >
              Focus on High Priority
            </Button>
            <Button
              onClick={() => {
                setShowBudgetWarning(false);
                startSessionMutation.mutate(pendingStoreName);
              }}
              disabled={startSessionMutation.isPending}
            >
              {startSessionMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : 'Continue Full List'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* T80b Pantry Conflict Warning */}
      {/* Duplicate item warning */}
      <Dialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Item Already in List
            </DialogTitle>
          </DialogHeader>
          <div className="my-4 space-y-2">
            <p className="text-sm text-muted">
              <strong className="text-foreground">{newItemName}</strong> is already on your shopping list
              {duplicateExistingItem?.assignedStore ? ` for ${duplicateExistingItem.assignedStore}` : ''}.
              Would you like to increase the quantity instead?
            </p>
            <p className="text-xs text-muted">
              Current quantity: <strong className="text-foreground">{duplicateExistingItem?.quantity || 1}</strong>
            </p>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => { setShowDuplicateWarning(false); setDuplicateExistingItem(null); }}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => {
              setShowDuplicateWarning(false);
              setDuplicateExistingItem(null);
              addItemMutation.mutate();
            }}>
              Add Separately
            </Button>
            <Button onClick={() => {
              if (duplicateExistingItem) {
                const currentQty = parseInt(String(duplicateExistingItem.quantity || '1'));
                const addQty = parseInt(newItemQty || '1');
                updateItemMutation.mutate({
                  id: duplicateExistingItem.id,
                  data: { quantity: String(currentQty + addQty) },
                });
              }
              setShowDuplicateWarning(false);
              setDuplicateExistingItem(null);
              setShowAddItem(false);
              setNewItemName('');
              setNewItemQty('1');
            }}>
              Increase Quantity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPantryWarning} onOpenChange={setShowPantryWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Item May Already Be In Pantry
            </DialogTitle>
          </DialogHeader>
          <div className="my-4">
            <p className="text-sm text-muted">
              You already have <strong className="text-foreground">{pantryConflictItem}</strong> in your pantry.
              Do you still want to add <strong className="text-foreground">{newItemName}</strong> to your shopping list?
            </p>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate('/pantry')}>Set Up Pantry</Button>
            <Button variant="outline" onClick={() => { setShowPantryWarning(false); setPantryConflictItem(null); }}>Cancel</Button>
            <Button onClick={() => { setShowPantryWarning(false); setPantryConflictItem(null); addItemMutation.mutate(); }}>
              Skip, Add Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SavedStoresCard({ savedStores, items, onFindOtherStores, onStartShopping, onUpdate, onDelete, onAssign }: {
  savedStores: SavedStore[];
  items: any[];
  onFindOtherStores: () => void;
  onStartShopping: (storeName: string) => void;
  onSave?: (data: any) => void;
  onUpdate: (id: string, data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAssign: (storeName: string, itemIds: string[]) => void;
}) {
  const [tab, setTab] = useState<'preferred' | 'other'>('preferred');
  const [assigningStore, setAssigningStore] = useState<SavedStore | null>(null);
  const [assignIds, setAssignIds] = useState<Set<string>>(new Set());
  const unassigned = items.filter((i: any) => !i.assignedStore);
  const preferred = savedStores.filter(s => s.isPreferred);
  const other = savedStores.filter(s => !s.isPreferred);
  const displayed = tab === 'preferred' ? preferred : other;
  return (
    <div className="rounded-2xl border border-card-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('preferred')}
            className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-all', tab === 'preferred' ? 'bg-primary text-white' : 'text-muted hover:text-foreground')}
          >
            Preferred Stores {preferred.length > 0 && `(${preferred.length})`}
          </button>
          <button
            onClick={() => setTab('other')}
            className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-all', tab === 'other' ? 'bg-primary text-white' : 'text-muted hover:text-foreground')}
          >
            Other Nearby {other.length > 0 && `(${other.length})`}
          </button>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onFindOtherStores}>
          <Search className="h-3 w-3 mr-1" /> Find Other Stores
        </Button>
      </div>
      <div className="p-3">
        {displayed.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">
            {tab === 'preferred' ? 'No preferred stores saved. Use "Find Other Stores" to discover and save stores.' : 'No other nearby stores saved.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {displayed.map(store => (
              <div key={store.id} className="rounded-xl border border-card-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{store.name}</p>
                    {store.address && <p className="text-[11px] text-muted truncate">{store.address}</p>}
                    {store.distance && <p className="text-[10px] text-muted">{store.distance} away</p>}
                  </div>
                  {store.isPreferred && <Star className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => onUpdate(store.id, { isPreferred: !store.isPreferred })}
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-primary transition-colors"
                    title={store.isPreferred ? 'Remove as preferred' : 'Set as preferred'}
                  >
                    {store.isPreferred ? <StarOff className="h-3 w-3" /> : <Star className="h-3 w-3" />}
                    {store.isPreferred ? 'Unprefer' : 'Set Preferred'}
                  </button>
                  <button
                    onClick={() => onStartShopping(store.name)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
                  >
                    <PlayCircle className="h-3 w-3" /> Shop Here
                  </button>
                  {unassigned.length > 0 && (
                    <button
                      onClick={() => { setAssigningStore(store); setAssignIds(new Set(unassigned.map((i: any) => i.id))); }}
                      className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors"
                    >
                      <Package className="h-3 w-3" /> Assign Items
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(store.id)}
                    className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 transition-colors ml-auto"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Assign Items mini-modal */}
      {assigningStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAssigningStore(null)}>
          <div className="bg-white dark:bg-[#1E2A3B] rounded-2xl border border-card-border p-4 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium mb-2">Assign unassigned items to {assigningStore.name}</p>
            <div className="space-y-1 max-h-48 overflow-y-auto mb-3">
              {unassigned.map((item: any) => (
                <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-[#283447] rounded px-1 py-0.5">
                  <input type="checkbox" checked={assignIds.has(item.id)} onChange={(e) => {
                    const next = new Set(assignIds);
                    e.target.checked ? next.add(item.id) : next.delete(item.id);
                    setAssignIds(next);
                  }} className="rounded" />
                  <span className="truncate">{item.itemName}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setAssigningStore(null)}>Cancel</Button>
              <Button size="sm" className="flex-1" disabled={assignIds.size === 0} onClick={() => {
                onAssign(assigningStore!.name, Array.from(assignIds));
                setAssigningStore(null);
              }}>
                Assign {assignIds.size}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreGroup({ storeName, storeItems, onRemove, onUpdate, preferredStores, showHeader, onStartShopping }: {
  storeName: string;
  storeItems: any[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, data: any) => void;
  preferredStores: string[];
  showHeader: boolean;
  onStartShopping?: (storeName: string) => void;
}) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editPriority, setEditPriority] = useState<string>('MEDIUM');
  const [editNotes, setEditNotes] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editEstPrice, setEditEstPrice] = useState('');
  const [editSourceRef, setEditSourceRef] = useState('');
  const [editAssignedStore, setEditAssignedStore] = useState('');
  const [validatingPriceIds, setValidatingPriceIds] = useState<Set<string>>(new Set());
  const [validatingLocationIds, setValidatingLocationIds] = useState<Set<string>>(new Set());

  const allIds = storeItems.map((i) => i.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => { setSelectedIds(new Set()); setShowMoveDropdown(false); };

  const openEdit = () => {
    const id = Array.from(selectedIds)[0];
    const item = storeItems.find((i) => i.id === id);
    if (!item) return;
    setEditingItem(item);
    setEditName(item.itemName);
    setEditQty(String(item.quantity || '1'));
    setEditPriority(item.priority || 'MEDIUM');
    setEditNotes(item.notes || '');
    setEditCategory(item.category || '');
    setEditEstPrice(item.estimatedPrice != null ? String(item.estimatedPrice) : '');
    setEditSourceRef(item.sourceRef || '');
    setEditAssignedStore(item.assignedStore || '');
  };

  const saveEdit = () => {
    if (!editingItem) return;
    onUpdate(editingItem.id, {
      itemName: editName,
      quantity: editQty,
      priority: editPriority,
      notes: editNotes || null,
      category: editCategory || null,
      estimatedPrice: editEstPrice ? parseFloat(editEstPrice) : null,
      sourceRef: editSourceRef || null,
      assignedStore: editAssignedStore || null,
    });
    setEditingItem(null);
    clearSelection();
  };

  const handleDeleteSelected = () => {
    Array.from(selectedIds).forEach((id) => onRemove(id));
    clearSelection();
  };

  const handleMoveSelected = (targetStore: string) => {
    Array.from(selectedIds).forEach((id) => onUpdate(id, { assignedStore: targetStore || null }));
    clearSelection();
  };

  const handleValidatePrice = async () => {
    const ids = Array.from(selectedIds);
    setValidatingPriceIds(new Set(ids));
    let updated = 0;
    await Promise.all(ids.map(async (id) => {
      const item = storeItems.find((i) => i.id === id);
      if (!item) return;
      try {
        const result = await api.getPriceEstimate(item.itemName, storeName !== 'Unassigned' ? storeName : undefined);
        if (result.estimatedPrice != null) {
          onUpdate(id, { estimatedPrice: result.estimatedPrice });
          updated++;
        }
      } catch { /* skip */ }
    }));
    setValidatingPriceIds(new Set());
    toast('success', `Price refreshed for ${updated} item${updated !== 1 ? 's' : ''}`);
  };

  const handleValidateLocation = async () => {
    const ids = Array.from(selectedIds);
    setValidatingLocationIds(new Set(ids));
    let updated = 0;
    await Promise.all(ids.map(async (id) => {
      const item = storeItems.find((i) => i.id === id);
      if (!item) return;
      try {
        const result = await api.predictAisleLocation(item.itemName, storeName !== 'Unassigned' ? storeName : 'Generic');
        if (result.aisle) {
          onUpdate(id, { aisleHint: result.aisle });
          updated++;
        }
      } catch { /* skip */ }
    }));
    setValidatingLocationIds(new Set());
    toast('success', `Location updated for ${updated} item${updated !== 1 ? 's' : ''}`);
  };

  const byCategory = storeItems.reduce<Record<string, any[]>>((acc, item) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const validatingAny = validatingPriceIds.size > 0 || validatingLocationIds.size > 0;

  return (
    <div className="space-y-0 rounded-2xl border border-card-border overflow-hidden">
      {/* Store header card — always visible */}
      <div className="bg-surface">
        {/* Row 1: store name + select all */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-card-border">
          <div className="flex items-center gap-2">
            <Store className="h-3.5 w-3.5 text-muted shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">{storeName === 'Unassigned' ? 'No Store Assigned' : storeName}</span>
            <span className="text-[10px] text-muted bg-slate-100 dark:bg-[#283447] rounded-full px-2 py-0.5">{storeItems.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {storeName !== 'Unassigned' && onStartShopping && (
              <button
                onClick={() => onStartShopping(storeName)}
                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <PlayCircle className="h-3.5 w-3.5" /> Start Shopping
              </button>
            )}
            {/* Select All toggle */}
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-[11px] text-muted hover:text-primary transition-colors font-medium"
            >
              <div className={cn(
                'h-3.5 w-3.5 rounded-sm border-2 flex items-center justify-center transition-colors',
                allSelected ? 'bg-primary border-primary' : someSelected ? 'bg-primary/30 border-primary' : 'border-current'
              )}>
                {allSelected && <Check className="h-2 w-2 text-white" />}
                {someSelected && <span className="w-1.5 h-0.5 bg-primary rounded-full block" />}
              </div>
              Select all
            </button>
          </div>
        </div>

        {/* Row 2: action bar — only when items are selected */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2 bg-primary/5 border-b border-primary/20 flex-wrap">
            <span className="text-xs font-semibold text-primary shrink-0 mr-1">
              {selectedIds.size} selected
            </span>

            {/* Edit — only when 1 item selected */}
            {selectedIds.size === 1 && (
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 px-2.5" onClick={openEdit}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}

            {/* Validate Price */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1 px-2.5"
              onClick={handleValidatePrice}
              disabled={validatingAny}
            >
              {validatingPriceIds.size > 0 ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
              Validate Price
            </Button>

            {/* Validate Location */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1 px-2.5"
              onClick={handleValidateLocation}
              disabled={validatingAny}
            >
              {validatingLocationIds.size > 0 ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
              Validate Location
            </Button>

            {/* Move to Store */}
            {preferredStores.length > 0 && (
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] gap-1 px-2.5"
                  onClick={() => setShowMoveDropdown((v) => !v)}
                >
                  <Store className="h-3 w-3" /> Move <ChevronDown className="h-3 w-3" />
                </Button>
                {showMoveDropdown && (
                  <div className="absolute top-8 left-0 z-20 bg-white dark:bg-[#283447] border border-card-border rounded-xl shadow-lg py-1 min-w-[160px]">
                    <p className="text-[10px] font-semibold text-muted px-3 pt-1 pb-0.5">Move to store</p>
                    <button
                      onClick={() => handleMoveSelected('')}
                      className="block w-full text-left text-xs px-3 py-2 hover:bg-surface-hover"
                    >
                      No store
                    </button>
                    {preferredStores.filter((s) => s !== storeName).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleMoveSelected(s)}
                        className="block w-full text-left text-xs px-3 py-2 hover:bg-surface-hover"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Delete */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1 px-2.5 text-red-600 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </Button>

            {/* Clear */}
            <button
              onClick={clearSelection}
              className="ml-auto h-7 w-7 flex items-center justify-center rounded hover:bg-surface-hover text-muted"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Category groups */}
      <div className="space-y-1.5 px-2 py-2">
        {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([category, catItems]) => (
          <CategoryGroup
            key={`${storeName}-${category}`}
            category={category}
            items={catItems}
            onRemove={onRemove}
            onUpdate={onUpdate}
            preferredStores={preferredStores}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            validatingPriceIds={validatingPriceIds}
            validatingLocationIds={validatingLocationIds}
          />
        ))}
      </div>

      {/* Fine print footer */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-[#1e2a38] border-t border-card-border">
        <p className="text-[10px] text-muted/70 text-center">
          Select items using the checkboxes to edit, delete, validate prices, update in-store locations, or move between stores.
        </p>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-3">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Item name" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={editQty} onChange={(e) => setEditQty(e.target.value)} placeholder="Quantity" type="number" min="1" />
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
                className="h-10 rounded-xl border border-card-border dark:border-[#374151] dark:bg-[#283447] dark:text-white bg-white px-3 text-sm"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="h-10 rounded-xl border border-card-border dark:border-[#374151] dark:bg-[#283447] dark:text-white bg-white px-3 text-sm w-full"
              >
                <option value="">Category (auto)</option>
                {['Produce','Dairy','Meat & Seafood','Pantry','Bakery','Frozen','Beverages','Snacks','Condiments','Pet Food','Other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Input
                value={editEstPrice}
                onChange={(e) => setEditEstPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Est. price ($)"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
            <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes (optional)" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={editSourceRef} onChange={(e) => setEditSourceRef(e.target.value)} placeholder="For meal (optional)" />
              {preferredStores.length > 0 ? (
                <select
                  value={editAssignedStore}
                  onChange={(e) => setEditAssignedStore(e.target.value)}
                  className="h-10 rounded-xl border border-card-border dark:border-[#374151] dark:bg-[#283447] dark:text-white bg-white px-3 text-sm"
                >
                  <option value="">No store</option>
                  {preferredStores.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <Input value={editAssignedStore} onChange={(e) => setEditAssignedStore(e.target.value)} placeholder="Assign to store" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={!editName.trim()}>
              <Check className="h-3.5 w-3.5" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryGroup({ category, items, onRemove, onUpdate, preferredStores = [], selectedIds, onToggleSelect, validatingPriceIds, validatingLocationIds }: {
  category: string;
  items: any[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, data: any) => void;
  preferredStores?: string[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  validatingPriceIds?: Set<string>;
  validatingLocationIds?: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <Card>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted" />
          <span className="text-sm font-semibold capitalize">{category}</span>
          <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted transition-transform', collapsed && '-rotate-90')} />
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1.5">
              {items.map((item) => {
                const isPriceValidating = validatingPriceIds?.has(item.id);
                const isLocationValidating = validatingLocationIds?.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all',
                      PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.MEDIUM,
                      selectedIds?.has(item.id) && 'ring-2 ring-primary/40'
                    )}
                  >
                    {/* Square checkbox */}
                    <div
                      onClick={(e) => { e.stopPropagation(); onToggleSelect?.(item.id); }}
                      className={cn(
                        'h-4 w-4 rounded-sm border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors',
                        selectedIds?.has(item.id) ? 'bg-primary border-primary' : 'border-current opacity-40 hover:opacity-80'
                      )}
                    >
                      {selectedIds?.has(item.id) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>

                    {/* Item content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{item.itemName}</p>
                        {(isPriceValidating || isLocationValidating) && (
                          <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted flex-wrap">
                        <span>Qty: {item.quantity || 1}</span>
                        {item.unit && <span>· {item.unit}</span>}
                        {item.estimatedPrice != null && (
                          <span className="flex items-center gap-0.5">
                            <DollarSign className="h-3 w-3" /> ~{formatCurrency(item.estimatedPrice)}
                          </span>
                        )}
                        {item.aisleHint && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" /> {item.aisleHint}
                          </span>
                        )}
                        {item.confidence && item.confidence < 0.5 && (
                          <span className="flex items-center gap-0.5 text-amber-600">
                            <AlertTriangle className="h-3 w-3" /> Low confidence
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-[10px] text-muted mt-0.5 italic">{item.notes}</p>
                      )}
                      {item.sourceRef && (
                        <p className="text-[10px] text-primary mt-0.5 font-medium">🍽 {item.sourceRef}</p>
                      )}
                    </div>

                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">{item.priority?.toLowerCase()}</Badge>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
