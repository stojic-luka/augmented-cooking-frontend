import { queryOptions, useQuery } from '@tanstack/react-query';
import { reviewKeys } from '../query-keys';
import { fetchRecipeRatings } from '../services';

export const recipeRatingsOptions = (stableIds: string[]) =>
  queryOptions({
    queryKey: reviewKeys.ratings(stableIds),
    queryFn: () => fetchRecipeRatings(stableIds),
    enabled: stableIds.length > 0,
    staleTime: 1000 * 60,
  });
export const useRecipeRatings = (recipeIds: string[]) => {
  const stableIds = [...recipeIds].sort((a, b) => a.localeCompare(b));
  return useQuery(recipeRatingsOptions(stableIds));
};
