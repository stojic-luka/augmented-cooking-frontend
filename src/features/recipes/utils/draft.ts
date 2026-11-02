import type { AiRecipeDraft } from '@features/ai';
import type { FullRecipe, RecipeFormValues } from '../types';

export function detailToFormValues(recipe: FullRecipe): RecipeFormValues {
  return {
    title: recipe.title,
    description: recipe.description,
    cuisine: recipe.cuisines?.name ?? '',
    // schema requires a positive int — 0 would fail "must be positive"
    prepTimeMinutes: recipe.prep_time_minutes ?? 1,
    cookTimeMinutes: recipe.cook_time_minutes ?? null,
    servings: recipe.servings,
    difficulty: (recipe.difficulty as RecipeFormValues['difficulty']) ?? null,
    dietaryTags: recipe.dietary_tags,
    isPublic: recipe.is_public,
    ingredients: recipe.recipe_ingredients.map((ingredient) => ({
      name: ingredient.ingredient.name,
      // TextInput holds strings — normalize numeric quantities from the DB
      amount: String(ingredient.quantity ?? ''),
      unit: ingredient.unit ?? '',
    })),
    steps: recipe.recipe_steps.map((step) => ({ instruction: step.instruction })),
  };
}

/** Used by the importer and AI generation flows to prefill the create form. */
export function draftToFormValues(draft: AiRecipeDraft): RecipeFormValues {
  return {
    title: draft.title,
    description: draft.description,
    cuisine: draft.cuisine,
    prepTimeMinutes: draft.prepTimeMinutes,
    cookTimeMinutes: draft.cookTimeMinutes ?? null,
    servings: draft.servings,
    difficulty: (draft.difficulty as RecipeFormValues['difficulty']) ?? null,
    dietaryTags: draft.dietaryTags,
    isPublic: true,
    ingredients:
      draft.ingredients.length > 0
        ? draft.ingredients.map((ingredient) => ({
            name: ingredient.name,
            amount: String(ingredient.amount ?? ''),
            unit: ingredient.unit || 'pc',
          }))
        : [{ name: '', amount: '', unit: '' }],
    steps: draft.steps.length > 0 ? draft.steps.map((step) => ({ instruction: step.instruction })) : [{ instruction: '' }],
  };
}
