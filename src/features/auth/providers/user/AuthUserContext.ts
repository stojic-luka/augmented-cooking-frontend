import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';
import type { PublicProfilesRow } from '@/types/schemas';

export interface AuthUserContextValue {
  user: User | null;
  profile: PublicProfilesRow | null;
  /** True until the initial session lookup resolves. */
  isLoading: boolean;
  isAuthed: boolean;
  role: 'user' | 'moderator' | 'admin' | undefined;
  signOut: () => Promise<void>;
}

export const AuthUserContext = createContext<AuthUserContextValue | null>(null);
