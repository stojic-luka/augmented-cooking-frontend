import { z } from 'zod';
import { api } from '@/api';
import { AI_API_ROUTES } from '../api';

const aiModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.enum(['economy', 'advanced']),
  is_enabled: z.boolean().catch(true),
  min_tier: z.enum(['free', 'premium']).catch('free'),
});

export type AiModel = z.infer<typeof aiModelSchema>;

const modelsResponseSchema = z.object({ models: z.array(aiModelSchema) }).catch({ models: [] });

export async function fetchAiModels(): Promise<AiModel[]> {
  const response = await api.get<unknown>(AI_API_ROUTES.models);
  return modelsResponseSchema.parse(response.data).models;
}
