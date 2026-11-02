import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Code, Group, List, Modal, Stack, Text, Textarea, ThemeIcon } from '@mantine/core';
import { LuSparkles } from 'react-icons/lu';
import { useEditRecipe, toAiDraft } from '../index';
import { draftToFormValues } from '@features/recipes';
import type { AiRecipeDraft } from '../types';
import type { FullRecipe, RecipeFormValues } from '@features/recipes';

interface AiEditRecipeModalProps {
  opened: boolean;
  onClose: () => void;
  recipe: FullRecipe | null;
  /** Receives the edited draft mapped to form values; the caller saves it. */
  onApply: (values: RecipeFormValues) => void;
}

/** Two-step AI edit: describe changes, review the result, then apply. */
export function AiEditRecipeModal({ opened, onClose, recipe, onApply }: Readonly<AiEditRecipeModalProps>) {
  const editRecipe = useEditRecipe();
  const { reset: resetEditRecipe } = editRecipe;
  const [instruction, setInstruction] = useState('');
  const [preview, setPreview] = useState<{ summary: string; draft: AiRecipeDraft } | null>(null);

  // `opened` for callbacks that resolve after a close, plus a full reset
  // whenever the modal closes: an edit request still in flight would
  // otherwise land its onSuccess afterwards and repopulate the preview, so
  // the next open starts on the review step instead of the form.
  const isOpenRef = useRef(false);
  useEffect(() => {
    isOpenRef.current = opened;
    if (!opened) {
      setPreview(null);
      setInstruction('');
      resetEditRecipe();
    }
  }, [opened, resetEditRecipe]);

  const close = () => {
    onClose();
  };

  const describe = () => {
    if (!recipe || !instruction.trim()) return;
    editRecipe.mutate(
      { instruction: instruction.trim(), recipe: toAiDraft(recipe) },
      {
        onSuccess: (result) => {
          if (isOpenRef.current) {
            setPreview({ summary: result.summary, draft: result.recipe });
          }
        },
      },
    );
  };

  if (!recipe) {
    return null;
  }

  return (
    <Modal opened={opened} onClose={close} title="Edit recipe with AI" size="lg" centered>
      <Stack gap="md">
        <Group gap="sm">
          <ThemeIcon variant="light">
            <LuSparkles size={18} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            Describe the changes you want — e.g. “make it vegetarian and double the sauce”. You will review the result before
            anything is saved.
          </Text>
        </Group>

        <Textarea
          label="What should change?"
          placeholder="Make it vegetarian and halve the prep time…"
          minRows={3}
          value={instruction}
          onChange={(event) => setInstruction(event.currentTarget.value)}
          disabled={editRecipe.isPending || Boolean(preview)}
        />

        {!preview ? (
          <Button
            leftSection={<LuSparkles size={16} />}
            loading={editRecipe.isPending}
            disabled={!instruction.trim()}
            onClick={describe}
            w="fit-content"
          >
            Generate edit
          </Button>
        ) : null}

        {editRecipe.isError ? (
          <Alert color="red" variant="light" title="AI edit failed">
            <Text size="sm">The edit could not be applied ({editRecipe.error.message}). Nothing was changed.</Text>
          </Alert>
        ) : null}

        {preview ? (
          <Stack gap="sm">
            <Alert color="brand" variant="light" title="AI summary">
              {preview.summary || 'The recipe was edited as requested.'}
            </Alert>
            <Text fw={600} size="sm">
              Proposed ingredients
            </Text>
            <List spacing="xs" size="sm">
              {preview.draft.ingredients.map((ingredient, index) => (
                <List.Item key={index}>
                  <Code>
                    {ingredient.amount !== null ? `${ingredient.amount} ` : ''}
                    {ingredient.unit}
                  </Code>{' '}
                  {ingredient.name}
                </List.Item>
              ))}
            </List>
            <Text fw={600} size="sm">
              Proposed steps ({preview.draft.steps.length})
            </Text>
            <List spacing="xs" size="sm" type="ordered">
              {preview.draft.steps.map((step, index) => (
                <List.Item key={index}>{step.instruction}</List.Item>
              ))}
            </List>
            <Group justify="space-between">
              <Button variant="subtle" onClick={() => setPreview(null)}>
                Back to editing
              </Button>
              <Button
                onClick={() => {
                  onApply(draftToFormValues(preview.draft));
                  close();
                }}
              >
                Apply changes
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Stack>
    </Modal>
  );
}
