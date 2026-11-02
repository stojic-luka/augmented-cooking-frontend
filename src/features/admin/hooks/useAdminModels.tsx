import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { adminKeys } from '../query-keys';
import { createModel, fetchModels, updateModel } from '../services';

export const adminModelsOptions = () => queryOptions({ queryKey: adminKeys.models(), queryFn: fetchModels });
export const useAdminModels = () => useQuery(adminModelsOptions());

export function useUpdateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ modelId, patch }: { modelId: string; patch: Parameters<typeof updateModel>[1] }) =>
      updateModel(modelId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.models() });
      notifications.show({ message: 'Model updated.', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });
}

export function useCreateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.models() });
      notifications.show({ message: 'Model registered.', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });
}
