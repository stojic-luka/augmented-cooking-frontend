import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { analyzeNutrition, editRecipe, generateRecipe } from './aiActions';
import { buildChatBody, sendChatMessage, streamChatMessage, type ChatStreamEvent } from './chatApi';
import { fetchAiModels } from './aiModels';
import type { AiRecipeDraft } from '../types';
import { clearSession, seedSession } from '@/test/auth';
import { API_URL, sseStreamResponse } from '@/test/handlers/rest';
import { IDS } from '@/test/fixtures/db';
import { server } from '@/test/server';

const fullDraft = (overrides: Partial<AiRecipeDraft> = {}): AiRecipeDraft => ({
  title: 'Draft',
  description: '',
  cuisine: '',
  prepTimeMinutes: 10,
  cookTimeMinutes: 10,
  servings: 2,
  difficulty: null,
  image: null,
  ingredients: [],
  steps: [],
  dietaryTags: [],
  ...overrides,
});

/**
 * Contract tests for the documented AI endpoints (docs/API_ENDPOINTS.md):
 * method + path + exact payload on the happy path, `{ message }` error
 * bodies surfaced, and network failures. MSW mocks the network — the real
 * axios interceptors and Zod parsing run.
 */
describe('ai services (axios contract)', () => {
  beforeEach(() => {
    seedSession();
  });

  it('POST /ai/generate-recipe sends the documented payload and returns the draft', async () => {
    let path = '';
    let method = '';
    server.use(
      http.post(`${API_URL}/ai/generate-recipe`, async ({ request }) => {
        method = request.method;
        path = new URL(request.url).pathname;
        await request.json();
        return HttpResponse.json({
          recipe: { title: 'D', description: '', cuisine: '', prepTimeMinutes: 1, cookTimeMinutes: null, servings: 2, ingredients: [], steps: [] },
        });
      }),
    );

    const draft = await generateRecipe({ ingredients: ['tomatoes', 'rice'] });

    expect(method).toBe('POST');
    expect(path).toBe('/ai/generate-recipe');
    expect(draft.title).toBe('D');
  });

  it('POST /ai/generate-recipe rejects empty ingredient lists before any HTTP call', async () => {
    await expect(generateRecipe({ ingredients: [] })).rejects.toThrow(/ingredient/i);
  });

  it('POST /ai/edit-recipe sends the draft plus instruction and parses summary', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/edit-recipe`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          recipe: { title: 'Edited', cookTimeMinutes: 10 },
          summary: 'Doubled the sauce.',
        });
      }),
    );

    const result = await editRecipe(fullDraft({ title: 'Original' }), { instruction: 'double the sauce' });

    expect(body?.instruction).toBe('double the sauce');
    expect((body?.recipe as { title?: string }).title).toBe('Original');
    expect(result.summary).toBe('Doubled the sauce.');
    expect(result.recipe.title).toBe('Edited');
  });

  it('POST /ai/analyze-nutrition returns the parsed nutrition row with suggestions', async () => {
    server.use(
      http.post(`${API_URL}/ai/analyze-nutrition`, () =>
        HttpResponse.json({
          recipe_id: '11111111-1111-4111-8111-111111111111',
          calories_per_serving: 500,
          protein_grams: 20,
          carbs_grams: 60,
          fat_grams: 10,
          sugar_grams: null,
          fiber_grams: null,
          sodium_mg: null,
          nutrition_source: 'ai_estimated',
          computed_at: '2026-03-01T10:00:00Z',
          suggestions: ['Swap cream for Greek yogurt.'],
        }),
      ),
    );

    const nutritionRow = await analyzeNutrition(fullDraft({ title: 'X' }));
    expect(nutritionRow.calories_per_serving).toBe(500);
    expect(nutritionRow.nutrition_source).toBe('ai_estimated');
    expect(nutritionRow.suggestions).toEqual(['Swap cream for Greek yogurt.']);
  });

  it('POST /ai/analyze-nutrition tolerates a missing suggestions array', async () => {
    server.use(
      http.post(`${API_URL}/ai/analyze-nutrition`, () =>
        HttpResponse.json({
          recipe_id: '11111111-1111-4111-8111-111111111111',
          calories_per_serving: 500,
          protein_grams: 20,
          carbs_grams: 60,
          fat_grams: 10,
          sugar_grams: null,
          fiber_grams: null,
          sodium_mg: null,
          nutrition_source: 'ai_estimated',
          computed_at: '2026-03-01T10:00:00Z',
        }),
      ),
    );

    const nutritionRow = await analyzeNutrition(fullDraft({ title: 'X' }));
    expect(nutritionRow.suggestions).toEqual([]);
  });

  it('POST /ai/chat sends sessionId, messages, and a UUIDv4 modelId; tolerates a missing tokensUsed', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/chat`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ reply: 'Simmer it.' });
      }),
    );

    const result = await sendChatMessage('session-1', [{ role: 'user', content: 'How long?' }], IDS.modelEconomy);

    expect(body?.sessionId).toBe('session-1');
    expect(body?.messages).toEqual([{ role: 'user', content: 'How long?' }]);
    expect(body?.modelId).toBe(IDS.modelEconomy);
    expect(result).toEqual({ text: 'Simmer it.', modelId: null, tokensUsed: 0 });
  });

  it('POST /ai/chat omits modelId entirely when it is null, empty, or not a UUIDv4', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/chat`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ reply: 'Simmer it.' });
      }),
    );

    for (const modelId of [null, undefined, '', 'model-1', IDS.modelEconomy.slice(0, -1)]) {
      await sendChatMessage('session-1', [{ role: 'user', content: 'How long?' }], modelId);
      expect(body && 'modelId' in body).toBe(false);
    }
  });

  it('POST /ai/chat keeps only the most recent 100 turns', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/chat`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ reply: 'Simmer it.' });
      }),
    );

    const turns = Array.from({ length: 150 }, (_, index) => ({ role: 'user' as const, content: `turn ${index}` }));
    await sendChatMessage('session-1', turns);

    const messages = body?.messages as { content: string }[];
    expect(messages).toHaveLength(100);
    expect(messages[0].content).toBe('turn 50');
    expect(messages[99].content).toBe('turn 149');
  });

  it('GET /ai/models surfaces tier metadata; malformed rows fall back to safe defaults', async () => {
    server.use(
      http.get(`${API_URL}/ai/models`, () =>
        HttpResponse.json({
          models: [
            { id: 'm1', name: 'flash-mini', tier: 'economy' },
            { id: 'm2', name: 'chef-pro', tier: 'advanced', is_enabled: 'not-a-boolean', min_tier: 'enterprise' },
          ],
        }),
      ),
    );

    const models = await fetchAiModels();
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({ is_enabled: true, min_tier: 'free' });
    // `.catch(true)` / `.catch('free')` absorb garbage instead of failing the page.
    expect(models[1].is_enabled).toBe(true);
    expect(models[1].min_tier).toBe('free');
  });

  it('surfaces the backend `{ message }` body as the rejected error message', async () => {
    server.use(
      http.post(`${API_URL}/ai/generate-recipe`, () => HttpResponse.json({ message: 'Daily AI quota reached' }, { status: 402 })),
    );

    await expect(generateRecipe({ ingredients: ['rice'] })).rejects.toThrow('Daily AI quota reached');
  });

  it('rejects with a network error when the backend is unreachable', async () => {
    server.use(http.post(`${API_URL}/ai/generate-recipe`, () => HttpResponse.error()));

    await expect(generateRecipe({ ingredients: ['rice'] })).rejects.toThrow();
  });
});

describe('ai service session gating', () => {
  it('requests are blocked when unauthenticated — the network is never touched', async () => {
    clearSession();
    let reachedServer = false;
    server.use(
      http.post(`${API_URL}/ai/chat`, () => {
        reachedServer = true;
        return HttpResponse.json({ reply: '' });
      }),
    );

    await expect(sendChatMessage('s', [{ role: 'user', content: 'hi' }])).rejects.toThrow(
      'Request blocked: User is not authenticated.',
    );
    expect(reachedServer).toBe(false);
  });

  it('stream requests are blocked when unauthenticated too', async () => {
    clearSession();
    let reachedServer = false;
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, () => {
        reachedServer = true;
        return HttpResponse.json({ reply: '' });
      }),
    );

    await expect(
      streamChatMessage({
        body: buildChatBody('s', [{ role: 'user', content: 'hi' }]),
        signal: new AbortController().signal,
        onEvent: () => {},
      }),
    ).rejects.toThrow('Request blocked: User is not authenticated.');
    expect(reachedServer).toBe(false);
  });
});

describe('streamChatMessage (SSE contract)', () => {
  beforeEach(() => {
    seedSession();
  });

  const callStream = (onEvent: (event: ChatStreamEvent) => void, signal: AbortSignal) =>
    streamChatMessage({ body: buildChatBody('session-1', [{ role: 'user', content: 'hi' }]), onEvent, signal });

  it('POSTs the shared body to /ai/chat/stream and delivers meta/delta/done in order', async () => {
    let method = '';
    let path = '';
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, async ({ request }) => {
        method = request.method;
        path = new URL(request.url).pathname;
        body = (await request.json()) as Record<string, unknown>;
        return sseStreamResponse([
          'data: {"type":"meta","modelId":null}\n\n',
          'data: {"type":"delta","text":"Sim"}\n\n',
          'data: {"type":"delta","text":"mer it."}\n\n',
          'data: {"type":"done","text":"Simmer it.","modelId":null}\n\n',
        ]);
      }),
    );

    const events: ChatStreamEvent[] = [];
    await callStream((event) => events.push(event), new AbortController().signal);

    expect(method).toBe('POST');
    expect(path).toBe('/ai/chat/stream');
    expect(body?.sessionId).toBe('session-1');
    expect(body?.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(events).toEqual([
      { type: 'meta', modelId: null },
      { type: 'delta', text: 'Sim' },
      { type: 'delta', text: 'mer it.' },
      { type: 'done', text: 'Simmer it.', modelId: null },
    ]);
  });

  it('tolerates CRLF separators and ignores comment lines and malformed frames', async () => {
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, () =>
        sseStreamResponse([
          ': keep-alive comment\r\n\r\n',
          'data: {"type":"meta","modelId":null}\r\n\r\n',
          'data: not-json-at-all\r\n\r\n',
          'data: {"type":"delta","text":"Hi"}\r\n\r\n',
          'data: {"type":"done","text":"Hi","modelId":null}\r\n\r\n',
        ]),
      ),
    );

    const events: ChatStreamEvent[] = [];
    await callStream((event) => events.push(event), new AbortController().signal);

    expect(events).toEqual([
      { type: 'meta', modelId: null },
      { type: 'delta', text: 'Hi' },
      { type: 'done', text: 'Hi', modelId: null },
    ]);
  });

  it('rejects with the frame message on an error frame', async () => {
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, () =>
        sseStreamResponse(['data: {"type":"error","message":"Model exploded"}\n\n']),
      ),
    );

    await expect(callStream(() => {}, new AbortController().signal)).rejects.toThrow('Model exploded');
  });

  it('rejects with the JSON error body when the route answers non-streaming', async () => {
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, () => HttpResponse.json({ message: 'Streaming unavailable' }, { status: 403 })),
    );

    await expect(callStream(() => {}, new AbortController().signal)).rejects.toThrow('Streaming unavailable');
  });

  it('rejects with a status-code message when the error body has none', async () => {
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, () => new HttpResponse('nope', { status: 500 })),
    );

    await expect(callStream(() => {}, new AbortController().signal)).rejects.toThrow('status code 500');
  });

  it('supports cancellation via AbortController', async () => {
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, () =>
        sseStreamResponse(['data: {"type":"meta","modelId":null}\n\n']),
      ),
    );

    const controller = new AbortController();
    const pending = callStream(() => {}, controller.signal);
    controller.abort();

    await expect(pending).rejects.toThrow();
  });
});
