import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { systemMetricsSchema, profilesRowSchema, recipesRowSchema } from '../types';
import type { SystemMetrics } from '../types';

export async function fetchSystemMetrics(): Promise<SystemMetrics> {
  const supabase = getSupabaseBrowserClient();

  const [usersResult, premiumResult, recipesResult, reviewsResult] = await Promise.all([
    supabase.from('profiles').select('id, created_at', { count: 'exact' }).limit(1000),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_tier', 'premium'),
    supabase.from('recipes').select('id, cuisines(name)', { count: 'exact' }).limit(1000),
    supabase.from('reviews').select('id', { count: 'exact', head: true }),
  ]);

  const error = usersResult.error ?? premiumResult.error ?? recipesResult.error ?? reviewsResult.error;
  if (error) {
    throw new Error(`Failed to compute metrics: ${error.message}`);
  }

  const users = profilesRowSchema.array().parse(usersResult.data ?? []);
  const recipes = recipesRowSchema.array().parse(recipesResult.data ?? []);

  const signupsByMonth = new Map<string, number>();
  for (const user of users) {
    const label = user.created_at.slice(0, 7);
    signupsByMonth.set(label, (signupsByMonth.get(label) ?? 0) + 1);
  }

  const recipesByCuisine = new Map<string, number>();
  for (const recipe of recipes) {
    const label = recipe.cuisines?.name ?? 'Other';
    recipesByCuisine.set(label, (recipesByCuisine.get(label) ?? 0) + 1);
  }

  return systemMetricsSchema.parse({
    totalUsers: usersResult.count ?? 0,
    premiumUsers: premiumResult.count ?? 0,
    totalRecipes: recipesResult.count ?? 0,
    totalReviews: reviewsResult.count ?? 0,
    signupsByMonth: [...signupsByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => ({ label, users: count })),
    recipesByCuisine: [...recipesByCuisine.entries()]
      .map(([label, count]) => ({ label, recipes: count }))
      .sort((a, b) => b.recipes - a.recipes)
      .slice(0, 8),
  });
}
