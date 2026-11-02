import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { publicReviewsRowSchema } from '@/types/schemas';
import type { PublicModerationStatus } from '@/types/schemas';

/**
 * Generated Row schema extended with the two joined fields
 * (author via public_profile_info, recipe title).
 */
const modReviewSchema = publicReviewsRowSchema.extend({
  author_name: z.string().nullable(),
  recipe_title: z.string().nullable(),
});

export type ModReview = z.infer<typeof modReviewSchema>;

export const modReviewRawSchema = publicReviewsRowSchema.extend({
  public_profile_info: z
    .object({
      display_name: z.string().nullable(),
    })
    .nullable(),
  recipes: z
    .object({
      title: z.string().nullable(),
    })
    .nullable(),
});
export type ModReviewRaw = z.infer<typeof modReviewRawSchema>;

export async function fetchModerationReviews(): Promise<ModReview[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('reviews')
    .select('*, public_profile_info(display_name), recipes(title)')
    .in('moderation_status', ['pending', 'flagged'])
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch reviews: ${error.message}`);
  }

  return (data ?? []).map((row: ModReviewRaw) =>
    modReviewSchema.parse({
      ...row,
      author_name: row.public_profile_info?.display_name ?? null,
      recipe_title: row.recipes?.title ?? null,
    }),
  );
}

export async function moderateReview(reviewId: string, decision: Exclude<PublicModerationStatus, 'pending'>): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase.from('reviews').update({ moderation_status: decision }).eq('id', reviewId);

  if (error) {
    throw new Error(`Failed to moderate review: ${error.message}`);
  }
}
