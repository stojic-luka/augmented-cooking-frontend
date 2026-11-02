import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { fullRecipeSchema } from '@features/recipes/types'; // leave this
import { RECIPE_SELECT, type FullRecipe } from '@features/recipes';
import { publicCollectionsRowSchema, publicCollectionsInsertSchema, publicCollectionsUpdateSchema } from '@/types/schemas';
import type { PublicCollectionsRow } from '@/types/schemas';
import type { CollectionFormValues } from '../types';

const collectionDetailSchema = publicCollectionsRowSchema.extend({
  recipes: z.array(fullRecipeSchema),
});
export type CollectionDetail = z.infer<typeof collectionDetailSchema>;

export async function fetchCollections(userId: string): Promise<PublicCollectionsRow[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch collections: ${error.message}`);
  }

  return (data ?? []).map((row) => publicCollectionsRowSchema.parse(row));
}

export async function fetchCollection(id: string): Promise<CollectionDetail> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('collections')
    .select(`*, collection_recipes(recipe:recipes(${RECIPE_SELECT}))`)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch collection: ${error.message}`);
  }
  if (!data) {
    throw new Error('Collection not found.');
  }

  const collection = publicCollectionsRowSchema.parse(data);

  // recipe_id -> recipes.id is many-to-one, so each join row embeds a single
  // recipe object (or null when the recipe row is hidden by RLS).
  const joinRows = z.array(z.object({ recipe: fullRecipeSchema.nullable() })).parse(data.collection_recipes ?? []);

  const recipes = joinRows.flatMap((row): FullRecipe[] => (row.recipe ? [row.recipe] : []));

  return collectionDetailSchema.parse({ ...collection, recipes });
}

export async function createCollection(userId: string, input: CollectionFormValues): Promise<PublicCollectionsRow> {
  const supabase = getSupabaseBrowserClient();

  // description is NOT nullable per the database types — send '' instead of null.
  const insert = publicCollectionsInsertSchema.parse({
    user_id: userId,
    name: input.name.trim(),
    description: input.description.trim(),
    is_public: input.isPublic,
  });

  const { data, error } = await supabase.from('collections').insert(insert).select('*').single();

  if (error) {
    throw new Error(`Failed to create collection: ${error.message}`);
  }

  return publicCollectionsRowSchema.parse(data);
}

export async function updateCollection(id: string, userId: string, input: CollectionFormValues): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const update = publicCollectionsUpdateSchema.parse({
    name: input.name.trim(),
    description: input.description.trim(),
    is_public: input.isPublic,
  });

  const { error } = await supabase.from('collections').update(update).eq('id', id).eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update collection: ${error.message}`);
  }
}

export async function deleteCollection(id: string, userId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase.from('collections').delete().eq('id', id).eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete collection: ${error.message}`);
  }
}
