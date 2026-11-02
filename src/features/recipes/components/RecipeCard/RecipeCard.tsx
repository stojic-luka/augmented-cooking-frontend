import { Badge, Box, Button, Card, Group, Paper, Stack, Text } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { LuClock, LuFlame } from 'react-icons/lu';
import { RatingStars } from '@components';
import type { FullRecipe } from '../../types';
import { RecipeImage } from '../RecipeImage';
import { useRecipeImageUrl } from '../../hooks/useRecipeImageUrl';

interface RecipeCardProps {
  recipe: FullRecipe;
  rating?: number | null;
  reviewCount?: number;
}

export function RecipeCard({ recipe, rating, reviewCount }: Readonly<RecipeCardProps>) {
  const navigate = useNavigate();
  const { data: imageUrl, isPending: imagePending, isError, refetch } = useRecipeImageUrl(recipe.image_url);

  return (
    <Card h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Card.Section>
        <Paper withBorder radius={12} h="100%" mih={200}>
          <Box pos="relative" h="100%" w="100%">
            <RecipeImage
              imageUrl={imageUrl}
              loading={imagePending}
              resolutionFailed={isError}
              onRetry={() => refetch()}
              alt={recipe.title}
              loadingHeight={200}
            />
          </Box>
        </Paper>
      </Card.Section>

      <Stack gap="sm" mt="md" flex={1}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} size="lg" lineClamp={1}>
            {recipe.title}
          </Text>
          {recipe.cuisines?.name ? (
            <Badge color="brand" variant="light">
              {recipe.cuisines.name}
            </Badge>
          ) : null}
        </Group>

        {rating != null ? (
          <Group gap="xs">
            <RatingStars value={rating} />
            {reviewCount ? (
              <Text size="xs" c="dimmed">
                ({reviewCount})
              </Text>
            ) : null}
          </Group>
        ) : null}

        <Group gap="xs">
          <Group gap={4} c="dimmed" wrap="nowrap">
            <LuClock size={16} />
            <Text size="sm" c="dimmed">
              {recipe.prep_time_minutes} min
            </Text>
          </Group>
          <Group gap={4} c="dimmed" wrap="nowrap">
            <LuFlame size={16} />
            <Text size="sm" c="dimmed">
              {recipe.recipe_nutrition?.calories_per_serving != null
                ? `${recipe.recipe_nutrition.calories_per_serving} kcal`
                : '—'}
            </Text>
          </Group>
        </Group>

        {recipe.dietary_tags.length > 0 ? (
          <Group gap={5}>
            {recipe.dietary_tags.slice(0, 5).map((tag) => (
              <Badge key={tag} size="xs" color="gray" variant="default">
                {tag.split('_').join(' ').toLowerCase()}
              </Badge>
            ))}
          </Group>
        ) : null}
      </Stack>

      <Button fullWidth mt="md" onClick={() => navigate({ to: '/recipes/$id', params: { id: recipe.id } })}>
        View details
      </Button>
    </Card>
  );
}
