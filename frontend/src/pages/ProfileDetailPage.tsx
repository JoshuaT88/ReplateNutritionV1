import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit, Trash2, Loader2, Star, UtensilsCrossed, Check, Clock, PawPrint, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import type { ActivityLogEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useState } from 'react';

export default function ProfileDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showDelete, setShowDelete] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => api.getProfile(id!),
    enabled: !!id,
  });

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', { profileId: id }],
    queryFn: () => api.getRecommendations(id),
    enabled: !!id,
  });

  const { data: mealPlans } = useQuery({
    queryKey: ['mealPlans', { profileId: id }],
    queryFn: () => api.getMealPlans({ profileId: id }),
    enabled: !!id,
  });

  const { data: activityLogs } = useQuery<ActivityLogEntry[]>({
    queryKey: ['activity', { profileId: id }],
    queryFn: () => api.getActivity({ profileId: id!, limit: 50 }),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProfile(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast('success', 'Profile deleted');
      navigate('/profiles');
    },
    onError: (err: Error) => toast('error', 'Delete failed', err.message),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-12 text-muted">Profile not found.</div>;
  }

  const allTags = [
    ...profile.allergies.map((t) => ({ label: t, variant: 'danger' as const })),
    ...profile.intolerances.map((t) => ({ label: t, variant: 'warning' as const })),
    ...profile.dietaryRestrictions.map((t) => ({ label: t, variant: 'default' as const })),
    ...profile.specialConditions.map((t) => ({ label: t, variant: 'gold' as const })),
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/profiles')} className="flex items-center gap-1 text-sm text-muted hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Profiles
      </button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <UserAvatar name={profile.name} imageUrl={profile.avatarUrl} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-semibold">{profile.name}</h1>
                  <Badge variant={profile.type === 'HUMAN' ? 'default' : 'gold'}>
                    {profile.type === 'HUMAN' ? '🧑 Human' : `🐾 ${profile.petType || 'Pet'}`}
                  </Badge>
                  {profile.dietType && (
                    <Badge variant="secondary" className="text-xs">{profile.dietType}</Badge>
                  )}
                </div>
                {profile.breed && <span className="text-sm text-muted">{profile.breed}</span>}
                {profile.age && <span className="text-sm text-muted ml-3">Age {profile.age}</span>}
                {profile.weight && <span className="text-sm text-muted ml-3">{profile.weight} lbs</span>}

                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {allTags.map((tag) => (
                      <Badge key={tag.label} variant={tag.variant}>{tag.label}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to={`/profiles/${id}/edit`}>
                  <Button variant="outline" size="sm"><Edit className="h-3.5 w-3.5" /> Edit</Button>
                </Link>
                <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="meals">Meal History</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoSection title="Food Preferences" items={profile.foodPreferences} emptyText="No preferences set." />
              <InfoSection title="Food Dislikes" items={profile.foodDislikes} emptyText="No dislikes noted." />
              <InfoSection title="Allergies" items={profile.allergies} emptyText="No allergies." />
              <InfoSection title="Intolerances" items={profile.intolerances} emptyText="No intolerances." />
            </div>
            {profile.type === 'PET' && profile.feedingSchedule && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <PawPrint className="h-3.5 w-3.5 text-primary" /> Feeding Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm text-muted">
                    {profile.feedingSchedule.mealsPerDay && (
                      <span>{profile.feedingSchedule.mealsPerDay} meal{profile.feedingSchedule.mealsPerDay > 1 ? 's' : ''}/day</span>
                    )}
                    {profile.feedingSchedule.amountPerFeeding && (
                      <span>{profile.feedingSchedule.amountPerFeeding} per feeding</span>
                    )}
                    {profile.feedingSchedule.times && profile.feedingSchedule.times.length > 0 && (
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {profile.feedingSchedule.times.join(', ')}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            {profile.notes && (
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted whitespace-pre-wrap">{profile.notes}</p></CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations">
            {!recommendations ? (
              <div className="space-y-3 mt-2">
                {[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-12">
                <Star className="h-8 w-8 text-muted mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted">No recommendations yet for {profile.name}.</p>
                <Link to="/recommendations" className="text-primary text-sm hover:underline">Get recommendations →</Link>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {recommendations.slice(0, 20).map((rec) => (
                  <Card key={rec.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{rec.itemName}</p>
                            <Badge variant="secondary" className="text-[10px]">{rec.itemType}</Badge>
                            <Badge variant="default" className="text-[10px]">{rec.category}</Badge>
                          </div>
                          <p className="text-xs text-muted mt-0.5 line-clamp-2">{rec.reason}</p>
                        </div>
                        {rec.isFavorite && <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {recommendations.length > 20 && (
                  <Link to={`/recommendations?profile=${id}`} className="block text-center text-sm text-primary hover:underline py-2">
                    View all {recommendations.length} recommendations →
                  </Link>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="meals">
            {!mealPlans ? (
              <div className="space-y-3 mt-2">
                {[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              (() => {
                const completed = mealPlans.filter((m) => m.completed);
                return completed.length === 0 ? (
                  <div className="text-center py-12">
                    <UtensilsCrossed className="h-8 w-8 text-muted mx-auto mb-2 opacity-30" />
                    <p className="text-sm text-muted">No completed meals yet for {profile.name}.</p>
                    <Link to="/meal-plan" className="text-primary text-sm hover:underline">Go to Meal Plan →</Link>
                  </div>
                ) : (
                  <div className="space-y-2 mt-2">
                    {completed.slice(0, 30).map((meal) => (
                      <Card key={meal.id}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{meal.mealName}</p>
                            <p className="text-xs text-muted capitalize">
                              {meal.mealType.replace(/_/g, ' ')} · {new Date(meal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                          {meal.calories && <span className="text-xs text-muted shrink-0">{meal.calories} cal</span>}
                        </CardContent>
                      </Card>
                    ))}
                    {completed.length > 30 && (
                      <Link to={`/meal-plan?profile=${id}`} className="block text-center text-sm text-primary hover:underline py-2">
                        View all {completed.length} completed meals →
                      </Link>
                    )}
                  </div>
                );
              })()
            )}
          </TabsContent>

          {/* T50: Activity Log tab */}
          <TabsContent value="activity">
            {!activityLogs ? (
              <div className="space-y-3 mt-2">
                {[1,2,3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-8 w-8 text-muted mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted">No activity recorded yet for {profile.name}.</p>
              </div>
            ) : (
              <div className="space-y-1.5 mt-2">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-card-border bg-card">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">
                        {log.entityType.replace(/_/g, ' ')} {log.action.replace(/_/g, ' ')}
                        {(log.metadata as any)?.mealName && ` — ${(log.metadata as any).mealName}`}
                        {(log.metadata as any)?.itemName && ` — ${(log.metadata as any).itemName}`}
                        {(log.metadata as any)?.name && ` — ${(log.metadata as any).name}`}
                      </p>
                      <p className="text-xs text-muted">{new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Delete dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Profile</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {profile.name}'s profile? This will also remove all their recommendations and meal plans. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoSection({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
          </div>
        ) : (
          <p className="text-xs text-muted">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}
