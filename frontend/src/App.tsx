import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/toast';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2 } from 'lucide-react';

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProfilesPage = lazy(() => import('@/pages/ProfilesPage'));
const ProfileFormPage = lazy(() => import('@/pages/ProfileFormPage'));
const ProfileDetailPage = lazy(() => import('@/pages/ProfileDetailPage'));
const RecommendationsPage = lazy(() => import('@/pages/RecommendationsPage'));
const MealPlanPage = lazy(() => import('@/pages/MealPlanPage'));
const ShoppingPage = lazy(() => import('@/pages/ShoppingPage'));
const ShoppingSessionPage = lazy(() => import('@/pages/ShoppingSessionPage'));
const ShoppingHistoryPage = lazy(() => import('@/pages/ShoppingHistoryPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const HelpPage = lazy(() => import('@/pages/HelpPage'));
const SupportPage = lazy(() => import('@/pages/SupportPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const SharePage = lazy(() => import('@/pages/SharePage'));
const MacroLogPage = lazy(() => import('@/pages/MacroLogPage'));
const PantryPage = lazy(() => import('@/pages/PantryPage'));
const RecipesPage = lazy(() => import('@/pages/RecipesPage'));
const JoinHouseholdPage = lazy(() => import('@/pages/JoinHouseholdPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppShell>
      <Suspense fallback={<PageSpinner />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

function PublicRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageSpinner />;
  if (user) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<PageSpinner />}>
      <Outlet />
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              {/* Public routes */}
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Route>

              {/* Fully public — no auth wrapper */}
              <Route path="/share/:token" element={<Suspense fallback={<PageSpinner />}><SharePage /></Suspense>} />
              <Route path="/join" element={<Suspense fallback={<PageSpinner />}><JoinHouseholdPage /></Suspense>} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/profiles" element={<ProfilesPage />} />
                <Route path="/profiles/new" element={<ProfileFormPage />} />
                <Route path="/profiles/:id" element={<ProfileDetailPage />} />
                <Route path="/profiles/:id/edit" element={<ProfileFormPage />} />
                <Route path="/recommendations" element={<RecommendationsPage />} />
                <Route path="/meal-plan" element={<MealPlanPage />} />
                <Route path="/shopping" element={<ShoppingPage />} />
                <Route path="/shopping/session/:sessionId" element={<ShoppingSessionPage />} />
                <Route path="/shopping/history" element={<ShoppingHistoryPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/macros" element={<MacroLogPage />} />
                <Route path="/pantry" element={<PantryPage />} />
                <Route path="/recipes" element={<RecipesPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/support" element={<SupportPage />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
