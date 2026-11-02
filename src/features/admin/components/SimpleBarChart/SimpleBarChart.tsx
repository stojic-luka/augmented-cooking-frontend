import { Box, Stack, Text } from '@mantine/core';
import { Chart } from '@tanstack/charts/react';
import { barY, defineChart } from '@tanstack/charts';
import { scaleBand, scaleLinear } from 'd3-scale';

interface SimpleBarChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}

export function SimpleBarChart({
  data,
  color = 'var(--accent)',
  height = 240,
}: Readonly<SimpleBarChartProps>) {
  const withColor = data.map((entry) => ({ ...entry, fill: color }));

  const definition = defineChart({
    marks: [
      barY(withColor, {
        x: (d) => d.label,
        y: (d) => d.value,
        fill: (d) => d.fill,
      }),
    ],
    scales: { x: { scale: scaleBand }, y: { scale: scaleLinear } },
  });

  return (
    <Stack gap="sm">
      <Box h={height} w="100%">
        <Chart definition={definition} height={height} ariaLabel="Bar chart" />
      </Box>
    </Stack>
  );
}

interface MetricTextProps {
  label: string;
  value: string;
}
export function MetricText({ label, value }: Readonly<MetricTextProps>) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700}>
        {value}
      </Text>
    </Stack>
  );
}
