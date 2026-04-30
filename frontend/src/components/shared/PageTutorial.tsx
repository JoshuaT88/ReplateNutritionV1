import { useState } from 'react';
import { ChevronDown, HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TutorialStep {
  title: string;
  description: string;
}

interface PageTutorialProps {
  pageKey: string;          // unique key used for localStorage dismissal
  title?: string;
  steps: TutorialStep[];
}

export function PageTutorial({ pageKey, title = 'How to use this page', steps }: PageTutorialProps) {
  const storageKey = `tutorial_dismissed_${pageKey}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(storageKey) === '1');
  const [open, setOpen] = useState(!dismissed);

  if (dismissed) {
    return (
      <button
        onClick={() => { setDismissed(false); setOpen(true); }}
        className="flex items-center gap-1 text-[11px] text-muted hover:text-primary transition-colors mb-1"
        title="Show page guide"
      >
        <HelpCircle className="h-3.5 w-3.5" /> How to use this page
      </button>
    );
  }

  const dismiss = () => {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 mb-4 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-primary"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4" />
          {title}
        </span>
        <div className="flex items-center gap-2">
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            className="p-0.5 rounded hover:bg-primary/10 text-muted hover:text-primary"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-xs font-semibold text-foreground">{step.title}</p>
                <p className="text-[11px] text-muted leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
