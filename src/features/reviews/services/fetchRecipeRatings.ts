import { getSupabaseBrowserClient } from '@lib/supabase';
import { recipeRatingAggregateSchema, RECIPE_RATINGS_SELECT } from '../types';

export interface RecipeRating {
  average: number;
  count: number;
}

/**
 * Rating aggregates per recipe, keyed by recipe id. Reads the denormalized
 * `rating_avg`/`review_count` cache on `recipes` (trigger-maintained from
 * approved, depth-0 reviews) — the same values the rating sort uses.
 */
export async function fetchRecipeRatings(recipeIds: string[]): Promise<Map<string, RecipeRating>> {
  if (recipeIds.length === 0) {
    return new Map();
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from('recipes').select(RECIPE_RATINGS_SELECT).in('id', recipeIds);

  if (error) {
    throw new Error(`Failed to fetch ratings: ${error.message}`);
  }

  const rows = recipeRatingAggregateSchema.array().parse(data);

  const result = new Map<string, RecipeRating>();
  for (const row of rows) {
    // Includes zero-review recipes: the DB defaults both columns to 0.
    result.set(row.id, { average: row.rating_avg, count: row.review_count });
  }
  return result;
}
