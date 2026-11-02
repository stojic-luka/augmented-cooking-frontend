import { getSupabaseBrowserClient } from '@lib/supabase';
import type { RecipeFilterParams } from '../types';
import { applyRecipeListFilters } from './recipeListQuery';

/**
 * One-shot exact count of public recipes matching `params` — the cursor
 * contract carries no total, so the "N recipes found" line runs this once
 * per filter set (keyed without the cursor), never per page. Filters are
 * identical to `fetchRecipes` via the shared list-query module.
 */
export async function countRecipes(params: RecipeFilterParams): Promise<number> {
  const supabase = getSupabaseBrowserClient();

  // The `!inner` join shape must match the fetch so counts drop the same
  // nutrition-less rows; the row payload itself is discarded (`head: true`).
  const filtersByCalories = params.min_calories !== undefined || params.max_calories !== undefined;
  const select = filtersByCalories ? 'id,recipe_nutrition!inner(calories_per_serving)' : 'id';

  let query = supabase
    .from('recipes')
    .select(select, { count: 'exact', head: true })
    .eq('is_public', true)
    .eq('moderation_status', 'approved');

  query = (await applyRecipeListFilters(query, params)).query;

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count recipes: ${error.message}`);
  }

  return count ?? 0;
}
