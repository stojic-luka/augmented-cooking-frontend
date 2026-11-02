import { useState } from 'react';
import { Alert, Button, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { z } from 'zod';
import { LuCloudUpload } from 'react-icons/lu';
import { useImportRecipe, type ImportedRecipe } from '../index';
import { RecipeForm } from './RecipeForm';

const importUrlSchema = z.object({
  url: z.url({ error: 'Enter a valid recipe URL' }),
});
type ImportUrlValues = z.infer<typeof importUrlSchema>;

export function RecipeImportForm() {
  const importRecipe = useImportRecipe();
  const [imported, setImported] = useState<ImportedRecipe | null>(null);

  const form = useForm<ImportUrlValues>({
    initialValues: { url: '' },
    validate: schemaResolver(importUrlSchema),
  });

  const handleSubmit = (values: ImportUrlValues) => {
    setImported(null);
    importRecipe.mutate(values.url, {
      onSuccess: (draft) => setImported(draft),
    });
  };

  if (imported) {
    return (
      <Stack gap="lg">
        <Alert color="green" title="Recipe imported">
          <Text size="sm">
            We scraped “{imported.title}”. Review the details below, adjust anything the scraper got wrong, then save it to
            your recipes.
          </Text>
        </Alert>
        <RecipeForm
          title="Review imported recipe"
          description="Check the scraped values and save the recipe to your collection."
          initialValues={{
            title: imported.title,
            description: imported.description,
            cuisine: imported.cuisine,
            prepTimeMinutes: imported.prepTimeMinutes,
            cookTimeMinutes: imported.cookTimeMinutes,
            servings: imported.servings,
            difficulty: null,
            dietaryTags: [],
            isPublic: true,
            ingredients:
              imported.ingredients.length > 0
                ? imported.ingredients.map((ingredient) => ({
                    name: ingredient.name,
                    amount: ingredient.amount ?? '',
                    unit: ingredient.unit || 'pc',
                  }))
                : [{ name: '', amount: '', unit: '' }],
            steps:
              imported.steps.length > 0
                ? imported.steps.map((step) => ({ instruction: step.instruction }))
                : [{ instruction: '' }],
          }}
        />
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <Paper withBorder p="xl" radius={12} maw={640}>
        <Stack gap="md">
          <Title order={2}>Import from URL</Title>
          <Text size="sm" c="dimmed">
            Paste a link to a recipe on any cooking site. Our backend scrapes the ingredients and steps so you can save them
            as your own editable copy.
          </Text>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="sm">
              <TextInput
                label="Recipe URL"
                placeholder="https://www.example.com/best-lasagna"
                leftSection={<LuCloudUpload size={16} />}
                disabled={importRecipe.isPending}
                key={form.key('url')}
                {...form.getInputProps('url')}
              />
              <Button type="submit" loading={importRecipe.isPending} w="fit-content">
                Import recipe
              </Button>
            </Stack>
          </form>
          {importRecipe.isError ? (
            <Alert color="red" title="Import failed">
              <Text size="sm">{importRecipe.error.message}</Text>
            </Alert>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}
