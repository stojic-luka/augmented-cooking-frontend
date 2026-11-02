import { getSupabaseBrowserClient } from '@lib/supabase';

/**
 * Uploads an avatar and returns its public URL. Bucket `avatars` must allow
 * authenticated users to write under their own `{user_id}/` prefix.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const path = `${userId}/avatar-${Date.now()}`;

  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) {
    throw new Error(`Avatar upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
