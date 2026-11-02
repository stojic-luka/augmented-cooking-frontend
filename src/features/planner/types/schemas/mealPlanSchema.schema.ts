import { z } from 'zod';
import { fullRecipeSchema } from '@features/recipes';

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealType = z.infer<typeof mealTypeSchema>;

/** Local-only (Dexie) entry; recipes are joined at read time via Supabase. */
export const mealPlanEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  meal_type: mealTypeSchema,
  recipe_id: z.string(),
  servings: z.number().int(),
  created_at: z.string(),
});

export type MealPlanEntry = z.infer<typeof mealPlanEntrySchema>;

export const mealPlanEntryWithRecipeSchema = mealPlanEntrySchema.extend({
  // Null when the planned recipe no longer exists (or is hidden by RLS).
  recipes: fullRecipeSchema.nullable(),
});

export type MealPlanEntryWithRecipe = z.infer<typeof mealPlanEntryWithRecipeSchema>;
export type PlanRecipe = NonNullable<MealPlanEntryWithRecipe['recipes']>;
