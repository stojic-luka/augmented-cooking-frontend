import { useMemo, useState } from 'react';
import { ActionIcon, Alert, Button, Container, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { LuChevronLeft, LuChevronRight, LuShoppingBag } from 'react-icons/lu';
import { notifications } from '@mantine/notifications';
import { useAuthUser } from '@features/auth/providers/user';
import {
  MealPlannerGrid,
  NutritionInsights,
  RecipePickerModal,
  addDays,
  computeDayNutrition,
  mergePlanIngredients,
  startOfWeek,
  toIsoDate,
  useAddMealEntry,
  useMealPlan,
  useRemoveMealEntry,
} from '@features/planner';
import { useAddShoppingItems, useCreateShoppingList } from '@features/shopping';
import type { MealType } from '@features/planner';

const plannerSearchSchema = z.object({
  week: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const Route = createFileRoute('/_protected/planner/')({
  validateSearch: plannerSearchSchema,
  component: PlannerPage,
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Strict yyyy-mm-dd parse. Unlike `new Date(string)`, this rejects both
 * malformed values ("2026-13-45") and rollovers ("2026-02-30" → March 2),
 * which a plain Date parse silently accepts.
 */
function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function PlannerPage() {
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const { week } = Route.useSearch();

  // Bad/missing URL param falls back to the current week instead of
  // letting NaN propagate into query keys and API calls.
  const weekStart = useMemo(() => {
    const parsed = week ? parseIsoDate(week) : null;
    return startOfWeek(parsed ?? new Date());
  }, [week]);

  const weekEnd = addDays(weekStart, 6);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  const planQuery = useMealPlan(user?.id ?? null, toIsoDate(weekStart), toIsoDate(weekEnd));
  const addMeal = useAddMealEntry(user?.id ?? null, toIsoDate(weekStart));
  const removeMeal = useRemoveMealEntry(user?.id ?? null, toIsoDate(weekStart));
  const createList = useCreateShoppingList(user?.id ?? null);
  const addItems = useAddShoppingItems();

  const [pickerState, setPickerState] = useState<{ date: string; mealType: MealType } | null>(null);
  const [generatingList, setGeneratingList] = useState(false);

  // Stable identity: a bare `?? []` would mint a new array every render.
  const entries = useMemo(() => planQuery.data ?? [], [planQuery.data]);
  const dayNutrition = useMemo(() => computeDayNutrition(entries), [entries]);

  const navigateWeek = (direction: -1 | 1) => {
    const next = addDays(weekStart, direction * 7);
    navigate({ to: '/planner', search: { week: toIsoDate(next) } });
  };

  const handleGenerateShoppingList = async () => {
    if (!user || entries.length === 0) return;
    setGeneratingList(true);
    try {
      const list = await createList.mutateAsync(`Week of ${toIsoDate(weekStart)}`);
      await addItems.mutateAsync({
        listId: list.id,
        items: mergePlanIngredients(entries).map((ingredient) => ({
          name: ingredient.name,
          quantity: ingredient.amount,
          unit: ingredient.unit || null,
        })),
      });
      notifications.show({
        title: 'Shopping list ready',
        message: `Created “${list.name}” with this week's ingredients.`,
        color: 'green',
      });
      navigate({ to: '/shopping-list' });
    } catch (error) {
      notifications.show({
        title: 'Could not generate shopping list',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setGeneratingList(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={1}>Meal planner</Title>
            <Text c="dimmed">
              {toIsoDate(weekStart)} – {toIsoDate(weekEnd)}
            </Text>
          </div>
          <Group gap="xs">
            <ActionIcon variant="default" onClick={() => navigateWeek(-1)} aria-label="Previous week">
              <LuChevronLeft size={15} />
            </ActionIcon>
            <Button variant="default" onClick={() => navigate({ to: '/planner', search: {} })}>
              This week
            </Button>
            <ActionIcon variant="default" onClick={() => navigateWeek(1)} aria-label="Next week">
              <LuChevronRight size={15} />
            </ActionIcon>
          </Group>
        </Group>

        <Group justify="flex-end">
          <Button
            leftSection={<LuShoppingBag size={16} />}
            loading={generatingList}
            disabled={entries.length === 0 || generatingList}
            onClick={handleGenerateShoppingList}
          >
            Generate shopping list from plan
          </Button>
        </Group>

        {planQuery.isPending ? (
          <Paper withBorder p="xl" radius={12}>
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          </Paper>
        ) : planQuery.isError ? (
          <Alert color="red" variant="light" title="Could not load your plan">
            <Text size="sm">{planQuery.error.message}</Text>
          </Alert>
        ) : (
          <MealPlannerGrid
            weekDays={weekDays}
            entries={entries}
            dayNutrition={dayNutrition}
            removing={removeMeal.isPending}
            onAddMeal={(date, mealType) => setPickerState({ date, mealType })}
            onRemoveEntry={(entryId) => removeMeal.mutate(entryId)}
            onOpenRecipe={(recipeId) => navigate({ to: '/recipes/$id', params: { id: recipeId } })}
          />
        )}

        <NutritionInsights dayNutrition={dayNutrition} />
      </Stack>

      <RecipePickerModal
        opened={pickerState !== null}
        onClose={() => setPickerState(null)}
        title={`Add ${pickerState?.mealType ?? 'meal'} on ${pickerState?.date ?? ''}`}
        pending={addMeal.isPending}
        onPick={(recipeId, servings) => {
          if (!pickerState) return;
          addMeal.mutate(
            { date: pickerState.date, mealType: pickerState.mealType, recipeId, servings },
            { onSuccess: () => setPickerState(null) },
          );
        }}
      />
    </Container>
  );
}
