import { useRef, useState } from 'react';
import {
  ActionIcon,
  Button,
  Divider,
  FileButton,
  Group,
  Image,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { useNavigate } from '@tanstack/react-router';
import { LuPlus, LuSave, LuTrash2 } from 'react-icons/lu';
import { useAuthUser } from '@features/auth/providers/user';
import { emptyRecipeForm, detailToFormValues, useCreateRecipe, useCuisines, useUpdateRecipe } from '../index';
import { recipeFormSchema, type FullRecipe, type RecipeFormValues } from '../types';
import { publicDietaryTagSchema } from '@/types/schemas';
import { notifications } from '@mantine/notifications';

const DIETARY_DATA = [...publicDietaryTagSchema.options.map((opt) => opt.value)];

interface RecipeFormProps {
  recipe?: FullRecipe;
  title: string;
  description: string;
  initialValues?: RecipeFormValues;
}
export function RecipeForm({ recipe, title, description, initialValues }: Readonly<RecipeFormProps>) {
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const createRecipe = useCreateRecipe(user?.id ?? null);
  const updateRecipe = useUpdateRecipe(user?.id ?? null);
  const cuisinesQuery = useCuisines();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const resetRef = useRef<(() => void) | null>(null);

  // Cuisine names (not ids) travel through the form; the service resolves
  // them against the same reference table when saving.
  const cuisineData = cuisinesQuery.data?.map((cuisine) => cuisine.name) ?? [];

  const form = useForm<RecipeFormValues>({
    initialValues: initialValues ?? (recipe ? detailToFormValues(recipe) : emptyRecipeForm),
    validate: schemaResolver(recipeFormSchema),
  });

  const isPending = createRecipe.isPending || updateRecipe.isPending;

  const handleSubmit = (values: RecipeFormValues) => {
    if (!user) {
      notifications.show({ message: 'You need to be signed in to save.', color: 'yellow' });
      return;
    }

    const input = { values, userId: user.id, imageFile };
    const onSuccess = () => navigate({ to: '/my-recipes' });

    if (recipe) {
      updateRecipe.mutate({ id: recipe.id, existingImageUrl: recipe.image_url, ...input }, { onSuccess });
    } else {
      createRecipe.mutate(input, { onSuccess });
    }
  };

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <div>
          <Title order={1}>{title}</Title>
          <Text c="dimmed">{description}</Text>
        </div>
      </Group>

      <Paper withBorder p="xl" radius={12}>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="lg">
            <Title order={3}>Basics</Title>
            <Group grow>
              <TextInput
                label="Recipe title"
                placeholder="e.g. Grandma's secret lasagna"
                required
                disabled={isPending}
                key={form.key('title')}
                {...form.getInputProps('title')}
              />
              <Select
                label="Cuisine"
                placeholder="Select cuisine"
                data={cuisineData}
                disabled={isPending}
                key={form.key('cuisine')}
                {...form.getInputProps('cuisine')}
              />
            </Group>

            <Textarea
              label="Description"
              placeholder="Briefly describe your dish…"
              minRows={3}
              disabled={isPending}
              key={form.key('description')}
              {...form.getInputProps('description')}
            />

            <Group grow>
              <NumberInput
                label="Prep time (minutes)"
                min={1}
                disabled={isPending}
                key={form.key('prepTimeMinutes')}
                {...form.getInputProps('prepTimeMinutes')}
              />
              <NumberInput
                label="Cook time (minutes)"
                min={1}
                disabled={isPending}
                key={form.key('cookTimeMinutes')}
                {...form.getInputProps('cookTimeMinutes')}
              />
              <NumberInput
                label="Servings"
                min={1}
                disabled={isPending}
                key={form.key('servings')}
                {...form.getInputProps('servings')}
              />
              <Select
                label="Difficulty"
                placeholder="Optional"
                clearable
                data={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
                disabled={isPending}
                key={form.key('difficulty')}
                {...form.getInputProps('difficulty')}
              />
            </Group>

            <Group justify="space-between" align="flex-start">
              <Stack gap={4} w={{ base: '100%', sm: 320 }}>
                <Text size="sm" fw={500}>
                  Dietary tags
                </Text>
                <Group gap={6}>
                  {DIETARY_DATA.map((tag) => {
                    const active = form.values.dietaryTags.includes(tag);
                    return (
                      <Button
                        key={tag}
                        size="compact-xs"
                        variant={active ? 'light' : 'default'}
                        disabled={isPending}
                        onClick={() =>
                          form.setFieldValue(
                            'dietaryTags',
                            active
                              ? form.values.dietaryTags.filter((entry) => entry !== tag)
                              : [...form.values.dietaryTags, tag],
                          )
                        }
                      >
                        {tag}
                      </Button>
                    );
                  })}
                </Group>
              </Stack>
              <Switch
                label="Public recipe"
                description="Public recipes can be discovered and favorited by other cooks."
                disabled={isPending}
                key={form.key('isPublic')}
                {...form.getInputProps('isPublic', { type: 'checkbox' })}
              />
            </Group>

            <Group align="flex-start">
              {recipe?.image_url && !imageFile ? (
                <Image src={recipe.image_url} h={120} w={180} radius="md" fit="cover" alt="Current recipe image" />
              ) : null}
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Photo
                </Text>
                <Group gap="xs">
                  <FileButton onChange={setImageFile} accept="image/*" resetRef={resetRef}>
                    {(props) => (
                      <Button {...props} variant="default" disabled={isPending}>
                        Choose image
                      </Button>
                    )}
                  </FileButton>
                  {imageFile ? (
                    <Button
                      variant="subtle"
                      color="red"
                      disabled={isPending}
                      onClick={() => {
                        resetRef.current?.();
                        setImageFile(null);
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </Group>
                {imageFile ? (
                  <Text size="xs" c="dimmed">
                    {imageFile.name}
                  </Text>
                ) : null}
              </Stack>
            </Group>

            <Divider label="Ingredients" labelPosition="center" />

            {form.values.ingredients.map((_ingredient, index) => (
              <Group key={form.key(`ingredients.${index}`)} align="flex-end" wrap="nowrap">
                <TextInput
                  placeholder="Ingredient name"
                  style={{ flex: 2 }}
                  disabled={isPending}
                  {...form.getInputProps(`ingredients.${index}.name`)}
                />
                <TextInput
                  placeholder="Amount"
                  style={{ flex: 1 }}
                  disabled={isPending}
                  {...form.getInputProps(`ingredients.${index}.amount`)}
                />
                <TextInput
                  placeholder="Unit (g, ml, cup…)"
                  style={{ flex: 1 }}
                  disabled={isPending}
                  {...form.getInputProps(`ingredients.${index}.unit`)}
                />
                <ActionIcon
                  color="red"
                  variant="subtle"
                  disabled={isPending || form.values.ingredients.length === 1}
                  mb={4}
                  onClick={() => form.removeListItem('ingredients', index)}
                  aria-label="Remove ingredient"
                >
                  <LuTrash2 size={15} />
                </ActionIcon>
              </Group>
            ))}

            <Button
              variant="subtle"
              leftSection={<LuPlus size={16} />}
              disabled={isPending}
              onClick={() => form.insertListItem('ingredients', { name: '', amount: '', unit: '' })}
              w="fit-content"
            >
              Add ingredient
            </Button>

            <Divider label="Steps" labelPosition="center" />

            {form.values.steps.map((_step, index) => (
              <Group key={form.key(`steps.${index}`)} align="flex-start" wrap="nowrap">
                <ThemeIcon radius="lg" size="sm" mt="xs">
                  {index + 1}
                </ThemeIcon>
                <Textarea
                  placeholder="Describe this step…"
                  style={{ flex: 1 }}
                  disabled={isPending}
                  {...form.getInputProps(`steps.${index}.instruction`)}
                />
                <ActionIcon
                  color="red"
                  variant="subtle"
                  mt="xs"
                  disabled={isPending || form.values.steps.length === 1}
                  onClick={() => form.removeListItem('steps', index)}
                  aria-label="Remove step"
                >
                  <LuTrash2 size={15} />
                </ActionIcon>
              </Group>
            ))}

            <Button
              variant="subtle"
              leftSection={<LuPlus size={16} />}
              disabled={isPending}
              onClick={() => form.insertListItem('steps', { instruction: '' })}
              w="fit-content"
            >
              Add step
            </Button>

            <Divider mt="xl" />

            <Group justify="flex-end">
              <Button variant="default" disabled={isPending} onClick={() => navigate({ to: '/my-recipes' })}>
                Cancel
              </Button>
              <Button type="submit" loading={isPending} leftSection={<LuSave size={16} />}>
                {recipe ? 'Save changes' : 'Save recipe'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
