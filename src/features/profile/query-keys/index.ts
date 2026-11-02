export const profileKeys = {
  all: ['profiles'] as const,
  mine: (userId: string) => [...profileKeys.all, 'mine', userId] as const,
};
