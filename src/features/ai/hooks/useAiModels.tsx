import { useQuery } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { fetchAiModels } from '../services/aiModels';

export const aiModelsOptions = (enabled: boolean) =>
  queryOptions({
    queryKey: ['ai', 'models'] as const,
    queryFn: fetchAiModels,
    enabled,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

export function useAiModels(enabled: boolean) {
  return useQuery(aiModelsOptions(enabled));
}
