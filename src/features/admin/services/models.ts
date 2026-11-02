import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { publicAiModelsRowSchema as AiModelsRowSchema } from '@/types/schemas';
import type {
  PublicAiModelsRow as AiModelsRow,
  PublicAiModelsInsert as AiModelsInsert,
  PublicAiModelsUpdate as AiModelsUpdate,
} from '@/types/schemas';

export type UpdateModelPatch = Pick<AiModelsUpdate, 'is_enabled' | 'min_tier'>;
export type CreateModelInput = Required<Pick<AiModelsInsert, 'name' | 'tier' | 'min_tier'>>;

export async function fetchModels(): Promise<AiModelsRow[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase.from('ai_models').select('*').order('created_at');

  if (error) {
    throw new Error(`Failed to fetch AI models: ${error.message}`);
  }

  return z.array(AiModelsRowSchema).parse(data ?? []);
}

export async function updateModel(modelId: string, patch: UpdateModelPatch): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase.from('ai_models').update(patch).eq('id', modelId);

  if (error) {
    throw new Error(`Failed to update model: ${error.message}`);
  }
}

export async function createModel(input: CreateModelInput): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const payload: AiModelsInsert = {
    name: input.name.trim(),
    tier: input.tier,
    min_tier: input.min_tier,
    is_enabled: true,
  };

  const { error } = await supabase.from('ai_models').insert(payload);

  if (error) {
    throw new Error(`Failed to create model: ${error.message}`);
  }
}
