import { getSupabaseBrowserClient } from '@lib/supabase';

export default async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`,
  });

  if (error) {
    throw error;
  }
}
