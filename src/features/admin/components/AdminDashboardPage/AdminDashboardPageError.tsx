import { Alert, Button, Text } from '@mantine/core';

interface AdminDashboardPageErrorProps {
  error: Error;
  reset: () => void;
}

export function AdminDashboardPageError({ error, reset }: Readonly<AdminDashboardPageErrorProps>) {
  return (
    <Alert color="red" title="Metrics unavailable">
      <Text size="sm">{error.message}</Text>
      <Button variant="subtle" color="red" size="xs" mt="sm" onClick={() => reset()}>
        Retry
      </Button>
    </Alert>
  );
}
