/**
 * Time utilities — single source of truth for all date/time formatting
 * and the `useNow` hook so all live timestamps stay in sync.
 *
 * Import from '@/lib/time' everywhere.  Do NOT use `new Date()` inline
 * for display — always go through these helpers so formatting is consistent.
 */

import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Core formatters
// ---------------------------------------------------------------------------

/** "Apr 21, 2026" */
export function fmtDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Monday, April 21, 2026" */
export function fmtDateLong(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** "Mon 4/21" — compact weekly calendar header */
export function fmtDateCompact(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
}

/** "2:34 PM" */
export function fmtTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "Apr 21, 2026 at 2:34 PM" */
export function fmtDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return `${fmtDate(d)} at ${fmtTime(d)}`;
}

/** "2 minutes ago" / "3 hours ago" / "Apr 21" / "Apr 21, 2025" */
export function fmtRelative(date: string | Date | null | undefined, now = new Date()): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
  if (d.getFullYear() === now.getFullYear()) return fmtDate(d).replace(`, ${now.getFullYear()}`, '');
  return fmtDate(d);
}

/** "1h 23m" — for elapsed duration in seconds */
export function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

/** "YYYY-MM-DD" — for API date params */
export function toDateParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Whether two Date objects represent the same calendar day */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/** Parse a DB date string ("2026-04-14T00:00:00.000Z") to local YYYY-MM-DD */
export function dbDateToLocalStr(dateStr: string): string {
  return dateStr.split('T')[0];
}

// ---------------------------------------------------------------------------
// React hook — single ticking clock shared across the app
// ---------------------------------------------------------------------------

let listeners: Array<(now: Date) => void> = [];
let tickInterval: ReturnType<typeof setInterval> | null = null;
let currentNow = new Date();

function startTick() {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    currentNow = new Date();
    listeners.forEach((fn) => fn(currentNow));
  }, 1000);
}

/**
 * useNow(granularity?)
 *
 * Returns a `Date` object that ticks every N seconds (default 1).
 * All components using this share ONE interval — no drift, no duplication.
 *
 * @example
 *   const now = useNow(); // ticks every second
 *   const now = useNow(60); // ticks every minute
 */
export function useNow(granularitySeconds = 1): Date {
  const [now, setNow] = useState<Date>(currentNow);

  useEffect(() => {
    startTick();
    let lastUpdate = Date.now();

    const listener = (d: Date) => {
      const elapsed = (d.getTime() - lastUpdate) / 1000;
      if (elapsed >= granularitySeconds) {
        lastUpdate = d.getTime();
        setNow(new Date(d));
      }
    };

    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, [granularitySeconds]);

  return now;
}
