/**
 * ReportIssueModal
 *
 * A lightweight "Report an issue" sheet that can be triggered from:
 *  1. Any workflow page via the floating `ReportIssueButton`
 *  2. The Support page's issue form
 *
 * Usage:
 *   <ReportIssueButton workflow="shopping-session" />
 *
 * Or control it manually:
 *   const [open, setOpen] = useState(false);
 *   <ReportIssueModal open={open} onClose={() => setOpen(false)} workflow="meal-plan" />
 */

import { useState } from 'react';
import { AlertTriangle, MessageSquarePlus, Send, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ReportIssueModalProps {
  open: boolean;
  onClose: () => void;
  workflow?: string;
  route?: string;
  metadata?: Record<string, unknown>;
}

export function ReportIssueModal({ open, onClose, workflow, route, metadata }: ReportIssueModalProps) {
  const { toast } = useToast();
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.reportIssue({
        description,
        workflow: workflow || 'unknown',
        route: route || window.location.pathname,
        metadata,
      }),
    onSuccess: () => {
      toast('success', 'Report sent!', 'We\'ll look into it — thank you.');
      setDescription('');
      onClose();
    },
    onError: () => toast('error', 'Failed to send report', 'Please try again.'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <DialogTitle>Report an Issue</DialogTitle>
          </div>
          <p className="text-sm text-muted">
            Tell us what happened. This goes directly to the developer.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <textarea
            className={cn(
              'w-full min-h-[120px] rounded-xl border border-card-border bg-white px-4 py-3',
              'text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30',
              'resize-none transition-shadow'
            )}
            placeholder="Describe what you were doing and what went wrong…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted">{description.length}/2000</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => mutation.mutate()}
                disabled={description.trim().length < 5 || mutation.isPending}
                className="gap-2"
              >
                {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Report
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Floating trigger button — attach to any workflow page
// ---------------------------------------------------------------------------

interface ReportIssueButtonProps {
  workflow?: string;
  metadata?: Record<string, unknown>;
  className?: string;
}

export function ReportIssueButton({ workflow, metadata, className }: ReportIssueButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Report an issue"
        className={cn(
          'fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-40 lg:bottom-6 lg:right-6',
          'flex items-center gap-2 rounded-full bg-amber-500 text-white shadow-lg',
          'px-4 py-2.5 text-xs font-semibold',
          'hover:bg-amber-600 active:scale-95 transition-all duration-200',
          className
        )}
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0" />
        <span>Report Issue</span>
      </button>

      <ReportIssueModal
        open={open}
        onClose={() => setOpen(false)}
        workflow={workflow}
        metadata={metadata}
      />
    </>
  );
}
