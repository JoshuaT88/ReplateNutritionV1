import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, X, AlertTriangle, ArrowLeft, DollarSign,
  MapPin, Loader2, ShoppingCart, Timer, RefreshCw,
  List, LayoutGrid, Layers, ChevronDown, Package
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cn, formatCurrency } from '@/lib/utils';

type ItemStatus = 'PENDING' | 'PICKED_UP' | 'OUT_OF_STOCK' | 'SKIPPED' | 'TOO_EXPENSIVE';
type ViewMode = 'list' | 'checklist' | 'cards';

const STATUS_STYLES: Record<ItemStatus, string> = {
  PENDING: 'bg-white border-card-border',
  PICKED_UP: 'bg-emerald-50 border-emerald-200',
  OUT_OF_STOCK: 'bg-slate-100 border-slate-300 opacity-60',
  SKIPPED: 'bg-slate-100 border-slate-300 opacity-50',
  TOO_EXPENSIVE: 'bg-amber-50 border-amber-200',
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  PENDING: 'Pending',
  PICKED_UP: 'Picked Up',
  OUT_OF_STOCK: 'Out of Stock',
  SKIPPED: 'Skipped',
  TOO_EXPENSIVE: 'Too Expensive',
};

export default function ShoppingSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [markingItem, setMarkingItem] = useState<{ id: string; name: string; aisleHint?: string } | null>(null);
  const [markPrice, setMarkPrice] = useState('');
  const [markAisle, setMarkAisle] = useState('');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewPrices, setReviewPrices] = useState<Record<string, string>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: session, isLoading } = useQuery({
    queryKey: ['shoppingSession', sessionId],
    queryFn: () => api.getShoppingSession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 30000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: ItemStatus }) =>
      api.updateSessionItem(sessionId!, itemId, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoppingSession', sessionId] }),
  });

  const submitPriceMutation = useMutation({
    mutationFn: ({ itemId, price }: { itemId: string; price: number }) =>
      api.submitSessionPrice(sessionId!, itemId, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingSession', sessionId] });
      toast('success', 'Price recorded');
    },
  });

  const submitAisleMutation = useMutation({
    mutationFn: ({ itemId, aisle }: { itemId: string; aisle: string }) =>
      api.submitSessionAisle(sessionId!, itemId, aisle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingSession', sessionId] });
      toast('success', 'Aisle saved');
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: () => api.endShoppingSession(sessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingHistory'] });
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      toast('success', 'Shopping session completed!');
      navigate('/shopping/history');
    },
  });

  const items = session?.items || [];
  const pickedUp = items.filter((i: any) => i.status === 'PICKED_UP');
  const pending = items.filter((i: any) => i.status === 'PENDING');
  const skipped = items.filter((i: any) => ['OUT_OF_STOCK', 'SKIPPED', 'TOO_EXPENSIVE'].includes(i.status));

  const runningTotal = pickedUp.reduce((sum: number, i: any) => sum + (i.actualPrice || i.estimatedPrice || 0), 0);
  const progress = items.length > 0 ? ((items.length - pending.length) / items.length) * 100 : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Group pending items by aisle
  const aisleGrouped = pending.reduce<Record<string, any[]>>((acc, item: any) => {
    const aisle = item.aisleHint || 'No Aisle Info';
    if (!acc[aisle]) acc[aisle] = [];
    acc[aisle].push(item);
    return acc;
  }, {});

  // Group ALL items by category for checklist view
  const categoryGrouped = items.reduce<Record<string, any[]>>((acc, item: any) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const handlePickUp = (item: any) => {
    updateStatusMutation.mutate({ itemId: item.id, status: 'PICKED_UP' });
    setMarkingItem({ id: item.id, name: item.itemName, aisleHint: item.aisleHint });
    setMarkPrice('');
    setMarkAisle(item.aisleHint && item.aisleHint !== 'Unknown' ? item.aisleHint : '');
  };

  const handleMarkSubmit = () => {
    if (!markingItem) return;
    const price = parseFloat(markPrice);
    if (!isNaN(price) && price > 0) {
      submitPriceMutation.mutate({ itemId: markingItem.id, price });
    }
    if (markAisle.trim() && markAisle.trim() !== markingItem.aisleHint) {
      submitAisleMutation.mutate({ itemId: markingItem.id, aisle: markAisle.trim() });
    }
    setMarkingItem(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-32">
      {/* Session Header */}
      <div className="sticky top-0 z-20 bg-background pt-2 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowEndConfirm(true)} className="flex items-center gap-1.5 text-sm text-muted">
            <ArrowLeft className="h-4 w-4" /> End Session
          </button>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-muted">
              <Timer className="h-3.5 w-3.5" /> {formatTime(elapsedSeconds)}
            </span>
            {session?.storeName && (
              <span className="flex items-center gap-1 text-muted">
                <MapPin className="h-3.5 w-3.5" /> {session.storeName}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{pickedUp.length} of {items.length} items</span>
            <span className="font-semibold text-foreground">{formatCurrency(runningTotal)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* View Mode Switcher */}
        {!showReview && (
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {([
              { mode: 'list' as ViewMode, icon: List, label: 'List' },
              { mode: 'checklist' as ViewMode, icon: LayoutGrid, label: 'Checklist' },
              { mode: 'cards' as ViewMode, icon: Layers, label: 'Cards' },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  viewMode === mode
                    ? 'bg-white shadow-sm text-foreground'
                    : 'text-muted hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══════ VIEW: LIST ═══════ */}
      {viewMode === 'list' && !showReview && (
        <>
          {Object.entries(aisleGrouped).map(([aisle, aisleItems]) => (
            <div key={aisle} className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted flex items-center gap-1.5 px-1">
                <MapPin className="h-3 w-3" /> {aisle}
              </p>
              {aisleItems.map((item: any) => (
                <ListItemCard
                  key={item.id}
                  item={item}
                  onPickUp={() => handlePickUp(item)}
                  onOutOfStock={() => updateStatusMutation.mutate({ itemId: item.id, status: 'OUT_OF_STOCK' })}
                  onSkip={() => updateStatusMutation.mutate({ itemId: item.id, status: 'SKIPPED' })}
                  onTooExpensive={() => updateStatusMutation.mutate({ itemId: item.id, status: 'TOO_EXPENSIVE' })}
                />
              ))}
            </div>
          ))}
        </>
      )}

      {/* ═══════ VIEW: CHECKLIST ═══════ */}
      {viewMode === 'checklist' && !showReview && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(categoryGrouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catItems]) => (
            <div key={category} className="space-y-0.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary border-b-2 border-primary/30 pb-1 mb-1.5">
                {category}
              </h3>
              {catItems.map((item: any) => {
                const isDone = item.status !== 'PENDING';
                const isPickedUp = item.status === 'PICKED_UP';
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center gap-2 py-1.5 px-1.5 rounded-lg transition-all group',
                      isDone ? 'opacity-50' : 'hover:bg-slate-50'
                    )}
                  >
                    <button
                      onClick={() => {
                        if (item.status === 'PENDING') handlePickUp(item);
                        else updateStatusMutation.mutate({ itemId: item.id, status: 'PENDING' });
                      }}
                      className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                        isPickedUp ? 'bg-emerald-500 border-emerald-500' :
                        isDone ? 'bg-slate-300 border-slate-300' :
                        'border-slate-300 hover:border-primary'
                      )}
                    >
                      {isDone && <Check className="h-2.5 w-2.5 text-white" />}
                    </button>
                    <span className={cn(
                      'text-xs flex-1 min-w-0 truncate',
                      isDone && 'line-through text-muted'
                    )}>
                      {item.itemName}
                    </span>
                    {item.quantity && (
                      <span className="text-[9px] text-muted shrink-0">{item.quantity}</span>
                    )}
                    {!isDone && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => updateStatusMutation.mutate({ itemId: item.id, status: 'OUT_OF_STOCK' })}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-600" title="Out of Stock">
                          <X className="h-3 w-3" />
                        </button>
                        <button onClick={() => updateStatusMutation.mutate({ itemId: item.id, status: 'TOO_EXPENSIVE' })}
                          className="p-0.5 rounded text-amber-400 hover:text-amber-600" title="Too Expensive">
                          <DollarSign className="h-3 w-3" />
                        </button>
                        <button onClick={() => updateStatusMutation.mutate({ itemId: item.id, status: 'SKIPPED' })}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-600" title="Skip">
                          <AlertTriangle className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {isDone && !isPickedUp && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">
                        {item.status === 'OUT_OF_STOCK' ? 'OOS' :
                         item.status === 'TOO_EXPENSIVE' ? '$$$' : 'Skip'}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ═══════ VIEW: CARDS ═══════ */}
      {viewMode === 'cards' && !showReview && (
        <div className="space-y-3">
          {Object.entries(aisleGrouped).map(([aisle, aisleItems]) => (
            <AisleCard
              key={aisle}
              title={aisle}
              pendingItems={aisleItems}
              allItems={items.filter((i: any) => (i.aisleHint || 'No Aisle Info') === aisle)}
              onPickUp={handlePickUp}
              onOutOfStock={(id: string) => updateStatusMutation.mutate({ itemId: id, status: 'OUT_OF_STOCK' })}
              onSkip={(id: string) => updateStatusMutation.mutate({ itemId: id, status: 'SKIPPED' })}
              onTooExpensive={(id: string) => updateStatusMutation.mutate({ itemId: id, status: 'TOO_EXPENSIVE' })}
              onRevert={(id: string) => updateStatusMutation.mutate({ itemId: id, status: 'PENDING' })}
            />
          ))}
          {/* Show completed-only aisles */}
          {(() => {
            const doneAisles = items
              .filter((i: any) => i.status !== 'PENDING')
              .reduce<Record<string, any[]>>((acc, item: any) => {
                const aisle = item.aisleHint || 'No Aisle Info';
                if (aisleGrouped[aisle]) return acc;
                if (!acc[aisle]) acc[aisle] = [];
                acc[aisle].push(item);
                return acc;
              }, {});
            return Object.entries(doneAisles).map(([aisle, aisleItems]) => (
              <AisleCard
                key={`done-${aisle}`}
                title={aisle}
                pendingItems={[]}
                allItems={aisleItems}
                onPickUp={handlePickUp}
                onOutOfStock={(id: string) => updateStatusMutation.mutate({ itemId: id, status: 'OUT_OF_STOCK' })}
                onSkip={(id: string) => updateStatusMutation.mutate({ itemId: id, status: 'SKIPPED' })}
                onTooExpensive={(id: string) => updateStatusMutation.mutate({ itemId: id, status: 'TOO_EXPENSIVE' })}
                onRevert={(id: string) => updateStatusMutation.mutate({ itemId: id, status: 'PENDING' })}
              />
            ));
          })()}
        </div>
      )}

      {pending.length === 0 && !showReview && (
        <div className="text-center py-12">
          <ShoppingCart className="h-12 w-12 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">All items processed!</h2>
          <p className="text-sm text-muted mb-4">
            {pickedUp.length} picked up · {skipped.length} skipped
          </p>
          <Button onClick={() => {
            // Pre-fill review prices from actual or estimated
            const initPrices: Record<string, string> = {};
            pickedUp.forEach((i: any) => {
              initPrices[i.id] = (i.actualPrice || i.estimatedPrice || '').toString();
            });
            setReviewPrices(initPrices);
            setShowReview(true);
          }}>
            Review & Finish
          </Button>
        </div>
      )}

      {/* Final Review & Cost Confirmation */}
      {showReview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Review & Confirm</h2>
            <Button size="sm" variant="outline" onClick={() => setShowReview(false)}>
              Back
            </Button>
          </div>
          <p className="text-sm text-muted">Confirm prices for each item before finishing. Edit any price that's wrong.</p>

          {/* Picked Up Items with editable prices */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 px-1">
              Picked Up ({pickedUp.length})
            </p>
            {pickedUp.map((item: any) => {
              const priceStr = reviewPrices[item.id] || '';
              return (
                <Card key={item.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.itemName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                          {item.quantity && <span>Qty: {item.quantity}</span>}
                          {item.aisleHint && item.aisleHint !== 'Unknown' && (
                            <span className="flex items-center gap-0.5 text-blue-600">
                              <MapPin className="h-3 w-3" /> {item.aisleHint}
                            </span>
                          )}
                          {item.estimatedPrice && (
                            <span className="text-muted">Est: {formatCurrency(item.estimatedPrice)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={priceStr}
                          onChange={(e) => setReviewPrices((p) => ({ ...p, [item.id]: e.target.value }))}
                          className="w-20 h-8 text-sm font-mono text-right"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Unavailable / Skipped summary */}
          {skipped.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-1">
                Unavailable / Skipped ({skipped.length})
              </p>
              {skipped.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-slate-50 border-slate-200">
                  <X className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-sm text-muted line-through flex-1">{item.itemName}</span>
                  <Badge variant="outline" className="text-[9px]">{STATUS_LABELS[item.status as ItemStatus]}</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Cost Summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Items picked up</span>
                <span className="font-medium">{pickedUp.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Items unavailable</span>
                <span className="font-medium">{skipped.length}</span>
              </div>
              {(() => {
                const estimatedTotal = pickedUp.reduce((sum: number, i: any) => {
                  return sum + (i.estimatedPrice || 0);
                }, 0);
                const confirmedTotal = pickedUp.reduce((sum: number, i: any) => {
                  const p = parseFloat(reviewPrices[i.id] || '0');
                  return sum + (isNaN(p) ? 0 : p);
                }, 0);
                const diff = confirmedTotal - estimatedTotal;
                return (
                  <>
                    {estimatedTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Estimated total</span>
                        <span className="font-mono">{formatCurrency(estimatedTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold pt-2 border-t border-primary/20">
                      <span>Confirmed Total</span>
                      <span className="text-primary">{formatCurrency(confirmedTotal)}</span>
                    </div>
                    {estimatedTotal > 0 && diff !== 0 && (
                      <p className={cn('text-[10px] text-right', diff > 0 ? 'text-red-500' : 'text-emerald-600')}>
                        {diff > 0 ? '+' : ''}{formatCurrency(diff)} vs estimate
                      </p>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            onClick={async () => {
              // Submit all confirmed prices before ending session
              for (const [itemId, priceStr] of Object.entries(reviewPrices)) {
                const price = parseFloat(priceStr);
                if (!isNaN(price) && price > 0) {
                  await api.submitSessionPrice(sessionId!, itemId, price);
                }
              }
              endSessionMutation.mutate();
            }}
            disabled={endSessionMutation.isPending}
          >
            {endSessionMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Confirm & Finish Shopping'}
          </Button>
        </div>
      )}

      {/* Picked up (collapsible) */}
      {pickedUp.length > 0 && !showReview && (viewMode === 'list' || viewMode === 'checklist') && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 px-1">
            Picked Up ({pickedUp.length})
          </p>
          {pickedUp.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-emerald-50 border-emerald-200"
            >
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-through text-emerald-800">{item.itemName}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                  {item.aisleHint && item.aisleHint !== 'Unknown' && (
                    <span className="text-blue-600">{item.aisleHint}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.actualPrice ? (
                  <span className="text-xs font-mono text-emerald-700">{formatCurrency(item.actualPrice)}</span>
                ) : item.estimatedPrice ? (
                  <span className="text-xs font-mono text-muted">~{formatCurrency(item.estimatedPrice)}</span>
                ) : (
                  <button
                    onClick={() => {
                      setMarkingItem({ id: item.id, name: item.itemName, aisleHint: item.aisleHint });
                      setMarkPrice('');
                      setMarkAisle(item.aisleHint || '');
                    }}
                    className="text-[10px] text-primary underline"
                  >
                    Add price
                  </button>
                )}
                <button
                  onClick={() => updateStatusMutation.mutate({ itemId: item.id, status: 'PENDING' })}
                  className="text-[10px] text-muted hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skipped (collapsible) */}
      {skipped.length > 0 && !showReview && (viewMode === 'list' || viewMode === 'checklist') && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-1">
            Skipped / Unavailable ({skipped.length})
          </p>
          {skipped.map((item: any) => (
            <div
              key={item.id}
              className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border', STATUS_STYLES[item.status as ItemStatus])}
            >
              {item.status === 'OUT_OF_STOCK' ? <X className="h-4 w-4 text-slate-400 shrink-0" /> :
               item.status === 'TOO_EXPENSIVE' ? <DollarSign className="h-4 w-4 text-amber-500 shrink-0" /> :
               <X className="h-4 w-4 text-slate-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted line-through">{item.itemName}</p>
              </div>
              <Badge variant="outline" className="text-[9px]">{STATUS_LABELS[item.status as ItemStatus]}</Badge>
              <button
                onClick={() => updateStatusMutation.mutate({ itemId: item.id, status: 'PENDING' })}
                className="text-[10px] text-muted hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Combined Price + Aisle Dialog */}
      <Dialog open={!!markingItem} onOpenChange={() => setMarkingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Item Details</DialogTitle>
          </DialogHeader>
          {markingItem && (
            <div className="space-y-4 my-4">
              <p className="text-sm font-medium">{markingItem.name}</p>

              <div>
                <label className="text-xs font-medium text-muted block mb-1.5">Price paid (total)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={markPrice}
                    onChange={(e) => setMarkPrice(e.target.value)}
                    className="pl-7 text-lg font-mono"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-muted mt-1">Helps improve future price estimates at this store</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1.5">Store location / aisle</label>
                <Input
                  placeholder="e.g., Aisle 5, Produce Section, Back wall"
                  value={markAisle}
                  onChange={(e) => setMarkAisle(e.target.value)}
                />
                <p className="text-[10px] text-muted mt-1">Helps improve aisle info for future trips here</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkingItem(null)}>Skip</Button>
            <Button onClick={handleMarkSubmit}
              disabled={submitPriceMutation.isPending || submitAisleMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Session Confirm */}
      <Dialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Shopping Session?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted my-4">
            {pending.length > 0
              ? `You have ${pending.length} items still pending. Ending now will skip remaining items.`
              : 'Ready to review your items and confirm prices?'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndConfirm(false)}>Continue Shopping</Button>
            <Button
              variant={pending.length > 0 ? 'destructive' : 'default'}
              onClick={() => {
                setShowEndConfirm(false);
                // Pre-fill review prices
                const initPrices: Record<string, string> = {};
                pickedUp.forEach((i: any) => {
                  initPrices[i.id] = (i.actualPrice || i.estimatedPrice || '').toString();
                });
                setReviewPrices(initPrices);
                setShowReview(true);
              }}
            >
              Review & Finish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating summary bar */}
      {pending.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-card-border px-4 py-3 flex items-center justify-between lg:ml-64 z-30">
          <div>
            <p className="text-sm font-semibold">{formatCurrency(runningTotal)} spent</p>
            <p className="text-[10px] text-muted">{pending.length} items remaining</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowEndConfirm(true)}>
            End Session
          </Button>
        </div>
      )}
    </div>
  );
}

function ListItemCard({ item, onPickUp, onOutOfStock, onSkip, onTooExpensive }: {
  item: any;
  onPickUp: () => void;
  onOutOfStock: () => void;
  onSkip: () => void;
  onTooExpensive: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold">{item.itemName}</h3>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted">
              <span>Qty: {item.quantity || 1}</span>
              {item.unit && <span>· {item.unit}</span>}
            </div>
            {item.sourceRef && (
              <p className="text-[10px] text-primary mt-0.5 font-medium">🍽 {item.sourceRef}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            {item.estimatedPrice ? (
              <div>
                <p className="text-xs font-mono font-semibold text-foreground">{formatCurrency(item.estimatedPrice)}</p>
                <p className="text-[9px] text-muted">est. price</p>
              </div>
            ) : (
              <p className="text-[10px] text-muted italic">No price data</p>
            )}
          </div>
        </div>

        {item.aisleHint && item.aisleHint !== 'Unknown' && (
          <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="text-xs font-medium text-blue-800">{item.aisleHint}</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 mt-3">
          <button onClick={onPickUp}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors active:scale-95">
            <Check className="h-5 w-5" /><span className="text-[10px] font-medium">Pick Up</span>
          </button>
          <button onClick={onOutOfStock}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors active:scale-95">
            <X className="h-5 w-5" /><span className="text-[10px] font-medium">No Stock</span>
          </button>
          <button onClick={onTooExpensive}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors active:scale-95">
            <DollarSign className="h-5 w-5" /><span className="text-[10px] font-medium">Pricey</span>
          </button>
          <button onClick={onSkip}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100 transition-colors active:scale-95">
            <AlertTriangle className="h-5 w-5" /><span className="text-[10px] font-medium">Skip</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═════ CARDS VIEW – AISLE CARD ═════ */
function AisleCard({ title, pendingItems, allItems, onPickUp, onOutOfStock, onSkip, onTooExpensive, onRevert }: {
  title: string; pendingItems: any[]; allItems: any[];
  onPickUp: (item: any) => void; onOutOfStock: (id: string) => void;
  onSkip: (id: string) => void; onTooExpensive: (id: string) => void; onRevert: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(pendingItems.length > 0);
  const doneCount = allItems.filter((i: any) => i.status !== 'PENDING').length;
  const totalCount = allItems.length;
  const allDone = pendingItems.length === 0;

  return (
    <Card className={cn(allDone && 'opacity-60')}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          allDone ? 'bg-emerald-100' : 'bg-primary/10'
        )}>
          {allDone ? <Check className="h-4 w-4 text-emerald-600" /> : <Package className="h-4 w-4 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-muted" /> {title}
          </p>
          <p className="text-[10px] text-muted">{doneCount}/{totalCount} items done</p>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted transition-transform', !expanded && '-rotate-90')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1.5">
              {pendingItems.map((item: any) => (
                <div key={item.id} className="flex items-center gap-2 py-2 px-2 rounded-lg border border-card-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.itemName}</p>
                    {item.quantity && <span className="text-[10px] text-muted">{item.quantity}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => onPickUp(item)}
                      className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100" title="Pick Up">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => onOutOfStock(item.id)}
                      className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100" title="No Stock">
                      <X className="h-4 w-4" />
                    </button>
                    <button onClick={() => onTooExpensive(item.id)}
                      className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100" title="Too Expensive">
                      <DollarSign className="h-4 w-4" />
                    </button>
                    <button onClick={() => onSkip(item.id)}
                      className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100" title="Skip">
                      <AlertTriangle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {allItems.filter((i: any) => i.status !== 'PENDING').map((item: any) => (
                <div key={item.id} className={cn(
                  'flex items-center gap-2 py-1.5 px-2 rounded-lg',
                  item.status === 'PICKED_UP' ? 'bg-emerald-50' : 'bg-slate-50 opacity-60'
                )}>
                  {item.status === 'PICKED_UP' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className={cn('text-xs flex-1 line-through', item.status === 'PICKED_UP' ? 'text-emerald-800' : 'text-muted')}>
                    {item.itemName}
                  </span>
                  {item.actualPrice && (
                    <span className="text-[10px] font-mono text-emerald-700">{formatCurrency(item.actualPrice)}</span>
                  )}
                  <button onClick={() => onRevert(item.id)} className="text-muted hover:text-foreground">
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
