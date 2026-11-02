import { useState } from 'react';
import { Alert, Button, Group, MultiSelect, NumberInput, Paper, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { z } from 'zod';
import { useForm, schemaResolver } from '@mantine/form';
import { LuSparkles } from 'react-icons/lu';
import { useGenerateRecipe } from '../index';
import { draftToFormValues, RecipeForm, useCuisines } from '@features/recipes';
import type { AiRecipeDraft } from '../types';
import { publicDietaryTagSchema } from '@/types/schemas';

const generateFormSchema = z.object({
  ingredients: z.array(z.string()).min(1, { error: 'Add at least one ingredient you have' }),
  cuisine: z.string().optional(),
  maxCalories: z.number().int().positive().optional(),
  maxPrepMinutes: z.number().int().positive().optional(),
  dietaryTags: z.array(z.string()).optional(),
});

type GenerateFormValues = z.infer<typeof generateFormSchema>;

/** Requirements → AI draft → review in the standard recipe form. */
export function AiRecipeGeneratorPage() {
  const generateRecipe = useGenerateRecipe();
  const cuisinesQuery = useCuisines();
  const [draft, setDraft] = useState<AiRecipeDraft | null>(null);
  // Raw text drives the input; the form field holds the parsed list. Parsing
  // on every keystroke would eat the separators (", " never survives the
  // split-trim-filter round trip back into a controlled value).
  const [ingredientsDraft, setIngredientsDraft] = useState('');

  const form = useForm<GenerateFormValues>({
    initialValues: { ingredients: [], cuisine: '', maxCalories: undefined, maxPrepMinutes: undefined, dietaryTags: [] },
    validate: schemaResolver(generateFormSchema),
  });

  const handleGenerate = (values: GenerateFormValues) => {
    setDraft(null);
    generateRecipe.mutate(
      {
        ingredients: values.ingredients,
        cuisine: values.cuisine || undefined,
        maxCalories: values.maxCalories,
        maxPrepMinutes: values.maxPrepMinutes,
        dietaryTags: values.dietaryTags?.length ? values.dietaryTags : undefined,
      },
      { onSuccess: (result) => setDraft(result) },
    );
  };

  if (draft) {
    return (
      <Stack gap="lg">
        <Alert color="brand" variant="light" title="Recipe generated">
          <Text size="sm">
            The assistant drafted “{draft.title}”. Review it below, tweak anything you like, then save it to your recipes.
          </Text>
        </Alert>
        <RecipeForm
          title="Review AI draft"
          description="Check the generated recipe and save it to your collection."
          initialValues={draftToFormValues(draft)}
        />
      </Stack>
    );
  }

  return (
    <Paper withBorder p="xl" radius={12} maw={720}>
      <Stack gap="md">
        <Group gap="sm">
          <LuSparkles size={20} color="var(--accent)" aria-hidden />
          <Title order={2}>Generate a recipe with AI</Title>
        </Group>
        <Text size="sm" c="dimmed">
          Tell the assistant what you have on hand and how you eat. It will draft a complete recipe you can review and save.
        </Text>

        <form onSubmit={form.onSubmit(handleGenerate)}>
          <Stack gap="sm">
            <TextInput
              label="Ingredients on hand"
              description="Separate with commas — e.g. tomatoes, rice, chicken"
              placeholder="tomatoes, rice, chicken"
              value={ingredientsDraft}
              onChange={(event) => {
                setIngredientsDraft(event.currentTarget.value);
                form.setFieldValue(
                  'ingredients',
                  event.currentTarget.value
                    .split(',')
                    .map((entry) => entry.trim())
                    .filter(Boolean),
                );
              }}
            />
            <Group grow align="flex-start">
              <Select
                label="Cuisine"
                placeholder="Any"
                clearable
                data={cuisinesQuery.data?.map((cuisine) => cuisine.name) ?? []}
                key={form.key('cuisine')}
                {...form.getInputProps('cuisine')}
              />
              <NumberInput
                label="Max calories / serving"
                placeholder="Any"
                min={100}
                step={50}
                key={form.key('maxCalories')}
                {...form.getInputProps('maxCalories')}
              />
              <NumberInput
                label="Max prep time (min)"
                placeholder="Any"
                min={5}
                step={5}
                key={form.key('maxPrepMinutes')}
                {...form.getInputProps('maxPrepMinutes')}
              />
            </Group>
            <MultiSelect
              label="Dietary needs"
              placeholder="Optional"
              data={[...publicDietaryTagSchema.options.map((opt) => opt.value)]}
              key={form.key('dietaryTags')}
              {...form.getInputProps('dietaryTags')}
            />
            <Button type="submit" leftSection={<LuSparkles size={16} />} loading={generateRecipe.isPending} w="fit-content">
              Generate recipe
            </Button>
          </Stack>
        </form>

        {generateRecipe.isError ? (
          <Alert color="red" variant="light" title="Generation failed">
            <Text size="sm">{generateRecipe.error.message}</Text>
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
