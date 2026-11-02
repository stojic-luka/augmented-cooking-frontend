import { Center, Loader, Stack, Text } from '@mantine/core';

interface FullPageLoaderProps {
  label?: string;
}
export function FullPageLoader({ label = 'Loading…' }: Readonly<FullPageLoaderProps>) {
  return (
    <Center mih="60vh">
      <Stack align="center" gap="sm">
        <Loader size="lg" />
        {label ? (
          <Text size="sm" c="dimmed">
            {label}
          </Text>
        ) : null}
      </Stack>
    </Center>
  );
}
