import { Alert, Button, Stack, Text } from '@mantine/core';

interface AdminBugReportsPageErrorProps {
  error: Error;
  reset: () => void;
}

export function AdminBugReportsPageError({ error, reset }: Readonly<AdminBugReportsPageErrorProps>) {
  return (
    <Alert color="red" title="Something went wrong">
      <Stack gap="sm">
        <Text size="sm">{error.message}</Text>
        <Button size="xs" variant="subtle" onClick={reset}>
          Try again
        </Button>
      </Stack>
    </Alert>
  );
}