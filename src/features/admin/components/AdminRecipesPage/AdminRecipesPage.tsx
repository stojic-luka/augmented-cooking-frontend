import { useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Loader,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { LuClipboardList, LuSearch } from 'react-icons/lu';
import { useAutoLoadMore } from '@features/recipes';
import { EmptyState } from '@components';
import { useAdminDeleteRecipe, useAdminModerateRecipe, useAdminRecipes } from '../../hooks';

export function AdminRecipesPage() {
  const recipesQuery = useAdminRecipes();
  const deleteRecipe = useAdminDeleteRecipe();
  const moderate = useAdminModerateRecipe();
  const [search, setSearch] = useState('');

  const recipes = recipesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const filtered = recipes.filter((recipe) =>
    `${recipe.title} ${recipe.author_name ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  const isLoadMoreError = recipesQuery.isFetchNextPageError;
  const loadMore = () => void recipesQuery.fetchNextPage();

  const sentinelRef = useRef<HTMLDivElement>(null);
  useAutoLoadMore(
    sentinelRef,
    loadMore,
    recipesQuery.hasNextPage && !recipesQuery.isFetchingNextPage && !isLoadMoreError,
  );

  if (recipesQuery.isPending) {
    return (
      <Stack gap="lg">
        <Title order={1}>Recipe registry</Title>
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} height={34} radius="sm" />
        ))}
      </Stack>
    );
  }

  if (recipesQuery.isError) {
    return (
      <Stack gap="lg">
        <Title order={1}>Recipe registry</Title>
        <Alert color="red" title="Could not load recipes">
          <Stack gap="sm">
            <Text size="sm">{recipesQuery.error.message}</Text>
            <Button variant="light" color="red" maw="fit-content" onClick={() => void recipesQuery.refetch()}>
              Retry
            </Button>
          </Stack>
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title order={1}>Recipe registry</Title>

      <TextInput
        placeholder="Search by title or author…"
        leftSection={<LuSearch size={16} />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        maw={420}
      />

      {recipes.length === 0 ? (
        <EmptyState
          icon={LuClipboardList}
          title="No recipes yet"
          description="Every recipe created in the app lands here for moderation, public or not."
        />
      ) : (
        <Card p={0}>
          <ScrollArea>
            <Table verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Recipe</Table.Th>
                  <Table.Th>Author</Table.Th>
                  <Table.Th>Visibility</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((recipe) => (
                  <Table.Tr key={recipe.id}>
                    <Table.Td>
                      <Text size="sm" fw={500} maw={260} truncate>
                        {recipe.title}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{recipe.author_name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light" color={recipe.is_public ? 'brand' : 'gray'}>
                        {recipe.is_public ? 'public' : 'private'}
                      </Badge>
                    </Table.Td>
                    <Table.Td w={160}>
                      <Select
                        value={recipe.moderation_status}
                        data={['approved', 'pending', 'flagged', 'rejected'].map((status) => ({
                          value: status,
                          label: status,
                        }))}
                        onChange={(value) =>
                          value &&
                          moderate.mutate({
                            recipeId: recipe.id,
                            status: value as 'approved' | 'flagged' | 'rejected',
                          })
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{new Date(recipe.created_at).toLocaleDateString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color="red"
                        variant="light"
                        size="sm"
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          modals.openConfirmModal({
                            title: 'Delete recipe',
                            centered: true,
                            children: <>Delete “{recipe.title}”? This removes it for everyone.</>,
                            labels: { confirm: 'Delete', cancel: 'Keep' },
                            confirmProps: { color: 'red' },
                            onConfirm: () => deleteRecipe.mutate(recipe.id),
                          })
                        }
                      >
                        delete
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {filtered.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text size="sm" c="dimmed" ta="center" py="md">
                        No recipes match “{search}” on the loaded pages — keep scrolling to load more.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : null}
              </Table.Tbody>
            </Table>
            {search.trim() !== '' ? (
              <Text size="xs" c="dimmed" ta="center" pb="xs">
                {filtered.length} of {recipes.length} loaded
              </Text>
            ) : null}
            <Stack ref={sentinelRef} gap="xs" align="center" py="md">
              {isLoadMoreError ? (
                <>
                  <Text size="sm" c="red">
                    Couldn&apos;t load more recipes.
                  </Text>
                  <Button variant="light" onClick={loadMore}>
                    Retry
                  </Button>
                </>
              ) : recipesQuery.isFetchingNextPage ? (
                <Loader size="sm" />
              ) : !recipesQuery.hasNextPage ? (
                <Text size="sm" c="dimmed">
                  End of the registry
                </Text>
              ) : null}
            </Stack>
          </ScrollArea>
        </Card>
      )}

      <Text size="xs" c="dimmed">
        Changing status to “rejected” hides the recipe from public browse; “delete” removes it permanently.
      </Text>
    </Stack>
  );
}
