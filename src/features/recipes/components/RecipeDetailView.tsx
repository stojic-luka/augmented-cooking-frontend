import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Grid,
  Group,
  List,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { notifications } from '@mantine/notifications';
import {
  LuBrain,
  LuChevronRight,
  LuClock,
  LuCopy,
  LuFlag,
  LuFolders,
  LuHeart,
  LuPencil,
  LuScale,
  LuShare2,
  LuShoppingBasket,
  LuSoup,
  LuSparkles,
} from 'react-icons/lu';
import { RatingStars } from '@components';
import { useAuthUser } from '@features/auth/providers/user';
import {
  MacroChart,
  useUpdateRecipe,
  convertIngredient,
  formatIngredientAmount,
  useCopyRecipe,
  useCheckedIngredients,
  useCookModeActions,
  useIsFavorite,
  useRecipeServings,
  useToggleFavoriteRecipe,
} from '@features/recipes';
import { AddToShoppingListModal } from '@features/shopping';
import { AiEditRecipeModal, toAiDraft, useAnalyzeNutrition } from '@features/ai';
import { useCreateReport } from '@features/reports';
import { ReviewsSection } from '@features/reviews';
import type { FullRecipe } from '../types';
import { AddToCollectionModal } from '@features/collections';
import { RecipeImage } from './RecipeImage';
import { useRecipeImageUrl } from '../hooks/useRecipeImageUrl';

interface RecipeDetailViewProps {
  recipe: FullRecipe;
  averageRating?: number | null;
  reviewCount?: number;
}

export function RecipeDetailView({ recipe, averageRating, reviewCount }: Readonly<RecipeDetailViewProps>) {
  const { user, profile, isAuthed } = useAuthUser();
  const navigate = useNavigate();

  const { data: imageUrl, isPending: imagePending, isError, refetch } = useRecipeImageUrl(recipe.image_url);

  const favoriteQuery = useIsFavorite(user?.id ?? null, recipe.id);
  const toggleFavorite = useToggleFavoriteRecipe();
  const copyRecipe = useCopyRecipe(user?.id ?? null);
  const updateRecipe = useUpdateRecipe(user?.id ?? null);
  const createReport = useCreateReport();
  const analyzeNutrition = useAnalyzeNutrition();

  const servings = useRecipeServings(recipe.id, recipe.servings);
  const { setServings, toggleChecked } = useCookModeActions();
  const checked = useCheckedIngredients(recipe.id);

  const [shoppingModalOpen, setShoppingModalOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const isOwner = user?.id === recipe.user_id;
  const isFavorite = favoriteQuery.data ?? false;
  const scale = recipe.servings > 0 ? servings / recipe.servings : 1;
  const unitSystem = profile?.unit_preference ?? 'metric';

  const handleFavorite = () => {
    if (!user) {
      notifications.show({ message: 'Sign in to save favorites.', color: 'yellow' });
      return;
    }
    toggleFavorite.mutate({ userId: user.id, recipeId: recipe.id, favorite: !isFavorite });
  };

  const handleCopy = () => {
    if (!user) {
      notifications.show({ message: 'Sign in to copy this recipe to your collection.', color: 'yellow' });
      return;
    }
    copyRecipe.mutate(recipe, {
      onSuccess: (copied) => navigate({ to: '/recipes/$id/edit', params: { id: copied.id } }),
      onError: (error) => notifications.show({ title: 'Copy failed', message: error.message, color: 'red' }),
    });
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.title, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      notifications.show({ message: 'Recipe link copied to clipboard.', color: 'green' });
    } catch {
      // User dismissed the share sheet or denied clipboard access — nothing to recover.
    }
  };

  const handleReportSubmit = () => {
    if (!user || !reportReason.trim()) return;
    createReport.mutate(
      { reporterId: user.id, targetType: 'recipe', targetId: recipe.id, reason: reportReason },
      {
        onSuccess: () => {
          notifications.show({ message: 'Report submitted. A moderator will take a look.', color: 'green' });
          setReportOpen(false);
          setReportReason('');
        },
        onError: (error) => notifications.show({ title: 'Report failed', message: error.message, color: 'red' }),
      },
    );
  };

  const requestAnalysis = () => {
    analyzeNutrition.mutate(toAiDraft(recipe), {
      onError: (error) =>
        notifications.show({
          title: 'Analysis failed',
          message: error.message,
          color: 'red',
        }),
    });
  };

  const analysis = analyzeNutrition.data;

  return (
    <Stack gap="xl">
      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          {recipe.image_url ? (
            <Paper withBorder radius={12} h="100%" mih={300}>
              <Box pos="relative" h="100%" w="100%">
                <RecipeImage
                  imageUrl={imageUrl}
                  loading={imagePending}
                  resolutionFailed={isError}
                  onRetry={() => refetch()}
                  alt={recipe.title}
                  loadingHeight={300}
                />
              </Box>
            </Paper>
          ) : (
            <Paper withBorder radius={12} p="xl" h="100%" mih={300}>
              <Stack align="center" justify="center" h="100%" gap="xs">
                <ThemeIcon variant="light" size={36} radius="lg" color="gray">
                  <LuSoup size={18} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  No image
                </Text>
              </Stack>
            </Paper>
          )}
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="md">
            <div>
              {recipe.cuisines?.name ? (
                <Badge color="brand" mb="xs">
                  {recipe.cuisines.name}
                </Badge>
              ) : null}
              <Title order={1}>{recipe.title}</Title>
              <Text c="dimmed" mt="sm">
                {recipe.description}
              </Text>
            </div>

            {averageRating !== null && averageRating !== undefined ? (
              <Group gap="xs">
                <RatingStars value={averageRating} />
                <Text size="sm" c="dimmed">
                  {averageRating.toFixed(1)} · {reviewCount ?? 0} review{(reviewCount ?? 0) === 1 ? '' : 's'}
                </Text>
              </Group>
            ) : null}

            <Group grow>
              <Paper withBorder p="sm" radius={12}>
                <Stack gap={4} align="center">
                  <LuClock size={18} />
                  <Text size="xs" c="dimmed" fw={500}>
                    PREP TIME
                  </Text>
                  <Text fw={600}>{recipe.prep_time_minutes} min</Text>
                </Stack>
              </Paper>
              <Paper withBorder p="sm" radius={12}>
                <Stack gap={4} align="center">
                  <LuScale size={18} />
                  <Text size="xs" c="dimmed" fw={500}>
                    SERVINGS
                  </Text>
                  <Text fw={600}>{recipe.servings}</Text>
                </Stack>
              </Paper>
              <Paper withBorder p="sm" radius={12}>
                <Stack gap={4} align="center">
                  <LuSoup size={18} />
                  <Text size="xs" c="dimmed" fw={500}>
                    CALORIES
                  </Text>
                  <Text fw={600}>
                    {recipe.recipe_nutrition?.calories_per_serving != null
                      ? `${recipe.recipe_nutrition.calories_per_serving} kcal`
                      : '—'}
                  </Text>
                </Stack>
              </Paper>
            </Group>

            {recipe.dietary_tags.length > 0 ? (
              <Group gap={5}>
                {recipe.dietary_tags.map((tag) => (
                  <Badge key={tag} size="sm" variant="default" color="gray">
                    {tag}
                  </Badge>
                ))}
              </Group>
            ) : null}

            <Group gap="xs">
              <Button
                leftSection={isFavorite ? <LuHeart size={16} fill="currentColor" /> : <LuHeart size={16} />}
                variant="light"
                color="red"
                loading={toggleFavorite.isPending}
                onClick={handleFavorite}
              >
                {isFavorite ? 'Favorited' : 'Favorite'}
              </Button>
              <Tooltip label="Copy to my recipes">
                <ActionIcon
                  variant="subtle"
                  onClick={handleCopy}
                  loading={copyRecipe.isPending}
                  aria-label="Copy to my recipes"
                >
                  <LuCopy size={15} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Add to collection">
                <ActionIcon
                  variant="subtle"
                  onClick={() => {
                    if (!user) {
                      notifications.show({ message: 'Sign in to use collections.', color: 'yellow' });
                      return;
                    }
                    setCollectionModalOpen(true);
                  }}
                  aria-label="Add to collection"
                >
                  <LuFolders size={15} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Add ingredients to shopping list">
                <ActionIcon
                  variant="subtle"
                  onClick={() => {
                    if (!user) {
                      notifications.show({ message: 'Sign in to use shopping lists.', color: 'yellow' });
                      return;
                    }
                    setShoppingModalOpen(true);
                  }}
                  aria-label="Add to shopping list"
                >
                  <LuShoppingBasket size={15} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Share">
                <ActionIcon variant="subtle" onClick={handleShare} aria-label="Share recipe">
                  <LuShare2 size={15} />
                </ActionIcon>
              </Tooltip>
              {/* <Tooltip label="Print">
                <ActionIcon variant="subtle" onClick={() => window.print()} aria-label="Print recipe">
                  <LuPrinter size={15} />
                </ActionIcon>
              </Tooltip> */}
              {isOwner ? (
                <Tooltip label="Edit recipe">
                  <ActionIcon
                    variant="subtle"
                    onClick={() => navigate({ to: '/recipes/$id/edit', params: { id: recipe.id } })}
                    aria-label="Edit recipe"
                  >
                    <LuPencil size={15} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
              {isOwner ? (
                <Tooltip label="Edit with AI">
                  <ActionIcon variant="subtle" onClick={() => setAiEditOpen(true)} aria-label="Edit with AI">
                    <LuSparkles size={15} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
              <Tooltip label="Report recipe">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => {
                    if (!user) {
                      notifications.show({ message: 'Sign in to report content.', color: 'yellow' });
                      return;
                    }
                    setReportOpen(true);
                  }}
                  aria-label="Report recipe"
                >
                  <LuFlag size={15} />
                </ActionIcon>
              </Tooltip>
            </Group>

            {isAuthed ? (
              <Button
                onClick={() => navigate({ to: '/recipes/$id/cook', params: { id: recipe.id } })}
                leftSection={<LuChevronRight size={16} />}
              >
                Start cook mode
              </Button>
            ) : null}
          </Stack>
        </Grid.Col>
      </Grid>

      <Tabs defaultValue="ingredients" mt="xl">
        <Tabs.List>
          <Tabs.Tab value="ingredients">Ingredients</Tabs.Tab>
          <Tabs.Tab value="instructions">Instructions</Tabs.Tab>
          <Tabs.Tab value="nutrition">Nutrition</Tabs.Tab>
          <Tabs.Tab value="reviews">Reviews</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="ingredients" pt="xl">
          <Group justify="space-between" align="flex-end" mb="xl">
            <Title order={3}>What you&apos;ll need</Title>
            <NumberInput
              label="Scale servings"
              description={`Base: ${recipe.servings}`}
              value={servings}
              onChange={(value) => setServings(recipe.id, typeof value === 'number' && value > 0 ? value : 1)}
              min={1}
              max={50}
              w={140}
            />
          </Group>

          {scale !== 1 ? (
            <Text size="sm" c="brand" mb="md">
              Quantities scaled ×{Number(scale.toFixed(2))}
            </Text>
          ) : null}

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {recipe.recipe_ingredients.map((ingredient) => {
              const converted = convertIngredient(
                ingredient.quantity !== null ? ingredient.quantity * scale : null,
                ingredient.unit ?? '',
                unitSystem,
              );
              const isChecked = checked.includes(ingredient.position);
              return (
                <Paper
                  key={ingredient.id}
                  withBorder
                  p="sm"
                  radius={12}
                  opacity={isChecked ? 0.55 : 1}
                  onClick={() => toggleChecked(recipe.id, ingredient.position)}
                  style={{ cursor: 'pointer' }}
                >
                  <Group justify="space-between">
                    <Text fw={500} td={isChecked ? 'line-through' : 'none'}>
                      {ingredient.ingredient.name}
                    </Text>
                    <Text c={isChecked ? 'dimmed' : 'brand'} fw={500}>
                      {formatIngredientAmount(converted.amount, converted.unit)}
                    </Text>
                  </Group>
                </Paper>
              );
            })}
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="instructions" pt="xl">
          <Title order={3} mb="xl">
            Step-by-step
          </Title>
          <List
            spacing="lg"
            size="md"
            center
            icon={
              <ThemeIcon color="brand" w={24} h={24} radius="lg">
                <LuChevronRight size={16} />
              </ThemeIcon>
            }
          >
            {recipe.recipe_steps.map((step) => (
              <List.Item key={step.id}>{step.instruction}</List.Item>
            ))}
          </List>
        </Tabs.Panel>

        <Tabs.Panel value="nutrition" pt="xl">
          <Stack gap="lg">
            {recipe.recipe_nutrition ? (
              <Paper withBorder p="xl" radius={12}>
                <Title order={4} mb="md">
                  Per serving
                </Title>
                <MacroChart
                  macros={[
                    { label: 'Protein', grams: recipe.recipe_nutrition.protein_grams ?? 0 },
                    { label: 'Carbs', grams: recipe.recipe_nutrition.carbs_grams ?? 0 },
                    { label: 'Fat', grams: recipe.recipe_nutrition.fat_grams ?? 0 },
                  ]}
                />
                <Group justify="center" mt="md">
                  <Text size="sm" c="dimmed">
                    {recipe.recipe_nutrition.calories_per_serving !== null
                      ? `${recipe.recipe_nutrition.calories_per_serving} kcal`
                      : 'Calories not set'}
                  </Text>
                </Group>
              </Paper>
            ) : (
              <Alert color="brand" title="No nutrition data yet" icon={<LuBrain size={18} />}>
                <Text size="sm">This recipe has no nutrition information. Ask the AI below to analyze it.</Text>
              </Alert>
            )}

            <Paper withBorder p="md" radius={12}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="brand" variant="light">
                      <LuBrain size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>AI nutrition analysis</Text>
                      <Text size="sm" c="dimmed">
                        Detailed macros plus healthier-alternative suggestions.
                      </Text>
                    </div>
                  </Group>
                  <Button variant="light" color="brand" loading={analyzeNutrition.isPending} onClick={requestAnalysis}>
                    Analyze with AI
                  </Button>
                </Group>

                {analysis ? (
                  <Stack gap="sm">
                    <SimpleGrid cols={{ base: 2, sm: 4 }}>
                      <AnalysisStat label="Calories" value={analysis.calories_per_serving} unit="kcal" />
                      <AnalysisStat label="Protein" value={analysis.protein_grams} unit="g" />
                      <AnalysisStat label="Carbs" value={analysis.carbs_grams} unit="g" />
                      <AnalysisStat label="Fat" value={analysis.fat_grams} unit="g" />
                    </SimpleGrid>
                    {analysis.suggestions.length > 0 ? (
                      <List spacing="xs" size="sm">
                        {analysis.suggestions.map((suggestion) => (
                          <List.Item key={suggestion}>{suggestion}</List.Item>
                        ))}
                      </List>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="reviews" pt="xl">
          <ReviewsSection recipeId={recipe.id} />
        </Tabs.Panel>
      </Tabs>

      <AiEditRecipeModal
        opened={aiEditOpen}
        onClose={() => setAiEditOpen(false)}
        recipe={recipe}
        onApply={(values) =>
          updateRecipe.mutate(
            { id: recipe.id, existingImageUrl: recipe.image_url, values, userId: user?.id ?? '' },
            {
              onSuccess: () => notifications.show({ message: 'AI edits applied and saved.', color: 'green' }),
              onError: (error) =>
                notifications.show({ title: 'Could not apply AI edits', message: error.message, color: 'red' }),
            },
          )
        }
      />

      <AddToCollectionModal
        opened={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        recipeId={recipe.id}
      />

      <AddToShoppingListModal opened={shoppingModalOpen} onClose={() => setShoppingModalOpen(false)} recipe={recipe} />

      <Modal opened={reportOpen} onClose={() => setReportOpen(false)} title="Report recipe" centered>
        <Stack gap="sm">
          <Text size="sm">Tell us what is wrong with this recipe. A moderator will review it.</Text>
          <Textarea
            placeholder="Reason for reporting…"
            minRows={3}
            value={reportReason}
            onChange={(event) => setReportReason(event.currentTarget.value)}
          />
          <Button color="red" loading={createReport.isPending} disabled={!reportReason.trim()} onClick={handleReportSubmit}>
            Submit report
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

interface AnalysisStatProps {
  label: string;
  value: number | null;
  unit: string;
}
function AnalysisStat({ label, value, unit }: Readonly<AnalysisStatProps>) {
  return (
    <Paper withBorder p="xs" radius={12} ta="center">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text fw={600}>{value !== null ? `${value} ${unit}` : '—'}</Text>
    </Paper>
  );
}
