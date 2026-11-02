import { getSupabaseBrowserClient } from '@lib/supabase';
import { fullRecipeSchema, RECIPE_SELECT, type FullRecipe } from '../types';
import { buildRecipeRows } from './recipeRows';
import { toRecipeRow, uploadRecipeImage, type RecipeWriteInput } from './recipeImage';
import { resolveCuisineId, fetchCuisines } from './fetchCuisines';
import { fetchUnitCodes } from './fetchUnits';
import { ensureIngredientIds } from './ensureIngredients';
import { insertChildren } from './createRecipe';

export async function updateRecipe(
  id: string,
  input: RecipeWriteInput & { existingImageUrl?: string | null },
): Promise<FullRecipe> {
  const supabase = getSupabaseBrowserClient();

  const [imageUrl, cuisines, unitCodes, ingredientIds] = await Promise.all([
    input.imageFile ? uploadRecipeImage(input.userId, input.imageFile) : Promise.resolve(input.existingImageUrl ?? null),
    fetchCuisines(),
    fetchUnitCodes(),
    ensureIngredientIds(input.values.ingredients.map((entry) => entry.name)),
  ]);

  const rows = buildRecipeRows({
    recipe: toRecipeRow(input, imageUrl, resolveCuisineId(input.values.cuisine, cuisines)),
    ingredients: input.values.ingredients,
    steps: input.values.steps,
    ingredientIds,
    unitCodes,
  });

  const { data, error } = await supabase
    .from('recipes')
    .update({ ...rows.recipe, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', input.userId)
    .select(RECIPE_SELECT)
    .single();
  if (error) {
    throw new Error(`Failed to update recipe: ${error.message}`);
  }

  // Replace children atomically-ish: both deletes run in parallel, and a
  // failed delete must abort the re-insert — otherwise the insert would
  // duplicate the surviving rows.
  const [ingredientsDelete, stepsDelete] = await Promise.all([
    supabase.from('recipe_ingredients').delete().eq('recipe_id', id),
    supabase.from('recipe_steps').delete().eq('recipe_id', id),
  ]);
  const deleteError = ingredientsDelete.error ?? stepsDelete.error;
  if (deleteError) {
    throw new Error(`Failed to replace recipe details: ${deleteError.message}`);
  }

  const children = await insertChildren(supabase, id, rows.ingredients, rows.steps);
  if (children.error) {
    throw new Error(`Failed to update recipe details: ${children.error.message}`);
  }

  return fullRecipeSchema.parse({
    ...data,
    recipe_ingredients: children.ingredients,
    recipe_steps: children.steps,
  });
}
