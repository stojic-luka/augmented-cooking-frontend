import { getSupabaseBrowserClient } from '@lib/supabase';

export async function deleteRecipe(id: string, userId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  // Children and favorites cascade via foreign keys (see DATABASE_REFERENCE.md).
  const { error } = await supabase.from('recipes').delete().eq('id', id).eq('user_id', userId);
  if (error) {
    throw new Error(`Failed to delete recipe: ${error.message}`);
  }
}
