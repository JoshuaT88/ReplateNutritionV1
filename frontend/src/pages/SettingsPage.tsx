import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Shield, Bell, Database, Info, LogOut, Trash2, Download,
  Lock, Loader2, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showEmailDisclosure, setShowEmailDisclosure] = useState(false);
  const [acceptEmailDisclosure, setAcceptEmailDisclosure] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

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
      toast('success', 'Preferences updated');
    },
    onError: (err: Error) => toast('error', 'Failed to update preferences', err.message),
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: () => api.sendTestNotificationEmail(),
    onSuccess: () => toast('success', 'Test email sent', `Sent to ${user?.email}`),
    onError: (err: Error) => toast('error', 'Failed to send test email', err.message),
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

  const deleteAccountMutation = useMutation({
    mutationFn: () => api.deleteAccount(),
    onSuccess: () => logout(),
  });

  const emailNotificationsEnabled = preferences?.emailNotificationsEnabled ?? false;
  const emailDisclosureAccepted = preferences?.emailNotificationsDisclosureAccepted ?? false;
  const emailConsentDate = preferences?.emailNotificationsDisclosureAcceptedAt
    ? new Date(preferences.emailNotificationsDisclosureAcceptedAt).toLocaleDateString()
    : null;

  const handleEmailNotificationsToggle = (nextValue: boolean) => {
    if (!nextValue) {
      updatePreferencesMutation.mutate({ emailNotificationsEnabled: false });
      return;
    }

    if (emailDisclosureAccepted) {
      updatePreferencesMutation.mutate({ emailNotificationsEnabled: true });
      return;
    }

    setAcceptEmailDisclosure(false);
    setShowEmailDisclosure(true);
  };

  const enableEmailNotifications = () => {
    updatePreferencesMutation.mutate({
      emailNotificationsEnabled: true,
      emailNotificationsDisclosureAccepted: true,
      emailNotificationsDisclosureAcceptedAt: new Date().toISOString(),
    });
    setShowEmailDisclosure(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your account and preferences.</p>
      </div>

      {/* Account */}
      <SettingsSection icon={User} title="Account">
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">{user?.fullName || 'Your Name'}</p>
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
          </SettingsRow>
          <SettingsRow label="Timezone" value={preferences?.timezone || 'America/New_York'}>
            <select
              defaultValue={preferences?.timezone || 'America/New_York'}
              className="flex h-9 rounded-xl border border-card-border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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

      {/* Security */}
      <SettingsSection icon={Shield} title="Security">
        <button
          onClick={() => setShowChangePassword(true)}
          className="w-full flex items-center justify-between py-3 text-sm hover:text-primary transition-colors"
        >
          <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-muted" /> Change Password</span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </button>
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

          <div className="rounded-2xl border border-card-border bg-slate-50 px-4 py-3 text-xs text-muted space-y-2">
            <p>
              Email notifications are optional and sent to <span className="font-medium text-foreground">{user?.email}</span>.
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

      {/* Data & Privacy */}
      <SettingsSection icon={Database} title="Data & Privacy">
        <button
          onClick={() => exportDataMutation.mutate()}
          disabled={exportDataMutation.isPending}
          className="w-full flex items-center justify-between py-3 text-sm hover:text-primary transition-colors"
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

      <Dialog open={showEmailDisclosure} onOpenChange={setShowEmailDisclosure}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable Email Notifications</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4 text-sm text-muted">
            <p>
              Replate Nutrition can send optional email notifications to <span className="font-medium text-foreground">{user?.email}</span>
              for meal reminders, shopping alerts, and price updates tied to your account activity.
            </p>
            <div className="rounded-2xl border border-card-border bg-slate-50 p-4 space-y-2 text-[13px] leading-6">
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
              <span className="text-sm text-foreground">
                I understand the disclosure above and consent to receive optional Replate Nutrition notification emails at this address.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDisclosure(false)}>Cancel</Button>
            <Button onClick={enableEmailNotifications} disabled={!acceptEmailDisclosure || updatePreferencesMutation.isPending}>
              {updatePreferencesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept and enable'}
            </Button>
          </DialogFooter>
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
    </div>
  );
}

function SettingsSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <div className="divide-y divide-card-border">{children}</div>
      </CardContent>
    </Card>
  );
}

function SettingsRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
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
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[10px] text-muted">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors duration-200 disabled:cursor-not-allowed',
          value ? 'bg-primary' : 'bg-slate-200'
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
