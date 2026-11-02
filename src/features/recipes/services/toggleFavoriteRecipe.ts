import { getSupabaseBrowserClient } from '@lib/supabase';

export async function toggleFavoriteRecipe(userId: string, recipeId: string, favorite: boolean): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  if (favorite) {
    const { error } = await supabase.from('favorites').insert({ user_id: userId, recipe_id: recipeId });
    // Re-favoriting a row that exists is harmless; real failures surface.
    if (error && error.code !== '23505') {
      throw new Error(`Failed to favorite recipe: ${error.message}`);
    }
    return;
  }

  const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('recipe_id', recipeId);
  if (error) {
    throw new Error(`Failed to unfavorite recipe: ${error.message}`);
  }
}

export async function fetchIsFavorite(userId: string, recipeId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('favorites')
    .select('recipe_id')
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check favorite state: ${error.message}`);
  }
  return Boolean(data);
}
