import { getSupabaseBrowserClient } from '@lib/supabase';
import { fullRecipeSchema, RECIPE_SELECT, type FullRecipe } from '../types';
import { sortDetailChildren } from './recipeRows';

export async function fetchRecipeDetails(id: string): Promise<FullRecipe> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('id', id)
    .order('position', { referencedTable: 'recipe_ingredients', ascending: true })
    .order('position', { referencedTable: 'recipe_steps', ascending: true })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch recipe: ${error.message}`);
  }
  if (!data) {
    throw new Error('Recipe not found.');
  }

  return sortDetailChildren(fullRecipeSchema.parse(data));
}
