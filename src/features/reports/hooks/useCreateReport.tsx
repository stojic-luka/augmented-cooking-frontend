import { useMutation } from '@tanstack/react-query';
import { createReport } from '../services';
import type { CreateReportInput } from '../types';

export function useCreateReport() {
  return useMutation({
    mutationFn: (input: CreateReportInput) => createReport(input),
  });
}
