import { queryOptions, useQuery } from '@tanstack/react-query';
import { recipeKeys } from '../query-keys';
import { fetchCuisines } from '../services';

/**
 * Active cuisine options for filter dropdowns. Names (not ids) travel in the
 * URL params; `fetchRecipes` resolves them to ids server-side.
 */
export const cuisinesOptions = () =>
  queryOptions({
    queryKey: recipeKeys.cuisines(),
    queryFn: fetchCuisines,
    staleTime: 1000 * 60 * 10,
  });

export function useCuisines() {
  return useQuery(cuisinesOptions());
}
