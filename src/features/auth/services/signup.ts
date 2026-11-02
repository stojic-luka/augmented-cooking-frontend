import { getSupabaseBrowserClient } from '@lib/supabase';
import type { ApiResponseData, SignupResponse } from '@/types/api/response';

export default async function signup(
  email: string,
  password: string,
  displayName?: string,
): Promise<ApiResponseData<SignupResponse>> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // The profile row is created by the `handle_new_user` DB trigger, which
    // reads the name from `full_name` — clients cannot INSERT into profiles.
    options: displayName ? { data: { full_name: displayName } } : undefined,
  });

  if (error || !data.user) {
    throw error ?? new Error('Unable to sign up.');
  }

  return {
    success: true,
    meta: null,
    data: data.user,
  };
}
