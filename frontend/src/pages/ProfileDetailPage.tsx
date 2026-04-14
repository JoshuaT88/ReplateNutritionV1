import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit, Trash2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
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
                </div>
                {profile.age && <span className="text-sm text-muted">Age {profile.age}</span>}
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
          </TabsList>

          <TabsContent value="overview">
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoSection title="Food Preferences" items={profile.foodPreferences} emptyText="No preferences set." />
              <InfoSection title="Food Dislikes" items={profile.foodDislikes} emptyText="No dislikes noted." />
              <InfoSection title="Allergies" items={profile.allergies} emptyText="No allergies." />
              <InfoSection title="Intolerances" items={profile.intolerances} emptyText="No intolerances." />
            </div>
            {profile.notes && (
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted whitespace-pre-wrap">{profile.notes}</p></CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations">
            <p className="text-sm text-muted py-8 text-center">
              View this profile's recommendations on the{' '}
              <Link to={`/recommendations?profile=${id}`} className="text-primary hover:underline">Recommendations page</Link>.
            </p>
          </TabsContent>

          <TabsContent value="meals">
            <p className="text-sm text-muted py-8 text-center">
              View this profile's meal history on the{' '}
              <Link to={`/meal-plan?profile=${id}`} className="text-primary hover:underline">Meal Plan page</Link>.
            </p>
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
