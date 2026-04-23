import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ShoppingCart, CalendarDays, ArrowRight, Plus, Sparkles, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { getGreeting, formatCurrency, cn } from '@/lib/utils';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function DashboardPage() {
  const { user, preferences } = useAuth();

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
  });

  const { data: shoppingList, isLoading: shoppingLoading } = useQuery({
    queryKey: ['shoppingList'],
    queryFn: () => api.getShoppingList(),
  });

  const { data: todayMeals, isLoading: mealsLoading } = useQuery({
    queryKey: ['todayMeals'],
    queryFn: () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return api.getMealPlans({ startDate: today, endDate: today });
    },
  });

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api.getRecommendations(),
  });

  const { data: shoppingHistory } = useQuery({
    queryKey: ['shoppingHistory'],
    queryFn: () => api.getShoppingHistory(),
  });

  const budget = preferences?.budget || 0; // Budget is stored as monthly
  const monthlySpent = (() => {
    if (!shoppingHistory) return 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return shoppingHistory
      .filter((h: any) => new Date(h.shoppingDate) >= startOfMonth)
      .reduce((sum: number, h: any) => sum + (h.actualCost || 0), 0);
  })();
  const budgetRemaining = budget > 0 ? Math.max(0, budget - monthlySpent) : budget;
  const budgetData = [
    { name: 'Spent', value: monthlySpent },
    { name: 'Remaining', value: budgetRemaining },
  ];

  // 8-week spending trend
  const weeklyTrend = (() => {
    if (!shoppingHistory?.length) return [];
    const weeks: { label: string; amount: number }[] = [];
    const now = new Date();
    for (let w = 7; w >= 0; w--) {
      const start = new Date(now);
      start.setDate(now.getDate() - w * 7 - 6);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(now.getDate() - w * 7);
      end.setHours(23, 59, 59, 999);
      const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const amount = shoppingHistory
        .filter((h: any) => {
          const d = new Date(h.shoppingDate);
          return d >= start && d <= end;
        })
        .reduce((sum: number, h: any) => sum + (h.actualCost || 0), 0);
      weeks.push({ label, amount: Math.round(amount * 100) / 100 });
    }
    return weeks;
  })();

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Greeting */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
          {getGreeting()}, {user?.fullName?.split(' ')[0]}
        </h1>
        <p className="text-muted mt-1">Here's what's happening with your household nutrition.</p>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Profiles" value={profiles?.length ?? 0} icon={Users} loading={profilesLoading} />
        <StatCard label="Shopping Items" value={shoppingList?.filter((i) => !i.checked).length ?? 0} icon={ShoppingCart} loading={shoppingLoading} />
        <StatCard label="Today's Meals" value={todayMeals?.length ?? 0} icon={CalendarDays} loading={mealsLoading} />
        <StatCard label="Recommendations" value={recommendations?.length ?? 0} icon={Sparkles} />
      </motion.div>

      {/* Budget widget — visible on mobile above the grid */}
      {budget > 0 && (
        <motion.div variants={fadeUp} className="lg:hidden">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-accent-success" /> Monthly Budget
                </span>
                <span className={cn(
                  'text-sm font-bold',
                  budgetRemaining > 0 ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {formatCurrency(budgetRemaining)} left
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    monthlySpent / budget > 0.9 ? 'bg-red-500' :
                    monthlySpent / budget > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min(100, (monthlySpent / budget) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-muted">
                <span>Spent: {formatCurrency(monthlySpent)}</span>
                <span>Budget: {formatCurrency(budget)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's meals */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Today's Meal Plan
                </CardTitle>
                <Link to="/meal-plan">
                  <Button variant="ghost" size="sm">View all <ArrowRight className="h-3.5 w-3.5" /></Button>
                </Link>
              </CardHeader>
              <CardContent>
                {mealsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : todayMeals?.length ? (
                  <div className="space-y-2">
                    {todayMeals.slice(0, 5).map((meal) => (
                      <div key={meal.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors">
                        <Badge variant="secondary" className="capitalize shrink-0">{meal.mealType}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{meal.mealName}</p>
                          <p className="text-xs text-muted">{meal.profile?.name}</p>
                        </div>
                        {meal.calories && <span className="text-xs font-mono text-muted">{meal.calories} cal</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="No meals planned for today"
                    description="Generate a meal plan to get started."
                    actionLabel="Plan today's meals"
                    onAction={() => window.location.href = '/meal-plan'}
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Shopping preview */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Shopping List
                </CardTitle>
                <Link to="/shopping">
                  <Button variant="ghost" size="sm">View all <ArrowRight className="h-3.5 w-3.5" /></Button>
                </Link>
              </CardHeader>
              <CardContent>
                {shoppingLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
                  </div>
                ) : shoppingList?.filter((i) => !i.checked).length ? (
                  <div className="space-y-1.5">
                    {shoppingList.filter((i) => !i.checked).slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="w-2 h-2 rounded-full bg-primary/40 shrink-0" />
                        <span className="text-sm flex-1">{item.itemName}</span>
                        {item.quantity && <span className="text-xs text-muted">{item.quantity}</span>}
                        {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={ShoppingCart}
                    title="Shopping list is empty"
                    description="Add items manually or generate from your meal plans."
                    actionLabel="Go to shopping"
                    onAction={() => window.location.href = '/shopping'}
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent recommendations */}
          {recommendations && recommendations.length > 0 && (
            <motion.div variants={fadeUp}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Recent Recommendations
                </h3>
                <Link to="/recommendations">
                  <Button variant="ghost" size="sm">See all <ArrowRight className="h-3.5 w-3.5" /></Button>
                </Link>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                {recommendations.slice(0, 6).map((rec) => (
                  <Card key={rec.id} className="min-w-[260px] max-w-[280px] shrink-0 snap-start hover:-translate-y-1 hover:shadow-card-hover transition-all duration-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-semibold line-clamp-1">{rec.itemName}</h4>
                        <Badge variant="secondary" className="text-[10px] capitalize shrink-0 ml-2">{rec.itemType}</Badge>
                      </div>
                      <p className="text-xs text-muted line-clamp-2 mb-3">{rec.reason}</p>
                      <div className="flex items-center justify-between">
                        <Badge className="capitalize">{rec.category}</Badge>
                        {rec.priceRange && <span className="text-xs font-mono text-muted">{rec.priceRange}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">
          {/* Budget ring — desktop only (mobile version shown above) */}
          {budget > 0 && (
            <motion.div variants={fadeUp} className="hidden lg:block">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-accent-success" />
                    Monthly Budget
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={budgetData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={55}
                            paddingAngle={2}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                          >
                            <Cell fill="#3B82F6" />
                            <Cell fill="#E2E8F0" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-mono text-lg font-bold">{formatCurrency(budgetRemaining)}</span>
                        <span className="text-[10px] text-muted">remaining</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between mt-3 text-[10px] text-muted">
                    <span>Spent: {formatCurrency(monthlySpent)}</span>
                    <span>Budget: {formatCurrency(budget)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Weekly spending trend */}
          {weeklyTrend.some((w) => w.amount > 0) && (
            <motion.div variants={fadeUp}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-primary" />
                    8-Week Spending Trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={weeklyTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={1} />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        formatter={(v: number) => [`$${v.toFixed(2)}`, 'Spent']}
                        labelStyle={{ fontSize: 11 }}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Quick actions */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/profiles/new" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Plus className="h-4 w-4" /> Add Profile
                  </Button>
                </Link>
                <Link to="/recommendations" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Sparkles className="h-4 w-4" /> Get Recommendations
                  </Button>
                </Link>
                <Link to="/meal-plan" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <CalendarDays className="h-4 w-4" /> Plan Meals
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Profiles summary */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm">Profiles</CardTitle>
                <Link to="/profiles">
                  <Button variant="ghost" size="sm">View <ArrowRight className="h-3 w-3" /></Button>
                </Link>
              </CardHeader>
              <CardContent>
                {profilesLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
                  </div>
                ) : profiles?.length ? (
                  <div className="space-y-2">
                    {profiles.slice(0, 4).map((p) => (
                      <Link key={p.id} to={`/profiles/${p.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                          {p.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[11px] text-muted capitalize">{p.type.toLowerCase()}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted text-center py-4">No profiles yet.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, loading }: { label: string; value: number; icon: any; loading?: boolean }) {
  return (
    <Card className="hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          {loading ? (
            <Skeleton className="h-7 w-10 mb-1" />
          ) : (
            <p className="text-2xl font-bold font-mono">{value}</p>
          )}
          <p className="text-xs text-muted">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
