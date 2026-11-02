# Augmented Cooking — web client

AI-assisted cooking platform: browse/create/import recipes, AI recipe generation and editing, an AI cooking assistant with local chat history, a weekly meal planner, smart shopping lists, reviews, collections, favorites, subscriptions, and a support desk. Plus dedicated moderator and admin panels.

**Stack:** React 19 · TypeScript · Vite 8 (React Compiler enabled) · Mantine v9 · TanStack Router (file-based) · TanStack Query v5 · Zustand v5 · Zod v4 · Supabase (auth + data) · Dexie (local AI chat history) · axios (AI/scraping/order/billing backend) · react-icons.

## Running it

```bash
npm install
npm run dev      # dev server (regenerates src/routeTree.gen.ts on start)
npm run build    # tsc -b && vite build
npm run lint     # eslint
```

Environment variables (browser-visible, Zod-validated in `src/config/client`): `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

## What's done

The whole user-facing surface plus moderator and admin panels is implemented — see `docs/PROGRESS.md` for the full checklist. Highlights:

- **Recipes:** browse with URL-driven multi-criteria search, detail with serving scaling, unit conversion, persistent cook-mode check-off, favorites, copy-to-my-recipes, nutrition chart, reviews (threaded, with images), report.
- **Management:** create/edit with photo upload, URL import (review-before-save), collections (shareable), my recipes.
- **AI:** assistant chat (Dexie-stored history, markdown), recipe generation, AI edit with preview/apply, nutrition analysis with healthier-alternative suggestions, model selection.
- **Planning:** weekly planner (7 days × 4 slots, per-day nutrition) and unit-aware shopping lists generated from the plan, with a grocery-order integration button.
- **Roles:** route guards via router `beforeLoad`, moderator portal, admin panel (users, recipes, plans, AI models, metrics, bug reports). A dev-only role switcher lets you reach every area without real role data.

## What needs the backend / database

- **Supabase schema is not created yet.** Every table, column, and RLS rule the code expects is specified in `docs/DATABASE_REFERENCE.md` — create the schema to match and the app lights up.
- **AI/scraping/ordering backend is live** and implements `docs/API_ENDPOINTS.md` (NestJS, sibling `server/` repo). Point `VITE_API_URL` at it (e.g. `http://localhost:3000` for a local server); while it is unreachable, AI surfaces, imports, ordering, and billing fail with visible, handled errors.
- Payment (subscribe / token top-up) is a placeholder flow recording intent — no real payments.

## Architecture notes

- Strict layering: components → feature hooks (TanStack Query) → feature services (Supabase or axios + Zod) → shared clients (`src/api/client.ts`, `src/lib/supabase/client.ts`).
- Feature modules live in `src/features/*` with per-feature `components/hooks/services/types/query-keys` folders and barrels.
- Shareable UI state (search filters, planner week) lives in the URL via `validateSearch`; cook-mode progress lives in Zustand + localStorage; server state lives only in TanStack Query.
- Route tree is generated — do not edit `src/routeTree.gen.ts`; start the dev server to regenerate it.
