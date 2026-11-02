// @features/recipes/components/RecipeImage.tsx
import { useEffect, useState } from 'react';
import { Button, Image, Paper, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core';
import { LuRefreshCw, LuSoup } from 'react-icons/lu';

interface RecipeImageProps {
  imageUrl: string | null | undefined;
  alt: string;
  loading?: boolean;
  loadingHeight?: number;
  resolutionFailed?: boolean;
  onRetry?: () => void;
}

function Placeholder({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <Paper withBorder radius={12} p="xl" h={height}>
      <Stack align="center" justify="center" h="100%" gap="xs">
        {children}
      </Stack>
    </Paper>
  );
}

export function RecipeImage({
  imageUrl,
  alt,
  loading = false,
  loadingHeight = 300,
  resolutionFailed,
  onRetry,
}: RecipeImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!imageUrl) return;
    setStatus('loading');
    let active = true;
    const probe = new window.Image();
    probe.onload = () => active && setStatus('loaded');
    probe.onerror = () => active && setStatus('error');
    // cache-buster on retries; extra query params don't affect signed-URL validation
    probe.src = nonce > 0 ? `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}r=${nonce}` : imageUrl;
    return () => {
      active = false;
    };
  }, [imageUrl, nonce]);

  if (loading || status === 'loading') {
    return <Skeleton radius="lg" h={loadingHeight} />;
  }

  if (!imageUrl) {
    return resolutionFailed ? (
      <Placeholder height={loadingHeight}>
        <ThemeIcon variant="light" size={36} radius="lg" color="gray">
          <LuSoup size={18} />
        </ThemeIcon>
        <Text size="sm" c="dimmed">
          Image unavailable
        </Text>
        {onRetry ? (
          <Button size="xs" variant="subtle" leftSection={<LuRefreshCw size={14} />} onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </Placeholder>
    ) : (
      <Placeholder height={loadingHeight}>
        <ThemeIcon variant="light" size={36} radius="lg" color="gray">
          <LuSoup size={18} />
        </ThemeIcon>
        <Text size="sm" c="dimmed">
          No image
        </Text>
      </Placeholder>
    );
  }

  if (status === 'error') {
    return (
      <Placeholder height={loadingHeight}>
        <ThemeIcon variant="light" size={36} radius="lg" color="gray">
          <LuSoup size={18} />
        </ThemeIcon>
        <Text size="sm" c="dimmed">
          Image unavailable
        </Text>
        <Button size="xs" variant="subtle" leftSection={<LuRefreshCw size={14} />} onClick={() => setNonce((n) => n + 1)}>
          Try again
        </Button>
      </Placeholder>
    );
  }

  return <Image src={imageUrl} alt={alt} fit="contain" pos="absolute" top={0} left={0} h="100%" w="100%" />;
}
