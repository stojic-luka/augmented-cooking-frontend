import { Alert, Button, Container, Grid, Group, NumberInput, Paper, Skeleton, Stack, Text, Title } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { LuSoup } from 'react-icons/lu';
import { EmptyState } from '@components';
import {
  CookModeStepper,
  IngredientsChecklist,
  useCookModeActions,
  useRecipeDetails,
  useRecipeServings,
} from '@features/recipes';
import { useAuthUser } from '@features/auth/providers/user';

export const Route = createFileRoute('/_protected/recipes/$id/cook/')({
  component: CookModeRoute,
});

function CookModeRoute() {
  const { id } = Route.useParams();
  const { profile } = useAuthUser();
  const recipeQuery = useRecipeDetails(id);
  const servings = useRecipeServings(id, recipeQuery.data?.servings);
  const { setServings } = useCookModeActions();

  if (recipeQuery.isPending) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="md">
          <Skeleton height={32} width={260} radius={8} />
          <Skeleton height={400} radius={12} />
        </Stack>
      </Container>
    );
  }

  if (recipeQuery.isError) {
    return (
      <Container size="lg" py="xl">
        <EmptyState icon={LuSoup} title="Recipe not found" description={recipeQuery.error.message} />
      </Container>
    );
  }

  const recipe = recipeQuery.data;
  const currentServings = servings ?? recipe.servings;

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={1}>{recipe.title}</Title>
            <Text c="dimmed">Cook mode — check off ingredients as you go. Your progress is saved on this device.</Text>
          </div>
          <NumberInput
            label="Servings"
            value={currentServings}
            onChange={(value) => setServings(recipe.id, typeof value === 'number' && value > 0 ? value : 1)}
            min={1}
            max={50}
            w={120}
          />
        </Group>

        {recipe.recipe_steps.length === 0 ? (
          <Alert color="yellow" variant="light" title="No steps yet">
            This recipe has no instructions. Add steps in the editor before cooking.
          </Alert>
        ) : (
          <Grid>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <CookModeStepper steps={recipe.recipe_steps.map((step) => ({ instruction: step.instruction }))} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <IngredientsChecklist recipe={recipe} unitPreference={profile?.unit_preference ?? 'metric'} />
            </Grid.Col>
          </Grid>
        )}

        <Group justify="center">
          <Paper withBorder px="md" py="xs">
            <Text size="sm" c="dimmed">
              Base recipe: {recipe.servings} servings · currently cooking for {currentServings}
            </Text>
          </Paper>
          <Button variant="default" onClick={() => window.history.back()}>
            Back to recipe
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
