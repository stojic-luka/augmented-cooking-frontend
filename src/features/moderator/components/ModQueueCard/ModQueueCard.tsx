import { Card, Group, Text } from '@mantine/core';

interface ModQueueCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

/** Summary tile showing the size of one moderation queue. */
export function ModQueueCard({ icon, label, value }: Readonly<ModQueueCardProps>) {
  return (
    <Card>
      <Group justify="space-between">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {label}
          </Text>
          <Text size="xl" fw={700}>
            {value}
          </Text>
        </div>
        {icon}
      </Group>
    </Card>
  );
}