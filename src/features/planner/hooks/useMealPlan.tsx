import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { plannerKeys } from '../query-keys';
import { addMealEntry, fetchMealPlan, removeMealEntry, updateMealEntryServings } from '../services';
import type { MealType } from '../types';

export function useMealPlan(userId: string | null, weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: plannerKeys.week(userId ?? 'anonymous', weekStart),
    queryFn: () => fetchMealPlan(userId, weekStart, weekEnd),
  });
}

export function useAddMealEntry(userId: string | null, weekStart: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { date: string; mealType: MealType; recipeId: string; servings: number }) => {
      return addMealEntry(userId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.week(userId ?? 'anonymous', weekStart) });
      notifications.show({ message: 'Meal added to your plan.', color: 'green' });
    },
  });
}

export function useUpdateMealServings(userId: string | null, weekStart: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId, servings }: { entryId: string; servings: number }) => updateMealEntryServings(entryId, servings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.week(userId ?? 'anonymous', weekStart) });
    },
  });
}

export function useRemoveMealEntry(userId: string | null, weekStart: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entryId: string) => removeMealEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.week(userId ?? 'anonymous', weekStart) });
    },
  });
}
