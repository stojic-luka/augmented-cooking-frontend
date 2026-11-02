import { getSupabaseBrowserClient } from '@lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fullRecipeSchema, RECIPE_SELECT, type FullRecipe } from '../types';
import { publicRecipesRowSchema } from '@/types/schemas';
import { buildRecipeRows } from './recipeRows';
import { toRecipeRow, uploadRecipeImage, type RecipeWriteInput } from './recipeImage';
import { resolveCuisineId, fetchCuisines } from './fetchCuisines';
import { fetchUnitCodes } from './fetchUnits';
import { ensureIngredientIds } from './ensureIngredients';

export async function createRecipe(input: RecipeWriteInput): Promise<FullRecipe> {
  const supabase = getSupabaseBrowserClient();

  const [imageUrl, cuisines, unitCodes, ingredientIds] = await Promise.all([
    input.imageFile ? uploadRecipeImage(input.userId, input.imageFile) : Promise.resolve(null),
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

  const { data, error } = await supabase.from('recipes').insert(rows.recipe).select(RECIPE_SELECT).single();
  if (error) {
    throw new Error(`Failed to save recipe: ${error.message}`);
  }

  const recipeId = publicRecipesRowSchema.pick({ id: true }).parse(data).id;
  const children = await insertChildren(supabase, recipeId, rows.ingredients, rows.steps);
  if (children.error) {
    throw new Error(`Failed to save recipe details: ${children.error.message}`);
  }

  return fullRecipeSchema.parse({
    ...data,
    recipe_ingredients: children.ingredients,
    recipe_steps: children.steps,
  });
}

export async function insertChildren(
  supabase: SupabaseClient,
  recipeId: string,
  ingredients: ReturnType<typeof buildRecipeRows>['ingredients'],
  steps: ReturnType<typeof buildRecipeRows>['steps'],
) {
  // Ingredients carry the same `ingredient` embed as RECIPE_SELECT so the
  // merged rows satisfy `fullRecipeSchema` without a refetch.
  const ingredientsResult = await supabase
    .from('recipe_ingredients')
    .insert(ingredients.map((row) => ({ ...row, recipe_id: recipeId })))
    .select('*, ingredient:ingredients(*)');
  if (ingredientsResult.error) {
    return { error: ingredientsResult.error, ingredients: [], steps: [] };
  }

  const stepsResult = await supabase
    .from('recipe_steps')
    .insert(steps.map((row) => ({ ...row, recipe_id: recipeId })))
    .select('*');

  return {
    error: stepsResult.error,
    ingredients: ingredientsResult.data ?? [],
    steps: stepsResult.data ?? [],
  };
}
