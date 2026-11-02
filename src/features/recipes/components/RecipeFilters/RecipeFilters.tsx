import { useEffect, useRef, useState } from 'react';
import { Accordion, Button, Group, MultiSelect, Paper, RangeSlider, Select, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { LuFilter, LuSearch } from 'react-icons/lu';
import { useCuisines } from '../../hooks';
import type { RecipeFilterParams } from '../../types';
import { publicDietaryTagSchema } from '@/types/schemas';

const PREP_TIME_OPTIONS = ['15', '30', '45', '60', '120'].map((value) => ({
  value,
  label: `${value} min or less`,
}));

const CALORIE_MIN = 0;
const CALORIE_MAX = 2000;

interface RecipeFiltersProps {
  search: RecipeFilterParams;
  onChange: (patch: Partial<RecipeFilterParams>) => void;
  onClear: () => void;
}

/** Advanced multi-criteria search panel. State lives in the URL. */
export function RecipeFilters({ search, onChange, onClear }: Readonly<RecipeFiltersProps>) {
  const calorieRange: [number, number] = [search.min_calories ?? CALORIE_MIN, search.max_calories ?? CALORIE_MAX];
  const cuisinesQuery = useCuisines();
  const cuisineOptions = cuisinesQuery.data ?? [];

  // Keystrokes stay local; the URL (and with it the list + count queries)
  // receives the settled value. Writing per keystroke refetched everything
  // on every letter and flashed the grid's pending skeleton.
  const [qDraft, setQDraft] = useState(search.q ?? '');
  const [debouncedQ, cancelDebounce] = useDebouncedValue(qDraft, 300);
  const lastPublished = useRef(search.q);

  // Adopt external changes only — our own writes land as search.q === lastPublished,
  // so they're skipped here and the cursor never jumps.
  useEffect(() => {
    if (search.q !== lastPublished.current) {
      setQDraft(search.q ?? '');
      lastPublished.current = search.q;
      cancelDebounce(); // kill any in-flight publish from before the reset
    }
  }, [search.q, cancelDebounce]);

  // Publish the settled draft — only while it still matches the input, so an
  // external clear is never re-overwritten with a stale draft.
  useEffect(() => {
    if (debouncedQ !== qDraft) return;
    const next = debouncedQ.trim() ? debouncedQ.trim() : undefined;
    if (lastPublished.current !== next) {
      lastPublished.current = next;
      onChange({ q: next });
    }
  }, [debouncedQ, qDraft, onChange]);

  return (
    <Paper p="md" radius={12} withBorder>
      <Group grow align="flex-end" mb="md">
        <TextInput
          placeholder="Search recipes and ingredients…"
          leftSection={<LuSearch size={16} />}
          label="Search"
          value={qDraft}
          onChange={(event) => setQDraft(event.currentTarget.value)}
        />
        <Select
          label="Sort by"
          data={[
            { value: 'recent', label: 'Newest' },
            { value: 'rating', label: 'Top rated' },
            { value: 'time', label: 'Quickest' },
          ]}
          value={search.sort ?? 'recent'}
          onChange={(next) => onChange({ sort: (next ?? 'recent') as RecipeFilterParams['sort'] })}
          allowDeselect={false}
        />
      </Group>

      <Accordion variant="contained">
        <Accordion.Item value="advanced">
          <Accordion.Control icon={<LuFilter size={16} />}>
            Advanced filters
            {search.cuisines?.length ||
            search.dietary?.length ||
            search.max_prep_time ||
            search.min_calories ||
            search.max_calories ? (
              <Text component="span" size="xs" c="brand" ml="sm">
                active
              </Text>
            ) : null}
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Group grow align="flex-start">
                <MultiSelect
                  label="Cuisine"
                  placeholder="Any cuisine"
                  data={cuisineOptions.map((cuisine) => cuisine.name)}
                  searchable
                  clearable
                  value={search.cuisines ?? []}
                  onChange={(next) => onChange({ cuisines: next.length ? next : undefined })}
                />
                <MultiSelect
                  label="Dietary"
                  placeholder="Any diet"
                  data={[...publicDietaryTagSchema.options.map((opt) => opt.value)]}
                  clearable
                  value={search.dietary ?? []}
                  onChange={(next) => onChange({ dietary: next.length ? next : undefined })}
                />
                <Select
                  label="Prep time"
                  placeholder="Any duration"
                  data={PREP_TIME_OPTIONS}
                  clearable
                  value={search.max_prep_time ? String(search.max_prep_time) : null}
                  onChange={(next) => onChange({ max_prep_time: next ? Number(next) : undefined })}
                />
              </Group>

              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Calories (kcal)
                </Text>
                <RangeSlider
                  min={CALORIE_MIN}
                  max={CALORIE_MAX}
                  step={50}
                  value={calorieRange}
                  onChangeEnd={([min, max]) =>
                    onChange({
                      min_calories: min > CALORIE_MIN ? min : undefined,
                      max_calories: max < CALORIE_MAX ? max : undefined,
                    })
                  }
                />
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    {calorieRange[0]} kcal
                  </Text>
                  <Text size="xs" c="dimmed">
                    {calorieRange[1]} kcal
                  </Text>
                </Group>
              </Stack>

              <Button leftSection={<LuFilter size={16} />} variant="light" w="fit-content" onClick={onClear}>
                Clear all filters
              </Button>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  );
}
