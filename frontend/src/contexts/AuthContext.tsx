import { createContext, useContext, useState, useEffect, useCallback, startTransition, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User, UserPreferences } from '@/types';

interface AuthContextValue {
  user: User | null;
  preferences: UserPreferences | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function applyTheme(theme: string) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
  try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const loadUser = useCallback(async () => {
    try {
      api.loadTokens();
      if (!localStorage.getItem('accessToken')) {
        setIsLoading(false);
        return;
      }
      const [me, prefs] = await Promise.all([api.getMe(), api.getPreferences()]);
      setUser(me);
      setPreferences(prefs);
      applyTheme(prefs?.theme ?? 'light');
    } catch {
      setUser(null);
      setPreferences(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    api.onAuthFailure(() => {
      setUser(null);
      setPreferences(null);
      navigate('/login');
    });
    loadUser();
  }, [loadUser, navigate]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    api.setTokens(res.accessToken, res.refreshToken);
    queryClient.clear(); // Clear all cached data from previous user
    const prefs = await api.getPreferences();
    applyTheme(prefs?.theme ?? 'light');
    startTransition(() => {
      setUser(res.user);
      setPreferences(prefs);
    });
  };

  const register = async (email: string, password: string, fullName: string) => {
    const res = await api.register(email, password, fullName);
    api.setTokens(res.accessToken, res.refreshToken);
    queryClient.clear(); // Clear all cached data
    const prefs = await api.getPreferences();
    applyTheme(prefs?.theme ?? 'light');
    startTransition(() => {
      setUser(res.user);
      setPreferences(prefs);
    });
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    api.clearTokens();
    queryClient.clear(); // Clear all cached data
    setUser(null);
    setPreferences(null);
    navigate('/login');
  };

  const refreshPreferences = async () => {
    const prefs = await api.getPreferences();
    setPreferences(prefs);
    applyTheme(prefs?.theme ?? 'light');
  };

  return (
    <AuthContext.Provider value={{ user, preferences, isLoading, isAuthenticated: !!user, login, register, logout, refreshPreferences }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
