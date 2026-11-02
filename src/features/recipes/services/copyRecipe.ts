import { getSupabaseBrowserClient } from '@lib/supabase';
import { fullRecipeSchema, RECIPE_SELECT, type FullRecipe } from '../types';
import { publicRecipesRowSchema } from '@/types/schemas';
import { insertChildren } from './createRecipe';

/** Creates a private, editable copy of an existing recipe for the given user. */
export async function copyRecipe(recipe: FullRecipe, userId: string): Promise<FullRecipe> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      title: `${recipe.title} (copy)`,
      description: recipe.description,
      cuisine_id: recipe.cuisine_id,
      prep_time_minutes: recipe.prep_time_minutes,
      cook_time_minutes: recipe.cook_time_minutes,
      original_recipe_id: recipe.id,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      image_url: recipe.image_url,
      dietary_tags: recipe.dietary_tags,
      is_public: false,
      origin: 'manual',
    })
    .select(RECIPE_SELECT)
    .single();
  if (error) {
    throw new Error(`Failed to copy recipe: ${error.message}`);
  }

  const recipeId = publicRecipesRowSchema.pick({ id: true }).parse(data).id;
  const rows = buildCopyRows(recipe);
  const children = await insertChildren(supabase, recipeId, rows.ingredients, rows.steps);
  if (children.error) {
    throw new Error(`Failed to copy recipe details: ${children.error.message}`);
  }

  return fullRecipeSchema.parse({
    ...data,
    recipe_ingredients: children.ingredients,
    recipe_steps: children.steps,
  });
}

function buildCopyRows(recipe: FullRecipe) {
  return {
    ingredients: recipe.recipe_ingredients.map((ingredient) => ({
      position: ingredient.position,
      ingredient_id: ingredient.ingredient_id,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      note: ingredient.note,
      is_optional: ingredient.is_optional,
      raw_text: ingredient.raw_text,
    })),
    steps: recipe.recipe_steps.map((step) => ({
      position: step.position,
      instruction: step.instruction,
      estimated_time_minutes: step.estimated_time_minutes,
      timer_seconds: step.timer_seconds,
    })),
  };
}
