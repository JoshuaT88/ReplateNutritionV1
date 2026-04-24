import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertTriangle, Package, RefreshCw, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';
import { PantryItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

const CATEGORIES = [
  'Produce', 'Meat & Poultry', 'Dairy & Eggs', 'Frozen', 'Pantry',
  'Bakery', 'Snacks', 'Beverages', 'Condiments', 'Health & Beauty', 'Other',
];

export default function PantryPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [form, setForm] = useState({
    itemName: '', category: '', quantity: '', unit: '',
    expiresAt: '', notes: '', lowStockAlert: false,
  });

  const { data: items = [], isLoading } = useQuery<PantryItem[]>({
    queryKey: ['pantry'],
    queryFn: () => api.getPantryItems(),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof form) => api.addPantryItem({
      itemName: data.itemName,
      category: data.category || undefined,
      quantity: data.quantity || undefined,
      unit: data.unit || undefined,
      expiresAt: data.expiresAt || undefined,
      notes: data.notes || undefined,
      lowStockAlert: data.lowStockAlert,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pantry'] });
      setShowAdd(false);
      setForm({ itemName: '', category: '', quantity: '', unit: '', expiresAt: '', notes: '', lowStockAlert: false });
      toast('success', 'Item added to pantry');
    },
    onError: (e: any) => toast('error', e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePantryItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pantry'] }),
  });

  const addToShoppingListMutation = useMutation({
    mutationFn: (item: PantryItem) => api.addShoppingItem({
      itemName: item.itemName,
      category: item.category || undefined,
      quantity: item.quantity || undefined,
    }),
    onSuccess: () => toast('success', 'Added to shopping list'),
    onError: (e: any) => toast('error', e.message),
  });

  const addAllToShoppingMutation = useMutation({
    mutationFn: async () => {
      const toAdd = filtered.filter((i) => !i.isExpired);
      await Promise.all(toAdd.map((item) =>
        api.addShoppingItem({ itemName: item.itemName, category: item.category || undefined, quantity: item.quantity || undefined })
      ));
      return toAdd.length;
    },
    onSuccess: (count) => toast('success', `Added ${count} item${count !== 1 ? 's' : ''} to shopping list`),
    onError: (e: any) => toast('error', e.message),
  });

  const filtered = items.filter((item) => {
    const matchSearch = !search || item.itemName.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'All' || item.category === filterCategory;
    return matchSearch && matchCat;
  });

  const expiring = filtered.filter((i) => i.isExpiringSoon && !i.isExpired);
  const expired = filtered.filter((i) => i.isExpired);
  const normal = filtered.filter((i) => !i.isExpiringSoon && !i.isExpired);

  const categories: string[] = ['All', ...Array.from(new Set(items.map((i) => i.category).filter((c): c is string => !!c)))];

  function formatExpiry(dateStr: string | null) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Expired';
    if (diff === 0) return 'Expires today';
    if (diff === 1) return 'Expires tomorrow';
    return `Expires in ${diff} days`;
  }

  function renderItem(item: PantryItem) {
    return (
      <Card key={item.id} className={`p-3 flex items-start justify-between gap-2 ${item.isExpired ? 'opacity-60 border-red-300' : item.isExpiringSoon ? 'border-amber-400' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-text-primary truncate">{item.itemName}</span>
            {item.isExpired && <Badge variant="danger" className="text-xs">Expired</Badge>}
            {item.isExpiringSoon && !item.isExpired && <Badge className="text-xs bg-amber-500 text-white">Expiring Soon</Badge>}
          </div>
          <div className="text-xs text-text-secondary mt-0.5 flex flex-wrap gap-2">
            {item.category && <span>{item.category}</span>}
            {(item.quantity || item.unit) && <span>{[item.quantity, item.unit].filter(Boolean).join(' ')}</span>}
            {item.expiresAt && <span className={item.isExpired ? 'text-red-500' : item.isExpiringSoon ? 'text-amber-600' : ''}>{formatExpiry(item.expiresAt)}</span>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" title="Add to shopping list" onClick={() => addToShoppingListMutation.mutate(item)}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(item.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Pantry</h1>
          <p className="text-sm text-text-secondary mt-0.5">{items.length} items tracked</p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <Button
              variant="outline"
              onClick={() => addAllToShoppingMutation.mutate()}
              disabled={addAllToShoppingMutation.isPending}
            >
              {addAllToShoppingMutation.isPending
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <ShoppingCart className="h-4 w-4" />}
              Add All to List
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search pantry..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px]"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="flex h-9 rounded-xl border border-card-border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <Skeleton key={n} className="h-16 rounded-xl" />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary">Your pantry is empty.</p>
          <p className="text-text-muted text-sm mt-1">Add items to track what you have at home.</p>
        </div>
      )}

      {/* Expired */}
      {expired.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold text-red-600 text-sm">Expired ({expired.length})</h2>
          </div>
          <div className="space-y-2">{expired.map(renderItem)}</div>
        </section>
      )}

      {/* Expiring soon */}
      {expiring.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-amber-600 text-sm">Expiring Soon ({expiring.length})</h2>
          </div>
          <div className="space-y-2">{expiring.map(renderItem)}</div>
        </section>
      )}

      {/* Normal */}
      {normal.length > 0 && (
        <section>
          <h2 className="font-semibold text-text-secondary text-sm mb-2">In Stock ({normal.length})</h2>
          <div className="space-y-2">{normal.map(renderItem)}</div>
        </section>
      )}

      {/* Add Item Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <h2 className="font-semibold text-text-primary mb-4">Add Pantry Item</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.itemName.trim()) return;
              addMutation.mutate(form);
            }}
          >
            <div>
              <Label>Item Name *</Label>
              <Input
                autoFocus
                value={form.itemName}
                onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
                placeholder="e.g. Greek Yogurt"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full flex h-9 rounded-xl border border-card-border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Auto-detect</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="e.g. 2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="lbs, oz, pkg..."
                />
              </div>
              <div>
                <Label>Expires On</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={form.lowStockAlert}
                onChange={(e) => setForm((f) => ({ ...f, lowStockAlert: e.target.checked }))}
                className="rounded"
              />
              Alert when low stock
            </label>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={addMutation.isPending}>
                {addMutation.isPending ? 'Adding...' : 'Add to Pantry'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
