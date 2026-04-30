/**
 * Hook for managing recently viewed recipes (saved in localStorage).
 * - Stores last 20 recipes opened with their settings.
 * - "Recent" = opened within 7 days.
 * - "History" = opened >7 days ago (read-only, no actions).
 */

import { useState, useCallback } from 'react';

export interface RecipeSettings {
  servings?: number;
  settingsSaved?: boolean;
  linkedMealPlanId?: string;
  linkedMealPlanDate?: string;
  linkedMealPlanType?: string;
  linkedProfileName?: string;
  linkedProfileId?: string;
  lastCheckedIngredients?: string[]; // ingredients checked off during guide
  lastStep?: number;                  // last instruction step reached
  lastUpdatedAt?: string;             // ISO timestamp of last setting change
}

export interface RecentRecipeEntry {
  mealId: string;
  name: string;
  mealType: string;
  photoUrl: string | null;
  openedAt: string; // ISO date string
  userId?: string;   // logged-in user id at time of open
  settings?: RecipeSettings;
}

const STORAGE_KEY = 'replate_recent_recipes';
const MAX_ENTRIES = 30;

/** Safe date formatter — returns fallback string if date is invalid */
export function safeFmtDate(isoString: string | undefined, opts: Intl.DateTimeFormatOptions, fallback = 'Recently'): string {
  if (!isoString) return fallback;
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString(undefined, opts);
}

/** Safe full datetime string: "Apr 30, 2026 at 2:15 PM" */
export function safeFmtDateTime(isoString: string | undefined): string {
  if (!isoString) return 'Unknown time';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Unknown time';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function load(): RecentRecipeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as RecentRecipeEntry[]) : [];
    // Sanitize: filter out entries with missing mealId or invalid openedAt
    return all.filter((e) => e.mealId && e.name && !isNaN(new Date(e.openedAt ?? '').getTime()));
  } catch {
    return [];
  }
}

function save(entries: RecentRecipeEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* quota exceeded — ignore */ }
}

export function useRecentRecipes() {
  const [entries, setEntries] = useState<RecentRecipeEntry[]>(() => load());

  const recordOpen = useCallback((entry: Omit<RecentRecipeEntry, 'openedAt'>) => {
    setEntries((prev) => {
      // Preserve existing settings from any prior open — don't overwrite with undefined
      const existing = prev.find((e) => e.mealId === entry.mealId);
      const filtered = prev.filter((e) => e.mealId !== entry.mealId);
      const merged: RecentRecipeEntry = {
        ...existing,          // carry forward settings, photoUrl, etc.
        ...entry,             // new fields override (name, mealType, photoUrl if updated)
        settings: existing?.settings, // always keep saved settings
        openedAt: new Date().toISOString(),
      };
      const updated = [merged, ...filtered].slice(0, MAX_ENTRIES);
      save(updated);
      return updated;
    });
  }, []);

  const updateSettings = useCallback((mealId: string, settings: RecentRecipeEntry['settings']) => {
    setEntries((prev) => {
      const updated = prev.map((e) => e.mealId === mealId ? { ...e, settings: { ...e.settings, ...settings } } : e);
      save(updated);
      return updated;
    });
  }, []);

  /** Update any fields on an existing entry (e.g. photoUrl after upload) */
  const updateEntry = useCallback((mealId: string, patch: Partial<Omit<RecentRecipeEntry, 'mealId'>>) => {
    setEntries((prev) => {
      const updated = prev.map((e) => e.mealId === mealId ? { ...e, ...patch } : e);
      save(updated);
      return updated;
    });
  }, []);

  const removeEntry = useCallback((mealId: string) => {
    setEntries((prev) => {
      const updated = prev.filter((e) => e.mealId !== mealId);
      save(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    save([]);
    setEntries([]);
  }, []);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recent = entries.filter((e) => new Date(e.openedAt) >= sevenDaysAgo);
  const history = entries.filter((e) => new Date(e.openedAt) < sevenDaysAgo);

  return { recent, history, allEntries: entries, recordOpen, updateSettings, updateEntry, removeEntry, clearHistory };
}
