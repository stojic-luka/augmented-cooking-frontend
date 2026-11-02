import { getSupabaseBrowserClient } from '@lib/supabase';
import {
  FetchRecipesResponseSchema,
  fullRecipeSchema,
  RECIPES_PAGE_SIZE,
  RECIPE_SELECT,
  RECIPE_SELECT_NUTRITION_INNER,
} from '../types';
import type { FetchRecipesResponse, RecipeFilterParams } from '../types';
import { SORT_SPECS, cursorSeekFilter, decodeCursorForSort, encodeRecipeCursor } from '../utils/pagination';
import { sortDetailChildren } from './recipeRows';
import { applyRecipeListFilters } from './recipeListQuery';

/**
 * One keyset-paginated page of public recipes. Filters + cursor in,
 * `{ data, nextCursor, hasNextPage }` out. The cursor embeds the sort key,
 * so a cursor issued under a different sort resets to the first page.
 */
export async function fetchRecipes(params: RecipeFilterParams): Promise<FetchRecipesResponse> {
  const sort = params.sort ?? 'recent';
  const spec = SORT_SPECS[sort];
  const cursor = params.cursor ? decodeCursorForSort(params.cursor, sort) : null;
  const supabase = getSupabaseBrowserClient();

  // Calorie filters compare against the nutrition embed, so it must be `!inner`
  // — with a left embed, recipes without a nutrition row survive the filter.
  const filtersByCalories = params.min_calories !== undefined || params.max_calories !== undefined;
  let query = supabase
    .from('recipes')
    .select(filtersByCalories ? RECIPE_SELECT_NUTRITION_INNER : RECIPE_SELECT)
    .eq('is_public', true)
    .eq('moderation_status', 'approved');

  query = (await applyRecipeListFilters(query, params)).query;

  // Keyset seek: rows strictly after the cursor in (sort column, id) order.
  if (cursor) {
    query = query.or(cursorSeekFilter(spec, cursor));
  }

  query = query
    .order(spec.column, { ascending: !spec.descending, nullsFirst: false })
    .order('id', { ascending: !spec.descending })
    // Full recipes always carry their children in a stable order.
    .order('position', { referencedTable: 'recipe_ingredients', ascending: true })
    .order('position', { referencedTable: 'recipe_steps', ascending: true })
    // +1 lookahead answers hasNextPage without a count; the exact-boundary
    // page (rows == pageSize) therefore reports hasNextPage: false.
    .limit(RECIPES_PAGE_SIZE + 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch recipes: ${error.message}`);
  }

  const rows = (data ?? []).map((row) => sortDetailChildren(fullRecipeSchema.parse(row)));
  const pageRows = rows.slice(0, RECIPES_PAGE_SIZE);
  const hasNextPage = rows.length > RECIPES_PAGE_SIZE;
  const lastRow = hasNextPage ? pageRows.at(-1) : undefined;

  return FetchRecipesResponseSchema.parse({
    data: pageRows,
    hasNextPage,
    nextCursor: lastRow ? encodeRecipeCursor(sort, lastRow) : null,
  });
}
