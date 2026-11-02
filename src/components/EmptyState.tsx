import { ActionIcon, Button, Stack, Text, Title } from '@mantine/core';
import type { IconType } from 'react-icons';

interface EmptyStateProps {
  icon: IconType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: Readonly<EmptyStateProps>) {
  return (
    <Stack align="center" ta="center" gap={0} py={52} px={24}>
      <ActionIcon component="div" size={44} radius={12} variant="light">
        <Icon size={21} />
      </ActionIcon>
      <Title order={4} mt={18}>
        {title}
      </Title>
      <Text size="13.5" c="dimmed" ta="center" maw={360} mt={6} lh={1.6}>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Button onClick={onAction} mt={22}>
          {actionLabel}
        </Button>
      ) : null}
    </Stack>
  );
}
