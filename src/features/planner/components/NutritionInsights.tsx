import { Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { MacroChart } from '@features/recipes';
import type { DayNutrition } from '../utils/planAggregation';

interface NutritionInsightsProps {
  dayNutrition: Map<string, DayNutrition>;
}

/** Weekly nutrition rollup over planned meals. */
export function NutritionInsights({ dayNutrition }: Readonly<NutritionInsightsProps>) {
  const days = [...dayNutrition.values()];
  if (days.length === 0) {
    return (
      <Paper withBorder p="md" radius={12}>
        <Text size="sm" c="dimmed">
          Plan meals to see weekly nutrition insights.
        </Text>
      </Paper>
    );
  }

  const totals = days.reduce(
    (acc, day) => ({
      calories: acc.calories + day.calories,
      protein: acc.protein + day.protein,
      carbs: acc.carbs + day.carbs,
      fat: acc.fat + day.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const count = days.length;

  const perDayMacro = (total: number) => Math.round(total / count);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <StatCard label="Avg calories / day" value={`${Math.round(totals.calories / count)} kcal`} />
        <StatCard label="Avg protein / day" value={`${perDayMacro(totals.protein)} g`} />
        <StatCard label="Avg carbs / day" value={`${perDayMacro(totals.carbs)} g`} />
        <StatCard label="Avg fat / day" value={`${perDayMacro(totals.fat)} g`} />
      </SimpleGrid>

      <Paper withBorder p="md" radius={12}>
        <Text fw={600} size="sm" mb="sm">
          Average daily macros (g)
        </Text>
        <MacroChart
          macros={[
            { label: 'Protein', grams: perDayMacro(totals.protein) },
            { label: 'Carbs', grams: perDayMacro(totals.carbs) },
            { label: 'Fat', grams: perDayMacro(totals.fat) },
          ]}
          height={180}
        />
      </Paper>
    </Stack>
  );
}

interface StatCard {
  label: string;
  value: string;
}
function StatCard({ label, value }: Readonly<StatCard>) {
  return (
    <Paper withBorder p="sm" radius={12} ta="center">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
    </Paper>
  );
}
