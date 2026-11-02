import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { paymentKeys } from '../query-keys';
import { buyTokens, fetchSubscriptionPlans, requestPlanChange } from '../services/billing';
import { profileKeys } from '@features/profile';
import { useAuthUser } from '@features/auth/providers/user';

export const useSubscriptionPlansOptions = () =>
  queryOptions({
    queryKey: paymentKeys.plans(),
    queryFn: fetchSubscriptionPlans,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
export const useSubscriptionPlans = () => useQuery(useSubscriptionPlansOptions());

export function useRequestPlanChange() {
  const { user } = useAuthUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => requestPlanChange(planId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.mine(user?.id ?? 'anonymous') });
      notifications.show({ title: 'Request recorded', message: result.message, color: 'green' });
    },
    onError: (error) => {
      notifications.show({
        title: 'Request failed',
        message: error instanceof Error ? error.message : 'Something went wrong.',
        color: 'red',
      });
    },
  });
}

export function useBuyTokens() {
  const { user } = useAuthUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tokens: number) => buyTokens(tokens),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.mine(user?.id ?? 'anonymous') });
      notifications.show({ title: 'Request recorded', message: result.message, color: 'green' });
    },
    onError: (error) => {
      notifications.show({
        title: 'Purchase failed',
        message: error instanceof Error ? error.message : 'Something went wrong.',
        color: 'red',
      });
    },
  });
}
