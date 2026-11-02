import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { ProfileSettingsPage } from '@features/profile';

export const Route = createFileRoute('/_protected/profile/')({
  component: () => (
    <Container size="lg" py="xl">
      <ProfileSettingsPage />
    </Container>
  ),
});
