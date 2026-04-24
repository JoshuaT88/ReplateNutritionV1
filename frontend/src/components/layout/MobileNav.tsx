import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShoppingCart, CalendarDays, Package,
  Settings, Menu, X, Sparkles, Activity, ChefHat, History,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_PINNED_TOS = ['/', '/profiles', '/shopping', '/meal-plan'];

const ALL_NAV_DEFS = [
  { to: '/', icon: LayoutDashboard, label: 'Home', end: true, badge: null },
  { to: '/profiles', icon: Users, label: 'Profiles', end: false, badge: null },
  { to: '/shopping', icon: ShoppingCart, label: 'Shop', end: true, badge: 'shopping' as const },
  { to: '/meal-plan', icon: CalendarDays, label: 'Meals', end: false, badge: 'meals' as const },
  { to: '/pantry', icon: Package, label: 'Pantry', end: false, badge: 'pantry' as const },
  { to: '/recommendations', icon: Sparkles, label: 'Recommendations', end: false, badge: null },
  { to: '/macros', icon: Activity, label: 'Nutrition Log', end: false, badge: null },
  { to: '/recipes', icon: ChefHat, label: 'Recipes', end: false, badge: null },
  { to: '/shopping/history', icon: History, label: 'Shopping History', end: false, badge: null },
  { to: '/settings', icon: Settings, label: 'Settings', end: false, badge: null },
];

export function MobileNav() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hide entirely during active shopping session
  if (location.pathname.startsWith('/shopping/session')) return null;

  return <MobileNavInner drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} location={location} />;
}

function MobileNavInner({ drawerOpen, setDrawerOpen, location }: {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  location: ReturnType<typeof useLocation>;
}) {
  const { preferences } = useAuth();

  // Build effective pinned/drawer lists from user preferences
  const pinnedTos = (preferences?.pinnedNavItems as string[] | null) ?? DEFAULT_PINNED_TOS;
  const effectivePinned = pinnedTos
    .map((to) => ALL_NAV_DEFS.find((d) => d.to === to))
    .filter(Boolean) as typeof ALL_NAV_DEFS;
  const effectiveDrawer = ALL_NAV_DEFS.filter((d) => !pinnedTos.includes(d.to));
  const { data: shoppingList } = useQuery({
    queryKey: ['shoppingList'],
    queryFn: () => api.getShoppingList(),
    staleTime: 60_000,
  });

  const { data: todayMeals } = useQuery({
    queryKey: ['todayMeals'],
    queryFn: () => {
      const today = new Date().toISOString().split('T')[0];
      return api.getMealPlans({ startDate: today, endDate: today });
    },
    staleTime: 60_000,
  });

  const { data: pantryItems } = useQuery({
    queryKey: ['pantry'],
    queryFn: () => api.getPantryItems(),
    staleTime: 5 * 60_000,
  });

  const shoppingBadge = shoppingList?.filter((i: any) => !i.checked).length ?? 0;
  const mealsBadge = todayMeals?.filter((m: any) => !m.completed).length ?? 0;
  const pantryBadge = (pantryItems as any[])?.filter((i) => i.isExpired || i.isExpiringSoon || i.lowStockAlert).length ?? 0;

  const getBadge = (key: 'shopping' | 'meals' | 'pantry' | null) => {
    if (key === 'shopping') return shoppingBadge;
    if (key === 'meals') return mealsBadge;
    if (key === 'pantry') return pantryBadge;
    return 0;
  };

  const drawerItemActive = effectiveDrawer.some((t) =>
    t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)
  );
  const drawerBadgeTotal = effectiveDrawer.reduce((sum, t) => sum + getBadge(t.badge as any), 0);

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-card-border dark:border-slate-700 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1 max-w-screen-sm mx-auto">
          {effectivePinned.map((tab) => {
            const count = getBadge(tab.badge);
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-[52px]',
                    isActive ? 'text-primary' : 'text-muted'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={cn('relative', isActive && 'after:absolute after:-top-3 after:left-1/2 after:-translate-x-1/2 after:w-8 after:h-0.5 after:bg-primary after:rounded-full')}>
                      <tab.icon className={cn('h-5 w-5', isActive ? 'stroke-[2.5]' : 'stroke-[1.5]')} />
                      {count > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-white text-[9px] font-bold leading-none">
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </div>
                    <span className={cn('text-[10px]', isActive ? 'font-semibold' : 'font-medium')}>{tab.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* More / hamburger button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-[52px]',
              (drawerItemActive || drawerOpen) ? 'text-primary' : 'text-muted'
            )}
          >
            <div className="relative">
              <Menu className={cn('h-5 w-5', (drawerItemActive || drawerOpen) ? 'stroke-[2.5]' : 'stroke-[1.5]')} />
              {drawerBadgeTotal > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                  {drawerBadgeTotal > 9 ? '9+' : drawerBadgeTotal}
                </span>
              )}
            </div>
            <span className={cn('text-[10px]', (drawerItemActive || drawerOpen) ? 'font-semibold' : 'font-medium')}>More</span>
          </button>
        </div>
      </nav>

      {/* More drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 bg-black/40 z-[60]"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Drawer panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white dark:bg-slate-900 rounded-t-2xl pb-safe"
            >
              {/* Drag handle */}
              <div className="flex items-center justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-slate-200 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-2 border-b border-card-border">
                <span className="text-sm font-semibold text-foreground">More</span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-muted hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Nav items */}
              <div className="px-3 py-3 space-y-0.5 pb-8">
                {effectiveDrawer.map((tab) => {
                  const count = getBadge(tab.badge as any);
                  const isActive = tab.end
                    ? location.pathname === tab.to
                    : location.pathname.startsWith(tab.to);
                  return (
                    <NavLink
                      key={tab.to}
                      to={tab.to}
                      end={tab.end}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-slate-50'
                      )}
                    >
                      <tab.icon className={cn('h-5 w-5 shrink-0', isActive ? 'stroke-[2.5]' : 'stroke-[1.5]')} />
                      <span className={cn('flex-1 text-sm', isActive ? 'font-semibold' : 'font-medium')}>
                        {tab.label}
                      </span>
                      {count > 0 && (
                        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
