import { getSupabaseBrowserClient } from '@lib/supabase';
import { reviewWithAuthorSchema } from '../types';
import type { ReviewWithAuthor } from '../types';

export async function fetchRecipeReviews(recipeId: string): Promise<ReviewWithAuthor[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('reviews')
    .select('*, public_profile_info(display_name, avatar_url)')
    .eq('recipe_id', recipeId)
    .neq('moderation_status', 'rejected')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch reviews: ${error.message}`);
  }

  const rows = reviewWithAuthorSchema.array().parse(data);

  return rows.map(({ public_profile_info, ...review }) => ({
    ...review,
    author_name: public_profile_info?.display_name ?? null,
    author_avatar: public_profile_info?.avatar_url ?? null,
  }));
}
