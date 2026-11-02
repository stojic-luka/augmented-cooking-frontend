import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { collectionKeys } from '../query-keys';
import { createCollection, deleteCollection } from '../services';
import type { CollectionFormValues } from '../types';

function useInvalidateCollections(userId: string | null, collectionId?: string) {
  const queryClient = useQueryClient();
  return () => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: collectionKeys.mine(userId) });
    }
    if (collectionId) {
      queryClient.invalidateQueries({ queryKey: collectionKeys.detail(collectionId) });
    }
  };
}

export function useCreateCollection(userId: string | null) {
  const invalidate = useInvalidateCollections(userId);

  return useMutation({
    mutationFn: (input: CollectionFormValues) => {
      if (!userId) return Promise.reject(new Error('Sign in to create collections.'));
      return createCollection(userId, input);
    },
    onSuccess: () => {
      invalidate();
      notifications.show({ message: 'Collection created.', color: 'green' });
    },
  });
}

export function useDeleteCollection(userId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCollections(userId);

  return useMutation({
    mutationFn: (id: string) => {
      if (!userId) return Promise.reject(new Error('Sign in first.'));
      return deleteCollection(id, userId);
    },
    onSuccess: (_data, id) => {
      invalidate();
      // The detail no longer exists — drop it from the cache entirely.
      queryClient.removeQueries({ queryKey: collectionKeys.detail(id) });
    },
  });
}
