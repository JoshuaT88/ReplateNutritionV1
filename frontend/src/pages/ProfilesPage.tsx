import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ErrorCard } from '@/components/shared/ErrorCard';

export default function ProfilesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: profiles, isLoading, error, refetch } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
  });

  const filtered = profiles?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Nutrition Profiles</h1>
          <p className="text-sm text-muted mt-0.5">Manage nutrition profiles for your household.</p>
        </div>
        <Link to="/profiles/new">
          <Button><Plus className="h-4 w-4" /> Add Nutrition Profile</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search profiles..."
          className="pl-9"
        />
      </div>

      {error ? (
        <ErrorCard onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-card-border bg-white dark:bg-[#1F2937] dark:border-[#374151] p-5">
              <Skeleton className="w-14 h-14 rounded-xl mb-3" />
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : filtered?.length ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {filtered.map((profile, i) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/profiles/${profile.id}`}>
                <div className="group rounded-2xl border border-card-border bg-white dark:bg-[#1F2937] dark:border-[#374151] p-5 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200">
                  <UserAvatar name={profile.name} imageUrl={profile.avatarUrl} size="lg" className="mb-3" />
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{profile.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={profile.type === 'HUMAN' ? 'default' : 'gold'} className="text-[10px]">
                      {profile.type === 'HUMAN' ? '🧑 Human' : `🐾 ${profile.petType || 'Pet'}`}
                    </Badge>
                    {profile.age && <span className="text-xs text-muted">Age {profile.age}</span>}
                  </div>
                  {profile.dietaryRestrictions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {profile.dietaryRestrictions.slice(0, 3).map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                      ))}
                      {profile.dietaryRestrictions.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">+{profile.dietaryRestrictions.length - 3}</Badge>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <EmptyState
          icon={Users}
          title="No profiles yet"
          description="Create a profile for each person or pet in your household to get personalized recommendations."
          actionLabel="Create first profile"
          onAction={() => navigate('/profiles/new')}
        />
      )}
    </div>
  );
}
