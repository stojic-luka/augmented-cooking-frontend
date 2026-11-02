import type { FullRecipe, RecipeFormValues } from '@features/recipes';
import type { AiRecipeDraft } from '../types';

/** Maps a stored recipe to the draft shape the AI endpoints expect. */
export function toAiDraft(recipe: FullRecipe): AiRecipeDraft {
  return {
    title: recipe.title,
    description: recipe.description,
    cuisine: recipe.cuisines?.name ?? '',
    prepTimeMinutes: recipe.prep_time_minutes ?? 1,
    cookTimeMinutes: recipe.cook_time_minutes ?? null,
    servings: recipe.servings,
    difficulty: (recipe.difficulty as RecipeFormValues['difficulty']) ?? null,
    image: recipe.image_url,
    ingredients: recipe.recipe_ingredients.map((ingredient) => ({
      name: ingredient.ingredient.name,
      amount: ingredient.quantity,
      unit: ingredient.unit ?? '',
    })),
    steps: recipe.recipe_steps.map((step) => ({ instruction: step.instruction })),
    dietaryTags: recipe.dietary_tags,
  };
}
