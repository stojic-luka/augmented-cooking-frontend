import { getSupabaseBrowserClient } from '@lib/supabase';
import { fetchProfile } from '@features/profile/services';
import type { ApiResponseData, LoginResponse } from '@/types/api/response';
import type { Enums } from '@/types/database.types';

export default async function login(
  email: string,
  password: string,
): Promise<ApiResponseData<LoginResponse & { role: Enums<'app_role'> }>> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw error ?? new Error('Unable to sign in.');
  }

  // The role resolves from the fresh session's profile — the same source the
  // area guards read. A missing profile row falls back to plain 'user', the
  // same default AuthUserProvider uses.
  const profile = await fetchProfile(data.user.id);

  return {
    success: true,
    meta: null,
    data: { ...data.user, role: profile?.role ?? 'user' },
  };
}
