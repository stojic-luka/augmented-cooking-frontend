import { getSupabaseBrowserClient } from '@lib/supabase';
import { fullRecipeSchema, RECIPE_SELECT, type FullRecipe } from '../types';
import { sortDetailChildren } from './recipeRows';

interface FavoritesJoinRow {
  recipes: unknown;
}

export async function fetchFavoriteRecipes(userId: string): Promise<FullRecipe[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('favorites')
    .select(`recipes(${RECIPE_SELECT})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch favorites: ${error.message}`);
  }

  return (data ?? [])
    .flatMap((entry) => {
      const recipes = (entry as FavoritesJoinRow).recipes;
      return Array.isArray(recipes) ? recipes : recipes ? [recipes] : [];
    })
    .map((row) => sortDetailChildren(fullRecipeSchema.parse(row)));
}
