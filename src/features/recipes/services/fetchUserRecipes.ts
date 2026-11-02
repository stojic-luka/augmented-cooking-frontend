import { getSupabaseBrowserClient } from '@lib/supabase';
import {
  FetchRecipesResponseSchema,
  RECIPES_PAGE_SIZE,
  RECIPE_SELECT,
  fullRecipeSchema,
} from '../types';
import type { FetchRecipesResponse } from '../types';
import { SORT_SPECS, cursorSeekFilter, decodeCursorForSort, encodeRecipeCursor } from '../utils/pagination';
import { sortDetailChildren } from './recipeRows';

/**
 * One keyset-paginated page of the signed-in cook's own recipes — drafts and
 * private copies included. Cursor in, `{ data, nextCursor, hasNextPage }` out,
 * on the same `recent` sort and cursor codec as `fetchRecipes`, so both lists
 * page identically and a page never repeats or skips rows.
 */
export async function fetchUserRecipes(userId: string, cursor: string | null): Promise<FetchRecipesResponse> {
  const spec = SORT_SPECS.recent;
  const payload = cursor ? decodeCursorForSort(cursor, 'recent') : null;
  const supabase = getSupabaseBrowserClient();

  let query = supabase.from('recipes').select(RECIPE_SELECT).eq('user_id', userId);

  // Keyset seek: rows strictly after the cursor in (created_at, id) order.
  if (payload) {
    query = query.or(cursorSeekFilter(spec, payload));
  }

  const { data, error } = await query
    .order(spec.column, { ascending: !spec.descending, nullsFirst: false })
    .order('id', { ascending: !spec.descending })
    // Full recipes always carry their children in a stable order.
    .order('position', { referencedTable: 'recipe_ingredients', ascending: true })
    .order('position', { referencedTable: 'recipe_steps', ascending: true })
    // +1 lookahead answers hasNextPage without a count; the exact-boundary
    // page (rows == pageSize) therefore reports hasNextPage: false.
    .limit(RECIPES_PAGE_SIZE + 1);

  if (error) {
    throw new Error(`Failed to fetch your recipes: ${error.message}`);
  }

  const rows = (data ?? []).map((row) => sortDetailChildren(fullRecipeSchema.parse(row)));
  const pageRows = rows.slice(0, RECIPES_PAGE_SIZE);
  const hasNextPage = rows.length > RECIPES_PAGE_SIZE;
  const lastRow = hasNextPage ? pageRows.at(-1) : undefined;

  return FetchRecipesResponseSchema.parse({
    data: pageRows,
    hasNextPage,
    nextCursor: lastRow ? encodeRecipeCursor('recent', lastRow) : null,
  });
}
