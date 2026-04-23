import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Loader2, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { fmtDate } from '@/lib/time';

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'text-red-600',
  MEDIUM: 'text-amber-600',
  LOW: 'text-slate-500',
};

export default function SharePage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['share', token],
    queryFn: () => api.getShareSnapshot(token!),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-semibold">Link expired or not found</h1>
        <p className="text-sm text-muted max-w-sm">This shopping list link may have expired (links last 7 days) or been removed.</p>
        <Link to="/login" className="text-sm text-primary hover:underline">Sign in to Replate Nutrition</Link>
      </div>
    );
  }

  const items: any[] = Array.isArray(data.snapshot) ? data.snapshot : [];
  const grouped = items.reduce<Record<string, any[]>>((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const expires = new Date(data.expiresAt);
  const unchecked = items.filter((i) => !i.checked).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">Shared Shopping List</h1>
          </div>
          <p className="text-sm text-muted">
            {unchecked} item{unchecked !== 1 ? 's' : ''} · Shared via Replate Nutrition · Expires {fmtDate(expires)}
          </p>
          <p className="text-xs text-muted">Read-only view — sign in to manage your own lists</p>
        </div>

        {/* Items grouped by category */}
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catItems]) => (
          <Card key={category}>
            <CardContent className="p-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">{category}</h2>
              <div className="space-y-2">
                {catItems.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3">
                    {item.checked
                      ? <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                      : <Square className="h-4 w-4 text-slate-300 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.checked ? 'line-through text-muted' : ''}`}>{item.itemName}</p>
                      {item.quantity && <p className="text-[10px] text-muted">Qty: {item.quantity}</p>}
                    </div>
                    {item.priority && item.priority !== 'MEDIUM' && (
                      <span className={`text-[10px] font-semibold ${PRIORITY_COLORS[item.priority]}`}>
                        {item.priority}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="text-center pt-4">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <ShoppingCart className="h-4 w-4" /> Get Replate Nutrition
          </Link>
          <p className="text-[10px] text-muted mt-2">AI-powered household nutrition &amp; shopping management</p>
        </div>
      </div>
    </div>
  );
}
