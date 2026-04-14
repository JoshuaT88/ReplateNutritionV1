import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Sparkles, Trash2, Store, PlayCircle, Loader2,
  Search, ChevronDown, MapPin, DollarSign, AlertTriangle, Package, Pencil, Check, X
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
import { useToast } from '@/components/ui/toast';
import { cn, formatCurrency } from '@/lib/utils';
import type { ShoppingItem } from '@/types';

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 border-red-200 text-red-700',
  MEDIUM: 'bg-amber-50 border-amber-200 text-amber-700',
  LOW: 'bg-slate-50 border-slate-200 text-slate-600',
};

export default function ShoppingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showGenerateFromMeals, setShowGenerateFromMeals] = useState(false);
  const [showStoreFinder, setShowStoreFinder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemPriority, setNewItemPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [search, setSearch] = useState('');
  const [zipCode, setZipCode] = useState('');

  const { data: shoppingList, isLoading, error, refetch } = useQuery({
    queryKey: ['shoppingList'],
    queryFn: () => api.getShoppingList(),
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
  });

  const { data: stores, isFetching: storesFetching } = useQuery({
    queryKey: ['stores', zipCode],
    queryFn: () => api.findStores(zipCode),
    enabled: zipCode.length === 5 && showStoreFinder,
  });

  const addItemMutation = useMutation({
    mutationFn: () => api.addShoppingItem({
      itemName: newItemName,
      quantity: parseInt(newItemQty) as any,
      category: newItemCategory,
      priority: newItemPriority,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      setNewItemName('');
      setNewItemQty('1');
      setNewItemCategory('');
      setNewItemPriority('MEDIUM');
      setShowAddItem(false);
      toast('success', 'Item added');
    },
    onError: (err: Error) => toast('error', 'Failed to add item', err.message),
  });

  const generateFromMealsMutation = useMutation({
    mutationFn: () => {
      const profileIds = profiles?.map((p) => p.id) || [];
      return api.generateShoppingFromMeals(profileIds, 7);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      toast('success', 'Shopping list generated from meal plan!');
      setShowGenerateFromMeals(false);
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
      navigate(`/shopping/session/${session.id}`);
    },
    onError: (err: Error) => toast('error', 'Failed to start session', err.message),
  });

  const items = shoppingList || [];
  const filtered = items.filter((item) =>
    item.itemName.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, item) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const totalEstimate = items.reduce((sum, i) => sum + (i.estimatedPrice || 0) * (i.quantity || 1), 0);

  return (
    <div className="space-y-6">
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
            <Store className="h-4 w-4" /> Find Stores
          </Button>
          <Button variant="outline" onClick={() => setShowGenerateFromMeals(true)}>
            <Sparkles className="h-4 w-4" /> From Meals
          </Button>
          <Button variant="outline" onClick={() => setShowAddItem(true)}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
          <Button
            onClick={() => startSessionMutation.mutate()}
            disabled={items.length === 0 || startSessionMutation.isPending}
          >
            <PlayCircle className="h-4 w-4" /> Start Shopping
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="flex h-10 w-full rounded-xl border border-card-border bg-white pl-9 pr-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
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
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catItems]) => (
            <CategoryGroup
              key={category}
              category={category}
              items={catItems}
              onRemove={(id) => removeItemMutation.mutate(id)}
              onUpdate={(id, data) => updateItemMutation.mutate({ id, data })}
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
              <Input
                placeholder="Category (optional)"
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
              />
            </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
            <Button onClick={() => addItemMutation.mutate()} disabled={!newItemName.trim() || addItemMutation.isPending}>
              {addItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate from Meals Dialog */}
      <Dialog open={showGenerateFromMeals} onOpenChange={setShowGenerateFromMeals}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate from Meal Plan</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted my-4">
            This will analyze your upcoming meal plan and create a shopping list with all required ingredients,
            grouped by category with estimated prices.
          </p>
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

      {/* Store Finder Dialog */}
      <Dialog open={showStoreFinder} onOpenChange={setShowStoreFinder}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Find Nearby Stores</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter ZIP code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                maxLength={5}
                className="flex-1"
              />
              {storesFetching && <Loader2 className="h-5 w-5 animate-spin text-muted self-center" />}
            </div>

            {stores && stores.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {stores.map((store: any) => (
                  <button
                    key={store.placeId}
                    onClick={() => {
                      startSessionMutation.mutate(store.name);
                      setShowStoreFinder(false);
                    }}
                    className="w-full text-left p-3 rounded-xl border border-card-border hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <p className="text-sm font-medium">{store.name}</p>
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {store.address}
                    </p>
                    {store.distance && (
                      <p className="text-[10px] text-muted mt-0.5">{store.distance} away</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {stores && stores.length === 0 && (
              <p className="text-sm text-muted text-center py-4">No stores found near this ZIP code.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryGroup({ category, items, onRemove, onUpdate }: {
  category: string;
  items: any[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, data: any) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editPriority, setEditPriority] = useState<string>('MEDIUM');
  const [editNotes, setEditNotes] = useState('');

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditName(item.itemName);
    setEditQty(item.quantity || '1');
    setEditPriority(item.priority || 'MEDIUM');
    setEditNotes(item.notes || '');
  };

  const saveEdit = () => {
    if (editingId) {
      onUpdate(editingId, {
        itemName: editName,
        quantity: editQty,
        priority: editPriority,
        notes: editNotes || null,
      });
      setEditingId(null);
    }
  };

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
            <div className="px-5 pb-4 space-y-1.5">
              {items.map((item) => (
                <div key={item.id}>
                  {editingId === item.id ? (
                    <div className="px-3 py-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Item name"
                        className="text-sm h-8"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          placeholder="Quantity"
                          className="text-sm h-8"
                        />
                        <select
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value)}
                          className="text-sm h-8 rounded-xl border border-card-border bg-white px-2"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                        </select>
                      </div>
                      <Input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Notes (optional)"
                        className="text-sm h-8"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={saveEdit}>
                          <Check className="h-3 w-3" /> Save
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all',
                        PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.MEDIUM
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.itemName}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted">
                          <span>Qty: {item.quantity || 1}</span>
                          {item.unit && <span>· {item.unit}</span>}
                          {item.estimatedPrice && (
                            <span className="flex items-center gap-0.5">
                              <DollarSign className="h-3 w-3" /> ~{formatCurrency(item.estimatedPrice)}
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
                        {item.aisleHint && (
                          <p className="text-[10px] text-muted mt-0.5">Aisle: {item.aisleHint}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">{item.priority?.toLowerCase()}</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => startEdit(item)}>
                        <Pencil className="h-3.5 w-3.5 text-muted" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onRemove(item.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
