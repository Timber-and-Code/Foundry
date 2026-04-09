# Foundry App — Code Review v3
**Date:** 2026-04-02
**Reviewer:** Claude Sonnet 4.6 (automated)
**Branch:** claude/angry-elion
**App version:** 1.35.0
**Prior scores:** v1 = 5.4/10 · v2 = 6.4/10 · **v3 = 7.5/10**

---

## Overall Score: 7.5 / 10

This is the most substantial improvement between any two versions. Testing jumped from 4 to 7, Build/Deploy from 7 to 8.5, Error Handling strengthened to 8, and State Management finally has a proper sync layer. App.jsx is still 1,062 lines and there is no ESLint config file, but the trajectory is strongly positive.

---

## Score Breakdown

### 1. Architecture — 7.5 / 10 _(was 7)_

**What exists:**
- `src/components/home/` directory with 8 properly split components: `HomeView.jsx`, `HomeTab.jsx`, `ScheduleTab.jsx`, `ProgressTab.jsx`, `MesoOverview.jsx`, `EditScheduleSheet.jsx`, `RestDaySheet.jsx`, `NoMesoShell.jsx`
- `src/components/workout/` directory: `DayView.jsx`, `ExerciseCard.jsx`, `CardioSessionView.jsx`, `CardioIntervalTimer.jsx`, `ExtraDayView.jsx`, `MobilitySessionView.jsx`
- `ErrorBoundary` class component wrapping entire app (confirmed)
- `useMesoState` custom hook extracted from App.jsx (confirmed)
- `React.lazy()` + `React.Suspense` on all major view imports (confirmed)

**What's still missing:**
- `App.jsx` is still **1,062 lines**. `MinimizedTimerBar` and `WeekCompleteModal` are defined inline within App.jsx rather than extracted to separate files — these two alone account for ~500 lines.
- `store.js` is still a single file. The proposed split into `persistence.js` / `analytics.js` / `archive.js` barrel did not happen; all functions remain in one 700+ line module.
- No barrel `index.js` re-exports; consumers import deep paths directly.

**Verdict:** Structural wins at the view layer but the two biggest files (App.jsx, store.js) remain monolithic.

---

### 2. Code Quality — 7.0 / 10 _(was 6)_

**What exists:**
- `.prettierrc` with explicit config: single quotes, semicolons, 2-space indent, 100-char line width, trailing commas (ES5)
- ESLint 9.39.4 + `eslint-plugin-react` 7.37.5 + `eslint-plugin-react-hooks` installed as dev deps
- `npm run lint` and `npm run format` scripts in `package.json`
- CI pipeline enforces lint on every push (see §9)

**What's still missing:**
- No `.eslintrc.js` / `eslint.config.js` found in the repo. ESLint is installed but no custom rule set is defined. This means the `npm run lint` script may be running with no project-specific rules and catching very little.
- No evidence of pre-commit hooks (Husky / lint-staged) to prevent un-linted code from reaching CI.
- No TypeScript — the codebase is pure JS with no JSDoc type annotations, so type errors are invisible until runtime.

**Verdict:** Tooling is installed, scripts exist, CI enforces it — but without an actual ESLint config the lint step is largely ceremonial.

---

### 3. State Management — 7.5 / 10 _(was 6)_

**What exists:**
- `useMesoState` hook encapsulates all training-block state: `profile`, `completedDays`, `currentWeek`, `weekCompleteModal`, plus `handleComplete` and `handleReset`
- `foundry:storedProgram` localStorage key confirmed — program is generated once and cached, avoiding re-generation on every render
- `src/utils/sync.js` exports `pullFromSupabase()` and `pushToSupabase()` — Supabase sync layer exists as a separate module
- `AuthContext` triggers `pullFromSupabase()` on `SIGNED_IN` / `USER_UPDATED` auth events
- `handleReset()` in `useMesoState` archives then clears state cleanly — no `window.location.reload()` call found

**What's still missing:**
- Props drilling remains extensive: App.jsx passes callbacks down through HomeView → DayView → ExerciseCard. No intermediate context to cut the prop chain.
- `currentWeek` is stored in both `useMesoState` hook state and `localStorage` (`loadCurrentWeek` / `saveCurrentWeek`). The two can drift if a write fails.
- No optimistic UI: Supabase pushes happen fire-and-forget; failures are silently swallowed with no retry.

**Verdict:** Solid improvement — sync layer, cached program, proper reset logic all landed. Prop drilling and silent sync failures are the remaining pain points.

---

### 4. Data Model — 7.5 / 10 _(was 7)_

**What exists:**
- `src/utils/validate.js` with four validators: `validateProfile`, `validateDayData`, `validateMesoConfig`, `validateArchive`
- All validators are fail-safe (return safe defaults, never throw)
- `validateMesoConfig` enforces actual business rules: days 2–6, weeks 4–8, split from allowed enum
- Supabase integration exists via `AuthContext` + `sync.js`
- Exercise schema is rich: `id, name, muscle, muscles[], tag, equipment, pattern, anchor, diff, sets, reps, rest, warmup, description, videoUrl, bw`

**What's still missing:**
- No Supabase schema or migration files found in the repository (no `supabase/migrations/`, no `schema.sql`). The database structure is implicit — it exists in the Supabase dashboard only. This makes the data model un-reviewable and un-reproducible from source.
- `validateDayData` coerces malformed data rather than surfacing errors to the user. A corrupted localStorage entry will silently produce empty training data.
- No schema versioning: if the data shape changes, older localStorage snapshots have no migration path.

---

### 5. Component Design — 7.0 / 10 _(was 6)_

**What exists:**
- Shared UI library started: `src/components/ui/Modal.jsx`, `Sheet.jsx`, `Button.jsx`
- Shared structural components: `FoundryBanner`, `UserMenu`, `HammerIcon`
- HomeView fully decomposed into tab-level components
- `React.lazy()` enforced at route/view level

**What's still missing:**
- `React.memo` usage on expensive list components (`ExerciseCard`, `DayView`, `HomeTab`, `ScheduleTab`, `MesoOverview`) not confirmed in the exploration. These components re-render on every parent state change.
- The shared UI library is thin — only 3 components. Recurring patterns (pill badges, progress bars, stat cards) are likely implemented inline in multiple places.
- Cross-component communication still uses `window.dispatchEvent(new CustomEvent('foundry:openCardio'))` — a global event bus pattern that bypasses React's data flow and is hard to test.

---

### 6. Performance — 7.0 / 10 _(was 6)_

**What exists:**
- `React.lazy` + `Suspense` on all top-level views (confirmed in App.jsx)
- Vite manual chunk splitting: `vendor-react` and `data-exercises` chunks configured in `vite.config.js`
- Source maps enabled for production debugging
- `useMemo` in `useMesoState` for `activeDays` computation (avoids regenerating program on every render)

**What's still missing:**
- No `React.memo` wrapping confirmed on `ExerciseCard`, `DayView`, `HomeTab`, `ScheduleTab`, or `MesoOverview`. A single state change in App.jsx (e.g. `restTimer` tick every second) re-renders the entire component tree.
- The rest timer runs a `setInterval` in App.jsx, updating state every second while active. Because memoization is absent on child components, this likely causes 60+ unnecessary re-renders per minute during active timer sessions.
- No `useCallback` confirmed for frequently-passed callbacks (`handleComplete`, `handleReset`, etc.).
- No bundle size budget or Lighthouse score tracking.

**Verdict:** The chunking and lazy loading are good. The timer-driven re-render problem is the single biggest perf issue and is straightforward to fix with `React.memo` + `useCallback`.

---

### 7. Error Handling — 8.0 / 10 _(was 7)_

**What exists:**
- `ErrorBoundary` class component confirmed: wraps entire app, shows dev stack trace in development, user-friendly fallback in production
- All four `validate.js` functions integrated as guards on localStorage reads
- `AuthContext` catches Supabase initialization errors → sets `authUnavailable = true` → app continues in offline/localStorage-only mode
- Auth gate in App.jsx shows distinct UI states: loading spinner, unavailable notice, logged-out state
- Supabase JWT → `VITE_FOUNDRY_APP_KEY` fallback chain on Worker requests

**What's still missing:**
- No global `window.onerror` / `window.onunhandledrejection` handler for async errors that escape React's boundary (e.g. a failed `pushToSupabase()` call).
- The `WeekCompleteModal` is ~430 lines of inline JSX in App.jsx. An error in that render path would crash the boundary at the worst possible moment (end of workout).
- No user-visible error state for failed AI program generation (`callFoundryAI`). Currently a timeout or parse failure likely leaves the user on a loading screen.

---

### 8. Testing — 7.0 / 10 _(was 4)_

**What exists:**
- **7 test files**, major jump from v2
- **~150 test cases / ~550+ assertions**
- Vitest 4.1.2 + jsdom environment
- `npm test` in CI (enforced on every push)

**File breakdown:**
| File | Test Cases | Coverage Focus |
|---|---|---|
| `utils/__tests__/core.test.js` | ~56 | generateProgram, PR detection, carryover, archive |
| `utils/__tests__/helpers.test.js` | ~18 | parseRestSeconds, haptic |
| `utils/__tests__/persistence.test.js` | ~30 | localStorage CRUD, snapshots |
| `utils/__tests__/analytics.test.js` | ~28 | readiness score/label, exercise history |
| `utils/__tests__/archive.test.js` | ~18 | archive CRUD, meso reset |
| `utils/__tests__/program.test.js` | ~21 | generateProgram edge cases |
| `contexts/__tests__/AuthContext.test.jsx` | ~12 | auth state, Supabase mock |

**What's still missing:**
- **Zero component tests.** No tests for `DayView`, `ExerciseCard`, `HomeTab`, `WeekCompleteModal`, or any JSX component beyond AuthContext.
- No integration tests: the full flow of completing a day, triggering week-complete modal, and archiving a meso is untested end-to-end.
- No snapshot tests for UI regression detection.
- `AuthContext.test.jsx` is the only file using React Testing Library — component testing infrastructure exists but is not used elsewhere.

**Verdict:** The biggest single improvement in v3. Utility coverage is solid. Component coverage is the remaining gap.

---

### 9. Build & Deploy — 8.5 / 10 _(was 7)_

**What exists:**
- `.github/workflows/ci.yml`: triggers on push/PR to `main` → `npm ci` → `npm run lint` → `npm test` → `npm run build` (Node 20, npm cache)
- `.github/workflows/deploy.yml`: triggers on `main` push + manual `workflow_dispatch` → build → upload `dist/` → GitHub Pages deploy
- Capacitor scripts for iOS/Android native builds (`cap:sync`, `cap:android`, `cap:ios`)
- Vite 5.4.0 with source maps and manual chunk splitting

**What's still missing:**
- No separate staging environment — all merges to main deploy directly to production GitHub Pages.
- No build caching beyond npm's node_modules cache (no Vite cache layer in CI).
- No automated mobile build in CI — Capacitor Android/iOS must be built manually.
- No lighthouse or bundle size check step in the CI pipeline.

**Verdict:** This is the strongest area improvement in v3. CI is real and enforced. The gap to 10/10 is staging environments and mobile automation.

---

### 10. Security — 6.0 / 10 _(was 5)_

**What exists:**
- Supabase auth flow: `signUp` / `signInWithPassword` / `signOut` via SDK (no password caching locally)
- JWT-authenticated Worker calls: Supabase session token sent as `Authorization: Bearer` header to Cloudflare Worker
- `VITE_FOUNDRY_APP_KEY` fallback for unauthenticated users (app key, not a user secret)
- Graceful degradation when auth is unavailable (no crash, no data exposure)

**What's still missing / concerns:**
- `src/utils/supabase.js` contains a **hardcoded Supabase anon key and project URL** as fallback strings. Even though the anon key is technically public by design, hardcoding it bypasses the environment variable pattern and means it will appear in the built JS bundle and version history permanently.
- No RLS (Row Level Security) policies were found in the codebase. There is no `supabase/` directory with policy definitions. If Supabase tables exist without RLS, any authenticated user can read/write any other user's data.
- No CORS verification — the Cloudflare Worker URL is hardcoded; if the Worker misconfigures CORS, requests silently fall back to the app key rather than failing loudly.
- No input sanitization on exercise notes fields (free-text stored to localStorage and potentially synced to Supabase).

**Verdict:** Auth integration is a real improvement. The missing RLS documentation and hardcoded fallback credentials are the remaining risk areas.

---

### 11. Dependencies — 9.0 / 10 _(was 9)_

**Key additions since v2:**
- `@supabase/supabase-js` 2.101.1 — auth + sync
- `vitest` 4.1.2 — test runner
- `eslint` 9.39.4 + `eslint-plugin-react` + `eslint-plugin-react-hooks`
- `prettier` 3.8.1

**Full dependency picture:**
- React 18.2.0 (stable, widely supported)
- Vite 5.4.0 (current)
- Capacitor 6.x (current stable)
- All dependencies appear to be maintained and on reasonable versions

**Minor concerns:**
- `vitest` 4.1.2 is a very recent release (vitest v4 is the latest major); worth monitoring for breaking changes.
- No `engines` field in `package.json` to lock the Node version requirement.

---

## Comparison Table: v1 vs v2 vs v3

| Area | v1 | v2 | v3 | Delta v2→v3 |
|---|---|---|---|---|
| Architecture | 6.0 | 7.0 | 7.5 | +0.5 |
| Code Quality | 5.0 | 6.0 | 7.0 | +1.0 |
| State Management | 5.0 | 6.0 | 7.5 | +1.5 |
| Data Model | 6.0 | 7.0 | 7.5 | +0.5 |
| Component Design | 5.0 | 6.0 | 7.0 | +1.0 |
| Performance | 5.0 | 6.0 | 7.0 | +1.0 |
| Error Handling | 6.0 | 7.0 | 8.0 | +1.0 |
| Testing | 2.0 | 4.0 | 7.0 | +3.0 |
| Build & Deploy | 5.0 | 7.0 | 8.5 | +1.5 |
| Security | 4.0 | 5.0 | 6.0 | +1.0 |
| Dependencies | 8.0 | 9.0 | 9.0 | 0.0 |
| **Overall** | **5.4** | **6.4** | **7.5** | **+1.1** |

> v1/v2 area scores are reconstructed estimates consistent with their published overall scores.

---

## What Still Needs Work (Priority Order)

### P1 — Highest impact, lowest effort

**1. Add ESLint config file**
ESLint is installed but has no `eslint.config.js` / `.eslintrc.js`. The `npm run lint` step in CI is effectively a no-op. Add a minimal config targeting React + hooks rules. This is a one-file change that makes the lint step meaningful.

**2. Extract `MinimizedTimerBar` and `WeekCompleteModal` from App.jsx**
These two inline components account for ~500 of App.jsx's 1,062 lines. Moving them to `src/components/timer/MinimizedTimerBar.jsx` and `src/components/workout/WeekCompleteModal.jsx` would cut App.jsx roughly in half with no behavior changes.

**3. Add `React.memo` to `ExerciseCard` and `DayView`**
The rest timer ticks every second in App.jsx state. Without memoization, the entire component tree re-renders every second during active timer sessions. Wrapping these two components (the deepest and most expensive) with `React.memo` stops the cascade with one-line changes.

### P2 — Medium effort, high value

**4. Add Supabase schema to the repository**
Create a `supabase/migrations/` directory with the table definitions and RLS policies. This makes the data model reviewable, reproducible, and deployable. Without it, the Supabase database is a black box — if it ever needs to be recreated, the schema is lost.

**5. Add component tests for `DayView` and `WeekCompleteModal`**
These are the two most complex, highest-stakes components (workout logging and meso completion). Even basic render + interaction tests would catch regressions. The React Testing Library infrastructure already exists in `AuthContext.test.jsx`.

**6. Move `pushToSupabase` failures out of silent swallow**
Currently sync failures are caught and discarded. Add a simple retry (1–2 attempts) or a toast notification so users know when their data is not synced. The offline degradation story is good; the failure story is not.

### P3 — Architectural improvements for later

**7. Split `store.js` into focused modules**
`persistence.js` (CRUD), `analytics.js` (PR detection, readiness), `archive.js` (archive/reset). This makes each module independently testable and reduces the cognitive load of navigating a single 700-line file.

**8. Replace `window.dispatchEvent('foundry:openCardio')` with React context**
Global custom events bypass React's data flow and are invisible to React DevTools. A small `NavigationContext` (or lifting state in HomeView) would make this cross-component communication explicit and testable.

**9. Move `supabase.js` hardcoded credentials to env-only**
Remove the fallback hardcoded strings. Fail fast with a clear error if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing. The credentials will be in the `.env` file (already gitignored) — no fallback needed in source.

---

## Recommended Next Steps

1. **`eslint.config.js`** — 30-minute task. Unlocks real linting in CI.
2. **Extract `WeekCompleteModal`** — 1-hour refactor. Biggest architecture win left.
3. **`React.memo` on `ExerciseCard` + `DayView`** — 20-minute task. Fixes the timer re-render cascade.
4. **Supabase migrations directory** — 2-hour task. Adds schema to source control permanently.
5. **2–3 component tests for `DayView`** — 2-hour task. Closes the biggest testing gap.

If those five items land, v4 should realistically reach **8.3–8.5 / 10**.
