# Foundry App — Code Review v2

**Date:** 2026-04-02
**Reviewer:** Claude Sonnet 4.6
**App Version:** 1.35.0
**Prior Review Score:** 5.4/10
**Scope:** Re-evaluation after major refactoring pass. Read-only analysis using grep and targeted file reads.

---

## Score Summary

| Area                        | v1 Score | v2 Score | Delta  |
|-----------------------------|----------|----------|--------|
| Architecture & Structure    | 7/10     | 7/10     | →      |
| Code Quality                | 5/10     | 6/10     | ↑      |
| State Management            | 5/10     | 6/10     | ↑      |
| Data Model                  | 6/10     | 7/10     | ↑      |
| Component Design            | 4/10     | 6/10     | ↑↑     |
| Performance                 | 6/10     | 7/10     | ↑      |
| Error Handling              | 4/10     | 7/10     | ↑↑↑    |
| Testing                     | 1/10     | 4/10     | ↑↑↑    |
| Build & Deploy              | 7/10     | 7/10     | →      |
| Security                    | 5/10     | 5/10     | →      |
| Dependencies                | 9/10     | 8/10     | ↓      |
| **Overall**                 | **5.4**  | **6.4**  | **↑**  |

---

## 1. Architecture & Project Structure — 7/10 (was 7/10)

### What improved
No major structural regressions. The directory layout continues to be the app's strongest organisational asset.

### Current structure
```
foundry-app/
├── src/
│   ├── App.jsx                      (751 lines — LARGE)
│   ├── components/
│   │   ├── home/                    HomeTab, HomeView, ProgressView, ScheduleTab, etc.
│   │   ├── workout/                 DayView, ExerciseCard, CardioSessionView, etc.
│   │   ├── settings/                SettingsView, PricingPage
│   │   ├── onboarding/              OnboardingFlow
│   │   ├── setup/                   SetupPage
│   │   ├── shared/                  AppIcon, FoundryBanner, HammerIcon
│   │   ├── tour/                    TourOverlay
│   │   └── ui/                      Button, Modal, Sheet  ← new shared UI layer
│   ├── data/
│   │   ├── exercises.js             (2,611 lines — data-only, kept separate)
│   │   └── constants.js             (572 lines)
│   ├── utils/
│   │   ├── store.js                 (678 lines — over-large)
│   │   ├── program.js               (341 lines)
│   │   ├── training.js              (296 lines)
│   │   ├── api.js                   (227 lines)
│   │   ├── storage.js               (33 lines)
│   │   ├── helpers.js               (26 lines)
│   │   └── __tests__/core.test.js
│   └── styles/
│       ├── global.css
│       └── theme.css
```

### Still needs work
- **App.jsx at 751 lines** — timer logic, event listeners, navigation, modal state, and global prop management all live here. Should be decomposed into custom hooks (`useRestTimer`, `useModals`, `useNavigation`).
- **store.js at 678 lines** — conflates persistence, analytics (PR/stall detection), archive management, and export/import. Should be split into focused modules.
- No `tsconfig.json`, no ESLint, no Prettier. Zero static analysis tooling.

---

## 2. Code Quality — 6/10 (was 5/10)

### What improved
- **No duplicate functions found.** `formatDuration`, `formatTime`, and `calculateCalories` each exist exactly once. Prior duplication concern is resolved.
- **No TODO/FIXME comments** anywhere in the codebase — the backlog is either done or tracked externally.
- **Consistent error-log formatting.** Every `console.warn` call uses the `[Foundry]` prefix, making prod logs instantly filterable.
- Only **two `console.warn` calls** across the whole codebase (both in `storage.js`); no stray debug `console.log` statements.

### Still needs work
- `store.js` (678 lines) and `App.jsx` (751 lines) violate the single-responsibility principle. Neither is unreadable, but both carry too many concerns.
- No linter enforces the quality gains made here. A future contributor could reintroduce duplicates without any tooling to catch it.
- `exercises.js` at 2,611 lines is a data file, not logic, but it bloats the initial parse time. Code splitting partially mitigates this (see Performance).

---

## 3. State Management — 6/10 (was 5/10)

### What improved
- **`generateProgram` is now deterministic via `storedProgram`.** The pattern in `App.jsx` is:
  1. Attempt to load a serialised program from `localStorage` (`storedProgram`)
  2. Only call `generateProgram()` if none exists
  3. Persist the result immediately
  This means returning users always get the same program until they explicitly reset — the non-determinism from v1 is fixed.

### Current pattern (App.jsx ~228–475)
```js
// Load or generate
const stored = localStorage.getItem('storedProgram');
const program = stored ? JSON.parse(stored) : generateProgram(profile);
if (!stored) localStorage.setItem('storedProgram', JSON.stringify(program));
```
- On profile change: `storedProgram` is cleared (line 228)
- On setup completion: generate + persist (lines 441–442)
- On reset: clear (line 475)

### Still needs work
- **Prop drilling 3–4 levels deep.** App.jsx holds all global state and passes it down as props. No Context API, no lightweight store (Zustand, Jotai). At the current component count this works, but it makes refactoring painful.
- **22 `useEffect` hooks** across the codebase. Several in `DayView.jsx` (4 instances) and `ExtraDayView.jsx` (3 instances) manage complex day/week navigation state — these are candidates for stale-closure bugs and should be audited.

---

## 4. Data Model — 7/10 (was 6/10)

### What improved
- **`bwDown` is correctly implemented** (`store.js:501–502`):
  ```js
  const bwDown = inWindow[0].weight > inWindow[inWindow.length - 1].weight;
  stalls.push({ name: ex.name, weight: last.weight, isProtecting: bwDown, isFatigueSignal });
  ```
  The field represents whether body weight trended downward during the stall-detection window. It's used to flag stalls as "protecting" (i.e., weight loss is the probable cause, not a true training plateau) — which is correct domain logic. The v1 concern about its semantics is resolved.

### Core shapes (no TypeScript, inferred from usage)
| Shape | Key fields |
|---|---|
| Profile | `experience, equipment[], sessionDuration, goal, splitType, daysPerWeek, dayMuscleConfig, birthDate, weight, height, aiDays` |
| Day | `tag, exercises[], restDay, notes, cardioSession, mobilitySession` |
| Exercise | `id, name, muscle, muscles[], tag, equipment, pattern, sets, reps, rest, warmup, bw` |
| Session | `{ [exIdx]: { [setIdx]: { weight, reps, warmup, notes } } }` |
| Archive entry | `{ id, mesoWeeks, startDate, sessions[], anchorPeaks[], readinessSummary }` |

### Still needs work
- No TypeScript means these shapes exist only in dev's memory and in comments. A type mismatch (e.g. `muscles` vs `muscle` singular) will fail silently at runtime.
- No schema validation at the storage boundary — if a user's `localStorage` has a stale shape from a prior version, there's no migration or validation layer beyond try/catch fallbacks.

---

## 5. Component Design — 6/10 (was 4/10)

### What improved
- **`src/components/ui/` now exists** with reusable `Button` (57 lines), `Modal` (42 lines), and `Sheet` components. These are used across views — the prior ad-hoc inline button/modal patterns are gone.
  - `Button`: `primary | secondary | danger | ghost` variants, `fullWidth`, `disabled`
  - `Modal`: backdrop click to dismiss, `blur`, `maxWidth`, `zIndex` props
- **`React.memo` is applied to `ExerciseCard`** with a custom comparator `areExerciseCardsEqual` (`ExerciseCard.jsx:494`). This prevents the entire exercise list from re-rendering on every parent state change — the v1 concern is addressed.
- **Lazy loading** is used for all top-level views via `React.lazy()`, reducing initial bundle parse time.

### Still needs work
- **`HomeView.jsx` is 443 lines.** It was flagged in v1 for being too large. While it hasn't gotten worse, it has not been split. It mixes weekly schedule rendering, modal triggers, readiness display, and navigation.
- **`ExerciseCard.jsx` is 494 lines.** The custom memo comparator adds complexity. If the props structure were tighter, a plain `React.memo` (shallow compare) would suffice.
- **App.jsx still passes props 3–4 levels deep** rather than using context, which means component interfaces are bloated with pass-through props.

---

## 6. Performance — 7/10 (was 6/10)

### What improved
- **`React.memo` on `ExerciseCard`** with `areExerciseCardsEqual` comparator (confirmed, line 494). This is the most render-heavy component in the workout view.
- **Manual chunk splitting in `vite.config.js`:**
  - `vendor-react` chunk — React + ReactDOM separated from app code
  - `data-exercises` chunk — the 2,611-line exercise database loaded on demand
- **`React.lazy()`** on all top-level views means the initial load only parses the App shell.

### Still needs work
- The exercise database chunk is still 2.6 MB in memory once loaded. Splitting it by muscle group or split type would allow truly lazy loading of only the exercises needed for a given program.
- No `useMemo` or `useCallback` audit has been done on the heavy list-rendering paths in `DayView` and `HomeView`.
- No performance profiling evidence (no lighthouse scores, no bundle-size tracking in CI).

---

## 7. Error Handling — 7/10 (was 4/10)

### What improved dramatically
This is the biggest improvement since v1.

- **30+ try/catch blocks** with consistent `console.warn('[Foundry]', message, error)` pattern across all utils.
- **Graceful degradation everywhere** — all parse failures return sensible defaults (`null`, `[]`, `{}`, `0`) rather than crashing.
- **Error Boundary in `App.jsx` (lines 31–99):**
  - Catches React component tree errors
  - Shows stack trace only in development (`process.env.NODE_ENV !== 'production'`)
  - Displays a user-friendly message in production
  - Provides Reload and Retry buttons
- **API timeout handling** in `api.js:223` — fetch errors are caught and rethrown with context.
- **`storage.js`** wraps all `localStorage` calls in try/catch, so storage quota errors don't propagate up.

### Still needs work
- Errors are logged to `console.warn` but never surfaced to a monitoring service. In production, real user errors are invisible unless the user reports them manually.
- Some catch blocks in `store.js` (e.g. lines 525–545 during meso reset) suppress errors entirely with no logging — making debugging a meso-reset failure very difficult.
- No retry logic on failed AI API calls beyond the one AbortError check in `SetupPage.jsx`.

---

## 8. Testing — 4/10 (was 1/10)

### What improved
This went from effectively zero to a meaningful baseline.

- **Vitest 4.1.2** is installed and configured (`vite.config.js` `test` block with `jsdom` + `globals`).
- **`npm test` runs `vitest run`** — single-pass, exits with pass/fail.
- **`src/utils/__tests__/core.test.js`** covers the core business logic:

| `describe` block | What it tests |
|---|---|
| `generateProgram` | 9 cases: PPL (3/5/6 days), upper/lower (2/4 days), full body (3 days), push/pull (4 days), AI day overrides, custom day config, **determinism** |
| `detectStallingLifts` | Stall detection logic |
| `detectSessionPRs` | Personal record detection |
| `loadDayWeekWithCarryover` | Weight progression hints |
| `archiveCurrentMeso` | Meso archival and anchor peak saving |

- The determinism test (`same profile = same program`) directly validates the v1 state management concern.
- Test fixtures (`BASE_PROFILE`, `EXERCISE_DB`, `mkEx` helper) are well-structured and minimal.

### Still needs work
- **Only 1 test file.** All UI components (Button, Modal, ExerciseCard, HomeView, DayView) are completely untested.
- No `@testing-library/react` — component render tests are not possible with the current setup.
- No snapshot tests, no integration tests, no E2E tests.
- `vitest run` (no `--watch`) is fine for CI, but dev workflow has no watch mode configured.
- Code coverage is not measured or enforced.

---

## 9. Build & Deploy — 7/10 (was 7/10)

### Unchanged — solid baseline
- **`.github/workflows/deploy.yml`** deploys to GitHub Pages on push to `main` or manual trigger.
- Node 20, `npm ci`, `npm run build`, then upload `foundry-app/dist/`.
- Sourcemaps enabled in production build (useful for error boundary stack traces in dev).
- Capacitor scripts exist for Android/iOS native builds (`cap:build:android`, `cap:build:ios`).
- Manual Rollup chunks separate vendor React and exercise data.

### Still needs work
- `npm test` is not run in the CI pipeline. Tests pass locally but are not a gate on deploys.
- No bundle size tracking — a large dependency could be accidentally added without notice.
- No staging/preview environment; all deploys go straight to production (GitHub Pages).
- Sourcemaps in production build leak source structure to the public. Acceptable for an open-source or personal app, worth noting for commercial use.

---

## 10. Security — 5/10 (was 5/10)

### No change — same issues remain
- **`dangerouslySetInnerHTML`: not found** — safe.
- **`eval()`: not found** — safe.
- **Vite `VITE_*` prefix** is used correctly — secrets are not accidentally excluded from the bundle; they ARE included in the browser bundle by design (that's how Vite env vars work client-side).
- **`.gitignore` includes `.env`** — the `.env` file should not be in version history.

### Remaining concerns
- **`VITE_FOUNDRY_APP_KEY` is baked into the client-side bundle at build time.** This is unavoidable with Vite env vars — the key ships to every user's browser. The Cloudflare Worker must enforce its own auth, rate limiting, and abuse controls. If it doesn't, the key is effectively public.
- **`localStorage` stores plaintext JSON** for all user data: training history, body weight logs, full program structure. If an XSS vulnerability were ever introduced, the entire training history would be exfiltrated. Encrypting at-rest in localStorage is a medium-effort improvement.
- No Content Security Policy (CSP) headers — the `index.html` has no `<meta http-equiv="Content-Security-Policy">`. GitHub Pages doesn't set these automatically.
- No subresource integrity (SRI) on any external assets.

---

## 11. Dependencies — 8/10 (was 9/10)

### What changed
- **Vitest 4.1.2 and jsdom 29.0.1 added** to devDependencies — the v1 gap is addressed.
- Score dropped from 9 to 8 because the addition of testing infra reveals the absence of `@testing-library/react`, which is now an obvious gap rather than a future concern.

### Full dependency picture
**Production (9 packages):**
- `react` 18.2.0, `react-dom` 18.2.0
- `@capacitor/core` 6.1.0 + 7 Capacitor plugins (app, android, ios, haptics, keyboard, splash-screen, status-bar)

**Dev (5 packages):**
- `vite` 5.4.0, `@vitejs/plugin-react` 4.2.1
- `vitest` 4.1.2, `jsdom` 29.0.1
- `@capacitor/cli` 6.1.0

**Still missing:**
| Gap | Impact |
|---|---|
| `@testing-library/react` | Can't render/query components in tests |
| ESLint + `eslint-plugin-react` | No static analysis |
| Prettier | No enforced formatting |
| TypeScript (`typescript`, `@types/react`) | No compile-time type safety |

Dependency count remains admirably lean. The absences listed above are not bloat concerns — they're developer-experience gaps.

---

## Top Remaining Issues (Priority Order)

### Critical
1. **Client-side API key exposure** — `VITE_FOUNDRY_APP_KEY` is in every user's browser bundle. Ensure the Cloudflare Worker enforces rate limiting and request validation independently.

### High
2. **CI does not run tests** — `npm test` is absent from `deploy.yml`. A broken business-logic change can deploy silently.
3. **`App.jsx` (751 lines)** — Extract `useRestTimer()`, `useModals()`, and routing logic into custom hooks.
4. **`store.js` (678 lines)** — Split into persistence, analytics, and archive modules.

### Medium
5. **No `@testing-library/react`** — UI component tests are impossible without it.
6. **No TypeScript** — Shape mismatches between `exercises.js` objects and component expectations fail silently.
7. **`HomeView.jsx` (443 lines)** — Not split since v1 despite being flagged.
8. **localStorage plaintext** — Consider encrypting user health data at rest.
9. **No CSP headers** — Low-hanging security win for a health-data app.

### Low
10. **No ESLint/Prettier** — Quality gains from this refactor pass could erode without enforcement.
11. **Exercise data lazy-loading** — The `data-exercises` chunk is code-split but still 2.6 MB once parsed. Per-split-type splitting would reduce memory footprint for users with simple programs.

---

## Overall Assessment

The codebase improved meaningfully from **5.4 → 6.4/10**. The most impactful changes were:

- A consistent, production-safe error handling pattern (was the worst area, now mid-tier)
- Vitest setup with real business-logic test coverage (was absent, now present)
- React.memo on ExerciseCard and lazy-loaded views (renders are now guarded)
- A shared `ui/` component layer replacing ad-hoc inline UI
- Deterministic program generation via `storedProgram`

What hasn't moved: the monolithic `App.jsx` and `store.js`, the absence of TypeScript and linting, security posture, and thin test coverage beyond core utils. These are the gaps to close to reach a 7.5–8/10 codebase.
