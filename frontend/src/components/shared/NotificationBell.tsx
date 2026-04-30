import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const TYPE_COLORS: Record<string, string> = {
  suggestion_approved: 'bg-emerald-100 text-emerald-700',
  suggestion_denied: 'bg-red-100 text-red-700',
  suggestion_pending: 'bg-amber-100 text-amber-700',
  household_invite: 'bg-blue-100 text-blue-700',
  general: 'bg-slate-100 text-slate-700',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  /** Light variant for use on dark backgrounds (sidebar) */
  light?: boolean;
}

export function NotificationBell({ light = false }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) => api.markNotificationsRead(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Mark visible unread notifications as read when panel opens
  useEffect(() => {
    if (!open) return;
    const unreadIds = notifications.filter((n: any) => !n.isRead).map((n: any) => n.id);
    if (unreadIds.length > 0) {
      markReadMutation.mutate(unreadIds);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        className={cn(
          'relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors',
          light
            ? 'text-white/70 hover:text-white hover:bg-white/10'
            : 'text-muted hover:text-foreground hover:bg-muted/30'
        )}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-80 bg-white dark:bg-[#1e2a3b] border border-card-border dark:border-[#374151] rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-card-border dark:border-[#374151]">
              <span className="font-semibold text-sm">Notifications</span>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllMutation.mutate()}
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                  >
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg text-muted hover:bg-muted/30 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Notifications list */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No notifications yet
                </div>
              ) : (
                notifications.map((n: any) => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 px-4 py-3 border-b border-card-border/60 dark:border-[#283447] last:border-0 transition-colors',
                      !n.isRead ? 'bg-primary/5 dark:bg-primary/10' : ''
                    )}
                  >
                    <div className={cn('shrink-0 mt-0.5 w-2 h-2 rounded-full', !n.isRead ? 'bg-primary mt-2' : 'bg-transparent mt-2')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      {n.body && <p className="text-xs text-muted mt-0.5 leading-relaxed">{n.body}</p>}
                      <p className="text-[10px] text-muted/70 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <button
                        onClick={() => markReadMutation.mutate([n.id])}
                        className="shrink-0 p-1 mt-0.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
