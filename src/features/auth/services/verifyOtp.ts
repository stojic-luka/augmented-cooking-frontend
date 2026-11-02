import { getSupabaseBrowserClient } from '@lib/supabase';

export default async function verifyOtp(email: string, token: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });

  if (error) {
    throw error;
  }
}
