import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { fullRecipeSchema, RECIPE_SELECT } from '@features/recipes';
import type { PublicModerationStatus } from '@/types/schemas';

export type ModerationDecision = 'approve' | 'reject' | 'flag';

// Full recipe rows (shared full-recipe select, see features/recipes/types)
// plus the joined author name from the `public_profile_info` view.
const modRecipeSchema = fullRecipeSchema.extend({
  author_name: z.string().nullable(),
});
export type ModRecipe = z.infer<typeof modRecipeSchema>;

const MODERATION_STATUS_BY_DECISION: Record<ModerationDecision, PublicModerationStatus> = {
  approve: 'approved',
  reject: 'rejected',
  flag: 'flagged',
};

export async function fetchPendingRecipes(): Promise<ModRecipe[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('recipes')
    .select(`${RECIPE_SELECT}, public_profile_info!user_id(display_name)`)
    .in('moderation_status', ['pending', 'flagged'])
    .order('created_at', { ascending: true })
    .order('position', { referencedTable: 'recipe_ingredients', ascending: true })
    .order('position', { referencedTable: 'recipe_steps', ascending: true });

  if (error) {
    throw new Error(`Failed to fetch pending recipes: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    // A view referenced in a select can come back wrapped in an array depending
    // on the PostgREST embedding — handle both shapes like the old code did.
    const profile = Array.isArray(row.public_profile_info) ? row.public_profile_info[0] : row.public_profile_info;

    return modRecipeSchema.parse({
      ...row,
      author_name: profile?.display_name ?? null,
    });
  });
}

export async function moderateRecipe(recipeId: string, decision: ModerationDecision): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const status = MODERATION_STATUS_BY_DECISION[decision];

  // Per the DB spec, moderators change moderation_status ONLY via a
  // SECURITY DEFINER RPC gated on is_staff(). A direct table UPDATE would be
  // rejected by RLS (writes go through can_edit_recipe, which the moderator
  // typically doesn't satisfy for other users' recipes).
  const { error } = await supabase.rpc('set_recipe_moderation', {
    p_recipe: recipeId,
    p_status: status,
  });

  if (error) {
    throw new Error(`Failed to moderate recipe: ${error.message}`);
  }
}
