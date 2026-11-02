# Testing

Vitest + Testing Library + MSW. All network is mocked — tests never touch a
real backend or Supabase project.

```bash
npm test              # single run
npm run test:watch    # watch mode
npm run test:coverage # single run + v8 coverage
```

Typecheck your tests with the app: `npx tsc -b` (test files are included in
`tsconfig.app.json`). Lint: `npx eslint .`.

## How the mocking works

Both network stacks are mocked **at the network level** (MSW intercepts
`fetch`/XHR in jsdom), so real axios interceptors, the real supabase-js
client, and all Zod parsing run in every test:

- **NestJS API** (axios, `src/api/client.ts`) — handlers in
  `src/test/handlers/rest.ts` for the endpoints in `docs/API_ENDPOINTS.md`
  (`/ai/*`, `/recipes/import`, `/orders`, `/billing/*`).
- **Supabase** (PostgREST + GoTrue + Storage) — handlers in
  `src/test/handlers/supabase.ts` run against an in-memory table store in
  `src/test/fixtures/tables.ts` that implements the PostgREST features the
  app emits (eq/in/lte/gte/neq/contains/ilike filters, `.or()` incl. nested
  `and()`, order + embed order, limit, head counts, insert/update returns
  with resolved embeds, RPCs).

`src/test/setup.ts` starts the server with `onUnhandledFrame: 'error'` —
**any request without a handler fails the test**. When a service gains an
endpoint, add a handler; don't bypass.

## Where things live

| Thing                        | Location                                          |
| ---------------------------- | ------------------------------------------------- |
| Test files                   | co-located `*.test.ts(x)` next to the code        |
| MSW server                   | `src/test/server.ts`                              |
| REST (axios) handlers        | `src/test/handlers/rest.ts`                       |
| Supabase handlers + RPCs     | `src/test/handlers/supabase.ts`                   |
| Fake PostgREST table store   | `src/test/fixtures/tables.ts` (`seed`, `tables`)  |
| Row fixtures (deterministic) | `src/test/fixtures/db.ts` (`dbRecipe`, `authUser`…) |
| Session seeding              | `src/test/auth.ts` (`seedSession`, `clearSession`)|
| Provider/router test wrapper | `src/test/utils.tsx` (`renderRoutes`)             |

## Rules for adding tests

- **Fixtures must be deterministic** — no `Date.now()`/`Math.random()`;
  builders live in `fixtures/db.ts` and take overrides. If a query filters on
  a column, give the fixture a *distinct* value for it (several "why does my
  filter match everything" mysteries here were the shared default
  description in `dbRecipe`).
- **New endpoint** → add a default success handler in `handlers/rest.ts` or
  `handlers/supabase.ts`; contract tests override it per-test with
  `server.use(http.<method>(…))` and assert the outgoing payload inline.
- **Auth state**: `seedSession()` before the test, `clearSession()` to test
  the logged-out behavior (requests must be *blocked*, never sent). Sessions
  are seeded straight into the localStorage key supabase-js reads.
- **Component tests**: render through `renderRoutes()` (mirrors the real
  provider stack: Query, Mantine, Modals, Notifications, AuthUserProvider,
  memory-history router). Query like a user (role/label/text); use
  `userEvent`, never `fireEvent`; prefer `findBy*` with an explicit
  `{ timeout: 5000 }` for async UI (default 1s is too tight for
  provider-stacked renders).
- **Dexie-backed code** (shopping, planner, AI chat) runs on
  `fake-indexeddb` (loaded in setup). Clear the tables you use in
  `beforeEach` — Zustand stores likewise (`store.setState(initial)`).
- **RPCs** have no table; register behavior inline:
  `rpcHandlers['moderate_recipe'] = (args) => …` (restore/delete the key
  afterwards).
- Errors: default handlers return success; simulate failures by overriding
  with `HttpResponse.json({ message }, { status })` or
  `HttpResponse.error()` for network drops. Unauthenticated request paths
  are covered in `src/api/client.test.ts`.

## Coverage

`npm run test:coverage` covers `services/`, `utils/`, `lib/`, `store/`,
`src/api`, and `src/utils` (schema definitions excluded — they're exercised
through the contract tests). Treat the number as a smoke signal, not a
target: the suite is organized around user flows and API contracts.
