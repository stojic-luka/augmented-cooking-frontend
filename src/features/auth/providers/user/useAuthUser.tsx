import { useContext } from 'react';
import { AuthUserContext } from './AuthUserContext';
import type { AuthUserContextValue } from './AuthUserContext';

export function useAuthUser(): AuthUserContextValue {
  const ctx = useContext(AuthUserContext);
  if (!ctx) {
    throw new Error('useAuthUser must be used within AuthUserProvider');
  }
  return ctx;
}
