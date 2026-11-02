import type { AiModel } from '../services/aiModels';

export type SubscriptionTier = 'free' | 'premium';

/**
 * Single gating rule for model availability: the model must be enabled and
 * its gate met — `min_tier: 'free'` is available to everyone, `min_tier:
 * 'premium'` requires a premium subscription.
 */
export function isModelSelectable(
  model: Pick<AiModel, 'is_enabled' | 'min_tier'>,
  subscriptionTier: SubscriptionTier | null | undefined,
): boolean {
  return model.is_enabled === true && (model.min_tier === 'free' || subscriptionTier === 'premium');
}

export interface ChatModelResolution {
  /** The modelId to send; null means omit the field so the backend applies its default. */
  modelId: string | null;
  /** The chat's stored model when it is no longer selectable (null otherwise). */
  staleModel: AiModel | null;
  /** Why the stored model stopped being selectable. */
  staleReason: 'premium' | 'disabled' | 'unknown' | null;
  /** The model the fallback landed on, for messages and chip labels. */
  replacementModel: AiModel | null;
}

/**
 * Resolution order when sending: the chat's stored model → the profile's
 * default model (if still selectable) → the first selectable model → none.
 * A stored model that is disabled or no longer covered by the subscription is
 * reported as `staleModel` so the caller can notify once and persist the
 * fallback. Without a loaded catalog nothing can be verified — the result
 * omits modelId and never blocks the send.
 */
export function resolveChatModelId(params: {
  models: AiModel[] | undefined;
  storedModelId: string | null | undefined;
  profileModelId: string | null | undefined;
  subscriptionTier: SubscriptionTier | null | undefined;
}): ChatModelResolution {
  const { models, storedModelId, profileModelId, subscriptionTier } = params;

  if (!models) {
    return { modelId: null, staleModel: null, staleReason: null, replacementModel: null };
  }

  const selectable = models.filter((model) => isModelSelectable(model, subscriptionTier));
  const profileModel = profileModelId ? (selectable.find((model) => model.id === profileModelId) ?? null) : null;

  if (storedModelId) {
    const stored = models.find((model) => model.id === storedModelId) ?? null;
    if (stored && isModelSelectable(stored, subscriptionTier)) {
      return { modelId: stored.id, staleModel: null, staleReason: null, replacementModel: stored };
    }

    const replacement = profileModel ?? selectable[0] ?? null;
    const staleReason = !stored
      ? 'unknown'
      : !stored.is_enabled
        ? 'disabled'
        : stored.min_tier === 'premium'
          ? 'premium'
          : 'unknown';
    return { modelId: replacement?.id ?? null, staleModel: stored, staleReason, replacementModel: replacement };
  }

  const fallback = profileModel ?? selectable[0] ?? null;
  return { modelId: fallback?.id ?? null, staleModel: null, staleReason: null, replacementModel: fallback };
}
