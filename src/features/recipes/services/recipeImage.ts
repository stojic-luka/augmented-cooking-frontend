import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import type { RecipeFormValues } from '../types';
import { publicDietaryTagSchema, type PublicRecipesRow } from '@/types/schemas';
import { RECIPE_IMAGES_BUCKET } from '../constants';

/** Uploads to the `recipe-images` bucket and returns the public URL. */
export async function uploadRecipeImage(userId: string, file: File): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const ext = file.name.includes('.') ? file.name.split('.').pop() || 'bin' : 'bin';
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(RECIPE_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  return path;
}

export interface RecipeWriteInput {
  values: RecipeFormValues;
  userId: string;
  imageFile?: File | null;
}

/** Columns the client may write; rating caches and moderation are DB-managed. */
export type RecipeWriteRow = Omit<
  PublicRecipesRow,
  'id' | 'created_at' | 'updated_at' | 'moderation_status' | 'rating_avg' | 'review_count'
>;

export function toRecipeRow(input: RecipeWriteInput, imageUrl: string | null, cuisineId: string | null): RecipeWriteRow {
  const { values, userId } = input;
  return {
    user_id: userId,
    title: values.title.trim(),
    description: values.description.trim(),
    cuisine_id: cuisineId,
    category: null,
    cooking_method: null,
    spice_level: null,
    prep_time_minutes: values.prepTimeMinutes,
    cook_time_minutes: values.cookTimeMinutes,
    servings: values.servings,
    difficulty: values.difficulty,
    image_url: imageUrl,
    dietary_tags: z.array(publicDietaryTagSchema).catch([]).parse(values.dietaryTags),
    is_public: values.isPublic,
    origin: 'manual',
    source_url: null,
    original_recipe_id: null,
  };
}
