import { getSupabaseBrowserClient } from '@lib/supabase';

export default async function updatePassword(password: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }
}
