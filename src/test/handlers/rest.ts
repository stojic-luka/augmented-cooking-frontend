import { http, HttpResponse } from 'msw';
import { aiRecipeDraftSchema } from '@features/ai/types';
import { importedRecipeSchema } from '@features/recipes/services/importRecipe';
import { IDS } from '../fixtures/db';
import { TEST_ORIGIN } from '../origin';

export const API_URL = TEST_ORIGIN;

/** Builds a text/event-stream response emitting the given SSE frames verbatim. */
export function sseStreamResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new HttpResponse(stream, { headers: { 'content-type': 'text/event-stream' } });
}

/**
 * Default success bodies for the documented endpoints (docs/API_ENDPOINTS.md).
 * Contract tests override these per-test with `server.use(...)` to assert the
 * exact outgoing payload or to simulate errors; integration tests rely on
 * these defaults so pages render end-to-end.
 */
const draft = {
  title: 'Weeknight Tomato Rice',
  description: 'Generated draft.',
  cuisine: 'Italian',
  prepTimeMinutes: 15,
  cookTimeMinutes: 20,
  servings: 4,
  difficulty: 'easy',
  image: null,
  ingredients: [
    { name: 'tomato', amount: 400, unit: 'g' },
    { name: 'rice', amount: 300, unit: 'g' },
  ],
  steps: [{ instruction: 'Cook the rice.' }, { instruction: 'Fold in tomatoes.' }],
  dietaryTags: ['vegetarian'],
};

export const restHandlers = [
  http.post(`${API_URL}/ai/generate-recipe`, () => HttpResponse.json({ recipe: draft })),
  http.post(`${API_URL}/ai/edit-recipe`, () =>
    HttpResponse.json({ recipe: draft, summary: 'Replaced chicken with tofu.' }),
  ),
  http.post(`${API_URL}/ai/analyze-nutrition`, () =>
    HttpResponse.json({
      recipe_id: IDS.recipeA,
      calories_per_serving: 540,
      protein_grams: 32,
      carbs_grams: 48,
      fat_grams: 14,
      sugar_grams: null,
      fiber_grams: null,
      sodium_mg: null,
      nutrition_source: 'ai_estimated',
      computed_at: '2026-03-01T10:00:00Z',
      suggestions: ['Use Greek yogurt instead of cream to cut 8g fat per serving.'],
    }),
  ),
  http.post(`${API_URL}/ai/chat`, () => HttpResponse.json({ reply: 'Try simmering longer.', tokensUsed: 412 })),
  /**
   * Default stream route: meta → deltas → authoritative done, same final text
   * as the /ai/chat default. Server defaults apply (no modelId picked).
   */
  http.post(`${API_URL}/ai/chat/stream`, () =>
    sseStreamResponse([
      'data: {"type":"meta","modelId":null}\n\n',
      'data: {"type":"delta","text":"Try simmering "}\n\n',
      'data: {"type":"delta","text":"longer."}\n\n',
      'data: {"type":"done","text":"Try simmering longer.","modelId":null}\n\n',
    ]),
  ),
  http.get(`${API_URL}/ai/models`, () =>
    HttpResponse.json({
      models: [
        { id: IDS.modelEconomy, name: 'flash-mini', tier: 'economy', is_enabled: true, min_tier: 'free' },
        { id: IDS.modelAdvanced, name: 'chef-pro', tier: 'advanced', is_enabled: true, min_tier: 'premium' },
      ],
    }),
  ),
  http.post(`${API_URL}/recipes/import`, () => HttpResponse.json({ recipe: draft })),
  http.post(`${API_URL}/orders`, () => HttpResponse.json({ orderId: 'ord_123', status: 'placed' })),
  http.post(`${API_URL}/billing/subscribe`, () =>
    HttpResponse.json({ status: 'pending', message: 'Request recorded; payment flow will complete here once integrated.' }),
  ),
  http.post(`${API_URL}/billing/tokens`, () =>
    HttpResponse.json({ status: 'pending', message: 'Request recorded; payment flow will complete here once integrated.' }),
  ),
];

// Re-exported so the fixture stays the single source of draft shapes.
export const DRAFT_FIXTURE = aiRecipeDraftSchema.parse(draft);
export const IMPORT_FIXTURE = importedRecipeSchema.parse(draft);
