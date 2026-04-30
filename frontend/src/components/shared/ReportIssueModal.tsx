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
import { AlertTriangle, MessageSquarePlus, Send, Loader2, X } from 'lucide-react';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Collapsed: icon-only pill. Expanded: slides out to show label + close */}
      <div
        className={cn(
          // Position: mobile sits above the bottom nav bar; desktop sits above the End Session bar
          'fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-40',
          'lg:bottom-24 lg:right-6',
          'flex items-center gap-0 overflow-hidden',
          'rounded-full bg-amber-500 text-white shadow-lg transition-all duration-200',
          expanded ? 'gap-0' : '',
          className
        )}
      >
        {/* Always-visible icon button — toggles expanded */}
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? 'Collapse' : 'Report an issue'}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-amber-600 active:scale-95 transition-all duration-200 shrink-0"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>

        {/* Expanded label + action */}
        <div
          className={cn(
            'flex items-center gap-1 overflow-hidden transition-all duration-200',
            expanded ? 'max-w-[160px] pr-3' : 'max-w-0 pr-0'
          )}
        >
          <button
            onClick={() => { setExpanded(false); setModalOpen(true); }}
            className="text-xs font-semibold whitespace-nowrap hover:underline"
          >
            Report Issue
          </button>
          <span className="text-amber-300 mx-1 text-xs">·</span>
          <button
            onClick={() => setExpanded(false)}
            className="text-amber-200 hover:text-white transition-colors"
            title="Collapse"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      <ReportIssueModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workflow={workflow}
        metadata={metadata}
      />
    </>
  );
}
