import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, ChefHat, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Recipe } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

export default function RecipesPage() {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [servings, setServings] = useState(4);

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['recipe-categories'],
    queryFn: () => api.getRecipeCategories(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const {
    data: results = [],
    isFetching: searching,
  } = useQuery<Recipe[]>({
    queryKey: ['recipes', 'search', searchQuery],
    queryFn: () => api.searchRecipes(searchQuery),
    enabled: searchQuery.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const addToListMutation = useMutation({
    mutationFn: ({ id, servings }: { id: string; servings: number }) =>
      api.addRecipeToList(id, { servings }),
    onSuccess: (data) => {
      toast('success', data.message);
      setSelectedRecipe(null);
    },
    onError: (e: any) => toast('error', e.message),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearchQuery(searchInput.trim());
  };

  function handleCategoryClick(cat: string) {
    setSearchInput(cat);
    setSearchQuery(cat);
  }

  const recipes = searchQuery ? results : [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Recipes</h1>
        <p className="text-sm text-text-secondary mt-0.5">Search meals and add ingredients to your list</p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search recipes, e.g. 'chicken pasta'"
          className="flex-1"
        />
        <Button type="submit" disabled={searching}>
          <Search className="h-4 w-4 mr-1" />
          Search
        </Button>
      </form>

      {/* Category pills — show when no search active */}
      {!searchQuery && (
        <div>
          <p className="text-sm font-medium text-text-secondary mb-2">Browse by category</p>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 16).map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className="px-3 py-1 rounded-full text-sm bg-surface-hover border border-card-border hover:bg-primary hover:text-white transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searching && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map((n) => <Skeleton key={n} className="h-36 rounded-xl" />)}
        </div>
      )}

      {!searching && recipes.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <ChefHat className="h-12 w-12 mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary">No recipes found for "{searchQuery}"</p>
          <p className="text-text-muted text-sm mt-1">Try a different search term or browse a category above.</p>
        </div>
      )}

      {!searching && recipes.length === 0 && !searchQuery && (
        <div className="text-center py-12">
          <ChefHat className="h-12 w-12 mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary">Search for a meal or browse a category</p>
        </div>
      )}

      {recipes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {recipes.map((recipe) => (
            <button
              key={recipe.externalId || recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
              className="text-left rounded-xl overflow-hidden border border-card-border bg-surface hover:shadow-md transition-shadow"
            >
              {recipe.thumbnail ? (
                <img src={recipe.thumbnail} alt={recipe.name} className="w-full h-28 object-cover" />
              ) : (
                <div className="w-full h-28 bg-surface-hover flex items-center justify-center">
                  <ChefHat className="h-8 w-8 text-text-muted" />
                </div>
              )}
              <div className="p-2">
                <p className="text-sm font-medium text-text-primary line-clamp-2">{recipe.name}</p>
                {recipe.category && (
                  <p className="text-xs text-text-muted mt-0.5">{recipe.category}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Recipe Detail Dialog */}
      <Dialog open={!!selectedRecipe} onOpenChange={(v) => !v && setSelectedRecipe(null)}>
        {selectedRecipe && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            {selectedRecipe.thumbnail && (
              <img src={selectedRecipe.thumbnail} alt={selectedRecipe.name} className="w-full h-48 object-cover rounded-xl mb-4" />
            )}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 className="text-xl font-bold text-text-primary">{selectedRecipe.name}</h2>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {selectedRecipe.category && <Badge variant="secondary">{selectedRecipe.category}</Badge>}
                  {selectedRecipe.cuisine && <Badge variant="outline">{selectedRecipe.cuisine}</Badge>}
                </div>
              </div>
              <button onClick={() => setSelectedRecipe(null)} className="text-text-muted hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold text-text-primary text-sm mb-2">
                Ingredients ({selectedRecipe.ingredients.length})
              </h3>
              <ul className="space-y-1">
                {selectedRecipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="text-text-primary">{ing.name}</span>
                    <span className="text-text-secondary ml-4 shrink-0">{ing.measure}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-3 mb-4 p-3 bg-surface-hover rounded-xl">
              <label className="text-sm font-medium text-text-secondary">Servings:</label>
              <div className="flex items-center gap-2">
                <button
                  className="w-7 h-7 rounded-full border border-card-border flex items-center justify-center text-sm"
                  onClick={() => setServings((s) => Math.max(1, s - 1))}
                >−</button>
                <span className="text-sm font-bold w-6 text-center">{servings}</span>
                <button
                  className="w-7 h-7 rounded-full border border-card-border flex items-center justify-center text-sm"
                  onClick={() => setServings((s) => s + 1)}
                >+</button>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => addToListMutation.mutate({
                id: (selectedRecipe.externalId || selectedRecipe.id)!,
                servings,
              })}
              disabled={addToListMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              {addToListMutation.isPending ? 'Adding...' : `Add ${selectedRecipe.ingredients.length} Ingredients to List`}
            </Button>

            {selectedRecipe.instructions && (
              <div className="mt-4">
                <h3 className="font-semibold text-text-primary text-sm mb-2">Instructions</h3>
                <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
                  {selectedRecipe.instructions}
                </p>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
