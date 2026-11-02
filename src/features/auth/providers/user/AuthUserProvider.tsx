import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { logout } from '../../services';
import { useProfile } from '@features/profile/hooks/useProfile';
import { AuthUserContext } from './AuthUserContext';
import type { PublicProfilesRow } from '@/types/schemas';

export function AuthUserProvider({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setIsLoading(false);
      })
      .catch(() => {
        // A failed initial lookup must not strand every auth gate on its
        // loading state; the auth listener corrects this on the next event.
        setSession(null);
        setIsLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const userId = session?.user?.id ?? null;
  const profileQuery = useProfile(userId);
  const profile: PublicProfilesRow | null = profileQuery.data ?? null;

  // React Compiler memoizes this object; no manual useMemo.
  const value = {
    user: session?.user ?? null,
    profile,
    isLoading,
    isAuthed: Boolean(session),
    // The profile's stored role; undefined while the profile row is loading.
    role: profile?.role,
    signOut: async () => {
      await logout();
    },
  };

  return <AuthUserContext.Provider value={value}>{children}</AuthUserContext.Provider>;
}
