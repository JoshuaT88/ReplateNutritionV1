import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { motion } from 'framer-motion';
import { Sparkles, Star, ShoppingCart, CalendarDays, Loader2, Trash2, ChevronDown, Search, UtensilsCrossed, Tag, Leaf } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { Recommendation } from '@/types';

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'dessert'];
const PET_CATEGORIES = ['kibble', 'wet_food', 'treats', 'fresh_food', 'supplement'];
const PET_MEAL_TYPES = ['morning_feed', 'evening_feed', 'treat_time'];

export default function RecommendationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filterProfileId, setFilterProfileId] = useState<string>('all');
  const [mealPlanRec, setMealPlanRec] = useState<Recommendation | null>(null);
  const [mealPlanDate, setMealPlanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mealPlanType, setMealPlanType] = useState<string>('');

  const { data: recommendations, isLoading, error, refetch } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api.getRecommendations(),
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.getProfiles(),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.generateRecommendations(selectedProfiles, selectedCategories),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      toast('success', 'Recommendations generated!');
      setShowGenerate(false);
    },
    onError: (err: Error) => toast('error', 'Generation failed', err.message),
  });

  const favoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      api.updateRecommendation(id, { isFavorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      toast('success', 'Recommendation removed');
    },
  });

  const addToListMutation = useMutation({
    mutationFn: (rec: Recommendation) => {
      const isPet = rec.profile?.type === 'PET';
      const isBrand = rec.itemType === 'brand';

      // Brand items (both pet and human): add as a single product
      // Pet brands especially (kibble, canned food, etc.) should NEVER split into ingredients
      if (isBrand || (isPet && (!rec.ingredients || rec.ingredients.length === 0))) {
        return api.addShoppingItem({
          itemName: rec.itemName,
          priority: 'MEDIUM',
          notes: rec.reason,
        }).then((item) => [item]);
      }

      // Fresh food / recipes: add individual ingredients
      if (rec.ingredients && rec.ingredients.length > 0) {
        return api.addIngredientsToList({
          ingredients: rec.ingredients,
          mealName: rec.itemName,
          profileId: rec.profileId,
        });
      }

      // Fallback: add the item itself
      return api.addShoppingItem({
        itemName: rec.itemName,
        priority: 'MEDIUM',
        notes: rec.reason,
      }).then((item) => [item]);
    },
    onSuccess: (_data, rec) => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      const isBrand = rec.itemType === 'brand';
      if (isBrand) {
        toast('success', `Added "${rec.itemName}" to shopping list!`);
      } else {
        const count = rec.ingredients?.length || 1;
        toast('success', `Added ${count} ingredient${count > 1 ? 's' : ''} to shopping list!`);
      }
    },
    onError: (err: Error) => toast('error', 'Failed to add', err.message),
  });

  const addToMealPlanMutation = useMutation({
    mutationFn: ({ rec, date, mealType }: { rec: Recommendation; date: string; mealType: string }) =>
      api.createMealPlan({
        profileId: rec.profileId,
        date,
        mealType: mealType as any,
        mealName: rec.itemName,
        // Brand items (kibble, canned food, etc.) should add as the product title, not ingredients
        ingredients: rec.itemType === 'brand' ? [] : (rec.ingredients || []),
        preparationNotes: rec.reason,
        calories: rec.nutrition?.calories || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      toast('success', 'Added to meal plan!');
      setMealPlanRec(null);
    },
    onError: (err: Error) => toast('error', 'Failed to add to meal plan', err.message),
  });

  const openMealPlanDialog = (rec: Recommendation) => {
    setMealPlanRec(rec);
    setMealPlanDate(new Date().toISOString().split('T')[0]);
    const isPet = rec.profile?.type === 'PET';
    setMealPlanType(isPet ? 'morning_feed' : (rec.category || 'dinner'));
  };

  const filtered = recommendations?.filter((r) => {
    const matchesSearch = r.itemName.toLowerCase().includes(search.toLowerCase()) ||
      r.reason.toLowerCase().includes(search.toLowerCase());
    const matchesProfile = filterProfileId === 'all' || r.profileId === filterProfileId;
    return matchesSearch && matchesProfile;
  });

  const filterByType = (type: string) =>
    filtered?.filter((r) => type === 'all' || r.itemType === type) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recommendations</h1>
          <p className="text-sm text-muted mt-0.5">AI-generated food and product suggestions for your profiles.</p>
        </div>
        <Button onClick={() => setShowGenerate(true)}>
          <Sparkles className="h-4 w-4" /> Generate
        </Button>
      </div>

      {/* Search + Profile filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recommendations..."
            className="flex h-10 w-full rounded-xl border border-card-border bg-white pl-9 pr-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterProfileId('all')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all',
              filterProfileId === 'all'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-card-border text-muted hover:border-slate-300'
            )}
          >
            All Profiles
          </button>
          {profiles?.map((p) => (
            <button
              key={p.id}
              onClick={() => setFilterProfileId(p.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all',
                filterProfileId === p.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-card-border text-muted hover:border-slate-300'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorCard onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-card-border bg-white p-5">
              <Skeleton className="h-5 w-40 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-4" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({filtered?.length || 0})</TabsTrigger>
            <TabsTrigger value="food">Foods</TabsTrigger>
            <TabsTrigger value="brand">Brands</TabsTrigger>
            <TabsTrigger value="recipe">Recipes</TabsTrigger>
          </TabsList>

          {['all', 'food', 'brand', 'recipe'].map((type) => (
            <TabsContent key={type} value={type}>
              {filterByType(type).length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filterByType(type).map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      rec={rec}
                      onFavorite={() => favoriteMutation.mutate({ id: rec.id, isFavorite: !rec.isFavorite })}
                      onDelete={() => deleteMutation.mutate(rec.id)}
                      onAddToList={() => addToListMutation.mutate(rec)}
                      onAddToMealPlan={() => openMealPlanDialog(rec)}
                      isAddingToList={addToListMutation.isPending}
                      isAddingToMealPlan={addToMealPlanMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title="No recommendations yet"
                  description="Generate personalized food recommendations for your profiles."
                  actionLabel="Generate now"
                  onAction={() => setShowGenerate(true)}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Generate dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Recommendations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div>
              <p className="text-sm font-medium mb-2">Select profiles</p>
              <div className="flex flex-wrap gap-2">
                {profiles?.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfiles((s) =>
                      s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]
                    )}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all',
                      selectedProfiles.includes(p.id)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-card-border text-muted hover:border-slate-300'
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Meal categories</p>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const selectedProfileObjs = profiles?.filter((p) => selectedProfiles.includes(p.id)) || [];
                  const hasPets = selectedProfileObjs.some((p) => p.type === 'PET');
                  const hasHumans = selectedProfileObjs.some((p) => p.type === 'HUMAN');
                  const cats = [
                    ...(hasHumans || selectedProfiles.length === 0 ? CATEGORIES : []),
                    ...(hasPets ? PET_CATEGORIES : []),
                  ];
                  return cats.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategories((s) =>
                        s.includes(cat) ? s.filter((x) => x !== cat) : [...s, cat]
                      )}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all capitalize',
                        selectedCategories.includes(cat)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-card-border text-muted hover:border-slate-300'
                      )}
                    >
                      {cat.replace('_', ' ')}
                    </button>
                  ));
                })()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || selectedProfiles.length === 0 || selectedCategories.length === 0}
            >
              {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meal Plan Date/Type Picker Dialog */}
      <Dialog open={!!mealPlanRec} onOpenChange={(open) => !open && setMealPlanRec(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Meal Plan</DialogTitle>
          </DialogHeader>
          {mealPlanRec && (
            <div className="space-y-4 my-4">
              <p className="text-sm text-muted">
                Schedule <span className="font-semibold text-foreground">{mealPlanRec.itemName}</span> for a meal.
              </p>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date</label>
                <input
                  type="date"
                  value={mealPlanDate}
                  onChange={(e) => setMealPlanDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex h-10 w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Meal type</label>
                <div className="flex flex-wrap gap-2">
                  {(mealPlanRec.profile?.type === 'PET' ? PET_MEAL_TYPES : CATEGORIES).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setMealPlanType(cat)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all capitalize',
                        mealPlanType === cat
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-card-border text-muted hover:border-slate-300'
                      )}
                    >
                      {cat.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMealPlanRec(null)}>Cancel</Button>
            <Button
              onClick={() => mealPlanRec && addToMealPlanMutation.mutate({ rec: mealPlanRec, date: mealPlanDate, mealType: mealPlanType })}
              disabled={addToMealPlanMutation.isPending || !mealPlanDate || !mealPlanType}
            >
              {addToMealPlanMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding...</> : <><CalendarDays className="h-4 w-4" /> Add to Plan</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecommendationCard({ rec, onFavorite, onDelete, onAddToList, onAddToMealPlan, isAddingToList, isAddingToMealPlan }: {
  rec: Recommendation;
  onFavorite: () => void;
  onDelete: () => void;
  onAddToList: () => void;
  onAddToMealPlan: () => void;
  isAddingToList: boolean;
  isAddingToMealPlan: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-sm line-clamp-1 flex-1">{rec.itemName}</h3>
            <button onClick={onFavorite} className="ml-2 shrink-0">
              <Star className={cn('h-4 w-4 transition-colors', rec.isFavorite ? 'fill-accent-gold text-accent-gold' : 'text-slate-300 hover:text-accent-gold')} />
            </button>
          </div>

          <div className="flex items-center gap-1.5 mb-3">
            <Badge variant="secondary" className="text-[10px] capitalize">{rec.itemType}</Badge>
            <Badge className="text-[10px] capitalize">{rec.category}</Badge>
            {rec.priceRange && <span className="text-[10px] text-muted font-mono">{rec.priceRange}</span>}
            {rec.profile && <Badge variant="outline" className="text-[10px]">{rec.profile.name}</Badge>}
          </div>

          <p className={cn('text-xs text-muted leading-relaxed', !expanded && 'line-clamp-3')}>
            {rec.reason}
          </p>
          {rec.reason.length > 120 && (
            <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-primary mt-1 flex items-center gap-0.5">
              {expanded ? 'Less' : 'More'} <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}

          {/* Nutrition info */}
          {rec.nutrition && (
            <div className="flex flex-wrap gap-1 mt-3">
              {rec.nutrition.calories && <Badge variant="outline" className="text-[10px]">{rec.nutrition.calories} cal</Badge>}
              {rec.nutrition.protein && <Badge variant="outline" className="text-[10px]">{rec.nutrition.protein} protein</Badge>}
              {rec.nutrition.fiber && <Badge variant="outline" className="text-[10px]">{rec.nutrition.fiber} fiber</Badge>}
              {rec.nutrition.keyNutrients?.slice(0, 3).map((n) => (
                <Badge key={n} variant="outline" className="text-[10px] flex items-center gap-0.5">
                  <Leaf className="h-2.5 w-2.5" /> {n}
                </Badge>
              ))}
            </div>
          )}

          {rec.texture && (
            <p className="text-[10px] text-muted mt-2 italic">Texture: {rec.texture}</p>
          )}

          {/* Ingredients (for recipes and foods) */}
          {rec.ingredients && rec.ingredients.length > 0 && (
            <div className="mt-3 pt-2 border-t border-card-border">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <UtensilsCrossed className="h-3 w-3" /> Ingredients ({rec.ingredients.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {rec.ingredients.slice(0, expanded ? undefined : 6).map((ing) => (
                  <Badge key={ing} variant="outline" className="text-[10px] font-normal">{ing}</Badge>
                ))}
                {!expanded && rec.ingredients.length > 6 && (
                  <button onClick={() => setExpanded(true)} className="text-[10px] text-primary">
                    +{rec.ingredients.length - 6} more
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Alternatives */}
          {rec.alternatives && rec.alternatives.length > 0 && expanded && (
            <div className="mt-2 pt-2 border-t border-card-border">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <Tag className="h-3 w-3" /> Alternatives
              </p>
              <div className="flex flex-wrap gap-1">
                {rec.alternatives.map((alt) => (
                  <Badge key={alt} variant="secondary" className="text-[10px] font-normal">{alt}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-card-border">
            <Button
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={onAddToList}
              disabled={isAddingToList}
            >
              {isAddingToList
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <><ShoppingCart className="h-3 w-3" /> Add to List</>
              }
            </Button>
            <Button
              size="sm"
              variant="success"
              className="flex-1 text-xs h-8"
              onClick={onAddToMealPlan}
              disabled={isAddingToMealPlan}
            >
              {isAddingToMealPlan
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <><CalendarDays className="h-3 w-3" /> Meal Plan</>
              }
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 text-muted hover:text-accent-danger" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
