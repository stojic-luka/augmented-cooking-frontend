import { Title, Text, Stack, Group } from '@mantine/core';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  rightSection?: ReactNode;
  icon?: ReactNode;
}
export function PageHeader({
  title,
  description,
  rightSection,
  icon,
}: Readonly<PageHeaderProps>) {
  if (rightSection || icon) {
    return (
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="lg">
        <Stack gap={6}>
          <Title order={1}>
            {icon ? <span style={{ marginRight: 10 }}>{icon}</span> : null}
            {title}
          </Title>
          {description && <Text c="dimmed">{description}</Text>}
        </Stack>
        {rightSection}
      </Group>
    );
  }

  return (
    <header>
      <Stack gap={6}>
        <Title order={1}>{title}</Title>
        {description && <Text c="dimmed">{description}</Text>}
      </Stack>
    </header>
  );
}
