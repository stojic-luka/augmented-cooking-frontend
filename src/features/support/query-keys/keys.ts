export const supportKeys = {
  all: ['support'] as const,
  mine: (userId: string) => [...supportKeys.all, 'mine', userId] as const,
  messages: (ticketId: string) => [...supportKeys.all, 'messages', ticketId] as const,
  queue: () => [...supportKeys.all, 'queue'] as const,
};
