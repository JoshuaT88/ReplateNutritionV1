import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, ShoppingCart, CalendarDays, History, Settings, HeadsetIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', icon: LayoutDashboard, label: 'Home', end: true },
  { to: '/profiles', icon: Users, label: 'Profiles', end: false },
  { to: '/shopping', icon: ShoppingCart, label: 'Shop', badge: true, end: true },
  { to: '/meal-plan', icon: CalendarDays, label: 'Meals', end: false },
  { to: '/shopping/history', icon: History, label: 'History', end: false },
  { to: '/settings', icon: Settings, label: 'Settings', end: false },
  { to: '/support', icon: HeadsetIcon, label: 'Support', end: false },
];

export function MobileNav() {
  const { data: shoppingList } = useQuery({
    queryKey: ['shoppingList'],
    queryFn: () => api.getShoppingList(),
    staleTime: 60_000,
  });

  const pendingCount = shoppingList?.filter((i: any) => !i.checked).length ?? 0;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-card-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1 max-w-screen-sm mx-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl transition-colors min-w-[44px]',
                isActive ? 'text-primary' : 'text-muted'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn('relative', isActive && 'after:absolute after:-top-3 after:left-1/2 after:-translate-x-1/2 after:w-8 after:h-0.5 after:bg-primary after:rounded-full')}>
                  <tab.icon className={cn('h-5 w-5', isActive ? 'stroke-[2.5]' : 'stroke-[1.5]')} />
                  {tab.badge && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-white text-[9px] font-bold leading-none">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </div>
                <span className={cn('text-[10px]', isActive ? 'font-semibold' : 'font-medium')}>{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
