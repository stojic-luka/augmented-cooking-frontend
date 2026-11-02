import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import type { RecipeFilterParams } from '../types';
import type { RecipeSortKey } from '../utils/pagination';
import { fetchCuisines } from './fetchCuisines';

/**
 * Structural view of the supabase-js builder for the recipes table, limited
 * to what list filtering needs. The real builder satisfies it (its filter
 * methods all return `this`), so the concrete query keeps its exact type
 * when passed through and chained afterwards. Value params are `unknown` so
 * the structural check can never fight the builder's conditional types.
 */
interface RecipeListQuery<Self> {
  eq(column: string, value: unknown): Self;
  or(filters: string): Self;
  contains(column: string, values: string[]): Self;
  lte(column: string, value: unknown): Self;
  gte(column: string, value: unknown): Self;
  in(column: string, values: string[]): Self;
  not(column: string, operator: 'is', value: null): Self;
}

const ingredientIdSchema = z.object({ id: z.string() });

/** Matches no rows; used when a name filter resolves to zero known names. */
const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * The WHERE clause of the public recipe list endpoint, shared by the page
 * fetch and the one-shot count so the two can never drift. Pure filters
 * only — ordering, keyset seek, and limit belong to `fetchRecipes`.
 *
 * The builder is returned inside an envelope because supabase-js builders
 * are thenables: `return query` from an async function would make `await`
 * adopt and EXECUTE the unfinished query (resolving to the response object).
 */
export async function applyRecipeListFilters<Q extends RecipeListQuery<Q>>(
  query: Q,
  params: RecipeFilterParams,
): Promise<{ query: Q }> {
  const sort: RecipeSortKey = params.sort ?? 'recent';

  if (params.q) {
    const term = params.q.trim().replace(/[%,()]/g, '');
    if (term) {
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }
  }
  if (params.cuisines?.length) {
    const cuisineIds = (await fetchCuisines())
      .filter((cuisine) => params.cuisines?.includes(cuisine.name))
      .map((cuisine) => cuisine.id);
    query = query.in('cuisine_id', cuisineIds.length ? cuisineIds : [NO_MATCH_UUID]);
  }
  if (params.dietary?.length) {
    query = query.contains('dietary_tags', params.dietary);
  }
  if (params.max_prep_time !== undefined) {
    query = query.lte('prep_time_minutes', params.max_prep_time);
  }
  if (params.min_calories !== undefined) {
    query = query.gte('recipe_nutrition.calories_per_serving', params.min_calories);
  }
  if (params.max_calories !== undefined) {
    query = query.lte('recipe_nutrition.calories_per_serving', params.max_calories);
  }
  if (params.ingredients?.length) {
    // Read-only name resolution (a filter must not insert rows, unlike
    // `ensureIngredientIds`); ingredients are stored lowercased.
    const names = params.ingredients.map((name) => name.trim().toLowerCase()).filter(Boolean);
    if (names.length) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from('ingredients').select('id, name').in('name', names);
      if (error) {
        throw new Error(`Failed to look up ingredients: ${error.message}`);
      }
      const ids = (data ?? []).map((row) => ingredientIdSchema.parse(row).id);
      query = query.in('recipe_ingredients.ingredient_id', ids.length ? ids : [NO_MATCH_UUID]);
    }
  }

  // Keyset seeks never match SQL NULL: without this, recipes with no prep
  // time would silently vanish from every page after the first when sorting
  // by quickest. Filtering them out keeps the ordering total. (Semantic
  // change vs offset pagination, where they sorted last.)
  if (sort === 'time') {
    query = query.not('prep_time_minutes', 'is', null);
  }

  return { query };
}
