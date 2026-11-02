import { http, HttpResponse } from 'msw';
import { authSession, authUser, TEST_PASSWORD } from '../fixtures/db';
import { TEST_ORIGIN } from '../origin';
import {
  applyEmbedOrder,
  applyOrder,
  filterParams,
  matchesWithDefaults,
  nextId,
  parseOrder,
  tables,
  type Row,
} from '../fixtures/tables';

const REST = `${TEST_ORIGIN}/rest/v1`;
const AUTH = `${TEST_ORIGIN}/auth/v1`;
export const SUPABASE_URL = TEST_ORIGIN;

/**
 * RPC registry — RPCs are SECURITY DEFINER functions with no table behind
 * them, so tests register/replace behavior directly:
 *   rpcHandlers['set_recipe_moderation'] = (args) => 204;
 * Returning `undefined` sends 204 No Content (void RPC).
 */
export const rpcHandlers: Record<string, (args: Record<string, unknown>) => unknown> = {
  set_recipe_moderation: () => undefined,
  admin_update_profile: () => undefined,
  update_support_ticket: () => undefined,
};

function send(result: Row[], representation: boolean, acceptObject: boolean): Response {
  if (!representation) return new HttpResponse(null, { status: 201 });
  if (acceptObject) {
    if (result.length !== 1) {
      return HttpResponse.json(
        { code: 'PGRST116', details: `Results contain ${result.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' },
        { status: 406 },
      );
    }
    return HttpResponse.json(result[0]);
  }
  return HttpResponse.json(result);
}

function isRepresentation(request: Request): boolean {
  return (request.headers.get('prefer') ?? '').includes('return=representation');
}

function isAcceptObject(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('vnd.pgrst.object');
}

function conflict(table: string, payload: Row): boolean {
  // Only unique-pair violation the services handle: favorites(user_id, recipe_id).
  if (table !== 'favorites') return false;
  const existing = tables.favorites ?? [];
  return existing.some((row) => row.user_id === payload.user_id && row.recipe_id === payload.recipe_id);
}

/**
 * PostgREST resolves embeds referenced in a select on returned write rows.
 * Reproduce the two shapes the write paths depend on: recipes select the
 * full-recipe embeds, recipe_ingredients select the master ingredient row.
 */
function decorateReturned(table: string, rows: Row[]): Row[] {
  return rows.map((row) => {
    if (table === 'recipes') {
      const children = (tables.recipe_ingredients ?? []).filter((entry) => entry.recipe_id === row.id);
      return {
        ...row,
        cuisines: (tables.cuisines ?? []).find((entry) => entry.id === row.cuisine_id) ?? null,
        recipe_nutrition: (tables.recipe_nutrition ?? []).find((entry) => entry.recipe_id === row.id) ?? null,
        recipe_ingredients: children.map((entry) => ({
          ...entry,
          ingredient: (tables.ingredients ?? []).find((master) => master.id === entry.ingredient_id) ?? null,
        })),
        recipe_steps: (tables.recipe_steps ?? []).filter((entry) => entry.recipe_id === row.id),
      };
    }
    if (table === 'recipe_ingredients') {
      return {
        ...row,
        ingredient: (tables.ingredients ?? []).find((master) => master.id === row.ingredient_id) ?? null,
      };
    }
    return row;
  });
}

/** Reference embeds resolved on read rows (joins through FK columns). */
function decorateJoined(table: string, row: Row): Row {
  const findRecipe = (id: unknown) => (tables.recipes ?? []).find((entry) => entry.id === id) ?? null;
  switch (table) {
    case 'favorites':
      return { ...row, recipes: findRecipe(row.recipe_id) };
    case 'collections':
      return {
        ...row,
        collection_recipes: (tables.collection_recipes ?? [])
          .filter((entry) => entry.collection_id === row.id)
          .map((entry) => ({ ...entry, recipe: findRecipe(entry.recipe_id) })),
      };
    case 'collection_recipes':
      return { ...row, recipe: findRecipe(row.recipe_id) };
    case 'reports':
      return {
        ...row,
        recipe: row.recipe_id === null ? null : findRecipe(row.recipe_id),
        review: row.review_id === null ? null : (tables.reviews ?? []).find((entry) => entry.id === row.review_id) ?? null,
      };
    case 'reviews':
      return {
        ...row,
        public_profile_info: (tables.profiles ?? []).find((entry) => entry.id === row.user_id) ?? null,
        recipes: row.recipe_id === null ? null : findRecipe(row.recipe_id),
      };
    case 'recipes':
      return {
        ...row,
        public_profile_info: (tables.profiles ?? []).find((entry) => entry.id === row.user_id) ?? null,
      };
    case 'support_tickets':
      return {
        ...row,
        requester: (tables.profiles ?? []).find((entry) => entry.id === row.user_id) ?? null,
      };
    default:
      return row;
  }
}

export const supabaseHandlers = [
  // ---- PostgREST: selects, counts ----
  http.get(`${REST}/:table`, ({ request, params }) => {
    const table = String(params.table);
    const url = new URL(request.url);
    const rows = (tables[table] ?? []).filter(filterParams(url.searchParams));
    const { parent, embeds } = parseOrder(url.searchParams);
    const ordered = applyOrder(rows, parent).map((row) => applyEmbedOrder(row, embeds));
    // Resolve the reference embeds the services select through join tables.
    const decorated = ordered.map((row) => decorateJoined(table, row));
    const limited = url.searchParams.get('limit') ? decorated.slice(0, Number(url.searchParams.get('limit'))) : decorated;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    // Body counts (`head: false, count: 'exact'`) also parse content-range.
    if ((request.headers.get('prefer') ?? '').includes('count=exact')) {
      headers['content-range'] = `*/${decorated.length}`;
    }
    return new HttpResponse(JSON.stringify(limited), { status: 200, headers });
  }),

  http.head(`${REST}/:table`, ({ request, params }) => {
    const table = String(params.table);
    const url = new URL(request.url);
    const rows = (tables[table] ?? []).filter(filterParams(url.searchParams));
    return new HttpResponse(null, {
      status: 200,
      headers: { 'content-range': `*/${rows.length}`, 'content-type': 'application/json' },
    });
  }),

  // ---- PostgREST: inserts / upserts ----
  http.post(`${REST}/:table`, async ({ request, params }) => {
    const table = String(params.table);
    const url = new URL(request.url);
    const prefer = request.headers.get('prefer') ?? '';
    const payload = (await request.json()) as Row | Row[];
    const incoming = Array.isArray(payload) ? payload : [payload];

    if (!prefer.includes('merge-duplicates') && !prefer.includes('ignore-duplicates')) {
      const dup = incoming.find((row) => conflict(table, row));
      if (dup) {
        return HttpResponse.json(
          { code: '23505', details: 'Key (user_id, recipe_id) already exists.', hint: null, message: 'duplicate key value violates unique constraint' },
          { status: 409 },
        );
      }
    }

    const created = incoming.map((row) => {
      const base = matchesWithDefaults(table, row);
      if (!base.id && table !== 'favorites' && table !== 'collection_recipes') base.id = nextId();
      return base;
    });

    if (prefer.includes('ignore-duplicates')) {
      const existing = new Set((tables[table] ?? []).map((row) => `${row.collection_id}:${row.recipe_id}`));
      const fresh = created.filter((row) => !existing.has(`${row.collection_id}:${row.recipe_id}`));
      tables[table] = [...(tables[table] ?? []), ...fresh];
    } else if (prefer.includes('merge-duplicates')) {
      const keyOf = (row: Row) => `${row.collection_id}:${row.recipe_id}`;
      const kept = (tables[table] ?? []).filter((row) => !created.some((insert) => keyOf(insert) === keyOf(row)));
      tables[table] = [...kept, ...created];
    } else {
      tables[table] = [...(tables[table] ?? []), ...created];
    }

    return send(decorateReturned(table, created), isRepresentation(request) || url.searchParams.has('select'), isAcceptObject(request));
  }),

  // ---- PostgREST: updates ----
  http.patch(`${REST}/:table`, async ({ request, params }) => {
    const table = String(params.table);
    const url = new URL(request.url);
    const predicate = filterParams(url.searchParams);
    const patch = (await request.json()) as Row;
    const before = tables[table] ?? [];
    const updated = before.map((row) => (predicate(row) ? { ...row, ...patch } : row));
    tables[table] = updated;
    const affected = updated.filter(predicate);
    return send(affected, isRepresentation(request) || url.searchParams.has('select'), isAcceptObject(request));
  }),

  // ---- PostgREST: deletes ----
  http.delete(`${REST}/:table`, ({ request, params }) => {
    const table = String(params.table);
    const url = new URL(request.url);
    const predicate = filterParams(url.searchParams);
    const before = tables[table] ?? [];
    const removed = before.filter(predicate);
    tables[table] = before.filter((row) => !predicate(row));
    if (!isRepresentation(request)) return new HttpResponse(null, { status: 204 });
    return HttpResponse.json(removed);
  }),

  // ---- PostgREST: RPCs ----
  http.post(`${REST}/rpc/:fn`, async ({ request, params }) => {
    const fn = String(params.fn);
    const handler = rpcHandlers[fn];
    if (!handler) {
      return HttpResponse.json({ code: '404', message: `RPC ${fn} is not mocked` }, { status: 404 });
    }
    const args = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = handler(args);
    if (result === undefined) return new HttpResponse(null, { status: 204 });
    return HttpResponse.json(result);
  }),

  // ---- GoTrue: password sign-in ----
  http.post(`${AUTH}/token`, async ({ request }) => {
    const url = new URL(request.url);
    const grantType = url.searchParams.get('grant_type');
    const body = (await request.json()) as { email?: string; password?: string; refresh_token?: string };

    if (grantType === 'password') {
      if (body.email === 'cook@example.com' && body.password === TEST_PASSWORD) {
        return HttpResponse.json(authSession());
      }
      return HttpResponse.json(
        { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
        { status: 400 },
      );
    }

    if (grantType === 'refresh_token') {
      if (!body.refresh_token) {
        return HttpResponse.json({ code: 400, error_code: 'invalid_grant', msg: 'Invalid refresh token' }, { status: 400 });
      }
      return HttpResponse.json(authSession({ access_token: 'refreshed-access-token', refresh_token: 'refreshed-refresh-token' }));
    }

    return HttpResponse.json({ code: 400, msg: `Unsupported grant type: ${grantType}` }, { status: 400 });
  }),

  // ---- GoTrue: signup / otp / verify / recover / user / logout ----
  http.post(`${AUTH}/signup`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string; data?: Record<string, unknown> };
    if (body.email === 'cook@example.com') {
      return HttpResponse.json(
        { code: 422, error_code: 'user_already_exists', msg: 'User already registered' },
        { status: 422 },
      );
    }
    const user = authUser({ id: nextId(), email: body.email, user_metadata: body.data ?? {} });
    return HttpResponse.json(user);
  }),

  http.post(`${AUTH}/otp`, async () => HttpResponse.json({})),

  http.post(`${AUTH}/verify`, async ({ request }) => {
    const body = (await request.json()) as { token?: string };
    if (body.token === '123456') {
      return HttpResponse.json(authSession());
    }
    return HttpResponse.json({ code: 400, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' }, { status: 400 });
  }),

  http.post(`${AUTH}/recover`, async () => HttpResponse.json({})),

  http.get(`${AUTH}/user`, ({ request }) => {
    if (!request.headers.get('authorization')) {
      return HttpResponse.json({ code: 401, msg: 'Missing authorization header' }, { status: 401 });
    }
    return HttpResponse.json(authUser());
  }),

  http.put(`${AUTH}/user`, async ({ request }) => {
    if (!request.headers.get('authorization')) {
      return HttpResponse.json({ code: 401, msg: 'Missing authorization header' }, { status: 401 });
    }
    const patch = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(authUser(patch));
  }),

  http.post(`${AUTH}/logout`, () => new HttpResponse(null, { status: 204 })),

  // ---- Storage uploads (avatars, recipe images, review images) ----
  http.post(`${SUPABASE_URL}/storage/v1/object/*`, ({ request }) => {
    const { pathname } = new URL(request.url);
    return HttpResponse.json({ Key: pathname.replace('/storage/v1/object/', '') });
  }),
];
