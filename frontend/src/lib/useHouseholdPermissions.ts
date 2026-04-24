import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { HouseholdPermissions } from '@/types';

const ALL_ALLOWED: HouseholdPermissions = {
  dashboard: true, profiles: true, mealPlan: true, shopping: true,
  budget: true, recommendations: true, pantry: true, settings: true,
};

/**
 * Returns household permissions for the current user.
 * If the user is NOT a household member (i.e. they own their own household or have no household),
 * all permissions default to true.
 */
export function useHouseholdPermissions(): HouseholdPermissions {
  const { data } = useQuery({
    queryKey: ['householdPermissions'],
    queryFn: () => api.getMyHouseholdPermissions(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  if (!data || !data.permissions) return ALL_ALLOWED;
  // OWNER always gets full access even if stored permissions are partial
  if (data.role === 'OWNER') return ALL_ALLOWED;

  return {
    dashboard: data.permissions.dashboard ?? true,
    profiles: data.permissions.profiles ?? false,
    mealPlan: data.permissions.mealPlan ?? true,
    shopping: data.permissions.shopping ?? true,
    budget: data.permissions.budget ?? false,
    recommendations: data.permissions.recommendations ?? true,
    pantry: data.permissions.pantry ?? true,
    settings: data.permissions.settings ?? false,
  };
}
