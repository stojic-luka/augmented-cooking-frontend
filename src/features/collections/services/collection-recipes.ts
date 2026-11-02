import { getSupabaseBrowserClient } from '@lib/supabase';

export async function addRecipeToCollection(collectionId: string, recipeId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase
    .from('collection_recipes')
    .upsert(
      { collection_id: collectionId, recipe_id: recipeId },
      { onConflict: 'collection_id,recipe_id', ignoreDuplicates: true },
    );

  if (error) {
    throw new Error(`Failed to add recipe to collection: ${error.message}`);
  }
}

export async function removeRecipeFromCollection(collectionId: string, recipeId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase
    .from('collection_recipes')
    .delete()
    .eq('collection_id', collectionId)
    .eq('recipe_id', recipeId);

  if (error) {
    throw new Error(`Failed to remove recipe from collection: ${error.message}`);
  }
}
