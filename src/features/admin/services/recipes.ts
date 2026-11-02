import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import {
  fullRecipeSchema,
  RECIPE_SELECT,
  SORT_SPECS,
  cursorSeekFilter,
  decodeCursorForSort,
  encodeRecipeCursor,
} from '@features/recipes';
import type { PublicModerationStatus as ModerationStatus } from '@/types/schemas';

/**
 * Admin-facing recipe row: the full recipe (shared full-recipe select, see
 * features/recipes/types) plus the author's display name joined through the
 * `public_profile_info` view.
 *
 * `author_name` replaces the old `author_email` — profiles RLS only allows
 * SELECT on your own row, and email lives in auth.users and is never exposed.
 * The view exposes (id, display_name, avatar_url) for exactly this purpose.
 * Nullable because `recipes.user_id` is nullable (anonymized recipes).
 */
export const adminRecipeSchema = fullRecipeSchema.extend({ author_name: z.string().nullable() });
export type AdminRecipe = z.infer<typeof adminRecipeSchema>;

/** Statuses a moderator can actively set (everything except 'pending'). */
export type AdminModerationAction = Extract<ModerationStatus, 'approved' | 'rejected' | 'flagged'>;

/** Rows per admin registry page; the +1 lookahead row answers hasNextPage. */
export const ADMIN_RECIPES_PAGE_SIZE = 25;

/**
 * One keyset-paginated page of the admin recipe registry — the same
 * `{ data, nextCursor, hasNextPage }` envelope every paginated list uses.
 */
export const AdminRecipePageSchema = z.object({
  data: z.array(adminRecipeSchema),
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});
export type AdminRecipePage = z.infer<typeof AdminRecipePageSchema>;

/**
 * One keyset-paginated page of the admin recipe registry — every recipe,
 * any moderation status, newest first. Cursor in, page out, on the same
 * `recent` sort and cursor codec as the recipe lists, so a page never
 * repeats or skips rows.
 */
export async function fetchAllRecipes(cursor: string | null): Promise<AdminRecipePage> {
  const supabase = getSupabaseBrowserClient();
  const spec = SORT_SPECS.recent;
  const payload = cursor ? decodeCursorForSort(cursor, 'recent') : null;

  // Join via public_profile_info, NOT profiles — a `profiles(display_name)`
  // join silently returns null for every non-staff-own row because profiles
  // RLS restricts SELECT to the caller's own row. The `!user_id` hint pins
  // the embed to that FK.
  let query = supabase.from('recipes').select(`${RECIPE_SELECT}, public_profile_info!user_id(display_name)`);

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
    .limit(ADMIN_RECIPES_PAGE_SIZE + 1);

  if (error) {
    throw new Error(`Failed to fetch recipes: ${error.message}`);
  }

  const rows = (data ?? []).map((row) => {
    // A view referenced in a select can come back wrapped in an array depending
    // on the PostgREST embedding — handle both shapes like the old code did.
    const profile = Array.isArray(row.public_profile_info) ? row.public_profile_info[0] : row.public_profile_info;

    return adminRecipeSchema.parse({
      ...row,
      author_name: profile?.display_name ?? null,
    });
  });
  const pageRows = rows.slice(0, ADMIN_RECIPES_PAGE_SIZE);
  const hasNextPage = rows.length > ADMIN_RECIPES_PAGE_SIZE;
  const lastRow = hasNextPage ? pageRows.at(-1) : undefined;

  return AdminRecipePageSchema.parse({
    data: pageRows,
    hasNextPage,
    nextCursor: lastRow ? encodeRecipeCursor('recent', lastRow) : null,
  });
}

export async function adminDeleteRecipe(recipeId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  // Hard delete cascades to recipe_ingredients, recipe_steps, recipe_nutrition,
  // reviews, favorites, collection_recipes and pending recipe_revisions.
  // Requires can_edit_recipe(recipe_id) to pass for the caller (staff included).
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId);

  if (error) {
    throw new Error(`Failed to delete recipe: ${error.message}`);
  }
}

export async function adminModerateRecipe(recipeId: string, status: AdminModerationAction): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  // Moderators change moderation_status ONLY through the SECURITY DEFINER
  // RPC gated on is_staff() — a direct .update() is rejected by RLS.
  const { error } = await supabase.rpc('set_recipe_moderation', {
    p_recipe: recipeId,
    p_status: status,
  });

  if (error) {
    throw new Error(`Failed to moderate recipe: ${error.message}`);
  }
}
