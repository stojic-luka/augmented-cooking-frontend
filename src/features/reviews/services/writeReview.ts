import { getSupabaseBrowserClient } from '@lib/supabase';
import { publicReviewsRowSchema } from '@/types/schemas';
import type { PublicReviewsRow } from '@/types/schemas';
import { REVIEW_IMAGES_BUCKET } from '../constants';

export interface ReviewWriteInput {
  recipeId: string;
  userId: string;
  rating: number | null;
  comment: string;
  imageUrl?: string | null;
  parentReviewId?: string | null;
}

export async function createReview(input: ReviewWriteInput): Promise<PublicReviewsRow> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      recipe_id: input.recipeId,
      user_id: input.userId,
      rating: input.rating,
      comment: input.comment.trim(),
      image_url: input.imageUrl ?? null,
      parent_review_id: input.parentReviewId ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to post review: ${error.message}`);
  }
  return publicReviewsRowSchema.parse(data);
}

export async function updateReview(
  reviewId: string,
  userId: string,
  patch: { rating: number | null; comment: string },
): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase
    .from('reviews')
    .update({
      rating: patch.rating,
      comment: patch.comment.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update review: ${error.message}`);
  }
}

export async function deleteReview(reviewId: string, userId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase.from('reviews').delete().eq('id', reviewId).eq('user_id', userId);
  if (error) {
    throw new Error(`Failed to delete review: ${error.message}`);
  }
}

/** Uploads to the `review-images` bucket and returns the storage path — signed URLs are minted at read time. */
export async function uploadReviewImage(userId: string, file: File): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const ext = file.name.includes('.') ? file.name.split('.').pop() || 'bin' : 'bin';
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(REVIEW_IMAGES_BUCKET).upload(path, file, { upsert: false });
  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  return path;
}
