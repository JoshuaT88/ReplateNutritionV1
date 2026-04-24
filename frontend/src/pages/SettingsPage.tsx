import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Shield, Bell, Database, Info, LogOut, Trash2, Download,
  Lock, Loader2, ChevronRight, Sun, Moon, Monitor, MapPin,
  ShoppingCart, LayoutGrid, Minus, Plus, X, Users, Mail, Trash
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
  { to: '/profiles', label: 'Profiles' },
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  // T58-T63: Data export flow
  const [exportFlowStep, setExportFlowStep] = useState<'idle' | 'reason' | 'code' | 'submitted'>('idle');
  const [exportReason, setExportReason] = useState('');
  const [exportCode, setExportCode] = useState('');

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

  const exportDataMutation = useMutation({
    mutationFn: () => api.exportData(),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `replate-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('success', 'Data exported');
    },
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
    try {
      const results = await api.findStores(storeSearch.trim());
      setStoreResults(results ?? []);
    } catch {
      toast('error', 'Could not search stores');
    } finally {
      setStoreSearching(false);
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold dark:text-white">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your account and preferences.</p>
      </div>

      {/* Account */}
      <SettingsSection icon={User} title="Account">
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium dark:text-slate-100">{user?.fullName || 'Your Name'}</p>
              <p className="text-xs text-muted">{user?.email}</p>
            </div>
          </div>
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
          </SettingsRow>
          <SettingsRow label="Timezone" value={preferences?.timezone || 'America/New_York'}>
            <select
              defaultValue={preferences?.timezone || 'America/New_York'}
              className="flex h-9 rounded-xl border border-card-border dark:border-slate-600 dark:bg-slate-700 dark:text-white bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
        </div>
      </SettingsSection>

      {/* Appearance (T14) */}
      <SettingsSection icon={Sun} title="Appearance">
        <div className="py-3">
          <p className="text-sm font-medium dark:text-slate-100 mb-3">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'light', icon: Sun, label: 'Light' },
              { value: 'dark', icon: Moon, label: 'Dark' },
              { value: 'system', icon: Monitor, label: 'System' },
            ] as const).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => updatePreferencesMutation.mutate({ theme: value })}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 py-3 px-2 transition-colors text-sm',
                  currentTheme === value
                    ? 'border-primary bg-primary/5 text-primary dark:bg-primary/10'
                    : 'border-card-border dark:border-slate-600 text-muted hover:border-primary/50'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
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
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-card-border">
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

      {/* Security */}
      <SettingsSection icon={Shield} title="Security">
        <button
          onClick={() => setShowChangePassword(true)}
          className="w-full flex items-center justify-between py-3 text-sm hover:text-primary transition-colors dark:text-slate-200"
        >
          <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-muted" /> Change Password</span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </button>

        {/* T63: Download link (available when export ready & not expired) */}
        {exportStatus?.dataExportUrl &&
          exportStatus.dataExportExpiresAt &&
          new Date(exportStatus.dataExportExpiresAt) > new Date() && (
          <div className="py-2 border-t border-card-border dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium dark:text-slate-100 flex items-center gap-1.5">
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

        {/* T58-T59: Request My Data flow */}
        <div className="py-2 border-t border-card-border dark:border-slate-700">
          {exportFlowStep === 'idle' && (
            <button
              onClick={() => setExportFlowStep('reason')}
              className="w-full flex items-center justify-between py-1 text-sm hover:text-primary transition-colors dark:text-slate-200"
            >
              <span className="flex items-center gap-2"><Database className="h-4 w-4 text-muted" /> Request My Data</span>
              <ChevronRight className="h-4 w-4 text-muted" />
            </button>
          )}

          {exportFlowStep === 'reason' && (
            <div className="space-y-3 py-1">
              <p className="text-sm font-medium dark:text-slate-100">Why are you requesting your data?</p>
              <div className="space-y-1.5">
                {[
                  'Personal backup',
                  'Switching to another service',
                  'GDPR / legal compliance',
                  'Reviewing my information',
                  'Other',
                ].map((r) => (
                  <button
                    key={r}
                    onClick={() => setExportReason(r)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-xl text-sm border-2 transition-colors',
                      exportReason === r
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-card-border dark:border-slate-600 text-muted hover:border-slate-300'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => { setExportFlowStep('idle'); setExportReason(''); }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!exportReason || requestExportMutation.isPending}
                  onClick={() => requestExportMutation.mutate()}
                >
                  {requestExportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Verification Code'}
                </Button>
              </div>
            </div>
          )}

          {exportFlowStep === 'code' && (
            <div className="space-y-3 py-1">
              <p className="text-sm font-medium dark:text-slate-100">Enter the 6-digit code sent to {user?.email}</p>
              <Input
                placeholder="123456"
                value={exportCode}
                onChange={(e) => setExportCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="tracking-[0.3em] text-center font-mono w-40"
              />
              <p className="text-xs text-muted">Code expires in 5 minutes.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setExportFlowStep('idle'); setExportCode(''); }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={exportCode.length !== 6 || verifyExportMutation.isPending}
                  onClick={() => verifyExportMutation.mutate()}
                >
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
              <button
                onClick={() => setExportFlowStep('idle')}
                className="text-xs text-muted hover:underline mt-1"
              >
                Done
              </button>
            </div>
          )}
        </div>
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

          <div className="rounded-2xl border border-card-border dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-xs text-muted space-y-2">
            <p>
              Email notifications are optional and sent to <span className="font-medium text-foreground dark:text-slate-200">{user?.email}</span>.
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

      {/* Shopping (T15, T17, T19) */}
      <SettingsSection icon={ShoppingCart} title="Shopping">
        {/* GPS App (T15) */}
        <SettingsRow label="Navigation App" value={preferences?.gpsAppPreference ?? 'system'}>
          <select
            value={preferences?.gpsAppPreference ?? 'system'}
            className="flex h-9 rounded-xl border border-card-border dark:border-slate-600 dark:bg-slate-700 dark:text-white bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            onChange={(e) => updatePreferencesMutation.mutate({ gpsAppPreference: e.target.value })}
          >
            <option value="system">System Default</option>
            <option value="google">Google Maps</option>
            <option value="apple">Apple Maps</option>
            <option value="waze">Waze</option>
          </select>
        </SettingsRow>

        {/* Shopping Frequency (T19) */}
        <SettingsRow label="Shopping Frequency" value={preferences?.shoppingFrequency ?? 'Not set'}>
          <select
            value={preferences?.shoppingFrequency ?? ''}
            className="flex h-9 rounded-xl border border-card-border dark:border-slate-600 dark:bg-slate-700 dark:text-white bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            onChange={(e) => updatePreferencesMutation.mutate({ shoppingFrequency: e.target.value || null })}
          >
            <option value="">Not set</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
        </SettingsRow>

        {/* Shopping Day (T19) */}
        <SettingsRow label="Preferred Shopping Day" value={preferences?.shoppingDay ?? 'Not set'}>
          <select
            value={preferences?.shoppingDay ?? ''}
            className="flex h-9 rounded-xl border border-card-border dark:border-slate-600 dark:bg-slate-700 dark:text-white bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            onChange={(e) => updatePreferencesMutation.mutate({ shoppingDay: e.target.value || null })}
          >
            <option value="">Not set</option>
            {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
        </SettingsRow>

        {/* Preferred Stores (T17) */}
        <div className="py-3">
          <p className="text-sm font-medium dark:text-slate-100 mb-2 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted" /> Preferred Stores
          </p>
          {preferredStores.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {preferredStores.map((store) => (
                <span key={store} className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium">
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
              placeholder="Search by store name or ZIP"
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStoreSearch()}
              className="flex-1 text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleStoreSearch} disabled={storeSearching}>
              {storeSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>
          {storeResults.length > 0 && (
            <div className="mt-2 rounded-xl border border-card-border dark:border-slate-600 overflow-hidden">
              {storeResults.slice(0, 5).map((store, idx) => (
                <button
                  key={idx}
                  onClick={() => addStore(store.name)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b last:border-0 border-card-border dark:border-slate-600"
                >
                  <div className="text-left">
                    <p className="font-medium dark:text-slate-200">{store.name}</p>
                    <p className="text-[11px] text-muted">{store.address}</p>
                  </div>
                  <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* App Preferences — Pinned Nav (T18) */}
      <SettingsSection icon={LayoutGrid} title="App Preferences">
        <div className="py-3">
          <p className="text-sm font-medium dark:text-slate-100 mb-1">Pinned Navigation</p>
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
                      : 'border-card-border dark:border-slate-600 text-muted dark:text-slate-400 hover:border-primary/30'
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

      {/* Data & Privacy */}
      <SettingsSection icon={Database} title="Data & Privacy">
        <button
          onClick={() => exportDataMutation.mutate()}
          disabled={exportDataMutation.isPending}
          className="w-full flex items-center justify-between py-3 text-sm hover:text-primary transition-colors dark:text-slate-200"
        >
          <span className="flex items-center gap-2">
            <Download className="h-4 w-4 text-muted" /> Export All Data
          </span>
          {exportDataMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4 text-muted" />}
        </button>
        <button
          onClick={() => setShowDeleteAccount(true)}
          className="w-full flex items-center justify-between py-3 text-sm text-accent-danger hover:text-red-700 transition-colors"
        >
          <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete Account</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </SettingsSection>

      {/* About */}
      <SettingsSection icon={Info} title="About">
        <div className="py-2 space-y-1.5 text-sm text-muted">
          <p>Replate Nutrition v1.0.0</p>
          <p className="text-[10px]">AI-powered dietary and nutrition management for your household.</p>
        </div>
      </SettingsSection>

      {/* Logout */}
      <Button variant="outline" className="w-full" onClick={logout}>
        <LogOut className="h-4 w-4" /> Sign Out
      </Button>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-4">
            <div>
              <Label>Current Password</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-accent-danger">Passwords do not match.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePassword(false)}>Cancel</Button>
            <Button
              onClick={() => changePasswordMutation.mutate()}
              disabled={!currentPassword || !newPassword || newPassword !== confirmPassword || changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Notification Disclosure + 6-digit Verification Dialog (T16) */}
      <Dialog open={showEmailDisclosure} onOpenChange={(open) => {
        setShowEmailDisclosure(open);
        if (!open) { setShowCodeInput(false); setVerificationCode(''); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable Email Notifications</DialogTitle>
          </DialogHeader>
          {!showCodeInput ? (
            <>
              <div className="space-y-4 my-4 text-sm text-muted">
                <p>
                  Replate Nutrition can send optional email notifications to <span className="font-medium text-foreground">{user?.email}</span>
                  {' '}for meal reminders, shopping alerts, and price updates tied to your account activity.
                </p>
                <div className="rounded-2xl border border-card-border bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2 text-[13px] leading-6">
                  <p>Message frequency varies based on the notification types you enable and the activity in your account.</p>
                  <p>These emails may reference household planning details and are not medical, nutrition, or veterinary advice.</p>
                  <p>You can turn email notifications off at any time in Settings.</p>
                </div>
                <label className="flex items-start gap-3 rounded-2xl border border-card-border p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    checked={acceptEmailDisclosure}
                    onChange={(e) => setAcceptEmailDisclosure(e.target.checked)}
                  />
                  <span className="text-sm text-foreground dark:text-slate-200">
                    I understand the disclosure above and consent to receive optional Replate Nutrition notification emails at this address.
                  </span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEmailDisclosure(false)}>Cancel</Button>
                <Button
                  onClick={() => requestVerificationMutation.mutate()}
                  disabled={!acceptEmailDisclosure || requestVerificationMutation.isPending}
                >
                  {requestVerificationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send verification code'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 my-4">
                <p className="text-sm text-muted">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{user?.email}</span>. It expires in 5 minutes.
                </p>
                <div>
                  <Label>Verification Code</Label>
                  <Input
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="text-center text-2xl font-bold tracking-widest mt-1"
                    maxLength={6}
                    inputMode="numeric"
                    autoFocus
                  />
                </div>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => requestVerificationMutation.mutate()}
                  disabled={requestVerificationMutation.isPending}
                >
                  Resend code
                </button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowCodeInput(false); setVerificationCode(''); }}>Back</Button>
                <Button
                  onClick={() => verifyCodeMutation.mutate()}
                  disabled={verificationCode.length !== 6 || verifyCodeMutation.isPending}
                >
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
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted my-4">
            This will permanently delete your account and all associated data including profiles, meal plans,
            shopping history, and preferences. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAccount(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteAccountMutation.mutate()}
              disabled={deleteAccountMutation.isPending}
            >
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
              <Input
                type="email"
                placeholder="family@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label>Role</Label>
              <div className="flex gap-2 mt-1">
                {(['MEMBER', 'ADMIN'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setInviteRole(r)}
                    className={cn('flex-1 px-3 py-2 rounded-xl border text-sm transition-colors', inviteRole === r ? 'border-primary bg-primary/5 font-medium' : 'border-card-border')}
                  >
                    {r === 'MEMBER' ? 'Member' : 'Admin'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-1.5">
                {inviteRole === 'ADMIN' ? 'Admins can manage profiles, shopping, and meal planning.' : 'Members can view and contribute to shopping and meal planning.'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>Cancel</Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
            >
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
          <h2 className="text-sm font-semibold dark:text-slate-100">{title}</h2>
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
        <p className="text-sm font-medium dark:text-slate-200">{label}</p>
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
        <p className="text-sm font-medium dark:text-slate-200">{label}</p>
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

