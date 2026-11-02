import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { AiAssistantPage } from '@features/ai';

export const Route = createFileRoute('/_protected/ai-assistant/')({
  component: () => (
    <Container size="lg" py="xl">
      <AiAssistantPage />
    </Container>
  ),
});
