export const plannerKeys = {
  all: ['planner'] as const,
  week: (userId: string, weekStart: string) => [...plannerKeys.all, 'week', userId, weekStart] as const,
};
