import { getSupabaseBrowserClient } from '@lib/supabase';
import { publicProfilesRowSchema, publicProfilesUpdateSchema } from '@/types/schemas';
import type { PublicProfilesRow, PublicProfilesUpdate } from '@/types/schemas';

export interface ProfileUpdateInput {
  displayName?: string;
  avatarUrl?: string | null;
  unitPreference?: 'metric' | 'imperial';
  dietaryPreferences?: string[];
  aiModelId?: string | null;
  role?: 'user' | 'moderator' | 'admin';
  subscriptionTier?: 'free' | 'premium';
}

export async function updateProfile(userId: string, input: ProfileUpdateInput): Promise<PublicProfilesRow> {
  const supabase = getSupabaseBrowserClient();
  const patch: PublicProfilesUpdate = publicProfilesUpdateSchema.parse({
    updated_at: new Date().toISOString(),
    ...(input.displayName !== undefined && { display_name: input.displayName }),
    ...(input.avatarUrl !== undefined && { avatar_url: input.avatarUrl }),
    ...(input.unitPreference !== undefined && { unit_preference: input.unitPreference }),
    ...(input.dietaryPreferences !== undefined && { dietary_preferences: input.dietaryPreferences }),
    ...(input.aiModelId !== undefined && { ai_model_id: input.aiModelId }),
    ...(input.role !== undefined && { role: input.role }),
    ...(input.subscriptionTier !== undefined && { subscription_tier: input.subscriptionTier }),
  });

  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('*').single();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return publicProfilesRowSchema.parse(data);
}
