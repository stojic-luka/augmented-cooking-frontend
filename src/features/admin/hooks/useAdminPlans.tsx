import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { adminKeys } from '../query-keys';
import { fetchPlans, updatePlan } from '../services';

export const adminPlansOptions = () => queryOptions({ queryKey: adminKeys.plans(), queryFn: fetchPlans });
export const useAdminPlans = () => useQuery(adminPlansOptions());

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, patch }: { planId: string; patch: Parameters<typeof updatePlan>[1] }) =>
      updatePlan(planId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.plans() });
      notifications.show({ message: 'Plan updated.', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });
}
