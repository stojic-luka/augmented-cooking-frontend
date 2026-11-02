import { Alert, Button, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { notifications } from '@mantine/notifications';
import { LuFolders } from 'react-icons/lu';
import { EmptyState } from '@components';
import { RecipeCard } from '@features/recipes';
import { useCollection, useRemoveRecipeFromCollection } from '../hooks';
import { useRecipeRatings } from '@features/reviews';

interface CollectionDetailPageProps {
  collectionId: string;
}

export function CollectionDetailPage({ collectionId }: Readonly<CollectionDetailPageProps>) {
  const navigate = useNavigate();
  const collectionQuery = useCollection(collectionId);
  const removeRecipe = useRemoveRecipeFromCollection(collectionId);
  const recipesFlattened = collectionQuery.data?.recipes ?? [];
  const ratingsQuery = useRecipeRatings(recipesFlattened.map((recipe) => recipe.id));

  if (collectionQuery.isPending) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width={260} radius="sm" />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height={340} radius="md" />
          ))}
        </SimpleGrid>
      </Stack>
    );
  }

  if (collectionQuery.isError) {
    return (
      <Alert color="red" variant="light" title="Could not load collection">
        <Stack gap="sm">
          <Text size="sm">{collectionQuery.error.message}</Text>
          <Button variant="light" color="red" size="sm" maw="fit-content" onClick={() => collectionQuery.refetch()}>
            Retry
          </Button>
        </Stack>
      </Alert>
    );
  }

  const collection = collectionQuery.data;
  const ratings = ratingsQuery.data ?? new Map();

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="sm">
            <Title order={1}>{collection.name}</Title>
            <Text size="xs" c="dimmed" mt={6}>
              {collection.is_public ? 'public' : 'private'}
            </Text>
          </Group>
          {collection.description ? (
            <Text c="dimmed" mt={4}>
              {collection.description}
            </Text>
          ) : null}
        </div>
        <Button
          variant="light"
          onClick={() => {
            const url = `${window.location.origin}/collections/${collection.id}`;
            navigator.clipboard
              .writeText(url)
              .then(() => {
                notifications.show({ message: 'Collection link copied.', color: 'green' });
              })
              .catch(() => {
                notifications.show({ message: 'Could not copy the link.', color: 'red' });
              });
          }}
        >
          Share
        </Button>
      </Group>

      {collection.recipes.length === 0 ? (
        <EmptyState
          icon={LuFolders}
          title="This collection is empty"
          description="Open any recipe and use the “add to collection” action to file it here."
          actionLabel="Browse recipes"
          onAction={() => navigate({ to: '/recipes', search: {} })}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {collection.recipes.map((recipe) => {
            const rating = ratings.get(recipe.id);
            return (
              <Paper key={recipe.id} p={0} radius={12}>
                <RecipeCard recipe={recipe} rating={rating?.average ?? null} reviewCount={rating?.count} />
                <Group justify="flex-end" px="md" pb="md">
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    loading={removeRecipe.isPending}
                    onClick={() => removeRecipe.mutate(recipe.id)}
                  >
                    Remove
                  </Button>
                </Group>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
}
