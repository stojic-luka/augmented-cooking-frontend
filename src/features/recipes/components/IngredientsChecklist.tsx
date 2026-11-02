import { Button, Checkbox, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { LuScale } from 'react-icons/lu';
import {
  convertIngredient,
  formatIngredientAmount,
  useCheckedIngredients,
  useCookModeActions,
} from '../index';
import type { FullRecipe } from '../types';
import type { PublicUnitPreference } from '@/types/schemas';

interface IngredientsChecklistProps {
  recipe: FullRecipe;
  unitPreference: PublicUnitPreference;
}

/** Persistent per-recipe ingredient check-off, shown beside the cook steps. */
export function IngredientsChecklist({ recipe, unitPreference }: Readonly<IngredientsChecklistProps>) {
  const checked = useCheckedIngredients(recipe.id);
  const { toggleChecked, clearProgress } = useCookModeActions();

  const doneCount = checked.length;

  return (
    <Paper withBorder p="md" radius={12}>
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <LuScale size={18} />
          <Title order={4}>Ingredients</Title>
        </Group>
        <Text size="xs" c="dimmed">
          {doneCount}/{recipe.recipe_ingredients.length} ready
        </Text>
      </Group>

      <Stack gap="xs">
        {recipe.recipe_ingredients.map((ingredient) => {
          const isChecked = checked.includes(ingredient.position);
          const converted = convertIngredient(ingredient.quantity, ingredient.unit ?? '', unitPreference);
          return (
            <Checkbox
              key={ingredient.id}
              checked={isChecked}
              onChange={() => toggleChecked(recipe.id, ingredient.position)}
              label={
                <Group justify="space-between" gap="xs" w="100%">
                  <Text size="sm" td={isChecked ? 'line-through' : 'none'}>
                    {ingredient.ingredient.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatIngredientAmount(converted.amount, converted.unit)}
                  </Text>
                </Group>
              }
              styles={{
                body: { alignItems: 'center' },
                label: { width: '100%' },
              }}
            />
          );
        })}
      </Stack>

      {doneCount > 0 ? (
        <>
          <Divider my="md" />
          <Button variant="subtle" size="xs" onClick={() => clearProgress(recipe.id)}>
            Reset checkmarks
          </Button>
        </>
      ) : null}
    </Paper>
  );
}
