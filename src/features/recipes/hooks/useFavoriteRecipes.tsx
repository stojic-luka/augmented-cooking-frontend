import { queryOptions, useQuery } from '@tanstack/react-query';
import { recipeKeys } from '../query-keys';
import { fetchFavoriteRecipes } from '../services';

export const useFavoriteRecipesOptions = (userId: string | null) =>
  queryOptions({
    queryKey: recipeKeys.favorites(userId ?? 'anonymous'),
    queryFn: () => fetchFavoriteRecipes(userId as string),
    enabled: Boolean(userId),
  });
export const useFavoriteRecipes = (userId: string | null) => useQuery(useFavoriteRecipesOptions(userId));
