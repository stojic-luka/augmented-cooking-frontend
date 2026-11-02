import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { moderatorKeys } from '../query-keys';
import { fetchReportQueue, updateReportStatus } from '../services';
import type { PublicReportStatus } from '@/types/schemas';

export const useReportQueueOptions = () =>
  queryOptions({
    queryKey: moderatorKeys.reports(),
    queryFn: fetchReportQueue,
  });
export const useReportQueue = () => useQuery(useReportQueueOptions());

export function useSetReportStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, status }: { reportId: string; status: Exclude<PublicReportStatus, 'open'> }) =>
      updateReportStatus(reportId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: moderatorKeys.reports() });
      notifications.show({ message: `Report marked as ${variables.status}.`, color: 'green' });
    },
  });
}
