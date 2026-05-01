import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Shield, Bell, Database, Info, LogOut, Trash2, Download,
  Lock, Loader2, ChevronRight, ChevronLeft, ChevronDown, Sun, Moon, Monitor, MapPin,
  ShoppingCart, LayoutGrid, Minus, Plus, X, Users, Mail, Trash,
  Utensils, Sparkles, CalendarDays, History, Brain, TrendingDown,
  ShieldCheck, Smartphone, HelpCircle, AlertTriangle, Lightbulb, MessageSquare, Send,
  HeadsetIcon, Package,
} from 'lucide-react';
import { US_STATES, getTaxRate, formatTaxRate } from '@/lib/stateTaxRates';
import { useAuth, applyTheme } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Household } from '@/types';

// All nav items available for pinning
const ALL_NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/profiles', label: 'Nutrition Profiles' },
  { to: '/shopping', label: 'Shopping' },
  { to: '/meal-plan', label: 'Meals' },
  { to: '/pantry', label: 'Pantry' },
  { to: '/recommendations', label: 'Recommendations' },
  { to: '/nutrition', label: 'Nutrition Log' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/shopping/history', label: 'Shopping History' },
  { to: '/settings', label: 'Settings' },
];

export default function SettingsPage() {
  const { user, logout, refreshPreferences } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [changeEmailStep, setChangeEmailStep] = useState<'form' | 'code'>('form');
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeCode, setEmailChangeCode] = useState('');
  const [showEmailDisclosure, setShowEmailDisclosure] = useState(false);
  const [acceptEmailDisclosure, setAcceptEmailDisclosure] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [storeResults, setStoreResults] = useState<{ name: string; address: string }[]>([]);
  const [storeSearching, setStoreSearching] = useState(false);
  const [storeSearched, setStoreSearched] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  // T58-T63: Data export flow
  const [exportFlowStep, setExportFlowStep] = useState<'idle' | 'reason' | 'code' | 'submitted'>('idle');
  const [exportReason, setExportReason] = useState('');
  const [exportCode, setExportCode] = useState('');
  // Support tab state
  const [supportTab, setSupportTab] = useState<'issue' | 'feedback'>('issue');
  const [issueDesc, setIssueDesc] = useState('');
  const [issueWorkflow, setIssueWorkflow] = useState('');
  const [feedbackType, setFeedbackType] = useState<'feature' | 'improvement' | 'general'>('feature');
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackDesc, setFeedbackDesc] = useState('');
  // About tab FAQ accordion
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsTab = searchParams.get('tab') as 'account' | 'preferences' | 'security' | 'about' | 'support' | null;

  // On desktop (≥768px), auto-navigate to account tab when no tab is selected
  useEffect(() => {
    if (!settingsTab && window.matchMedia('(min-width: 768px)').matches) {
      setSearchParams({ tab: 'account' }, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: household, refetch: refetchHousehold } = useQuery<Household | null>({
    queryKey: ['household'],
    queryFn: () => api.getHousehold(),
    staleTime: 60_000,
  });

  const { data: exportStatus, refetch: refetchExportStatus } = useQuery({
    queryKey: ['dataExportStatus'],
    queryFn: () => api.getDataExportStatus(),
    staleTime: 60_000,
  });

  const requestExportMutation = useMutation({
    mutationFn: () => api.requestDataExport(exportReason),
    onSuccess: () => {
      setExportFlowStep('code');
      toast('success', 'Verification code sent', `Check ${user?.email}`);
    },
    onError: (e: any) => toast('error', e.message),
  });

  const verifyExportMutation = useMutation({
    mutationFn: () => api.verifyDataExportCode(exportCode),
    onSuccess: () => {
      setExportFlowStep('submitted');
      setExportCode('');
      refetchExportStatus();
    },
    onError: (e: any) => toast('error', 'Invalid or expired code', e.message),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.inviteHouseholdMember(inviteEmail.trim(), inviteRole),
    onSuccess: () => {
      toast('success', `Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      setShowInviteModal(false);
      refetchHousehold();
    },
    onError: (e: any) => toast('error', e.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => api.removeHouseholdMember(memberId),
    onSuccess: () => { toast('success', 'Member removed'); refetchHousehold(); },
    onError: (e: any) => toast('error', e.message),
  });

  const createHouseholdMutation = useMutation({
    mutationFn: () => api.createHousehold(),
    onSuccess: () => refetchHousehold(),
    onError: (e: any) => toast('error', e.message),
  });

  // Check push subscription status on mount
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => setPushEnabled(!!sub));
      });
    }
  }, []);

  const handlePushToggle = async (enable: boolean) => {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (enable) {
        const { publicKey } = await api.getVapidPublicKey();
        if (!publicKey) throw new Error('Push not configured on server');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Permission denied');
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        });
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        await api.subscribePush(json);
        setPushEnabled(true);
        toast('success', 'Push notifications enabled');
      } else {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await api.unsubscribePush(sub.endpoint);
          await sub.unsubscribe();
        }
        setPushEnabled(false);
        toast('success', 'Push notifications disabled');
      }
    } catch (err: any) {
      toast('error', 'Push setup failed', err.message);
    } finally {
      setPushLoading(false);
    }
  };

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.getPreferences(),
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: Record<string, any>) => api.updatePreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      refreshPreferences();
      toast('success', 'Preferences updated');
    },
    onError: (err: Error) => toast('error', 'Failed to update preferences', err.message),
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: () => api.sendTestNotificationEmail(),
    onSuccess: () => toast('success', 'Test email sent', `Sent to ${user?.email}`),
    onError: (err: Error) => toast('error', 'Failed to send test email', err.message),
  });

  const requestVerificationMutation = useMutation({
    mutationFn: () => api.requestEmailVerification(),
    onSuccess: () => {
      setShowCodeInput(true);
      toast('success', 'Code sent', `Check ${user?.email} for your 6-digit code`);
    },
    onError: (err: Error) => toast('error', 'Could not send verification code', err.message),
  });

  const verifyCodeMutation = useMutation({
    mutationFn: () => api.verifyEmailCode(verificationCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      refreshPreferences();
      setShowEmailDisclosure(false);
      setShowCodeInput(false);
      setVerificationCode('');
      toast('success', 'Email notifications enabled');
    },
    onError: (err: Error) => toast('error', 'Invalid code', err.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast('success', 'Password changed successfully');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: Error) => toast('error', 'Failed to change password', err.message),
  });

  const requestEmailChangeMutation = useMutation({
    mutationFn: () => api.requestEmailChange(newEmail.trim()),
    onSuccess: () => {
      setChangeEmailStep('code');
      toast('success', 'Verification code sent', `Check ${newEmail.trim()} for your 6-digit code`);
    },
    onError: (err: Error) => toast('error', 'Could not send code', err.message),
  });

  const confirmEmailChangeMutation = useMutation({
    mutationFn: () => api.confirmEmailChange(emailChangeCode),
    onSuccess: (data) => {
      toast('success', 'Email updated', `Your email is now ${data.email}`);
      setShowChangeEmail(false);
      setChangeEmailStep('form');
      setNewEmail('');
      setEmailChangeCode('');
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
    },
    onError: (err: Error) => toast('error', 'Invalid or expired code', err.message),
  });

  const resetBudgetMutation = useMutation({
    mutationFn: () => api.resetBudget(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      toast('success', 'Budget period reset — spending now tracked from today');
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => api.deleteAccount(),
    onSuccess: () => logout(),
  });

  const issueMutation = useMutation({
    mutationFn: () => api.reportIssue({ description: issueDesc, workflow: issueWorkflow || 'settings-support', route: '/settings?tab=support' }),
    onSuccess: () => { toast('success', 'Issue reported!', 'The dev team will review it shortly.'); setIssueDesc(''); setIssueWorkflow(''); },
    onError: () => toast('error', 'Failed to send', 'Please try again.'),
  });

  const feedbackMutation = useMutation({
    mutationFn: () => api.submitFeedback({ type: feedbackType, subject: feedbackSubject, description: feedbackDesc }),
    onSuccess: () => { toast('success', 'Feedback received!', 'Thank you for helping improve Replate.'); setFeedbackSubject(''); setFeedbackDesc(''); },
    onError: () => toast('error', 'Failed to send', 'Please try again.'),
  });

  const emailNotificationsEnabled = preferences?.emailNotificationsEnabled ?? false;
  const emailConsentDate = preferences?.emailNotificationsDisclosureAcceptedAt
    ? new Date(preferences.emailNotificationsDisclosureAcceptedAt).toLocaleDateString()
    : null;

  const handleEmailNotificationsToggle = (nextValue: boolean) => {
    if (!nextValue) {
      updatePreferencesMutation.mutate({ emailNotificationsEnabled: false });
      return;
    }
    setAcceptEmailDisclosure(false);
    setVerificationCode('');
    setShowCodeInput(false);
    setShowEmailDisclosure(true);
  };

  // Preferred stores
  const preferredStores = (preferences?.preferredStoreIds ?? []) as string[];
  const addStore = (storeName: string) => {
    if (preferredStores.includes(storeName) || preferredStores.length >= 10) return;
    updatePreferencesMutation.mutate({ preferredStoreIds: [...preferredStores, storeName] });
    setStoreResults([]);
    setStoreSearch('');
  };
  const removeStore = (storeName: string) => {
    updatePreferencesMutation.mutate({ preferredStoreIds: preferredStores.filter((s) => s !== storeName) });
  };

  const handleStoreSearch = async () => {
    if (!storeSearch.trim()) return;
    setStoreSearching(true);
    setStoreSearched(false);
    try {
      const results = await api.searchPreferredStores(storeSearch.trim(), undefined);
      setStoreResults(results ?? []);
    } catch (e: any) {
      setStoreResults([]);
      const msg = e?.message ?? '';
      if (msg.includes('REQUEST_DENIED') || msg.includes('Google Places')) {
        toast('error', 'Store search unavailable', 'Google Places API is not enabled — add the store name manually using the button below');
      } else {
        toast('error', 'Could not search stores');
      }
    } finally {
      setStoreSearching(false);
      setStoreSearched(true);
    }
  };

  // Pinned nav items
  const pinnedNavItems = (preferences?.pinnedNavItems ?? ['/', '/profiles', '/shopping', '/meal-plan']) as string[];
  const togglePinnedNav = (to: string) => {
    if (pinnedNavItems.includes(to)) {
      updatePreferencesMutation.mutate({ pinnedNavItems: pinnedNavItems.filter((p) => p !== to) });
    } else if (pinnedNavItems.length < 4) {
      updatePreferencesMutation.mutate({ pinnedNavItems: [...pinnedNavItems, to] });
    } else {
      toast('error', 'Maximum 4 pinned items', 'Remove one before adding another');
    }
  };

  const currentTheme = preferences?.theme ?? 'light';

  // ── Sub-page back header ──────────────────────────────────────────────────
  const SubPageHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-2">
      <button
        onClick={() => setSearchParams({})}
        className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors md:hidden"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-xl font-semibold dark:text-white">{title}</h1>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── ROOT: category picker ─────────────────────────────────────────── */}
      {settingsTab === null && (
        <div className="block md:hidden space-y-4">
          <div>
            <h1 className="text-2xl font-semibold dark:text-white">Settings</h1>
            <p className="text-sm text-muted mt-0.5">Manage your account and preferences.</p>
          </div>

          {/* User identity card */}
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#1F2937]">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm select-none">
              {user?.fullName?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium dark:text-[#F9FAFB] truncate">{user?.fullName || 'Your Name'}</p>
              <p className="text-xs text-muted truncate">{user?.email}</p>
            </div>
          </div>

          {/* 5 category tiles */}
          <div className="space-y-2">
            {([
              { key: 'account',     icon: User,         title: 'Account',          desc: 'Profile, household & notifications' },
              { key: 'preferences', icon: LayoutGrid,   title: 'App Preferences',  desc: 'Theme, budget, shopping & navigation' },
              { key: 'security',    icon: Shield,       title: 'Data & Security',  desc: 'Email, password, export & account' },
              { key: 'about',       icon: Info,         title: 'About & Help (FAQs)', desc: 'Mission, how it works & FAQs' },
              { key: 'support',     icon: HeadsetIcon,  title: 'Support',          desc: 'Report issues & share feedback' },
            ] as const).map(({ key, icon: Icon, title, desc }) => (
              <button
                key={key}
                onClick={() => setSearchParams({ tab: key })}
                className="w-full flex items-center justify-between p-4 rounded-2xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#1F2937] hover:border-primary/40 dark:hover:border-primary/40 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium dark:text-[#F9FAFB]">{title}</p>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted shrink-0" />
              </button>
            ))}
          </div>

          <Button variant="outline" className="w-full" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      )}

      {/* ── ACCOUNT ──────────────────────────────────────────────────────── */}
      {settingsTab === 'account' && (
        <>
          <SubPageHeader title="Account" />

          {/* Profile info */}
          <SettingsSection icon={User} title="Profile">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium dark:text-[#F9FAFB]">{user?.fullName || 'Your Name'}</p>
                  <p className="text-xs text-muted">{user?.email}</p>
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* Household */}
          <SettingsSection icon={Users} title="Household">
            {!household ? (
              <div className="py-3 space-y-2">
                <p className="text-sm text-muted">Create a household to invite family members and share your meal plans, shopping lists, and more.</p>
                <Button variant="outline" size="sm" onClick={() => createHouseholdMutation.mutate()} disabled={createHouseholdMutation.isPending}>
                  {createHouseholdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  Create Household
                </Button>
              </div>
            ) : (
              <div className="py-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{household.name}</p>
                    <p className="text-xs text-muted">{household.members.length} member{household.members.length !== 1 ? 's' : ''}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowInviteModal(true)}>
                    <Mail className="h-3.5 w-3.5" /> Invite
                  </Button>
                </div>
                {household.members.length > 0 && (
                  <div className="space-y-1.5">
                    {household.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#283447]/70 border border-card-border">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{m.user?.fullName ?? m.inviteEmail}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[10px] capitalize">{m.role.toLowerCase()}</Badge>
                            <Badge variant={m.inviteStatus === 'ACCEPTED' ? 'default' : 'warning'} className="text-[10px] capitalize">{m.inviteStatus.toLowerCase()}</Badge>
                          </div>
                        </div>
                        <button
                          onClick={() => removeMemberMutation.mutate(m.id)}
                          disabled={removeMemberMutation.isPending}
                          className="text-muted hover:text-red-500 transition-colors ml-2"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </SettingsSection>

          {/* Notifications */}
          <SettingsSection icon={Bell} title="Notifications">
            <div className="py-3 space-y-3">
              <ToggleRow
                label="Email notifications"
                description={emailNotificationsEnabled
                  ? `Notification emails are enabled for ${user?.email}`
                  : 'Enable email delivery for reminders and account activity updates'}
                value={emailNotificationsEnabled}
                onChange={handleEmailNotificationsToggle}
              />
              <div className="rounded-2xl border border-card-border dark:border-[#374151] bg-slate-50 dark:bg-[#283447]/70 px-4 py-3 text-xs text-muted space-y-2">
                <p>
                  Email notifications are optional and sent to <span className="font-medium text-foreground dark:text-[#E5E7EB]">{user?.email}</span>.
                  {emailConsentDate ? ` Disclosure accepted on ${emailConsentDate}.` : ' You must review and accept the disclosure before enabling them.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowEmailDisclosure(true)}>
                    Review disclosure
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendTestEmailMutation.mutate()}
                    disabled={!emailNotificationsEnabled || sendTestEmailMutation.isPending}
                  >
                    {sendTestEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send test email'}
                  </Button>
                </div>
              </div>
            </div>
            <ToggleRow
              label="Meal plan reminders"
              description="Daily reminder to check your planned meals"
              value={preferences?.mealReminders ?? true}
              onChange={(v) => updatePreferencesMutation.mutate({ mealReminders: v })}
              disabled={!emailNotificationsEnabled}
            />
            <ToggleRow
              label="Shopping list alerts"
              description="Email when items are added to your shopping list"
              value={preferences?.shoppingAlerts ?? true}
              onChange={(v) => updatePreferencesMutation.mutate({ shoppingAlerts: v })}
              disabled={!emailNotificationsEnabled}
            />
            <ToggleRow
              label="Price drop notifications"
              description="Email when tracked items in your area drop meaningfully in price"
              value={preferences?.priceDropAlerts ?? false}
              onChange={(v) => updatePreferencesMutation.mutate({ priceDropAlerts: v })}
              disabled={!emailNotificationsEnabled}
            />
            {'serviceWorker' in navigator && 'PushManager' in window && (
              <ToggleRow
                label="Push notifications"
                description="Receive browser push notifications for meal reminders and alerts"
                value={pushEnabled}
                onChange={handlePushToggle}
                disabled={pushLoading}
              />
            )}
          </SettingsSection>
        </>
      )}

      {/* ── APP PREFERENCES ───────────────────────────────────────────────── */}
      {settingsTab === 'preferences' && (
        <>
          <SubPageHeader title="App Preferences" />

          {/* Appearance */}
          <SettingsSection icon={Sun} title="Appearance">
            <div className="py-3">
              <p className="text-sm font-medium dark:text-[#F9FAFB] mb-3">Theme</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'light', icon: Sun, label: 'Light' },
                  { value: 'dark', icon: Moon, label: 'Dark' },
                  { value: 'system', icon: Monitor, label: 'System' },
                ] as const).map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      applyTheme(value);
                      updatePreferencesMutation.mutate({ theme: value });
                    }}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border-2 py-3 px-2 transition-colors text-sm',
                      currentTheme === value
                        ? 'border-primary bg-primary/5 text-primary dark:bg-primary/10'
                        : 'border-card-border dark:border-[#374151] text-muted hover:border-primary/50'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </SettingsSection>

          {/* Budget & Location */}
          <SettingsSection icon={Database} title="Budget & Location">
            <SettingsRow label="City" value={(preferences as any)?.city || 'Not set'}>
              <Input
                placeholder="e.g. Nashville"
                defaultValue={(preferences as any)?.city || ''}
                className="w-40"
                maxLength={100}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== ((preferences as any)?.city || '')) {
                    updatePreferencesMutation.mutate({ city: val || null } as any);
                  }
                }}
              />
            </SettingsRow>
            <SettingsRow
              label="State"
              value={(preferences as any)?.state
                ? `${(preferences as any).state}${getTaxRate((preferences as any).state) > 0 ? ` — base tax ${formatTaxRate(getTaxRate((preferences as any).state))}` : ' — no state tax'}`
                : 'Not set'}
            >
              <select
                className="border border-border rounded-md px-2 py-1.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-48"
                value={(preferences as any)?.state || ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  updatePreferencesMutation.mutate({ state: val } as any);
                }}
              >
                <option value="">Select state…</option>
                {US_STATES.map((s) => (
                  <option key={s.abbr} value={s.abbr}>{s.name}</option>
                ))}
              </select>
              {(preferences as any)?.state && (
                <p className="text-[11px] text-muted mt-1">
                  Tax estimate applied to shopping session totals. State base rate only — local taxes not included.
                </p>
              )}
            </SettingsRow>
            <SettingsRow label="Default ZIP Code" value={preferences?.zipCode || 'Not set'}>
              <Input
                placeholder="ZIP code"
                defaultValue={preferences?.zipCode || ''}
                className="w-32"
                maxLength={5}
                onBlur={(e) => {
                  if (e.target.value !== (preferences?.zipCode || '')) {
                    updatePreferencesMutation.mutate({ zipCode: e.target.value });
                  }
                }}
              />
            </SettingsRow>
            <SettingsRow label="City" value={preferences?.city || 'Not set'}>
              <Input
                placeholder="e.g. Nashville"
                defaultValue={preferences?.city || ''}
                className="w-40"
                onBlur={(e) => {
                  if (e.target.value !== (preferences?.city || '')) {
                    updatePreferencesMutation.mutate({ city: e.target.value });
                  }
                }}
              />
            </SettingsRow>
            <SettingsRow label="State" value={preferences?.state || 'Not set'}>
              <select
                defaultValue={preferences?.state || ''}
                className="flex h-9 w-40 rounded-xl border border-card-border dark:border-[#374151] bg-white dark:bg-[#283447] dark:text-[#F9FAFB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                onBlur={(e) => {
                  if (e.target.value !== (preferences?.state || '')) {
                    updatePreferencesMutation.mutate({ state: e.target.value });
                  }
                }}
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s.abbr} value={s.abbr}>{s.name}</option>
                ))}
              </select>
            </SettingsRow>
            <SettingsRow label="Monthly Budget" value={preferences?.budget ? `$${preferences.budget}` : 'Not set'}>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="400"
                  defaultValue={preferences?.budget || ''}
                  className="w-24"
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val !== preferences?.budget) {
                      updatePreferencesMutation.mutate({ budget: val });
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resetBudgetMutation.mutate()}
                  disabled={resetBudgetMutation.isPending}
                  title="Reset budget tracking period to today"
                >
                  Reset Period
                </Button>
              </div>
              <p className="text-[10px] text-muted mt-1">Resets the 30-day tracking window to today. Does not clear trip data.</p>
            </SettingsRow>
            <SettingsRow label="Per-Trip Budget" value={preferences?.perTripBudgetAllocation ? `$${preferences.perTripBudgetAllocation}` : 'Auto'}>
              <div className="space-y-1">
                <Input
                  type="number"
                  placeholder="Auto-calculated"
                  defaultValue={preferences?.perTripBudgetAllocation || ''}
                  className="w-36"
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === '') {
                      updatePreferencesMutation.mutate({ perTripBudgetAllocation: null });
                    } else {
                      const val = parseFloat(raw);
                      if (!isNaN(val) && val !== preferences?.perTripBudgetAllocation) {
                        updatePreferencesMutation.mutate({ perTripBudgetAllocation: val });
                      }
                    }
                  }}
                />
                <p className="text-[10px] text-muted">Leave blank to auto-compute from monthly budget ÷ trips</p>
              </div>
            </SettingsRow>
            <SettingsRow label="Timezone" value={preferences?.timezone || 'America/New_York'}>
              <select
                defaultValue={preferences?.timezone || 'America/New_York'}
                className="flex h-9 rounded-xl border border-card-border dark:border-[#374151] dark:bg-[#283447] dark:text-white bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                onChange={(e) => updatePreferencesMutation.mutate({ timezone: e.target.value })}
              >
                {[
                  'America/New_York', 'America/Chicago', 'America/Denver',
                  'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage',
                  'Pacific/Honolulu', 'America/Puerto_Rico',
                ].map((tz) => (
                  <option key={tz} value={tz}>{tz.replace('America/', '').replace('Pacific/', 'Pacific/').replace(/_/g, ' ')}</option>
                ))}
              </select>
            </SettingsRow>
          </SettingsSection>

          {/* Shopping preferences */}
          <SettingsSection icon={ShoppingCart} title="Shopping">
            <SettingsRow label="Navigation App" value={preferences?.gpsAppPreference ?? 'system'}>
              <select
                value={preferences?.gpsAppPreference ?? 'system'}
                className="flex h-9 rounded-xl border border-card-border dark:border-[#374151] dark:bg-[#283447] dark:text-white bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                onChange={(e) => updatePreferencesMutation.mutate({ gpsAppPreference: e.target.value })}
              >
                <option value="system">System Default</option>
                <option value="google">Google Maps</option>
                <option value="apple">Apple Maps</option>
                <option value="waze">Waze</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Shopping Frequency" value={preferences?.shoppingFrequency ?? 'Not set'}>
              <select
                value={preferences?.shoppingFrequency ?? ''}
                className="flex h-9 rounded-xl border border-card-border dark:border-[#374151] dark:bg-[#283447] dark:text-white bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                onChange={(e) => updatePreferencesMutation.mutate({ shoppingFrequency: e.target.value || null })}
              >
                <option value="">Not set</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Preferred Shopping Day" value={preferences?.shoppingDay ?? 'Not set'}>
              <select
                value={preferences?.shoppingDay ?? ''}
                className="flex h-9 rounded-xl border border-card-border dark:border-[#374151] dark:bg-[#283447] dark:text-white bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                onChange={(e) => updatePreferencesMutation.mutate({ shoppingDay: e.target.value || null })}
              >
                <option value="">Not set</option>
                {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((d) => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
            </SettingsRow>

            {/* Preferred Stores */}
            <div className="py-3">
              <p className="text-sm font-medium dark:text-[#F9FAFB] mb-2 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted" /> Preferred Stores
              </p>
              {preferredStores.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {preferredStores.map((store) => (
                    <span key={store} className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-[#283447] px-2.5 py-1 text-xs font-medium">
                      {store}
                      <button onClick={() => removeStore(store)} className="text-muted hover:text-accent-danger ml-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter city, state, or ZIP to search for stores"
                  value={storeSearch}
                  onChange={(e) => { setStoreSearch(e.target.value); setStoreSearched(false); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleStoreSearch()}
                  className="flex-1 text-sm"
                />
                <Button variant="outline" size="sm" onClick={handleStoreSearch} disabled={storeSearching}>
                  {storeSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                </Button>
              </div>
              <p className="text-[11px] text-muted">Enter your city/state or ZIP to search for stores near you. Optionally filter by store name.</p>
              {storeResults.length > 0 && (
                <div className="mt-2 rounded-xl border border-card-border dark:border-[#374151] overflow-hidden">
                  {storeResults.slice(0, 5).map((store, idx) => (
                    <button
                      key={idx}
                      onClick={() => addStore(store.name)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-[#374151]/60 border-b last:border-0 border-card-border dark:border-[#374151]"
                    >
                      <div className="text-left">
                        <p className="font-medium dark:text-[#E5E7EB]">{store.name}</p>
                        <p className="text-[11px] text-muted">{store.address}</p>
                      </div>
                      <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {storeSearched && storeResults.length === 0 && storeSearch.trim() && (
                <div className="mt-2 rounded-xl border border-card-border dark:border-[#374151] p-3">
                  <p className="text-xs text-muted mb-2">No stores found. Add <span className="font-medium text-foreground dark:text-[#F9FAFB]">"{storeSearch.trim()}"</span> as a custom store?</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => addStore(storeSearch.trim())}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add "{storeSearch.trim()}"
                  </Button>
                </div>
              )}
            </div>
          </SettingsSection>

          {/* Pinned Nav — mobile only */}
          <div className="lg:hidden">
            <SettingsSection icon={LayoutGrid} title="Pinned Navigation">
              <div className="py-3">
                <p className="text-[11px] text-muted mb-3">Choose up to 4 items for your bottom navigation bar.</p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_NAV_ITEMS.map((item) => {
                    const pinned = pinnedNavItems.includes(item.to);
                    return (
                      <button
                        key={item.to}
                        onClick={() => togglePinnedNav(item.to)}
                        className={cn(
                          'flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors',
                          pinned
                            ? 'border-primary/50 bg-primary/5 text-primary dark:bg-primary/10'
                            : 'border-card-border dark:border-[#374151] text-muted dark:text-[#9CA3AF] hover:border-primary/30'
                        )}
                      >
                        <span className={cn('font-medium', pinned && 'text-primary')}>{item.label}</span>
                        {pinned ? (
                          <Minus className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted mt-2">{pinnedNavItems.length}/4 selected</p>
              </div>
            </SettingsSection>
          </div>
        </>
      )}

      {/* ── DATA & SECURITY ───────────────────────────────────────────────── */}
      {settingsTab === 'security' && (
        <>
          <SubPageHeader title="Data & Security" />

          <SettingsSection icon={Shield} title="Account Security">
            <button
              onClick={() => setShowChangeEmail(true)}
              className="w-full flex items-center justify-between py-3 text-sm hover:text-primary transition-colors dark:text-[#E5E7EB]"
            >
              <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted" /> Change Email Address</span>
              <ChevronRight className="h-4 w-4 text-muted" />
            </button>
            <button
              onClick={() => setShowChangePassword(true)}
              className="w-full flex items-center justify-between py-3 text-sm hover:text-primary transition-colors dark:text-[#E5E7EB] border-t border-card-border dark:border-[#374151]"
            >
              <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-muted" /> Change Password</span>
              <ChevronRight className="h-4 w-4 text-muted" />
            </button>
          </SettingsSection>

          <SettingsSection icon={Database} title="Your Data">
            {/* Download link (available when export ready & not expired) */}
            {exportStatus?.dataExportUrl &&
              exportStatus.dataExportExpiresAt &&
              new Date(exportStatus.dataExportExpiresAt) > new Date() && (
              <div className="py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium dark:text-[#F9FAFB] flex items-center gap-1.5">
                      <Download className="h-4 w-4 text-emerald-500" /> Your data export is ready
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Available until {new Date(exportStatus.dataExportExpiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={exportStatus.dataExportUrl}
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </div>
              </div>
            )}

            {/* Request My Data flow */}
            <div className={cn('py-2', exportStatus?.dataExportUrl ? 'border-t border-card-border dark:border-[#374151]' : '')}>
              {exportFlowStep === 'idle' && (
                <button
                  onClick={() => setExportFlowStep('reason')}
                  className="w-full flex items-center justify-between py-1 text-sm hover:text-primary transition-colors dark:text-[#E5E7EB]"
                >
                  <span className="flex items-center gap-2"><Database className="h-4 w-4 text-muted" /> Request My Data</span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </button>
              )}
              {exportFlowStep === 'reason' && (
                <div className="space-y-3 py-1">
                  <p className="text-sm font-medium dark:text-[#F9FAFB]">Why are you requesting your data?</p>
                  <div className="space-y-1.5">
                    {['Personal backup', 'Switching to another service', 'GDPR / legal compliance', 'Reviewing my information', 'Other'].map((r) => (
                      <button
                        key={r}
                        onClick={() => setExportReason(r)}
                        className={cn('w-full text-left px-3 py-2 rounded-xl text-sm border-2 transition-colors',
                          exportReason === r ? 'border-primary bg-primary/5 text-primary' : 'border-card-border dark:border-[#374151] text-muted hover:border-slate-300'
                        )}
                      >{r}</button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => { setExportFlowStep('idle'); setExportReason(''); }}>Cancel</Button>
                    <Button size="sm" disabled={!exportReason || requestExportMutation.isPending} onClick={() => requestExportMutation.mutate()}>
                      {requestExportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Verification Code'}
                    </Button>
                  </div>
                </div>
              )}
              {exportFlowStep === 'code' && (
                <div className="space-y-3 py-1">
                  <p className="text-sm font-medium dark:text-[#F9FAFB]">Enter the 6-digit code sent to {user?.email}</p>
                  <Input
                    placeholder="123456"
                    value={exportCode}
                    onChange={(e) => setExportCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="tracking-[0.3em] text-center font-mono w-40"
                  />
                  <p className="text-xs text-muted">Code expires in 5 minutes.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setExportFlowStep('idle'); setExportCode(''); }}>Cancel</Button>
                    <Button size="sm" disabled={exportCode.length !== 6 || verifyExportMutation.isPending} onClick={() => verifyExportMutation.mutate()}>
                      {verifyExportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Request'}
                    </Button>
                  </div>
                </div>
              )}
              {exportFlowStep === 'submitted' && (
                <div className="py-2">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                    ✓ Request submitted. You'll receive an email when your export is ready (usually within 24 hours).
                  </p>
                  <button onClick={() => setExportFlowStep('idle')} className="text-xs text-muted hover:underline mt-1">Done</button>
                </div>
              )}
            </div>
          </SettingsSection>

          <SettingsSection icon={Trash2} title="Danger Zone">
            <button
              onClick={() => setShowDeleteAccount(true)}
              className="w-full flex items-center justify-between py-3 text-sm text-accent-danger hover:text-red-700 transition-colors"
            >
              <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete Account</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </SettingsSection>
        </>
      )}

      {/* ── ABOUT & HELP ──────────────────────────────────────────────────── */}
      {settingsTab === 'about' && (
        <>
          <SubPageHeader title="About & Help (FAQs)" />

          {/* App identity */}
          <SettingsSection icon={Utensils} title="Replate Nutrition">
            <div className="py-3 space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Utensils className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground dark:text-[#F9FAFB]">Replate Nutrition</p>
                  <p className="text-xs text-muted">Version 1.0.0 · Beta</p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Our Mission</p>
                  <p className="text-xs text-muted leading-relaxed">
                    To eliminate the guesswork from healthy eating — making personalized, dietary-safe meal planning, smart grocery shopping, and whole-household nutrition management accessible to every family, regardless of complexity or budget.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">What Replate Does</p>
                  <p className="text-xs text-muted leading-relaxed">
                    Replate is an AI-powered dietary management platform that unifies household nutrition profiles, meal planning, smart shopping lists, real-world grocery pricing, pantry management, and detailed macro/nutrition logging — all in one place. The more you use it, the smarter and more accurate it becomes.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Who It Helps</p>
                  <ul className="text-xs text-muted leading-relaxed space-y-1 list-disc list-inside">
                    <li>Families and households with multiple people who have different dietary needs</li>
                    <li>Individuals managing allergies, intolerances, Celiac disease, ARFID, or other dietary conditions</li>
                    <li>Caregivers who need safe, tailored food recommendations for vulnerable household members</li>
                    <li>Pet owners who want species-appropriate food guidance alongside their own nutrition</li>
                    <li>Budget-conscious shoppers who want real-time price comparisons across nearby stores</li>
                    <li>Anyone who wants to spend less time planning meals and more time enjoying them</li>
                  </ul>
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* How It Works */}
          <SettingsSection icon={HelpCircle} title="How It Works">
            <div className="py-2 space-y-3">
              {([
                { icon: Users, title: 'Nutrition Profiles', desc: 'Create profiles for every household member — humans and pets. Each profile stores allergies, dietary restrictions, conditions (Celiac, ARFID), preferences, and dislikes. The AI uses these to generate safe, personalized recommendations.' },
                { icon: Sparkles, title: 'Recommendations', desc: 'AI-powered food, brand, and recipe suggestions tailored to each profile. Every recommendation includes nutritional info, ingredients, price range, and alternatives. Add directly to your shopping list or meal plan with one tap.' },
                { icon: CalendarDays, title: 'Meal Planning', desc: 'Plan meals for each profile by day and meal type. The AI avoids repeating recent meals and respects all dietary constraints. Each meal includes ingredients, prep notes, and calorie counts. Generate a shopping list directly from your plan.' },
                { icon: ShoppingCart, title: 'Smart Shopping List', desc: 'Items organized by category and priority. Add manually, from recommendations, or auto-generate from meal plan. Find nearby stores, compare prices, and start a guided shopping session.' },
                { icon: MapPin, title: 'Store Finder & Pricing', desc: 'Enter your ZIP to find nearby stores with estimated totals for your list. Pricing uses crowd-sourced data from your own sessions plus AI estimates. The more you shop, the more accurate it gets.' },
                { icon: History, title: 'Shopping Sessions', desc: 'Items grouped by aisle for efficient navigation. Mark items as Picked Up, Out of Stock, Too Expensive, or Skip. Log actual prices to improve future estimates. Session history saves automatically.' },
                { icon: Package, title: 'Pantry', desc: 'Track what\'s in your pantry with expiration dates and stock alerts. Get notified when items are running low or about to expire, and generate reorder suggestions based on purchase history.' },
                { icon: Brain, title: 'How the System Learns', desc: 'Every session teaches Replate: actual prices refine estimates, aisle locations get remembered, and out-of-stock patterns inform future suggestions. Usage makes the entire experience more accurate over time.' },
              ] as const).map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3 py-2 border-b border-card-border dark:border-[#374151] last:border-0">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground dark:text-[#F9FAFB]">{title}</p>
                    <p className="text-xs text-muted leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>

          {/* Typical Workflow */}
          <SettingsSection icon={TrendingDown} title="Typical Workflow">
            <ol className="py-2 space-y-2.5">
              {[
                'Create Profiles for each household member with their dietary needs.',
                'Generate Recommendations — AI creates personalized food, brand, and recipe suggestions.',
                'Plan Meals or add recommendations directly to your meal plan.',
                'Build Your Shopping List — manually, from recommendations, or from meal plan.',
                'Find Stores — compare prices at nearby stores for your list.',
                'Start a Shopping Session — items grouped by aisle, tap to mark picked up.',
                'End Session — history saved, prices contributed, list updated.',
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-xs text-muted">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </SettingsSection>

          {/* FAQ */}
          <SettingsSection icon={ShieldCheck} title="Frequently Asked Questions">
            <div className="py-1 space-y-1">
              {([
                { q: 'Is my data private?', a: 'Yes. Your profile and dietary data are stored securely and never shared. Only anonymized price data (item + store + ZIP region) is aggregated to improve estimates for all users.' },
                { q: 'How accurate are AI-generated prices?', a: 'AI estimates are a starting point. As you log actual prices during sessions, the system switches to crowd-sourced data which is significantly more accurate. Stores with more submissions show higher confidence.' },
                { q: 'How does aisle navigation work?', a: 'The AI predicts aisle locations based on the store name and item type. When you or others confirm or correct locations during sessions, those are saved and reused — improving accuracy over time.' },
                { q: 'Can I use this for pets?', a: 'Absolutely. Create a PET profile with species, weight, allergies, and dietary needs. The AI only recommends species-appropriate foods and flags any dangerous ingredients.' },
                { q: 'How do I adjust my budget?', a: 'Go to App Preferences → Weekly / Monthly Budget. During sessions, the running total updates in real-time. High-priority items are visually flagged so you can focus on essentials first.' },
                { q: 'What happens when items are out of stock?', a: 'Mark them "Out of Stock" during your session. The system remembers this pattern and can suggest alternative stores. Skipped items stay on your list for next time.' },
              ]).map((faq, i) => (
                <div key={i} className="border-b border-card-border dark:border-[#374151] last:border-0">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    className="w-full flex items-center justify-between py-3 text-left"
                  >
                    <span className="text-xs font-medium text-foreground dark:text-[#F9FAFB] pr-4">{faq.q}</span>
                    <ChevronDown className={cn('h-4 w-4 text-muted shrink-0 transition-transform', expandedFaq === i && 'rotate-180')} />
                  </button>
                  {expandedFaq === i && (
                    <p className="text-xs text-muted leading-relaxed pb-3">{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </SettingsSection>

          {/* Mobile / PWA note */}
          <SettingsSection icon={Smartphone} title="Mobile Access">
            <p className="py-2 text-xs text-muted leading-relaxed">
              Replate works as a Progressive Web App (PWA). On iOS: tap Share → Add to Home Screen. On Android: tap the menu → Install App. This gives you a native app-like experience with offline-capable features and push notification support.
            </p>
          </SettingsSection>
        </>
      )}

      {/* ── SUPPORT ───────────────────────────────────────────────────────── */}
      {settingsTab === 'support' && (
        <>
          <SubPageHeader title="Support" />

          {/* Tab switcher */}
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-[#283447] rounded-xl">
            {(['issue', 'feedback'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSupportTab(t)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all duration-200',
                  supportTab === t
                    ? 'bg-white dark:bg-[#1F2937] shadow-soft text-foreground'
                    : 'text-muted hover:text-foreground'
                )}
              >
                {t === 'issue' ? <AlertTriangle className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                {t === 'issue' ? 'Report Issue' : 'Share Feedback'}
              </button>
            ))}
          </div>

          {supportTab === 'issue' && (
            <SettingsSection icon={AlertTriangle} title="Report an Issue">
              <div className="py-2 space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-400">Your report goes directly to the developer. Include as much detail as you can — what you were doing, what you expected, and what happened.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Where did the issue occur? <span className="text-muted">(optional)</span></Label>
                  <input
                    className="w-full h-9 rounded-xl border border-card-border dark:border-[#374151] dark:bg-[#1F2937] dark:text-foreground px-3 text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="e.g. Shopping session, Meal plan…"
                    value={issueWorkflow}
                    onChange={(e) => setIssueWorkflow(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">What happened? <span className="text-red-500">*</span></Label>
                  <textarea
                    className={cn(
                      'w-full min-h-[120px] rounded-xl border border-card-border dark:border-[#374151] dark:bg-[#1F2937] dark:text-foreground px-3 py-2.5',
                      'text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none'
                    )}
                    placeholder="Describe the issue in detail…"
                    value={issueDesc}
                    onChange={(e) => setIssueDesc(e.target.value)}
                    maxLength={2000}
                  />
                  <span className="text-xs text-muted">{issueDesc.length}/2000</span>
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={() => issueMutation.mutate()}
                  disabled={issueDesc.trim().length < 10 || issueMutation.isPending}
                >
                  {issueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit Report
                </Button>
              </div>
            </SettingsSection>
          )}

          {supportTab === 'feedback' && (
            <SettingsSection icon={Lightbulb} title="Share Feedback">
              <div className="py-2 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type of feedback</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'feature', label: 'New Feature', desc: 'Something new' },
                      { value: 'improvement', label: 'Improvement', desc: 'Make it better' },
                      { value: 'general', label: 'General', desc: 'Anything else' },
                    ] as const).map((ft) => (
                      <button
                        key={ft.value}
                        onClick={() => setFeedbackType(ft.value)}
                        className={cn(
                          'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all',
                          feedbackType === ft.value ? 'border-primary bg-primary/5 text-primary' : 'border-card-border dark:border-[#374151] hover:border-primary/40'
                        )}
                      >
                        <span className="text-xs font-medium">{ft.label}</span>
                        <span className="text-[10px] text-muted leading-snug">{ft.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subject <span className="text-red-500">*</span></Label>
                  <input
                    className="w-full h-9 rounded-xl border border-card-border dark:border-[#374151] dark:bg-[#1F2937] dark:text-foreground px-3 text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Brief title…"
                    value={feedbackSubject}
                    onChange={(e) => setFeedbackSubject(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Details <span className="text-red-500">*</span></Label>
                  <textarea
                    className={cn(
                      'w-full min-h-[120px] rounded-xl border border-card-border dark:border-[#374151] dark:bg-[#1F2937] dark:text-foreground px-3 py-2.5',
                      'text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none'
                    )}
                    placeholder="Describe your idea or suggestion…"
                    value={feedbackDesc}
                    onChange={(e) => setFeedbackDesc(e.target.value)}
                    maxLength={5000}
                  />
                  <span className="text-xs text-muted">{feedbackDesc.length}/5000</span>
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={() => feedbackMutation.mutate()}
                  disabled={feedbackSubject.trim().length < 3 || feedbackDesc.trim().length < 10 || feedbackMutation.isPending}
                >
                  {feedbackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  Submit Feedback
                </Button>
              </div>
            </SettingsSection>
          )}

          {/* Quick contact info */}
          <SettingsSection icon={Mail} title="Quick Info">
            <div className="py-2 space-y-2">
              {[
                { icon: HeadsetIcon, label: 'Phone', value: '(865) 266-4549' },
                { icon: Mail, label: 'Dev contact', value: 'jtctechsoft@gmail.com' },
                { icon: Info, label: 'App version', value: '1.0.0-beta' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-card-border dark:border-[#374151] last:border-0">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Icon className="h-4 w-4" /> {label}
                  </div>
                  <span className="text-xs font-medium text-foreground dark:text-[#E5E7EB]">{value}</span>
                </div>
              ))}
            </div>
          </SettingsSection>
        </>
      )}

      {/* ── DIALOGS (always rendered regardless of tab) ───────────────────── */}

      {/* Change Email Dialog */}
      <Dialog open={showChangeEmail} onOpenChange={(open) => { setShowChangeEmail(open); if (!open) { setChangeEmailStep('form'); setNewEmail(''); setEmailChangeCode(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Email Address</DialogTitle></DialogHeader>
          {changeEmailStep === 'form' ? (
            <div className="space-y-3 my-4">
              <p className="text-sm text-muted">Current email: <strong className="text-foreground dark:text-[#E5E7EB]">{user?.email}</strong></p>
              <div>
                <Label>New Email Address</Label>
                <Input type="email" placeholder="new@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoFocus />
              </div>
            </div>
          ) : (
            <div className="space-y-3 my-4">
              <p className="text-sm text-muted">Enter the 6-digit code sent to <strong className="text-foreground dark:text-[#E5E7EB]">{newEmail}</strong></p>
              <Input placeholder="000000" maxLength={6} value={emailChangeCode} onChange={(e) => setEmailChangeCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="text-center text-xl font-mono tracking-widest" autoFocus />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowChangeEmail(false); setChangeEmailStep('form'); setNewEmail(''); setEmailChangeCode(''); }}>Cancel</Button>
            {changeEmailStep === 'form' ? (
              <Button onClick={() => requestEmailChangeMutation.mutate()} disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) || requestEmailChangeMutation.isPending}>
                {requestEmailChangeMutation.isPending ? 'Sending…' : 'Send Code'}
              </Button>
            ) : (
              <Button onClick={() => confirmEmailChangeMutation.mutate()} disabled={emailChangeCode.length !== 6 || confirmEmailChangeMutation.isPending}>
                {confirmEmailChangeMutation.isPending ? 'Verifying…' : 'Confirm Change'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          <div className="space-y-3 my-4">
            <div><Label>Current Password</Label><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
            <div><Label>New Password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <div><Label>Confirm New Password</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-accent-danger">Passwords do not match.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePassword(false)}>Cancel</Button>
            <Button onClick={() => changePasswordMutation.mutate()} disabled={!currentPassword || !newPassword || newPassword !== confirmPassword || changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Notification Disclosure Dialog */}
      <Dialog open={showEmailDisclosure} onOpenChange={(open) => { setShowEmailDisclosure(open); if (!open) { setShowCodeInput(false); setVerificationCode(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enable Email Notifications</DialogTitle></DialogHeader>
          {!showCodeInput ? (
            <>
              <div className="space-y-4 my-4 text-sm text-muted">
                <p>Replate Nutrition can send optional email notifications to <span className="font-medium text-foreground">{user?.email}</span> for meal reminders, shopping alerts, and price updates tied to your account activity.</p>
                <div className="rounded-2xl border border-card-border dark:border-[#374151] bg-slate-50 dark:bg-[#283447]/70 p-4 space-y-2 text-[13px] leading-6">
                  <p>Message frequency varies based on the notification types you enable and the activity in your account.</p>
                  <p>These emails may reference household planning details and are not medical, nutrition, or veterinary advice.</p>
                  <p>You can turn email notifications off at any time in Settings.</p>
                </div>
                <label className="flex items-start gap-3 rounded-2xl border border-card-border dark:border-[#374151] p-4 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" checked={acceptEmailDisclosure} onChange={(e) => setAcceptEmailDisclosure(e.target.checked)} />
                  <span className="text-sm text-foreground dark:text-[#E5E7EB]">I understand the disclosure above and consent to receive optional Replate Nutrition notification emails at this address.</span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEmailDisclosure(false)}>Cancel</Button>
                <Button onClick={() => requestVerificationMutation.mutate()} disabled={!acceptEmailDisclosure || requestVerificationMutation.isPending}>
                  {requestVerificationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send verification code'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 my-4">
                <p className="text-sm text-muted">We sent a 6-digit code to <span className="font-medium text-foreground">{user?.email}</span>. It expires in 5 minutes.</p>
                <div>
                  <Label>Verification Code</Label>
                  <Input placeholder="123456" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="text-center text-2xl font-bold tracking-widest mt-1" maxLength={6} inputMode="numeric" autoFocus />
                </div>
                <button className="text-xs text-primary hover:underline" onClick={() => requestVerificationMutation.mutate()} disabled={requestVerificationMutation.isPending}>Resend code</button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowCodeInput(false); setVerificationCode(''); }}>Back</Button>
                <Button onClick={() => verifyCodeMutation.mutate()} disabled={verificationCode.length !== 6 || verifyCodeMutation.isPending}>
                  {verifyCodeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Enable'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteAccount} onOpenChange={setShowDeleteAccount}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Account</DialogTitle></DialogHeader>
          <p className="text-sm text-muted my-4">This will permanently delete your account and all associated data including profiles, meal plans, shopping history, and preferences. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAccount(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteAccountMutation.mutate()} disabled={deleteAccountMutation.isPending}>
              {deleteAccountMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete My Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={showInviteModal} onOpenChange={(o) => { setShowInviteModal(o); if (!o) setInviteEmail(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite to Household</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Email address</Label>
              <Input type="email" placeholder="family@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="mt-1" autoFocus />
            </div>
            <div>
              <Label>Role</Label>
              <div className="flex gap-2 mt-1">
                {(['MEMBER', 'ADMIN'] as const).map((r) => (
                  <button key={r} onClick={() => setInviteRole(r)} className={cn('flex-1 px-3 py-2 rounded-xl border text-sm transition-colors', inviteRole === r ? 'border-primary bg-primary/5 font-medium' : 'border-card-border')}>
                    {r === 'MEMBER' ? 'Member' : 'Admin'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-1.5">{inviteRole === 'ADMIN' ? 'Admins can manage profiles, shopping, and meal planning.' : 'Members can view and contribute to shopping and meal planning.'}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>Cancel</Button>
            <Button onClick={() => inviteMutation.mutate()} disabled={!inviteEmail.trim() || inviteMutation.isPending}>
              {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function SettingsSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold dark:text-[#F9FAFB]">{title}</h2>
        </div>
        <div className="divide-y divide-card-border dark:divide-slate-700">{children}</div>
      </CardContent>
    </Card>
  );
}

function SettingsRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium dark:text-[#E5E7EB]">{label}</p>
        <p className="text-xs text-muted">{value}</p>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, value, onChange, disabled = false }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between py-3', disabled && 'opacity-50')}>
      <div>
        <p className="text-sm font-medium dark:text-[#E5E7EB]">{label}</p>
        <p className="text-[10px] text-muted">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors duration-200 disabled:cursor-not-allowed',
          value ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-600'
        )}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200',
          value && 'translate-x-5'
        )} />
      </button>
    </div>
  );
}

