import { queryOptions, useQuery } from '@tanstack/react-query';
import { recipeKeys } from '../query-keys';
import { fetchIsFavorite } from '../services';

export const useIsFavoriteOptions = (userId: string | null, recipeId: string) =>
  queryOptions({
    queryKey: recipeKeys.isFavorite(userId ?? 'anonymous', recipeId),
    queryFn: () => fetchIsFavorite(userId as string, recipeId),
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
  });
export const useIsFavorite = (userId: string | null, recipeId: string) => useQuery(useIsFavoriteOptions(userId, recipeId));
