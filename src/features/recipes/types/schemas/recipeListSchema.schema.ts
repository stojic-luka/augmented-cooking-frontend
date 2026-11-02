import { z } from 'zod';
import { fullRecipeSchema } from './recipeSchema.schema';

/**
 * Params of the paginated recipe list endpoint. `cursor` (string | null)
 * replaces the retired `page` field — pagination is keyset-based, see
 * `utils/pagination` for the cursor module. Every field stays optional so
 * URL parsing (validateSearch) never throws.
 *
 * Merged from the platform contract and the pre-existing recipe filters:
 * `cuisine_type` (single string in the contract) is superseded by the richer
 * multi-select `cuisines` array — no existing filter was dropped.
 */
export const RecipeFilterParamsSchema = z.object({
  q: z.string().optional(),
  cuisines: z.array(z.string()).optional(),
  dietary: z.array(z.string()).optional(),
  sort: z.enum(['recent', 'rating', 'time']).optional(),
  max_prep_time: z.coerce.number().int().positive().optional(),
  min_calories: z.coerce.number().int().nonnegative().optional(),
  max_calories: z.coerce.number().int().nonnegative().optional(),
  ingredients: z.array(z.string()).optional(),
  cursor: z.string().nullable().optional(),
});
export type RecipeFilterParams = z.infer<typeof RecipeFilterParamsSchema>;

/** Params without the cursor — the identity of a list/count result set. */
export type RecipeListFilters = Omit<RecipeFilterParams, 'cursor'>;

/**
 * List-query identity for TanStack Query keys: the cursor must never enter a
 * query key — it flows through the infinite query's `pageParam`, so all
 * pages of one result set share a single cache entry.
 */
export function recipeListFilters({ cursor: _cursor, ...filters }: RecipeFilterParams): RecipeListFilters {
  return filters;
}

export const RECIPES_PAGE_SIZE = 12;

/**
 * Contract shape of every paginated list response: the page's rows plus the
 * cursor to the next page. `nextCursor` is null exactly when `hasNextPage`
 * is false, and a page never repeats or skips rows relative to the previous
 * page (keyset seek on `(sort column, id)`).
 */
export const FetchRecipesResponseSchema = z.object({
  data: z.array(fullRecipeSchema),
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});
export type FetchRecipesResponse = z.infer<typeof FetchRecipesResponseSchema>;
