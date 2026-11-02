import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { CollectionDetailPage } from '@features/collections';

export const Route = createFileRoute('/_protected/collections/$id/')({
  component: CollectionDetailRoute,
});

function CollectionDetailRoute() {
  const { id } = Route.useParams();
  return (
    <Container size="lg" py="xl">
      <CollectionDetailPage collectionId={id} />
    </Container>
  );
}
