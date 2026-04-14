import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, ShoppingCart, CalendarDays, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/profiles', icon: Users, label: 'Profiles' },
  { to: '/shopping', icon: ShoppingCart, label: 'Shopping' },
  { to: '/meal-plan', icon: CalendarDays, label: 'Meal Plan' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-card-border">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[56px]',
                isActive ? 'text-primary' : 'text-muted'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn('relative', isActive && 'after:absolute after:-top-3 after:left-1/2 after:-translate-x-1/2 after:w-8 after:h-0.5 after:bg-primary after:rounded-full')}>
                  <tab.icon className={cn('h-5 w-5', isActive ? 'stroke-[2.5]' : 'stroke-[1.5]')} />
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
