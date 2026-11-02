import { queryOptions, useQuery } from '@tanstack/react-query';
import { recipeKeys } from '../query-keys';
import { recipeListFilters } from '../types';
import type { RecipeFilterParams } from '../types';
import { countRecipes } from '../services';

/**
 * One-shot total for the "N recipes found" line (cursor pages carry no
 * count). Keyed by the filters without the cursor, so it runs once per
 * filter set regardless of how many pages are loaded.
 */
export const useRecipeCountOption = (params: RecipeFilterParams) =>
  queryOptions({
    queryKey: recipeKeys.count(recipeListFilters(params)),
    queryFn: () => countRecipes(params),
  });
export const useRecipeCount = (params: RecipeFilterParams) => useQuery(useRecipeCountOption(params));
