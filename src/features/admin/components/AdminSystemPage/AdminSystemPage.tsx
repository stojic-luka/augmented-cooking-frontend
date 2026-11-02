import { Stack, Title } from '@mantine/core';
import { AdminPlansSection } from './AdminSystemPagePlans';
import { AdminModelsSection } from './AdminSystemPageModels';

export function AdminSystemPage() {
  return (
    <Stack gap="xl">
      <Title order={1}>AI & system configuration</Title>
      <AdminPlansSection />
      <AdminModelsSection />
    </Stack>
  );
}
