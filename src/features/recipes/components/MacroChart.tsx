import { Box, Group, Stack, Text } from '@mantine/core';
import { scaleBand, scaleLinear } from 'd3-scale';
import { Chart } from '@tanstack/charts/react';
import { barY, defineChart } from '@tanstack/charts';

interface MacroChartProps {
  /** Grams per serving. Null values render as gaps. */
  macros: { label: string; grams: number }[];
  height?: number;
}

const MACRO_COLORS: Record<string, string> = {
  Protein: 'var(--accent)',
  Carbs: 'var(--warning)',
  Fat: 'var(--pink-text)',
};

/** Per-serving macro breakdown as a simple bar chart. */
export function MacroChart({ macros, height = 220 }: Readonly<MacroChartProps>) {
  const data = macros.map((macro) => ({ ...macro, fill: MACRO_COLORS[macro.label] ?? 'var(--accent)' }));

  const definition = defineChart({
    marks: [
      barY(data, {
        x: (d) => d.label,
        y: (d) => d.grams,
        fill: (d) => d.fill,
      }),
    ],
    scales: { x: { scale: scaleBand }, y: { scale: scaleLinear } },
  });

  return (
    <Stack gap="sm">
      <Box h={height} w="100%">
        <Chart definition={definition} height={height} ariaLabel="Macronutrient breakdown" />
      </Box>
      <Group gap="md" justify="center">
        {macros.map((macro) => (
          <Group key={macro.label} gap={6}>
            <Box
              w={10}
              h={10}
              style={{ background: MACRO_COLORS[macro.label] ?? 'var(--text-tertiary)', borderRadius: 2 }}
            />
            <Text size="xs" c="dimmed">
              {macro.label}: {macro.grams} g
            </Text>
          </Group>
        ))}
      </Group>
    </Stack>
  );
}
