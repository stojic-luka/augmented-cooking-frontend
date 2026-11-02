import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { recipeKeys } from '../query-keys';
import { recipeListFilters } from '../types';
import type { RecipeFilterParams } from '../types';
import { fetchRecipes } from '../services';

/**
 * Cursor pagination: the key carries the filters only — the cursor flows
 * through `pageParam`, so all pages of one result set share a cache entry.
 */
export const useRecipesOption = (params: RecipeFilterParams) =>
  infiniteQueryOptions({
    queryKey: recipeKeys.list(recipeListFilters(params)),
    queryFn: ({ pageParam }) => fetchRecipes({ ...params, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextCursor ?? undefined : undefined,
  });
export const useRecipes = (params: RecipeFilterParams) => useInfiniteQuery(useRecipesOption(params));
