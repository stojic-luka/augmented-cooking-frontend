export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  recipes: () => [...adminKeys.all, 'recipes'] as const,
  plans: () => [...adminKeys.all, 'plans'] as const,
  models: () => [...adminKeys.all, 'models'] as const,
  metrics: () => [...adminKeys.all, 'metrics'] as const,
  bugReports: () => [...adminKeys.all, 'bug-reports'] as const,
};
