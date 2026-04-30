import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  UsersRound, UserPlus, Check, X, ChevronDown, ChevronUp,
  Clock, Mail, ShieldCheck, Shield, User, Loader2, Trash2,
  MessageSquare, UtensilsCrossed, ShoppingCart, CheckCircle2, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import type { Household, HouseholdMember } from '@/types';

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } };

const PERM_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', profiles: 'Nutrition Profiles', mealPlan: 'Meal Plan',
  shopping: 'Shopping', budget: 'Budget', recommendations: 'Recommendations',
  pantry: 'Pantry', settings: 'Settings',
};

const ALL_PERMS = Object.keys(PERM_LABELS);

function RoleBadge({ role }: { role: string }) {
  if (role === 'OWNER') return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 text-[10px]">Owner</Badge>;
  if (role === 'ADMIN') return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-[10px]">Admin</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Member</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACCEPTED') return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] gap-1"><Check className="h-2.5 w-2.5" />Active</Badge>;
  if (status === 'DECLINED') return <Badge className="bg-red-100 text-red-700 text-[10px]">Declined</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] gap-1"><Clock className="h-2.5 w-2.5" />Pending</Badge>;
}

function PermissionsModal({ member, onClose, householdId }: { member: HouseholdMember; onClose: () => void; householdId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [perms, setPerms] = useState<Record<string, boolean>>(
    member.permissions ?? ALL_PERMS.reduce((acc, k) => ({ ...acc, [k]: true }), {})
  );

  const mutation = useMutation({
    mutationFn: () => api.updateMemberPermissions(member.id, perms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household'] });
      toast('success', 'Permissions updated');
      onClose();
    },
    onError: () => toast('error', 'Failed to update permissions'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permissions — {member.user?.fullName ?? member.inviteEmail}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 my-4">
          {ALL_PERMS.map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!perms[key]}
                onChange={(e) => setPerms((p) => ({ ...p, [key]: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">{PERM_LABELS[key]}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuggestionReviewModal({ suggestion, onClose }: { suggestion: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [adminNotes, setAdminNotes] = useState('');

  const mutation = useMutation({
    mutationFn: (status: 'APPROVED' | 'DENIED') => api.reviewSuggestion(suggestion.id, status, adminNotes.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      toast('success', 'Response sent');
      onClose();
    },
    onError: () => toast('error', 'Failed to respond to suggestion'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 my-2">
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted uppercase tracking-wide">{suggestion.type === 'meal' ? 'Meal suggestion' : 'Shopping request'}</p>
            <p className="font-medium">{suggestion.title}</p>
            {suggestion.details && <p className="text-sm text-muted">{suggestion.details}</p>}
            <p className="text-xs text-muted">From: {suggestion.requestedByUser?.fullName ?? suggestion.requestedByUser?.email}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Note to member (optional)</label>
            <Input
              placeholder="e.g. Already planned for Thursday!"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => mutation.mutate('DENIED')}
            disabled={mutation.isPending}
          >
            <XCircle className="h-4 w-4" /> Decline
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => mutation.mutate('APPROVED')}
            disabled={mutation.isPending}
          >
            <CheckCircle2 className="h-4 w-4" /> Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HouseholdPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [showInvite, setShowInvite] = useState(false);
  const [permsMember, setPermsMember] = useState<HouseholdMember | null>(null);
  const [reviewSuggestion, setReviewSuggestion] = useState<any | null>(null);
  const [suggestionFilter, setSuggestionFilter] = useState<'all' | 'pending' | 'answered'>('pending');
  const [showMySuggestion, setShowMySuggestion] = useState(false);
  const [myTitle, setMyTitle] = useState('');
  const [myType, setMyType] = useState<'meal' | 'shopping_item'>('meal');
  const [myDetails, setMyDetails] = useState('');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const { data: household, isLoading } = useQuery({
    queryKey: ['household'],
    queryFn: () => api.getHousehold(),
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => api.getSuggestions(),
    enabled: household?.ownerId === user?.id,
  });

  const { data: mySuggestions = [] } = useQuery({
    queryKey: ['mySuggestions'],
    queryFn: () => api.getMySuggestions(),
    enabled: household?.ownerId !== user?.id,
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.inviteHouseholdMember(inviteEmail, inviteRole),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['household'] });
      toast('success', `Invite sent to ${inviteEmail}`, `Invite link: ${data.inviteUrl}`);
      setInviteEmail('');
      setShowInvite(false);
    },
    onError: (err: Error) => toast('error', 'Failed to send invite', err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => api.removeHouseholdMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household'] });
      toast('success', 'Member removed');
    },
    onError: () => toast('error', 'Failed to remove member'),
  });

  const createHouseholdMutation = useMutation({
    mutationFn: () => api.createHousehold('My Household'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household'] });
      toast('success', 'Household created!');
    },
    onError: (err: Error) => toast('error', 'Failed to create household', err.message),
  });

  const submitSuggestionMutation = useMutation({
    mutationFn: () => api.createSuggestion(myType, myTitle.trim(), myDetails.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySuggestions'] });
      toast('success', 'Request submitted!');
      setMyTitle('');
      setMyDetails('');
      setShowMySuggestion(false);
    },
    onError: (err: Error) => toast('error', 'Failed to submit request', err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOwner = household?.ownerId === user?.id;
  const acceptedMembers = household?.members?.filter((m) => m.inviteStatus === 'ACCEPTED') ?? [];
  const pendingInvites = household?.members?.filter((m) => m.inviteStatus === 'PENDING') ?? [];
  const pendingSuggestions = (suggestions as any[]).filter((s) => s.status === 'PENDING');

  // Member sees their membership info
  const myMembership = household?.members?.find((m) => m.userId === user?.id);

  // No household yet
  if (!household) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <UsersRound className="h-12 w-12 mx-auto text-muted" />
        <h1 className="text-xl font-semibold">No Household Yet</h1>
        <p className="text-sm text-muted">Create a household to invite family members and manage shared meal plans and shopping lists.</p>
        <Button onClick={() => createHouseholdMutation.mutate()} disabled={createHouseholdMutation.isPending}>
          {createHouseholdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UsersRound className="h-4 w-4" /> Create Household</>}
        </Button>
      </div>
    );
  }

  const filteredSuggestions = (suggestions as any[]).filter((s) => {
    if (suggestionFilter === 'pending') return s.status === 'PENDING';
    if (suggestionFilter === 'answered') return s.status !== 'PENDING';
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 lg:pb-8">
      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{household.name}</h1>
          <p className="text-sm text-muted mt-0.5">{acceptedMembers.length} active member{acceptedMembers.length !== 1 ? 's' : ''}</p>
        </div>
        {isOwner && (
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4" /> Invite
          </Button>
        )}
      </motion.div>

      {/* Owner: Pending Suggestions Banner */}
      {isOwner && pendingSuggestions.length > 0 && (
        <motion.div {...fadeUp}>
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-amber-800 dark:text-amber-300">
                    {pendingSuggestions.length} pending request{pendingSuggestions.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Family members are waiting for your response</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Members List */}
      <motion.div {...fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UsersRound className="h-4 w-4" /> Members
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {[...acceptedMembers, ...pendingInvites].map((member) => {
              const memberProfiles = profiles?.filter((p) => p.userId === member.userId) ?? [];
              const isExpanded = expandedMemberId === member.id;
              return (
                <div key={member.id} className="border-t first:border-t-0">
                  <button
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {member.user?.fullName ?? member.inviteEmail}
                      </p>
                      <p className="text-xs text-muted truncate">{member.inviteEmail}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <RoleBadge role={member.role} />
                      <StatusBadge status={member.inviteStatus} />
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 space-y-3 bg-muted/20">
                      {memberProfiles.length > 0 && (
                        <div>
                          <p className="text-[11px] font-medium text-muted uppercase tracking-wide mb-1.5">Nutrition Profiles</p>
                          <div className="flex flex-wrap gap-1.5">
                            {memberProfiles.map((p) => (
                              <Badge key={p.id} variant="secondary" className="text-xs">{p.name}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {member.permissions && (
                        <div>
                          <p className="text-[11px] font-medium text-muted uppercase tracking-wide mb-1.5">Permissions</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(member.permissions).filter(([, v]) => v).map(([k]) => (
                              <Badge key={k} variant="secondary" className="text-[10px]">{PERM_LABELS[k] ?? k}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {isOwner && member.userId !== user?.id && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPermsMember(member)}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Edit Permissions
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200"
                            onClick={() => removeMutation.mutate(member.id)}
                            disabled={removeMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {household.members.length === 0 && (
              <div className="p-6 text-center text-muted text-sm">
                No members yet. Invite someone to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Owner: Suggestions Panel */}
      {isOwner && (
        <motion.div {...fadeUp}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Family Requests
                </CardTitle>
                <div className="flex gap-1">
                  {(['pending', 'answered', 'all'] as const).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={suggestionFilter === f ? 'default' : 'ghost'}
                      className="text-xs h-7 px-2 capitalize"
                      onClick={() => setSuggestionFilter(f)}
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredSuggestions.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted">No {suggestionFilter === 'all' ? '' : suggestionFilter + ' '}requests</div>
              ) : (
                filteredSuggestions.map((s: any) => (
                  <div key={s.id} className="flex items-start gap-3 p-4 border-t first:border-t-0 hover:bg-muted/20">
                    <div className="mt-0.5 shrink-0">
                      {s.type === 'meal'
                        ? <UtensilsCrossed className="h-4 w-4 text-indigo-500" />
                        : <ShoppingCart className="h-4 w-4 text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{s.title}</p>
                      {s.details && <p className="text-xs text-muted mt-0.5">{s.details}</p>}
                      <p className="text-xs text-muted mt-1">
                        From {s.requestedByUser?.fullName ?? 'member'} ·{' '}
                        {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                      {s.adminNotes && (
                        <p className="text-xs italic text-muted mt-0.5">Note: {s.adminNotes}</p>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {s.status === 'PENDING' ? (
                        <Button size="sm" variant="outline" onClick={() => setReviewSuggestion(s)} className="text-xs h-7">
                          Review
                        </Button>
                      ) : (
                        <Badge className={s.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700 text-[10px]'
                          : 'bg-red-100 text-red-700 text-[10px]'}>
                          {s.status === 'APPROVED' ? 'Approved' : 'Declined'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Member: My Requests */}
      {!isOwner && myMembership && (
        <motion.div {...fadeUp}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> My Requests
                </CardTitle>
                <Button size="sm" onClick={() => setShowMySuggestion(true)}>
                  <MessageSquare className="h-3.5 w-3.5" /> New Request
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(mySuggestions as any[]).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted">No requests yet. Submit a meal suggestion or shopping request!</div>
              ) : (
                (mySuggestions as any[]).map((s: any) => (
                  <div key={s.id} className="flex items-start gap-3 p-4 border-t first:border-t-0">
                    <div className="mt-0.5 shrink-0">
                      {s.type === 'meal'
                        ? <UtensilsCrossed className="h-4 w-4 text-indigo-500" />
                        : <ShoppingCart className="h-4 w-4 text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{s.title}</p>
                      {s.details && <p className="text-xs text-muted">{s.details}</p>}
                      {s.adminNotes && (
                        <p className="text-xs italic text-blue-600 dark:text-blue-400 mt-0.5">Organizer note: {s.adminNotes}</p>
                      )}
                    </div>
                    <Badge className={
                      s.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-700 text-[10px] shrink-0'
                        : s.status === 'DENIED'
                          ? 'bg-red-100 text-red-700 text-[10px] shrink-0'
                          : 'bg-amber-100 text-amber-700 text-[10px] shrink-0'
                    }>
                      {s.status === 'APPROVED' ? 'Approved' : s.status === 'DENIED' ? 'Declined' : 'Pending'}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-4">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Email address</label>
              <Input
                type="email"
                placeholder="family@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Role</label>
              <select
                className="border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER')}
              >
                <option value="MEMBER">Member (view + suggest only)</option>
                <option value="ADMIN">Admin (can manage household)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail.includes('@') || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4" /> Send Invite</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* My Suggestion Dialog */}
      <Dialog open={showMySuggestion} onOpenChange={setShowMySuggestion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit a Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-4">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Type</label>
              <select
                className="border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary"
                value={myType}
                onChange={(e) => setMyType(e.target.value as 'meal' | 'shopping_item')}
              >
                <option value="meal">Meal suggestion</option>
                <option value="shopping_item">Shopping request</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">
                {myType === 'meal' ? 'Meal name' : 'Item name'} *
              </label>
              <Input
                placeholder={myType === 'meal' ? 'e.g. Taco Tuesday' : 'e.g. Oat milk'}
                value={myTitle}
                onChange={(e) => setMyTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Details (optional)</label>
              <Input
                placeholder="Any notes or preferences..."
                value={myDetails}
                onChange={(e) => setMyDetails(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMySuggestion(false)}>Cancel</Button>
            <Button
              onClick={() => submitSuggestionMutation.mutate()}
              disabled={!myTitle.trim() || submitSuggestionMutation.isPending}
            >
              {submitSuggestionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Modal */}
      {permsMember && household && (
        <PermissionsModal
          member={permsMember}
          householdId={household.id}
          onClose={() => setPermsMember(null)}
        />
      )}

      {/* Review Suggestion Modal */}
      {reviewSuggestion && (
        <SuggestionReviewModal
          suggestion={reviewSuggestion}
          onClose={() => setReviewSuggestion(null)}
        />
      )}
    </div>
  );
}
