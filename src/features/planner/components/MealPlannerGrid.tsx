import { useEffect, useState } from 'react';
import { Badge, Group, Loader, Modal, NumberInput, Paper, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { LuPlus } from 'react-icons/lu';
import { useRecipes } from '@features/recipes';
import type { MealPlanEntryWithRecipe, MealType } from '../types';
import { formatDayLabel, toIsoDate, type DayNutrition } from '../utils/planAggregation';

const MEAL_TYPES: { type: MealType; label: string; color: string }[] = [
  { type: 'breakfast', label: 'Breakfast', color: 'yellow' },
  { type: 'lunch', label: 'Lunch', color: 'green' },
  { type: 'dinner', label: 'Dinner', color: 'brand' },
  { type: 'snack', label: 'Snack', color: 'pink' },
];

interface MealPlannerGridProps {
  weekDays: Date[];
  entries: MealPlanEntryWithRecipe[];
  dayNutrition: Map<string, DayNutrition>;
  onAddMeal: (date: string, mealType: MealType) => void;
  onRemoveEntry: (entryId: string) => void;
  onOpenRecipe: (recipeId: string) => void;
  removing: boolean;
}

export function MealPlannerGrid({
  weekDays,
  entries,
  dayNutrition,
  onAddMeal,
  onRemoveEntry,
  onOpenRecipe,
  removing,
}: Readonly<MealPlannerGridProps>) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4, lg: 7 }} spacing="md">
      {weekDays.map((day) => {
        // Local-time formatting — toISOString would shift the date back a day
        // for every timezone east of UTC (local midnight is still "yesterday"
        // in UTC there), detaching columns from the entries' stored dates.
        const iso = toIsoDate(day);
        const dayEntries = entries.filter((entry) => entry.date === iso);
        const nutrition = dayNutrition.get(iso);

        return (
          <Paper key={iso} withBorder radius={12} p="sm" miw={0}>
            <Group justify="space-between" mb="xs" wrap="nowrap">
              <Text fw={600} size="sm">
                {formatDayLabel(day)}
              </Text>
            </Group>

            <Stack gap="xs">
              {MEAL_TYPES.map(({ type, label, color }) => {
                const entry = dayEntries.find((candidate) => candidate.meal_type === type);
                return (
                  <div key={type}>
                    <Group justify="space-between" wrap="nowrap" gap={4}>
                      <Badge size="xs" variant="light" color={color}>
                        {label}
                      </Badge>
                      {!entry ? (
                        <LuPlus
                          size={14}
                          style={{ cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => onAddMeal(iso, type)}
                          aria-label={`Add ${label} on ${formatDayLabel(day)}`}
                        />
                      ) : null}
                    </Group>
                    {entry ? (
                      <Paper withBorder p={6} radius="sm" mt={4}>
                        <Text
                          size="xs"
                          fw={500}
                          lineClamp={2}
                          style={{ cursor: 'pointer' }}
                          onClick={() => entry.recipes && onOpenRecipe(entry.recipes.id)}
                        >
                          {entry.recipes?.title ?? 'Unknown recipe'}
                        </Text>
                        <Group justify="space-between" mt={4} wrap="nowrap">
                          <Text size="xs" c="dimmed">
                            {entry.servings} servings
                          </Text>
                          <Text
                            size="xs"
                            c="red"
                            style={{ cursor: removing ? 'wait' : 'pointer' }}
                            onClick={() => onRemoveEntry(entry.id)}
                          >
                            remove
                          </Text>
                        </Group>
                      </Paper>
                    ) : (
                      <Text size="xs" c="dimmed" mt={4} mb={2}>
                        —
                      </Text>
                    )}
                  </div>
                );
              })}

              <Text size="xs" c="dimmed" mt="xs" ta="center">
                {nutrition
                  ? `${Math.round(nutrition.calories)} kcal · P${Math.round(nutrition.protein)} C${Math.round(nutrition.carbs)} F${Math.round(nutrition.fat)}`
                  : 'No meals planned'}
              </Text>
            </Stack>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}

interface RecipePickerModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  onPick: (recipeId: string, servings: number) => void;
  pending: boolean;
}

export function RecipePickerModal({ opened, onClose, title, onPick, pending }: Readonly<RecipePickerModalProps>) {
  const [query, setQuery] = useState('');
  const [servings, setServings] = useState<number>(2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The recipe query keys off the settled value — one fetch per pause, not
  // one per keystroke.
  const [debouncedQ, cancelDebounce] = useDebouncedValue(query, 300);
  const results = useRecipes({ q: debouncedQ || undefined });
  const pickerResults = results.data?.pages.flatMap((page) => page.data) ?? [];

  useEffect(() => {
    if (!opened) {
      cancelDebounce();
      setQuery('');
    }
  }, [opened]);

  const handlePick = (recipeId: string) => {
    onPick(recipeId, servings);
  };

  const handleClose = () => {
    cancelDebounce();
    setSelectedId(null);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title={title} size="lg" centered>
      <Stack gap="md">
        <Group align="flex-end" grow>
          <TextInput
            label="Search recipes"
            placeholder="By title or ingredient…"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <NumberInput
            label="Servings"
            min={1}
            max={12}
            value={servings}
            onChange={(value) => setServings(typeof value === 'number' ? value : 1)}
            w={140}
          />
        </Group>

        {results.isPending ? (
          <Loader size="sm" />
        ) : pickerResults.length > 0 ? (
          <Stack gap={4} mah={420} style={{ overflowY: 'auto' }}>
            {pickerResults.map((recipe) => (
              <Paper
                key={recipe.id}
                withBorder
                p="sm"
                radius="sm"
                style={{ cursor: 'pointer' }}
                onClick={() => handlePick(recipe.id)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={500} lineClamp={1}>
                    {recipe.title}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {/* {recipe.cuisine_name || '—'} · {recipe.prep_time_minutes} min */}
                    {recipe.prep_time_minutes} min
                  </Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No recipes found{query ? ` for “${query}”` : ''}. Create or import recipes first.
          </Text>
        )}

        {pending || selectedId ? <Loader size="xs" /> : null}
        <Text size="xs" c="dimmed">
          Pick a card to assign it with {servings} serving{servings === 1 ? '' : 's'}.
        </Text>
      </Stack>
    </Modal>
  );
}
