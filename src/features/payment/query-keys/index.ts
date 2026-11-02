export const paymentKeys = {
  all: ['payment'] as const,
  plans: () => [...paymentKeys.all, 'plans'] as const,
};
