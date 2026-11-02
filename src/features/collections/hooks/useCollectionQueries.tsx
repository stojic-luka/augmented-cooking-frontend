import { useQuery } from '@tanstack/react-query';
import { collectionKeys } from '../query-keys';
import { fetchCollection, fetchCollections } from '../services';

export function useCollections(userId: string | null) {
  return useQuery({
    queryKey: collectionKeys.mine(userId ?? 'anonymous'),
    queryFn: () => fetchCollections(userId as string),
    enabled: Boolean(userId),
  });
}

export function useCollection(id: string) {
  return useQuery({
    queryKey: collectionKeys.detail(id),
    queryFn: () => fetchCollection(id),
    enabled: Boolean(id),
  });
}
