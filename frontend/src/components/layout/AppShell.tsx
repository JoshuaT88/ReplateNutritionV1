import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { OnboardingFlow } from '../onboarding/OnboardingFlow';
import { useAuth } from '@/contexts/AuthContext';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { preferences, refreshPreferences } = useAuth();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const isDesktop = useIsDesktop();

  const showOnboarding = !onboardingDismissed && preferences && !preferences.firstVisitCompleted;

  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={() => {
          setOnboardingDismissed(true);
          refreshPreferences();
        }}
      />
    );
  }

  const sidebarWidth = sidebarCollapsed ? 72 : 280;

  return (
    <div className="min-h-screen bg-background dark:bg-slate-900">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col z-40 transition-all duration-300"
        style={{ width: sidebarWidth }}
      >
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </aside>

      {/* Main content */}
      <main
        className="min-h-screen transition-all duration-300 pb-20 lg:pb-0 overflow-x-hidden dark:bg-slate-900"
        style={{ marginLeft: isDesktop ? sidebarWidth : 0 }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children || <Outlet />}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
