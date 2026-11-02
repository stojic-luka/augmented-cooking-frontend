import type { PublicAppRole } from '@/types/schemas';

/** The two staff areas behind role-gated guards and nav entries. */
export type StaffArea = 'admin' | 'moderator';

/**
 * One source of truth for staff-area access: which areas each role may
 * enter. Admins also moderate. The _admin/_moderator guards, the protected
 * sidebar entries, and the post-login redirect all read from here — never
 * inline role checks. An unresolved role (`undefined` while the profile row
 * is still loading) grants access to nothing.
 */
const ROLE_AREAS: Record<PublicAppRole, readonly StaffArea[]> = {
  user: [],
  moderator: ['moderator'],
  admin: ['admin', 'moderator'],
};

export function canAccessArea(role: PublicAppRole | undefined, area: StaffArea): boolean {
  return role !== undefined && ROLE_AREAS[role].includes(area);
}

/** Where each role lands after signing in with no explicit destination. */
const ROLE_START_PATH: Record<PublicAppRole, string> = {
  user: '/recipes/search',
  moderator: '/mod',
  admin: '/admin',
};

export function roleStartPath(role: PublicAppRole): string {
  return ROLE_START_PATH[role];
}
