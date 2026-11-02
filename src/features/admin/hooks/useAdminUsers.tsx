import { infiniteQueryOptions, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { adminKeys } from '../query-keys';
import { fetchAdminUsers, updateUser } from '../services';

/**
 * Cursor pagination: the key is static — the cursor flows through
 * `pageParam`, so all pages of one registry share a single cache entry.
 * Admin routes are auth-guarded, so no `enabled` is needed.
 */
export const adminUsersOptions = () =>
  infiniteQueryOptions({
    queryKey: adminKeys.users(),
    queryFn: ({ pageParam }) => fetchAdminUsers(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor ?? undefined : undefined),
  });
export const useAdminUsers = () => useInfiniteQuery(adminUsersOptions());

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, ...patch }: { userId: string } & Parameters<typeof updateUser>[1]) => updateUser(userId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      notifications.show({ message: 'User updated.', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });
}
