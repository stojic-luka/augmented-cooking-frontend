/**
 * In-memory PostgREST simulation for supabase-js tests. Handlers in
 * `handlers/supabase.ts` run real supabase-js requests through this store,
 * so filters, embed ordering, counts, and insert-return shapes all behave
 * like the real service over HTTP.
 *
 * Scope note: only the PostgREST features this app actually emits are
 * implemented (eq/in/lte/gte/neq/contains/not-is-null filters, .or() with
 * nested and(), order incl. referencedTable embeds, limit, head counts,
 * representation/single inserts). Anything else falls through as "no
 * filter matched", which failing tests will surface.
 */

export type Row = Record<string, unknown>;

/** Tests seed and inspect this store directly between requests. */
export const tables: Record<string, Row[]> = {};

export function seed(table: string, rows: Row[]): void {
  tables[table] = rows.map((row) => ({ ...row }));
}

export function clearTables(): void {
  for (const key of Object.keys(tables)) delete tables[key];
}

export function allRows(): Row[] {
  return Object.values(tables).flat();
}

/** Column defaults the database applies and PostgREST echoes back on return. */
export const TABLE_DEFAULTS: Record<string, Row> = {
  recipes: {
    category: null,
    cooking_method: null,
    spice_level: null,
    cook_time_minutes: null,
    prep_time_minutes: null,
    cuisine_id: null,
    image_url: null,
    difficulty: null,
    dietary_tags: [],
    is_public: false,
    moderation_status: 'pending',
    origin: 'manual',
    source_url: null,
    original_recipe_id: null,
    rating_avg: 0,
    review_count: 0,
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
  recipe_ingredients: { quantity: null, unit: null, note: null, is_optional: false, raw_text: null },
  recipe_steps: { estimated_time_minutes: null, timer_seconds: null },
  profiles: {
    display_name: '',
    avatar_url: null,
    role: 'user',
    subscription_tier: 'free',
    tokens_remaining: 0,
    unit_preference: 'metric',
    dietary_preferences: [],
    ai_model_id: null,
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
  collections: { description: '', is_public: false, created_at: '2026-06-01T10:00:00Z' },
  support_tickets: { assignee_id: null, status: 'open', created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z' },
  support_ticket_messages: { created_at: '2026-06-01T10:00:00Z' },
  reviews: {
    rating: null,
    image_url: null,
    parent_review_id: null,
    root_review_id: null,
    depth: 0,
    moderation_status: 'pending',
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
  favorites: { created_at: '2026-06-01T10:00:00Z' },
  order_receipts: { total_minor: null, currency: 'EUR', created_at: '2026-06-01T10:00:00Z' },
  ingredients: { aliases: [], category: 'other', is_active: true, created_at: '2026-06-01T10:00:00Z' },
  cuisines: { region: null, is_active: true, created_at: '2026-06-01T10:00:00Z' },
  units: { is_active: true, created_at: '2026-06-01T10:00:00Z' },
  ai_models: { is_enabled: true, min_tier: 'free', created_at: '2026-06-01T10:00:00Z' },
  subscription_plans: { is_active: true, currency: 'EUR', created_at: '2026-06-01T10:00:00Z' },
  reports: { recipe_id: null, review_id: null, status: 'open', created_at: '2026-06-01T10:00:00Z' },
};

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'or', 'and', 'on_conflict', 'columns', 'apikey']);

/** `<embed>.order=position.asc` params are ordering directives, not filters. */
function isEmbedOrder(key: string): boolean {
  return key.endsWith('.order');
}

let fakeIdCounter = 0;
export function nextId(): string {
  fakeIdCounter += 1;
  return `90000000-0000-4000-8000-${String(fakeIdCounter).padStart(12, '0')}`;
}

type Predicate = (row: Row) => boolean;

/** `eq.true` / `lte.30` / `in.("a","b")` / `not.is.null` → typed value + op. */
function parseFilterValue(raw: string): { op: string; value: unknown } {
  const dot = raw.indexOf('.');
  const op = raw.slice(0, dot);
  let value: unknown = raw.slice(dot + 1);
  if (value === 'true') value = true;
  else if (value === 'false') value = false;
  else if (value === 'null') value = null;
  else if (value === 'is.null') value = null;
  else if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  } else if (typeof value === 'string' && value !== '' && !Number.isNaN(Number(value))) {
    value = Number(value);
  }
  return { op, value };
}

function columnValue(row: Row, column: string): unknown {
  if (!column.includes('.')) return row[column];
  // Embed-path filter (recipe_nutrition.calories_per_serving): match if any embed row matches.
  const [embed, ...rest] = column.split('.');
  const embedRows = row[embed];
  if (Array.isArray(embedRows)) {
    return embedRows.some((entry) => columnValue(entry as Row, rest.join('.')) !== undefined);
  }
  return columnValue((embedRows ?? {}) as Row, rest.join('.'));
}

/** Numeric strings compare numerically; everything else lexicographically. */
function compare(a: unknown, b: unknown): number {
  const asNum = typeof a === 'number' || typeof b === 'number' ? Number(a) - Number(b) : NaN;
  if (!Number.isNaN(asNum)) return asNum;
  return String(a).localeCompare(String(b));
}

function singleFilter(column: string, op: string, value: unknown): Predicate {
  return (row) => {
    if (op === 'is') return value === null ? columnValue(row, column) === null : false;
    const actual = columnValue(row, column);
    switch (op) {
      case 'eq':
        return actual === value || String(actual) === String(value);
      case 'neq':
        return !(actual === value || String(actual) === String(value));
      case 'gte':
        return actual !== null && actual !== undefined && compare(actual, value) >= 0;
      case 'lte':
        return actual !== null && actual !== undefined && compare(actual, value) <= 0;
      case 'lt':
        return actual !== null && actual !== undefined && compare(actual, value) < 0;
      case 'gt':
        return actual !== null && actual !== undefined && compare(actual, value) > 0;
      case 'in': {
        const values = String(value)
          .replace(/^\(|\)$/g, '')
          .split(',')
          .map((entry) => entry.replace(/^"|"$/g, ''));
        return values.some((entry) => String(actual) === entry);
      }
      case 'cs': {
        // contains: array column must include every given tag (`{vegetarian,vegan}`)
        const tags = String(value)
          .replace(/^\{|\}$/g, '')
          .split(',')
          .filter(Boolean);
        return Array.isArray(actual) && tags.every((tag) => actual.includes(tag));
      }
      case 'ilike': {
        const term = String(value).replaceAll('%', '').toLowerCase();
        return String(actual ?? '').toLowerCase().includes(term);
      }
      default:
        return false;
    }
  };
}

/** Splits on top-level commas only (parens/quotes protected). */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuotes = false;
  let current = '';
  for (const char of input) {
    if (char === '"') inQuotes = !inQuotes;
    if (!inQuotes && char === '(') depth += 1;
    if (!inQuotes && char === ')') depth -= 1;
    if (char === ',' && depth === 0 && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

const FILTER_TOKEN = /^([A-Za-z_][A-Za-z0-9_.]*)\.(eq|neq|lt|gt|lte|gte|is|cs|ilike)\.(.+)$/;

function tokenPredicate(token: string): Predicate {
  const match = token.match(FILTER_TOKEN);
  if (!match) return () => false;
  return singleFilter(match[1], match[2], parseSingleValue(match[3]));
}

function parseOrExpression(expression: string): Predicate {
  const parts = splitTopLevel(expression);
  const predicates: Predicate[] = parts.map((part) => {
    const andMatch = part.match(/^and\((.*)\)$/);
    if (andMatch) {
      const inner = splitTopLevel(andMatch[1]).map(tokenPredicate);
      return (row) => inner.every((predicate) => predicate(row));
    }
    return tokenPredicate(part);
  });
  return (row) => predicates.some((predicate) => predicate(row));
}

function parseSingleValue(raw: string): unknown {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

/** URL search params → row predicates (everything except reserved keys). */
export function filterParams(params: URLSearchParams): Predicate {
  const predicates: Predicate[] = [];
  params.forEach((value, key) => {
    if (RESERVED_PARAMS.has(key) || isEmbedOrder(key)) return;
    const dot = value.indexOf('.');
    if (dot === -1) return;
    const { op, value: parsed } = parseFilterValue(value);
    if (op === 'not') {
      // `not.is.null` is the only form the app emits.
      const inner = singleFilter(key, 'is', null);
      predicates.push((row) => !inner(row));
      return;
    }
    predicates.push(singleFilter(key, op, parsed));
  });
  const orParam = params.get('or');
  if (orParam) predicates.push(parseOrExpression(orParam.replace(/^\(|\)$/g, '')));
  return (row) => predicates.every((predicate) => predicate(row));
}

export interface OrderSpec {
  column: string;
  direction: 'asc' | 'desc';
}

export function parseOrder(params: URLSearchParams): { parent: OrderSpec[]; embeds: { table: string; spec: OrderSpec }[] } {
  const parent: OrderSpec[] = [];
  const embeds: { table: string; spec: OrderSpec }[] = [];

  const read = (path: string): OrderSpec => {
    const [column, ...modifiers] = path.split('.');
    return { column, direction: modifiers.includes('desc') ? 'desc' : 'asc' };
  };

  const parentParam = params.get('order') ?? '';
  for (const part of parentParam.split(',')) {
    if (part) parent.push(read(part));
  }
  params.forEach((value, key) => {
    if (isEmbedOrder(key)) {
      embeds.push({ table: key.slice(0, -'.order'.length), spec: read(value) });
    }
  });
  return { parent, embeds };
}

export function applyOrder(rows: Row[], specs: OrderSpec[]): Row[] {
  const sorted = [...rows];
  for (const { column, direction } of [...specs].reverse()) {
    const nullsLast = (row: Row) => (row[column] === null || row[column] === undefined ? 1 : 0);
    sorted.sort((a, b) => {
      const nullDelta = nullsLast(a) - nullsLast(b);
      if (nullDelta !== 0) return nullDelta;
      const delta = compare(a[column], b[column]);
      return direction === 'desc' ? -delta : delta;
    });
  }
  return sorted;
}

export function applyEmbedOrder(row: Row, embeds: { table: string; spec: OrderSpec }[]): Row {
  const result: Row = { ...row };
  for (const { table, spec } of embeds) {
    const value = result[table];
    if (Array.isArray(value)) {
      result[table] = applyOrder(value as Row[], [spec]);
    }
  }
  return result;
}

export function matchesWithDefaults(table: string, payload: Row): Row {
  return { ...(TABLE_DEFAULTS[table] ?? {}), ...payload };
}
