import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle, Lightbulb, MessageSquare, Send, Loader2,
  HelpCircle, Mail,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

type Tab = 'issue' | 'feedback';
type FeedbackType = 'feature' | 'improvement' | 'general';

const FEEDBACK_TYPES: { value: FeedbackType; label: string; desc: string }[] = [
  { value: 'feature', label: 'New Feature', desc: 'Something that doesn\'t exist yet' },
  { value: 'improvement', label: 'Improvement', desc: 'Make existing functionality better' },
  { value: 'general', label: 'General', desc: 'Anything else on your mind' },
];

export default function SupportPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('issue');

  // Issue form state
  const [issueDesc, setIssueDesc] = useState('');
  const [issueWorkflow, setIssueWorkflow] = useState('');

  // Feedback form state
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feature');
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackDesc, setFeedbackDesc] = useState('');

  const issueMutation = useMutation({
    mutationFn: () =>
      api.reportIssue({
        description: issueDesc,
        workflow: issueWorkflow || 'support-page',
        route: '/support',
      }),
    onSuccess: () => {
      toast('success', 'Issue reported!', 'The dev team will review it shortly.');
      setIssueDesc('');
      setIssueWorkflow('');
    },
    onError: () => toast('error', 'Failed to send', 'Please try again.'),
  });

  const feedbackMutation = useMutation({
    mutationFn: () =>
      api.submitFeedback({
        type: feedbackType,
        subject: feedbackSubject,
        description: feedbackDesc,
      }),
    onSuccess: () => {
      toast('success', 'Feedback received!', 'Thank you for helping improve Replate.');
      setFeedbackSubject('');
      setFeedbackDesc('');
    },
    onError: () => toast('error', 'Failed to send', 'Please try again.'),
  });

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">Support</h1>
        <p className="text-muted mt-1">Report a problem or share ideas to help improve Replate.</p>
      </motion.div>

      {/* Tab switcher */}
      <motion.div variants={fadeUp} className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        {(['issue', 'feedback'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all duration-200',
              tab === t
                ? 'bg-white shadow-soft text-foreground'
                : 'text-muted hover:text-foreground'
            )}
          >
            {t === 'issue' ? <AlertTriangle className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
            {t === 'issue' ? 'Report Issue' : 'Share Feedback'}
          </button>
        ))}
      </motion.div>

      {/* Issue form */}
      {tab === 'issue' && (
        <motion.div key="issue" variants={fadeUp} className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">
                  Your report goes directly to the developer. Include as much detail as you can — what you were doing, what you expected, and what actually happened.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workflow">Where did the issue occur? <span className="text-muted">(optional)</span></Label>
                <Input
                  id="workflow"
                  placeholder="e.g. Shopping session, Meal plan, Profile setup…"
                  value={issueWorkflow}
                  onChange={(e) => setIssueWorkflow(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="issue-desc">
                  What happened? <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="issue-desc"
                  className={cn(
                    'w-full min-h-[140px] rounded-xl border border-card-border bg-white px-4 py-3',
                    'text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30',
                    'resize-none transition-shadow'
                  )}
                  placeholder="Describe the issue in detail…"
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  maxLength={2000}
                />
                <div className="flex justify-between">
                  <span className="text-xs text-muted">{issueDesc.length}/2000</span>
                </div>
              </div>

              <Button
                className="w-full gap-2"
                onClick={() => issueMutation.mutate()}
                disabled={issueDesc.trim().length < 10 || issueMutation.isPending}
              >
                {issueMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
                Submit Report
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Feedback form */}
      {tab === 'feedback' && (
        <motion.div key="feedback" variants={fadeUp} className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>Type of feedback</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {FEEDBACK_TYPES.map((ft) => (
                    <button
                      key={ft.value}
                      onClick={() => setFeedbackType(ft.value)}
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200',
                        feedbackType === ft.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-card-border hover:border-primary/40'
                      )}
                    >
                      <span className="text-sm font-medium">{ft.label}</span>
                      <span className="text-xs text-muted leading-snug">{ft.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-subject">
                  Subject <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="feedback-subject"
                  placeholder="Brief title for your feedback…"
                  value={feedbackSubject}
                  onChange={(e) => setFeedbackSubject(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-desc">
                  Details <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="feedback-desc"
                  className={cn(
                    'w-full min-h-[140px] rounded-xl border border-card-border bg-white px-4 py-3',
                    'text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30',
                    'resize-none transition-shadow'
                  )}
                  placeholder="Describe your idea or suggestion in detail…"
                  value={feedbackDesc}
                  onChange={(e) => setFeedbackDesc(e.target.value)}
                  maxLength={5000}
                />
                <span className="text-xs text-muted">{feedbackDesc.length}/5000</span>
              </div>

              <Button
                className="w-full gap-2"
                onClick={() => feedbackMutation.mutate()}
                disabled={
                  feedbackSubject.trim().length < 3 ||
                  feedbackDesc.trim().length < 10 ||
                  feedbackMutation.isPending
                }
              >
                {feedbackMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <MessageSquare className="h-4 w-4" />}
                Submit Feedback
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick links */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Quick Info</p>
            <div className="space-y-2">
              {[
                { icon: Mail, label: 'Dev contact', value: 'jtctechsoft@gmail.com' },
                { icon: HelpCircle, label: 'App version', value: '1.0.0-beta' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-card-border last:border-0">
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Icon className="h-4 w-4" />
                    {label}
                  </div>
                  <span className="text-sm font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
