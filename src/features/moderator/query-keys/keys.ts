export const moderatorKeys = {
  all: ['moderator'] as const,
  pendingRecipes: () => [...moderatorKeys.all, 'pending-recipes'] as const,
  reviews: () => [...moderatorKeys.all, 'reviews'] as const,
  reports: () => [...moderatorKeys.all, 'reports'] as const,
  tickets: () => [...moderatorKeys.all, 'tickets'] as const,
  ticketMessages: (ticketId: string) => [...moderatorKeys.all, 'ticket-messages', ticketId] as const,
};
