import { Container } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { EmptyState } from '@components';
import { LuSoup } from 'react-icons/lu';

export interface RecipeDetailPageErrorProps {
  error: unknown;
}

/** Route-level error boundary content for the recipe detail page. */
export function RecipeDetailPageError({ error }: Readonly<RecipeDetailPageErrorProps>) {
  const navigate = useNavigate();
  const notFound = error instanceof Error && error.message === 'Recipe not found.';

  return (
    <Container size="lg" py="xl">
      <EmptyState
        icon={LuSoup}
        title={notFound ? 'Recipe not found' : 'Something went wrong'}
        description={
          notFound
            ? 'This recipe may have been removed or is not available right now.'
            : error instanceof Error
              ? error.message
              : 'Something went wrong while loading this recipe.'
        }
        actionLabel="Browse recipes"
        onAction={() => navigate({ to: '/recipes' })}
      />
    </Container>
  );
}