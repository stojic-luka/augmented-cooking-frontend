import { z } from 'zod';
import {
  publicRecipesRowSchema,
  publicIngredientsRowSchema,
  publicRecipeIngredientsRowSchema,
  publicRecipeStepsRowSchema,
  publicCuisinesRowSchema,
  publicRecipeNutritionRowSchema,
} from '@/types/schemas';

/**
 * Canonical shape of a fetched recipe — what `RECIPE_SELECT`
 * (recipeSelect.ts) returns and what every recipe fetch is validated against.
 * The select and this schema MUST change together: the select defines what the
 * query returns, this schema defines what is validated.
 *
 * `cuisines` and `recipe_nutrition` are nullable because the database allows
 * them to be absent (`recipes.cuisine_id` is nullable; a recipe may have no
 * nutrition row) — PostgREST then returns `null` for the embed.
 */
export const fullRecipeSchema = publicRecipesRowSchema.extend({
  cuisines: publicCuisinesRowSchema.nullable(),
  recipe_nutrition: publicRecipeNutritionRowSchema.nullable(),
  recipe_ingredients: z.array(
    publicRecipeIngredientsRowSchema.extend({
      ingredient: publicIngredientsRowSchema,
    }),
  ),
  recipe_steps: z.array(publicRecipeStepsRowSchema),
});
export type FullRecipe = z.infer<typeof fullRecipeSchema>;
