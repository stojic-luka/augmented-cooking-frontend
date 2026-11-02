export const collectionKeys = {
  all: ['collections'] as const,
  mine: (userId: string) => [...collectionKeys.all, 'mine', userId] as const,
  detail: (id: string) => [...collectionKeys.all, 'detail', id] as const,
};
