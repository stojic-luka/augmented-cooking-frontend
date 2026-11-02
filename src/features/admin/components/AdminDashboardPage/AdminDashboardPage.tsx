import { Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { LuUsers, LuBookOpen, LuStar, LuCoins } from 'react-icons/lu';
import { SimpleBarChart, MetricText } from '../SimpleBarChart/SimpleBarChart';
import { useSystemMetrics } from '../../hooks';

export function AdminDashboardPage() {
  const metricsQuery = useSystemMetrics();
  const metrics = metricsQuery.data!;

  return (
    <Stack gap="xl">
      <Title order={1}>System dashboard</Title>

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <MetricCard
          icon={<LuUsers size={18} />}
          label="Users (first 1k)"
          value={metrics.totalUsers.toLocaleString()}
        />
        <MetricCard
          icon={<LuCoins size={18} />}
          label="Premium users"
          value={metrics.premiumUsers.toLocaleString()}
        />
        <MetricCard
          icon={<LuBookOpen size={18} />}
          label="Recipes (first 1k)"
          value={metrics.totalRecipes.toLocaleString()}
        />
        <MetricCard icon={<LuStar size={18} />} label="Reviews" value={metrics.totalReviews.toLocaleString()} />
      </SimpleGrid>

      <Group align="flex-start" gap="lg">
        <Card style={{ flex: 1, minWidth: 300 }}>
          <Text fw={600} mb="sm">
            Signups by month
          </Text>
          {metrics.signupsByMonth.length === 0 ? (
            <EmptyChartNote />
          ) : (
            <SimpleBarChart
              data={metrics.signupsByMonth.map((entry) => ({ label: entry.label, value: entry.users }))}
              color="var(--accent)"
            />
          )}
        </Card>
        <Card style={{ flex: 1, minWidth: 300 }}>
          <Text fw={600} mb="sm">
            Recipes by cuisine
          </Text>
          {metrics.recipesByCuisine.length === 0 ? (
            <EmptyChartNote />
          ) : (
            <SimpleBarChart
              data={metrics.recipesByCuisine.map((entry) => ({ label: entry.label, value: entry.recipes }))}
              color="var(--success)"
            />
          )}
        </Card>
      </Group>

      <Text size="xs" c="dimmed">
        Metrics are aggregated client-side over a bounded window for now; heavy analytics will move to a backend endpoint.
      </Text>
    </Stack>
  );
}

function EmptyChartNote() {
  return (
    <Text size="sm" c="dimmed" py="xl" ta="center">
      No data yet — charts fill in as the platform is used.
    </Text>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}
function MetricCard({ icon, label, value }: Readonly<MetricCardProps>) {
  return (
    <Card>
      <Group justify="space-between">
        <MetricText label={label} value={value} />
        {icon}
      </Group>
    </Card>
  );
}
