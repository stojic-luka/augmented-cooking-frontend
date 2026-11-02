export const reportKeys = {
  all: ['reports'] as const,
  mine: (userId: string) => [...reportKeys.all, 'mine', userId] as const,
  queue: () => [...reportKeys.all, 'queue'] as const,
};
