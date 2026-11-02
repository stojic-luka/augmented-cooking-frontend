import { getSupabaseBrowserClient } from '@lib/supabase';
import { publicProfilesRowSchema } from '@/types/schemas';
import type { PublicProfilesRow } from '@/types/schemas';

export async function fetchProfile(userId: string): Promise<PublicProfilesRow | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

  // No profile row yet — callers must fall back to sensible defaults so the
  // app stays usable before the database is provisioned.
  if (error?.code === 'PGRST116') {
    return null;
  }
  if (error) {
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  return publicProfilesRowSchema.parse(data);
}
