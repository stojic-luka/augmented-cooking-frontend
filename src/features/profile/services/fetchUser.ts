import { getSupabaseBrowserClient } from '@lib/supabase';
import type { User } from '@supabase/supabase-js';

export async function fetchUser(): Promise<User | null> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      if (error.name === 'AuthSessionMissingError' || error.status === 401) {
        return null;
      }

      console.error(error.message);
      return null;
    }

    return data.user;
  } catch (criticalError) {
    console.error(criticalError);
    return null;
  }
}
