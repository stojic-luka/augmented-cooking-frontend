import { infiniteQueryOptions, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { adminKeys } from '../query-keys';
import { fetchAdminBugReports, resolveBugReport } from '../services';

/**
 * Cursor pagination: the key is static — the cursor flows through
 * `pageParam`, so all pages of one inbox share a single cache entry.
 * Admin routes are auth-guarded, so no `enabled` is needed.
 */
export const bugReportsOptions = () =>
  infiniteQueryOptions({
    queryKey: adminKeys.bugReports(),
    queryFn: ({ pageParam }) => fetchAdminBugReports(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor ?? undefined : undefined),
  });
export const useBugReports = () => useInfiniteQuery(bugReportsOptions());

export function useResolveBugReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reportId: string) => resolveBugReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.bugReports() });
      notifications.show({ message: 'Bug report resolved.', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });
}
