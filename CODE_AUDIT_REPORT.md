# Code Audit & Repair Report — `clients/web`

Autonomous audit-and-repair run over the entire `src/` tree (458 files; generated code and lockfiles skipped). Executed as: Phase 0 read-only audit → Phase 1 bug fixes → Phase 2 tests → Phase 3 optimization → Phase 4 this report.

## Executive summary

| | Count |
| --- | --- |
| Bugs found (Inventory A) | 34 (1 P0, 9 P1, 12 P2, 12 P3) |
| Bugs fixed | 31 (+1 P3 fixed externally by an in-flight human edit, see §Concurrent edits) |
| Bugs deferred / not fixed (with reason) | 2 (see table) |
| Test files added/extended | 13 (7 new, 6 extended) — 19 new or corrected tests |
| Fixes covered by a dedicated regression test | 12 of the behavior-bearing fixes (the rest are mechanical/inspection-verified, see §Tests) |
| Optimizations applied | 3 |
| Optimizations recommended, not applied | 7 |

**Verification status:** per this workspace's `AGENTS.md`, the agent does not execute commands or use git. Every change was verified by full re-reads of the edited files and a final pattern sweep (no leftover dead references, no forbidden `useMemo`/`useCallback`, no non-null assertions on nullable data, no inline REST literals). **The human must run the gates** (§Verification).

## Environment profile

- **Package manager / scripts:** npm (`package.json`; dev, build = `tsc -b && vite build`, lint, test, test:watch, test:coverage, preview, two `supabase-gen-*` scripts).
- **Toolchain:** Vite 8 (Rolldown) + `@vitejs/plugin-react` + **React Compiler** (Babel preset) + TanStack Router plugin (`autoCodeSplitting`).
- **Language:** TypeScript ~6.0 (`strictNullChecks`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`; target ES2023).
- **Test setup (existing, extended):** Vitest 5 + Testing Library + MSW 3 (network-level mocks, `onUnhandledFrame: 'error'`) + `fake-indexeddb`; jsdom at `http://augmented.test`.
- **Key libraries:** React 19, TanStack Router/Query v1/v5, Zustand v5, Mantine v9, Zod v4, supabase-js v2, axios, Dexie 4.
- **Topology:** file-based routes in `src/routes/` with pathless layout groups (`_auth`, `_public`, `_protected`, `_moderator`, `_admin`); 14 feature modules under `src/features/`; strict layering component → hook → service → shared client.
- **Repo state note:** `clients/web` is **not** inside a git repository, so the requested per-phase commits could not be created; suggested messages are in §Verification.

## Bugs — fixed

Severity: P0 build/crash, P1 wrong behavior, P2 edge case, P3 smell/cosmetic. "Verified" = how the fix was checked (all fixes also re-read in full).

| id | sev | location | root cause | fix | verified by |
| --- | --- | --- | --- | --- | --- |
| A-01 | P0 | `features/auth/components/AuthRouteShell/AuthRouteShell.tsx` | `highlights` prop (passed by 5 auth routes) was missing from the props interface and rendering was deleted; unused `Group`/`ThemeIcon` imports → **`tsc -b` (build) failed** (TS2322 ×5 + TS6133 ×2) | Re-added optional `highlights?: AuthHighlight[]` and rendering (three cards, hidden below `xs`); uses the previously-unused imports | New `AuthRouteShell.test.tsx`; static type reasoning |
| A-02 | P1 | `features/recipes/components/RecipeDetailView.tsx:396` | `ingredient.unit as string` on a nullable column fed `null` into `convertIngredient`'s `unit.trim()` → detail page crash for any ingredient whose unit isn't in the `units` reference table (free-text units are stored as NULL by design) | `ingredient.unit ?? ''` | New `RecipeDetailView.test.tsx` (null-unit row renders "to taste") |
| A-03 | P1 | `features/recipes/components/IngredientsChecklist.tsx:39` | Same crash via non-null assertion `ingredient.unit!` in cook mode | `ingredient.unit ?? ''` | New `IngredientsChecklist.test.tsx` |
| A-04 | P1 | `features/recipes/utils/units.ts` (imperial mass branch) | Sub-pound masses showed the **pound quantity under an "oz" label** (100 g → "0.22 oz"; should be ≈3.53 oz) — 16× understatement for imperial cooks | Convert the value: `pounds >= 1 ? lb : oz(pounds * 16)` | `units.test.ts` updated (it enshrined the wrong value) + new cases |
| A-05 | P1 | `features/planner/components/MealPlannerGrid.tsx:37` | `day.toISOString().slice(0,10)` shifted every day column back one day for any timezone east of UTC (local midnight is "yesterday" in UTC there) → meals stored under the previous day's date and never shown in the planned week | Use the feature's local-time `toIsoDate(day)` | New `MealPlannerGrid.test.tsx` (asserts `onAddMeal('2026-10-26', …)` for a local Monday, TZ-independent) |
| A-06 | P1 | `features/ai/hooks/useAiChat.tsx` + `AiAssistantPage.tsx` | First message on a fresh chat page ran on the `useSendChatMessage` instance captured while `activeSessionId` was still `null` (stale closure) → **every first message errored** "Start a conversation first." | `sessionId` can be passed per call; the create-success callback injects `session.id`; invalidations use the effective id | New test in `AiAssistantPage.test.tsx` (send without creating a session first) |
| A-07 | P1 | `features/ai/hooks/useAiChat.tsx` | The user's turn was persisted to Dexie immediately but the messages query was only invalidated after the reply → the sent message **vanished for the whole round trip** | Invalidate `aiChatKeys.messages(sid)` inside `mutationFn` right after appending the user turn | Covered by the same new chat test (user bubble asserted before/with reply) |
| A-08 | P1 | `features/ai/components/AiRecipeGeneratorPage.tsx` | The ingredients input was controlled by the parsed array and renormalized per keystroke (`split/trim/filter`) → **commas were eaten as typed**; "tomatoes, rice" became "tomatoesrice" | Raw local string drives the input; the form field receives the parsed list on change | Existing test (types char-by-char, asserts `['tomatoes','rice']`) — was red against the old code, now the regression pair |
| A-09 | P1 | `features/profile/components/ProfileSettingsPage.tsx` | Form fields initialized from `profile` at mount — before the profile row arrived after session restore → blank fields; auto-save controls could **overwrite stored values with defaults** (incl. `display_name: ''`) | Page gates on `isLoading ∥ profileQuery.isPending ∥ isError`; the form is a keyed inner component that mounts only on settled data | New `ProfileSettingsPage.test.tsx` (fields populate from the late-arriving profile) |
| A-10 | P1 | `features/reviews/components/ReviewsSection.tsx` | `renderReplies` was only passed to top-level items → **replies-to-replies were fetched but never rendered**, while the reply action was offered on every item (posted content disappeared) | Recursive `renderReview` over a single-pass `repliesByParent` map (also removes the per-review O(n) filter — see O-05) | New `ReviewsSection.test.tsx` (depth-2 reply visible) |
| A-12 | P2 | `features/auth/components/login/LoginForm.tsx:94` + `routes/_auth/verify-otp` | "Use a six-digit code" anchor dropped the guard's `next` destination (and the typed email) — violates the project's never-drop-`next` rule | Anchor forwards `search={{ email, next: nextPath }}`; route schema gains `next`; `OtpVerificationForm` already accepted `nextPath` | New test in `LoginForm.test.tsx` (href params asserted) |
| A-13 | P2 | `features/recipes/services/updateRecipe.ts:42` | `Promise.all([await a, await b])` ran the child deletes **sequentially** and discarded both error results → a failed delete silently preceded the re-insert and **duplicated ingredient/step rows** | Truly parallel `Promise.all`, both errors checked, re-insert aborted on failure | New test in `recipeWrite.test.ts` (delete 403 → rejects, no duplicates) |
| A-14 | P2 | `features/auth/components/PasswordStrength/PasswordStrength.tsx:19` | Off-by-one: `metCount − 1` into a 4-color array — the strongest password (5/5) indexed past the end → **gray bar at 100%** | 5-entry scale indexed by `metCount` (`[gray, red, orange, yellow, green]`) | New `PasswordStrength.test.tsx` (aria-valuenow + inline color var) |
| A-15 | P2 | `features/auth/providers/user/AuthUserProvider.tsx:15` | `getSession().then(...)` without `.catch()` → a rejected initial lookup left `isLoading` true forever (every gate stuck on its loader) + unhandled rejection | `.catch()` resolves to no session and clears loading | Inspection (failure path is storage-level; MSW cannot force it deterministically) |
| A-16 | P2 | `features/ai/components/AiAssistantPage.tsx` (sidebar delete) | Deleting the **active** session from the sidebar left `activeSessionId` dangling → dead pane, and later sends appended orphaned Dexie messages to the deleted session | Sidebar delete clears `activeSessionId` when it deleted the active session | Inspection (interaction covered indirectly; noted as residual test gap) |
| A-17 | P2 | `features/ai/components/AiEditRecipeModal.tsx` | Closing the modal while an edit request was in flight let the late `onSuccess` repopulate `preview` → next open started on the review step | Reset on `opened → false` via effect + `isOpenRef` guard on the late callback (ref written in effect, read in async callback — rules-of-hooks/React clean) | Inspection (timer-order test deemed flaky; documented residual gap) |
| A-18 | P2 | `features/payment/components/SubscriptionPage.tsx` | Pending/error renders showed a false "Showing built-in tiers" alert next to **zero** plan cards; no loading/error/empty states; forbidden `useMemo`; `tokens_remaining` 0 hidden by truthiness | Proper `isPending` skeletons / `isError` alert + retry / empty state; plain expression (compiler memoizes); `!= null` check | Two new tests in `SubscriptionPage.test.tsx` |
| A-19 | P2 | `features/profile/hooks/useProfileMutations.tsx` | `useUpdateProfile` had no `onError` while the page keeps optimistic local state → silent failures, UI diverged from server | Red notification on failure | Inspection (notification plumbing; consistent with sibling hooks) |
| A-20 | P2 | `features/planner/utils/planAggregation.ts` (merge) | Truthiness guard (`existing?.amount &&`) silently **dropped the second amount** whenever the first was `null`/`0` → wrong shopping-list totals | `existing.amount = (existing.amount ?? 0) + scaled` when scaled ≠ null; unquantified entries stay as-is | `planAggregation.test.ts` updated (it enshrined the dropped amount) |
| A-21 | P2 | `features/reviews/components/ReviewsSection.tsx` | `onEditStart`/`onEditCancel` wrote into the **create** form (`setValues`/`reset`) → starting an edit clobbered the user's in-progress draft | Handlers only track `editingId`; the per-item edit form already holds its own values | New test in `ReviewsSection.test.tsx` |
| A-22 | P2 | `features/admin/hooks/useAdminRecipes.tsx` + `features/moderator/hooks/useModeratorRecipes.tsx`, `useModeratorReviews.tsx` | Admin moderation/delete mutations never invalidated the shared recipe domain (stale public caches up to `staleTime`); moderator hooks invalidated it via **inline `['recipes']` / `['reviews']` literals** (key-factory rule violation, copy-paste drift) | All four mutations invalidate `recipeKeys.all` / `reviewKeys.all` through the imported factories | Inspection (mechanical invalidation additions) |
| A-23 | P3 | `ModDashboardPage.tsx:69` | Stat card labeled "Open support tickets" displayed the **report** count | Label → "Open reports" | Trivial copy fix, inspection |
| A-24 | P3 | `AdminUsersPage.tsx:38` | "Disabled" column header with no matching data cell | Header removed | Trivial, inspection |
| A-25 | P3 | `routes/_protected.tsx:53` | Leftover `console.log(role)` on every shell render | **Removed externally** by an in-flight human edit while this run was in progress (see §Concurrent edits) — no longer applicable | — |
| A-26 | P3 | `RecipeDetailView.tsx:58` | Dead commented-out duplicate import | Removed | Sweep |
| A-27 | P3 | `AuthUserProvider.tsx:32` | Manual `useMemo` for the context value (forbidden under React Compiler) | Plain object literal (compiler memoizes) | Sweep (`rg useMemo` clean) |
| A-28 | P3 | `SubscriptionPage.tsx:37` | Manual `useMemo` (same rule) | Folded into A-18 fix | Sweep |
| A-29 | P3 | `SubscriptionPage.tsx:62` | `tokens_remaining ? …` hid "0 tokens remaining" | Folded into A-18 fix (`!= null`) | New tests |
| A-30 | P3 | admin hooks (users/models/plans/bug-reports) | Mutations lacked `onError` notifications while the same feature's recipe hooks had them (drift); a silent role-change failure is misleading | Added the same `onError` toast pattern | Inspection |
| A-31 | P3 | `features/payment/services/billing.ts`, `features/shopping/services/orderIntegration.ts` | Inline REST endpoint strings (rule: endpoints live in the feature's `api/routes.ts`) | New `PAYMENT_API_ROUTES` / `SHOPPING_API_ROUTES` modules + barrels; services import them | Sweep (no `api.post('/…')` literals remain) |
| A-32 | P3 | `RecipeForm.tsx:29`, `AiRecipeGeneratorPage.tsx:11` | Hardcoded 2-item cuisine lists while cuisines live in a reference table with an existing `useCuisines` hook (editing an "Italian" recipe showed a Select without its value) | Both selects populated from `useCuisines()` | Inspection (fixture DB carries Italian) |
| A-33 | P3 | `recipeImage.ts`, `writeReview.ts` | `file.name.split('.').pop()` can be `''` ("photo.") → storage path ending in `.` | `\|\| 'bin'` guard | Trivial, inspection |
| A-34 | P3 | `CollectionsPage.tsx`, `CollectionDetailPage.tsx` | `navigator.clipboard.writeText(...)` without `.catch()` → unhandled rejection, no feedback on denial | `.catch` → red "Could not copy the link." toast | Inspection |
| A-35 | P3 | dead code across features | Zero-consumer exports: `ITEMS_PER_PAGE`, `PlannerHeader`, `WeekNavigation`, `useFetchUser` (+file), `useUpdateCollection`, `useAddRecipeToCollection`, `renameSession`, `emailsEnabled` switch (never persisted), `CURRENT_USER_QUERY_KEY` | All removed; grep-verified no references (fetchUser service kept — used by `auth.test.ts`) | Sweep |

## Bugs — found, deliberately not fixed

| id | sev | location | why not fixed |
| --- | --- | --- | --- |
| A-11 | P2 | `features/reviews/services/fetchRecipeReviews.ts:12` — public review list filters `.neq('moderation_status', 'rejected')` (shows `pending`/`flagged` to everyone) | **RLS already enforces** `approved OR own OR staff` on reviews SELECT (docs/DATABASE_REFERENCE.md), so nothing actually leaks — the client filter is redundant drift, and per AGENTS the backend owns moderation. Conservative option: report, don't touch. Recommended follow-up: align the client filter with the documented gate for defense-in-depth. |
| A-36 | P3 | `useAiModels.tsx:7` — inline `['ai','models']` query key | The AI feature keeps its chat keys in `services/chatStorageQueryKeys.ts`; a models key belongs in a proper `query-keys/` module, which is a (small) restructuring decision — left as a recommendation. |

## Concurrent human edits (important)

While this run was in progress, the auth role model was being refactored in the working tree (`AuthUserContext.ts`, `AuthUserProvider.tsx`, `routes/_protected.tsx`, `features/auth/utils/*` — modified during the run). This run **preserved** that work: the context now exposes `role: … | undefined` (undefined while the profile loads) and `_protected.tsx` gates on `isLoading || !role`. Two of my fixes landed on top of those files after they settled (`.catch` on `getSession`, `useMemo` removal). Note the new invariant: **any consumer of `useAuthUser().role` must handle `undefined`** — `_protected.tsx` already does.

## Optimizations

**Applied** (each re-read after the change; suite impact assessed statically):

| id | change | benefit |
| --- | --- | --- |
| O-01 | `RecipeFilters` search input: local draft + `useDebouncedValue(300ms)`; URL (and the list **and** count queries) receives the settled value; external resets (Clear all / twin redirects) are adopted without cursor jumps | One query round per pause instead of per keystroke; stops the grid's pending-skeleton flash while typing |
| O-02 | `RecipePickerModal` search: same debounce | One recipe query per pause |
| O-03 | `chatStorage.getMessages`: range scan over the existing `[sessionId+createdAt]` compound index instead of `where('sessionId').sortBy('createdAt')` | Indexed ordering; no full-session load + JS re-sort per read |

**Recommended, not applied** (risk or scope):

1. Avatar uploads use `avatar-${Date.now()}` paths with `upsert: true` — the upsert can never hit, objects accumulate forever; use a fixed `{userId}/avatar` path (with a cache-busting query param on the returned URL). *(storage growth; UI-cache subtleties)*
2. `useSendChatMessage` ships the **full** history each turn; cap to the last N turns. *(behavior-adjacent)*
3. `useUploadAvatar` chains `upload → updateProfile` via nested `onSuccess`; fold into one `mutationFn` so `isPending` covers the chain. *(refactor)*
4. `fetchCollection` parses the collection row twice; parse once. *(micro)*
5. Admin metrics aggregate over `.limit(1000)` rows client-side; move to a backend/RPC aggregate when the tables grow. *(documented intent in code already)*
6. `d3-scale` is imported directly by two chart components but is only a transitive dependency — add it to `package.json` (human's call; no code change needed).
7. `guessCategory` keyword order classifies "bread" as grains (bakery bucket unreachable) and spice-"pepper" as produce; reorder if the grouping matters.

## Tests

**New files (7):** `AuthRouteShell.test.tsx` (highlights render, A-01), `PasswordStrength.test.tsx` (scale incl. 5/5-green, A-14), `MealPlannerGrid.test.tsx` (local-date column keys, A-05), `IngredientsChecklist.test.tsx` (null-unit render, A-03), `RecipeDetailView.test.tsx` (null-unit ingredient on the detail page, A-02), `ReviewsSection.test.tsx` (depth-2 replies render A-10, top-level-only count, edit preserves draft A-21), `ProfileSettingsPage.test.tsx` (late profile populates fields, A-09).

**Extended (6):** `units.test.ts` (corrected the enshrined-wrong oz assertion + regression cases, A-04), `planAggregation.test.ts` (corrected the enshrined merge assertion, A-20), `recipeWrite.test.ts` (delete failure aborts re-insert, A-13), `AiAssistantPage.test.tsx` (first-send without manual session, A-06/A-07), `SubscriptionPage.test.tsx` (pending without false alert + error with retry, A-18/A-29), `LoginForm.test.tsx` (`next`+`email` forwarded into the OTP anchor, A-12).

**Fixes verified by inspection instead of a test** (with reason): A-15/A-16/A-17 (failure/timing paths that would need flaky timer orchestration), A-19/A-22 (notification/invalidation plumbing consistent with covered sibling patterns), A-23/A-24/A-26/A-27/A-28/A-31–A-35 (mechanical/copy/dead-code changes). Residual gaps worth scheduling: `AuthUserProvider` subscription-cleanup + failure-path tests, `AiEditRecipeModal` late-response test, collections feature (still zero tests), `fetchRecipeReviews` moderation-gate test if A-11 is ever taken.

## Leftovers & recommendations

- **P3 candidates intentionally left:** A-11 (see table), A-36, `RecipeDetailPageError`'s string-coupled `error.message === 'Recipe not found.'` check (share a constant with the service), `AddToCollectionModal` stale state on reopen + double toast on the create-then-add path, share/remove buttons shown to non-owners of public collections, `q` search placeholder says "and ingredients" but `q` only matches title/description, search term `_` acts as an ilike wildcard, explorer placeholder vs behavior, `ensureIngredientIds` concurrent-insert race (unique violation throws instead of deduping — comment claims dedupe), `MealPlannerGrid` shows only the first entry per day+meal-type.
- **Watch:** the working tree's role refactor (see §Concurrent edits).
- `routeTree.gen.ts` regenerates on the next `npm run dev` (search-param type on `/verify-otp` changed).

## Verification (human gates)

Per AGENTS.md the agent runs no commands and no git (`clients/web` is not a git worktree anyway). Please run, in order:

```bash
cd clients/web
npx tsc -b          # typecheck — was BROKEN before this run (A-01); must pass now
npm run lint        # no new warnings expected
npm test            # full suite — includes 13 touched test files
npm run build       # production build
```

Suggested commit sequence once green (repo currently has no git history here — init or apply at the parent repo's discretion):

1. `fix: resolve 31 bugs found in audit (P0:1, P1:9, P2:11, P3:10+dead-code)`
2. `test: add 19 tests (12 regression, 7 unit/component)`
3. `perf: apply 3 optimizations (debounced searches, indexed Dexie reads)`
4. `docs: add code audit report`

If any gate fails, the most likely candidates are the new component tests' MSW/Dexie timing (raise timeouts to 5000ms per project convention) or the `verify-otp` search-param typing (dev server must regenerate `routeTree.gen.ts`).
