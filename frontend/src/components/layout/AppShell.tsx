import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { OnboardingFlow } from '../onboarding/OnboardingFlow';
import { useAuth } from '@/contexts/AuthContext';

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { preferences, refreshPreferences } = useAuth();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col z-40"
        style={{ width: sidebarCollapsed ? 72 : 280 }}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </aside>

      {/* Main content */}
      <main
        className="min-h-screen transition-all duration-300 pb-20 lg:pb-0"
        style={{ marginLeft: typeof window !== 'undefined' && window.innerWidth >= 1024 ? (sidebarCollapsed ? 72 : 280) : 0 }}
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
