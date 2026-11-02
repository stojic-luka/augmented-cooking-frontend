import { queryOptions, useQuery } from '@tanstack/react-query';
import { adminKeys } from '../query-keys';
import { fetchSystemMetrics } from '../services';

export const systemMetricsOptions = () => queryOptions({ queryKey: adminKeys.metrics(), queryFn: fetchSystemMetrics });
export const useSystemMetrics = () => useQuery(systemMetricsOptions());
