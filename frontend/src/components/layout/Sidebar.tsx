import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, Sparkles, CalendarDays, ShoppingCart, History,
  Settings, HelpCircle, ChevronLeft, ChevronRight, LogOut, Utensils, HeadsetIcon, Activity,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { cn, getInitials, getAvatarGradient } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profiles', icon: Users, label: 'Profiles' },
  { to: '/recommendations', icon: Sparkles, label: 'Recommendations' },
  { to: '/meal-plan', icon: CalendarDays, label: 'Meal Plan' },
  { to: '/macros', icon: Activity, label: 'Nutrition Log' },
  { to: '/shopping', icon: ShoppingCart, label: 'Smart Shopping', badge: true },
  { to: '/shopping/history', icon: History, label: 'Shopping History' },
];

const systemItems = [
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/help', icon: HelpCircle, label: 'About / Help' },
  { to: '/support', icon: HeadsetIcon, label: 'Support' },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const gradient = user ? getAvatarGradient(user.fullName) : '';

  const { data: shoppingList } = useQuery({
    queryKey: ['shoppingList'],
    queryFn: () => api.getShoppingList(),
    staleTime: 60_000,
  });
  const pendingCount = shoppingList?.filter((i: any) => !i.checked).length ?? 0;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-sidebar-bg to-sidebar-bg-end relative">
      {/* Logo area */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary">
          <Utensils className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
            <span className="font-display text-white text-base font-bold tracking-tight">Replate</span>
            <span className="text-[10px] text-sidebar-text/60 uppercase tracking-widest -mt-0.5">Nutrition</span>
          </motion.div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 z-50 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-card-border shadow-soft hover:shadow-card transition-shadow"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted" /> : <ChevronLeft className="h-3.5 w-3.5 text-muted" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-text/40 px-3 mb-2">Navigation</p>}
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative',
                collapsed ? 'justify-center' : '',
                isActive
                  ? 'bg-primary/15 text-white'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                  />
                )}
                <item.icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-5 w-5')} />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && (item as any).badge && pendingCount > 0 && (
                  <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}

        <div className="pt-4">
          {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-text/40 px-3 mb-2">System</p>}
          {systemItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative',
                  collapsed ? 'justify-center' : '',
                  isActive
                    ? 'bg-primary/15 text-white'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                    />
                  )}
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User section */}
      {user && (
        <div className="border-t border-white/5 p-3">
          <div className={cn('flex items-center gap-3', collapsed ? 'justify-center' : '')}>
            <div className={cn('flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br text-white text-xs font-bold shrink-0', gradient)}>
              {getInitials(user.fullName)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
                <p className="text-[11px] text-sidebar-text/60 truncate">{user.email}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-sidebar-text/60 hover:text-white hover:bg-sidebar-hover transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
