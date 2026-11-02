import { useQuery } from '@tanstack/react-query';
import { profileKeys } from '../query-keys';
import { fetchProfile } from '../services';
import type { PublicProfilesRow } from '@/types/schemas';

export function useProfile(userId: string | null) {
  return useQuery<PublicProfilesRow | null>({
    queryKey: profileKeys.mine(userId ?? 'anonymous'),
    queryFn: () => (userId ? fetchProfile(userId) : Promise.resolve(null)),
    enabled: Boolean(userId),
    staleTime: 1000 * 60,
    retry: false,
  });
}
