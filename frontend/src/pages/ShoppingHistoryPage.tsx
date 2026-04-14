import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, ShoppingCart, MapPin, Clock, DollarSign, ChevronDown,
  Check, X, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

export default function ShoppingHistoryPage() {
  const { data: history, isLoading, error, refetch } = useQuery({
    queryKey: ['shoppingHistory'],
    queryFn: () => api.getShoppingHistory(),
  });

  const trips = history || [];

  // Summary stats
  const totalSpent = trips.reduce((sum: number, t: any) => sum + (t.actualCost || 0), 0);
  const totalTrips = trips.length;
  const avgPerTrip = totalTrips > 0 ? totalSpent / totalTrips : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Shopping History</h1>
        <p className="text-sm text-muted mt-0.5">{totalTrips} trip{totalTrips !== 1 ? 's' : ''} recorded</p>
      </div>

      {/* Summary Stats */}
      {totalTrips > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Total Spent</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalSpent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Total Trips</p>
              <p className="text-xl font-bold mt-1">{totalTrips}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Avg per Trip</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(avgPerTrip)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trip List */}
      {error ? (
        <ErrorCard onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-card-border bg-white p-5">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-32 mb-3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState
          icon={History}
          title="No shopping history"
          description="Complete a shopping session to see your trip history here."
        />
      ) : (
        <div className="space-y-3">
          {trips.map((trip: any) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: any }) {
  const [expanded, setExpanded] = useState(false);

  // Build unified items array from the separate JSON arrays
  const pickedUp = ((trip.itemsPickedUp as any[]) || []).map((i: any) => ({ ...i, status: 'PICKED_UP' }));
  const outOfStock = ((trip.itemsOutOfStock as any[]) || []).map((i: any) => ({ ...i, status: 'OUT_OF_STOCK' }));
  const tooExpensive = ((trip.itemsTooExpensive as any[]) || []).map((i: any) => ({ ...i, status: 'TOO_EXPENSIVE' }));
  const allItems = [...pickedUp, ...outOfStock, ...tooExpensive];

  const savingsEstimate = allItems.reduce((sum: number, i: any) => {
    if (i.actualPrice && i.estimatedPrice) {
      return sum + ((i.estimatedPrice - i.actualPrice) * (parseInt(i.quantity) || 1));
    }
    return sum;
  }, 0);

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-semibold truncate">
                {trip.storeName || 'Shopping Trip'}
              </h3>
              {trip.actualCost > 0 && (
                <span className="text-sm font-bold text-primary shrink-0">
                  {formatCurrency(trip.actualCost)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted">
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {formatDate(trip.shoppingDate)}
              </span>
              {trip.storeName && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" /> {trip.storeName}
                </span>
              )}
              <span>{pickedUp.length} of {allItems.length} items</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {savingsEstimate > 0 && (
              <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                <TrendingDown className="h-3 w-3 mr-0.5" /> Saved {formatCurrency(savingsEstimate)}
              </Badge>
            )}
            {savingsEstimate < 0 && (
              <Badge className="text-[10px] bg-red-50 text-red-700 border-red-200">
                <TrendingUp className="h-3 w-3 mr-0.5" /> Over {formatCurrency(Math.abs(savingsEstimate))}
              </Badge>
            )}
            <ChevronDown className={cn('h-4 w-4 text-muted transition-transform', expanded && 'rotate-180')} />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-3">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  <Check className="h-3 w-3 mr-0.5 text-emerald-600" /> {pickedUp.length} picked up
                </Badge>
                {outOfStock.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    <X className="h-3 w-3 mr-0.5 text-slate-400" /> {outOfStock.length} out of stock
                  </Badge>
                )}
                {tooExpensive.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    <DollarSign className="h-3 w-3 mr-0.5 text-amber-500" /> {tooExpensive.length} too expensive
                  </Badge>
                )}
              </div>

              {/* Item list */}
              <div className="space-y-1">
                {allItems.map((item: any) => (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                      item.status === 'PICKED_UP' ? 'bg-emerald-50' :
                      item.status === 'OUT_OF_STOCK' ? 'bg-slate-50 opacity-60' :
                      item.status === 'TOO_EXPENSIVE' ? 'bg-amber-50' : 'bg-slate-50 opacity-50'
                    )}
                  >
                    {item.status === 'PICKED_UP' ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> :
                     item.status === 'OUT_OF_STOCK' ? <X className="h-3.5 w-3.5 text-slate-400 shrink-0" /> :
                     item.status === 'TOO_EXPENSIVE' ? <DollarSign className="h-3.5 w-3.5 text-amber-500 shrink-0" /> :
                     <Minus className="h-3.5 w-3.5 text-slate-300 shrink-0" />}

                    <span className={cn('flex-1', item.status !== 'PICKED_UP' && 'line-through text-muted')}>
                      {item.itemName}
                      {item.quantity && parseInt(item.quantity) > 1 && <span className="text-muted"> ×{item.quantity}</span>}
                    </span>

                    {item.actualPrice ? (
                      <span className="text-xs font-mono">
                        {formatCurrency(item.actualPrice)}
                        {item.estimatedPrice && item.estimatedPrice !== item.actualPrice && (
                          <span className={cn(
                            'ml-1',
                            item.actualPrice < item.estimatedPrice ? 'text-emerald-600' : 'text-red-500'
                          )}>
                            ({item.actualPrice < item.estimatedPrice ? '-' : '+'}{formatCurrency(Math.abs(item.estimatedPrice - item.actualPrice))})
                          </span>
                        )}
                      </span>
                    ) : item.estimatedPrice ? (
                      <span className="text-xs font-mono text-muted">~{formatCurrency(item.estimatedPrice)}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
