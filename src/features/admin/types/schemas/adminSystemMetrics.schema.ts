import { z } from 'zod';
import { publicProfilesRowSchema, publicRecipesRowSchema, publicCuisinesRowSchema } from '@/types/schemas';

export const profilesRowSchema = publicProfilesRowSchema.pick({ id: true, created_at: true });
export const recipesRowSchema = publicRecipesRowSchema.pick({ id: true }).extend({
  cuisines: publicCuisinesRowSchema.pick({ name: true }).nullable(),
});

export const systemMetricsSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  premiumUsers: z.number().int().nonnegative(),
  totalRecipes: z.number().int().nonnegative(),
  totalReviews: z.number().int().nonnegative(),
  signupsByMonth: z.array(
    z.object({
      label: z.string(), // "YYYY-MM"
      users: z.number().int().nonnegative(),
    }),
  ),
  recipesByCuisine: z.array(
    z.object({
      label: z.string(),
      recipes: z.number().int().nonnegative(),
    }),
  ),
});

export type SystemMetrics = z.infer<typeof systemMetricsSchema>;
