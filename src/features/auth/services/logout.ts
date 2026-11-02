import { getSupabaseBrowserClient } from '@lib/supabase';

export default async function logout(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
