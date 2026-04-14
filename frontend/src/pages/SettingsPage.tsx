import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Shield, Bell, Database, Info, LogOut, Trash2, Download,
  Lock, Mail, MapPin, Loader2, ChevronRight, Moon, Sun
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
              <p className="text-sm font-medium">{user?.name || 'Your Name'}</p>
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
          <SettingsRow label="Weekly Budget" value={preferences?.budget ? `$${preferences.budget}` : 'Not set'}>
            <Input
              type="number"
              placeholder="150"
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
        <ToggleRow
          label="Meal plan reminders"
          description="Daily reminder to check your planned meals"
          value={preferences?.mealReminders ?? true}
          onChange={(v) => updatePreferencesMutation.mutate({ mealReminders: v })}
        />
        <ToggleRow
          label="Shopping list alerts"
          description="Notify when items are added to your list"
          value={preferences?.shoppingAlerts ?? true}
          onChange={(v) => updatePreferencesMutation.mutate({ shoppingAlerts: v })}
        />
        <ToggleRow
          label="Price drop notifications"
          description="Alert when tracked items drop in price"
          value={preferences?.priceDropAlerts ?? false}
          onChange={(v) => updatePreferencesMutation.mutate({ priceDropAlerts: v })}
        />
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

function ToggleRow({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[10px] text-muted">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors duration-200',
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
