import { useQuery } from '@tanstack/react-query';
import { RECIPE_IMAGES_BUCKET } from '../constants'; // the const from last step
import { getSupabaseBrowserClient } from '@lib/supabase';
import { recipeKeys } from '../query-keys';
import { useEffect } from 'react';
import { notifications } from '@mantine/notifications';

const TTL = 60 * 60 * 24 * 7; // 7 days — Supabase's max signed-URL lifetimeprobe
const IMAGE_ERROR_ID = 'recipe-image-url-error'; // same id = replace, not stack

export function useRecipeImageUrl(imagePath: string | undefined | null) {
  const query = useQuery({
    queryKey: recipeKeys.recipeImageUrl(imagePath),
    queryFn: async (): Promise<string> => {
      if (!imagePath) throw new Error('Cannot sign a URL without an image path');
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.storage.from(RECIPE_IMAGES_BUCKET).createSignedUrl(imagePath, TTL);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
    enabled: Boolean(imagePath),
    staleTime: TTL * 1000 * 0.9,
  });

  useEffect(() => {
    if (!query.isError) return;
    notifications.show({
      id: IMAGE_ERROR_ID,
      color: 'red',
      title: 'Image could not be loaded',
      message:
        query.error instanceof Error
          ? query.error.message
          : 'Something went wrong while loading the image. Please try again.',
    });
  }, [query.isError, query.error]);

  return query;
}
