import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { recipeKeys } from '../query-keys';
import { fetchUserRecipes } from '../services';
import type { FullRecipe } from '../types';

/**
 * Cursor pagination: the key carries the owner only — the cursor flows
 * through `pageParam`, so all pages of one result set share a cache entry.
 */
export const useUserRecipesOptions = (userId: string | null) =>
  infiniteQueryOptions({
    queryKey: recipeKeys.user(userId ?? 'anonymous'),
    queryFn: ({ pageParam }) => {
      // `enabled` keeps this from running while signed out; the guard narrows
      // the id for the fetch instead of casting.
      if (!userId) {
        throw new Error('Cannot load your recipes while signed out.');
      }
      return fetchUserRecipes(userId, pageParam);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextCursor ?? undefined : undefined,
    enabled: Boolean(userId),
  });

/**
 * Infinite query result plus a flattened `recipes` view: all pages
 * flat-mapped and deduped by id, because a create/delete can shift the
 * keyset so a refetched later page re-serves rows an earlier page carried.
 */
export const useUserRecipes = (userId: string | null) => {
  const query = useInfiniteQuery(useUserRecipesOptions(userId));

  const recipesById = new Map<string, FullRecipe>();
  for (const page of query.data?.pages ?? []) {
    for (const recipe of page.data) {
      recipesById.set(recipe.id, recipe);
    }
  }

  return { ...query, recipes: [...recipesById.values()] };
};
