# Foundry Fitness App — Professional Code Review

**Reviewed:** 2026-04-02
**Reviewer:** Claude Code (claude-sonnet-4-6)
**Version reviewed:** 1.35.0
**Codebase:** `foundry-app/` (React 18 + Vite) + `worker.js` (Cloudflare Worker)

---

## Executive Summary

Foundry is a sophisticated periodized training app with genuine domain depth — MEV/MAV/MRV volume landmarks, readiness-driven progression, cross-meso carryover, PR detection, and Claude AI program generation. The core fitness logic is thoughtful and well-reasoned. The architecture shows clear intent and the worker/frontend split is clean.

However, the codebase shows signs of rapid, solo development that has accumulated significant technical debt. The primary risks are: **a non-deterministic program generation function called from multiple places** (explains some runtime bugs), **a state reset strategy that relies on `window.location.reload()`**, **zero test coverage**, **widespread DRY violations in the data layer**, and **a single 2,195-line component**. None of these are show-stoppers individually, but together they explain why you've seen multiple runtime crashes and will continue to see them as the codebase grows.

---

## 1. Architecture & Project Structure — **7/10**

### What's good

The project is cleanly separated into `src/data/` (static), `src/utils/` (logic), `src/components/` (UI), and `worker.js` (backend). Lazy loading via `React.lazy()` is applied to every view component — that's correct and good. The Cloudflare Worker as an API proxy keeps the Anthropic key off the client. Capacitor integration is straightforward and the config is reasonable.

### Issues

**The `store.js` barrel pattern is confusing.** `store.js` simultaneously:
1. Defines its own functions (`loadDayWeekWithCarryover`, `detectStallingLifts`, `archiveCurrentMeso`, etc.)
2. Re-exports functions from `./training.js`
3. Re-exports the `store` primitive from `./storage.js`

This makes `store.js` a god-module — it's the primary import for half the codebase. The comment at the top of `storage.js` ("Separated from store.js to break circular dependency with training.js") confirms this architecture already caused a circular dependency once. The correct fix is to invert the dependency: storage primitives at the bottom, training logic in the middle, aggregated reads/writes at the top — not a barrel that re-exports everything.

**Routing is manual state.** There is no router. Navigation is `setView("day")` with `useState`. This works for a simple app but means:
- No browser history (back button does nothing)
- No deep-links (can't link directly to a session)
- All views are conditionally rendered, not unmounted on navigate — this could cause stale state in future
- The rest timer has to be lifted to App.jsx to survive view changes, which is a symptom of this pattern

**`window.location.reload()` as state reset.** Three call sites in App.jsx (lines 214, 220, 397). Every `window.location.reload()` is a failure to manage React state. It works, but it loses any in-memory state that hasn't been persisted, it's slow (full page reload), and it makes the app feel janky on mobile. The underlying issue is that profile creation and meso config are tightly coupled at the module level via `getMeso()` singleton.

---

## 2. Code Quality — **5/10**

### DRY violations (the most serious quality issue)

**`parseRestSeconds` is defined twice:**
- `src/utils/helpers.js` (exported)
- `src/utils/store.js` lines 148–157 (also exported)

Both are identical implementations. Components that import from `store.js` get a different function reference than those importing from `helpers.js`. If one is ever updated, the other silently diverges.

**`loadDayWeek` is defined twice:**
- `src/utils/training.js` lines 130–133
- `src/utils/store.js` lines 19–21

Identical implementations. `store.js` doesn't re-export the one from `training.js` — it defines its own.

**`loadNotes` and `saveNotes` are defined twice:**
- `src/utils/training.js` lines 135–143
- `src/utils/store.js` lines 159–165

Identical implementations.

**`shuffle` is defined twice:**
- `src/utils/training.js` lines 146–153 (exported)
- `src/utils/program.js` lines 18–25 (local, not exported)

**Inline styles are the entire UI styling strategy.** Every component is written with inline `style={{}}` objects. There is no CSS module, no Tailwind, no styled-components — not even a shared constants file for repeated style values like border radii, font sizes, or spacing. Searching for `borderRadius: 8` would return dozens of identical objects. When the design system changes, every component file needs touching. This is the single biggest day-to-day maintenance burden.

### Other code quality issues

**Import statement after executable code (App.jsx lines 12–13):**
```js
migrateKeys(); // line 12 — executable code
import { generateProgram } from './utils/program'; // line 13 — static import
```
Static imports are hoisted before execution in ESM, so this happens to work — but it's syntactically invalid in strict ESM and would fail in non-bundler contexts. The intent ("run migration before any reads") is also wrong: the migration runs after all module initialization, not before `store.js` is loaded. The comment is misleading.

**Hardcoded developer name in production error UI (App.jsx line 87):**
```js
<div>Screenshot this screen and send it to James for debugging.</div>
```
This will show to every user who hits the ErrorBoundary. Should be a support URL or email.

**Silent catch blocks throughout `store.js`.** 40+ instances of `try { ... } catch {}` or `try { ... } catch (e) { /* silent */ }`. Silent failure is dangerous in persistence code — if a JSON parse fails silently, the user's data appears empty and they may overwrite it. Even `catch (e) { console.warn(e); }` would be better.

**`archiveCurrentMeso` at App.jsx line 394 called without `deps`:**
```js
const handleReset = () => {
  archiveCurrentMeso(profile); // ← missing deps: { generateProgram, EXERCISE_DB }
```
The function signature is `archiveCurrentMeso(profile, deps)`. Without `deps`, `_generateProgram` is undefined and the entire meso transition block (anchor peaks, accessory IDs, readiness summary) is silently skipped. When a user manually resets, no transition context is saved — meso 2 won't know the meso 1 peak weights. **This is a live bug.**

---

## 3. State Management — **5/10**

The app uses a custom localStorage-first approach — no Redux, Zustand, or Context API. Data flows: `localStorage → load*() functions → useState → component`. This is reasonable for an offline-first app, but several specific patterns create bugs.

### The non-deterministic `generateProgram()` problem

`generateProgram()` uses `shuffle()` internally. Every call returns a potentially different ordering of exercises. The function is called in:

1. **`App.jsx` useMemo** (line 419) — generates what the user *sees*
2. **`App.jsx` handleComplete** (line 237) — `generateProgram(loadProfile())` — called for stats calculation, may return *different exercises*
3. **`archiveCurrentMeso`** — generates program to find anchor exercises for peak weight tracking

This is a real source of runtime bugs. If the exercises in call (2) don't match call (1), volume totals and PR counts will be wrong. If the exercises in call (3) don't match call (1), anchor peak weights get attributed to the wrong exercises.

**Fix:** The program should be stored (serialized) when generated, not regenerated from scratch each time. Or, make `generateProgram()` deterministic with a seeded random.

### `loadCompleted` called without required argument

`App.jsx` line 100:
```js
const [completedDays, setCompletedDays] = useState(loadCompleted);
```
React calls this as `loadCompleted()` — no argument. The function signature is:
```js
export function loadCompleted(mesoConfig) {
  const days = mesoConfig?.days || 6;  // defaults to 6
  const weeks = mesoConfig?.weeks || 6; // defaults to 6
```
It silently falls back to 6×6. If the actual meso is 4 days × 4 weeks, it will correctly load those 16 entries, but if it's 6 days × 8 weeks, weeks 7–8 will never appear as completed. This may cause the week-complete check to fail for long mesos.

### `getMeso()` singleton cache

`constants.js` exports a `getMeso()` function that caches the meso config in a module-level variable. If the profile changes (new program created, days edited), this cache must be explicitly invalidated with `resetMesoCache()`. Searching the codebase reveals `resetMesoCache()` is imported in App.jsx but its call sites should be audited — any profile update that changes `mesoLength`, `daysPerWeek`, or `splitType` must call it, or the app will use stale meso dimensions everywhere.

### Rest timer is sound

The global rest timer pattern (state in App, passed as props, synced via `visibilitychange`) is correct. Using `Date.now()` stored in a ref as the source of truth means it survives tab switches. This is the right approach.

---

## 4. Data Model — **6/10**

### What's good

The localStorage key schema is systematic: `foundry:day{d}:week{w}`, `foundry:done:d{d}:w{w}`, `foundry:readiness:{YYYY-MM-DD}`, etc. The `ppl:` → `foundry:` migration is correct and safe. The rolling 3-snapshot backup is a good safety net. The volume landmark constants (`VOLUME_LANDMARKS`) are domain-appropriate.

### Issues

**Set data uses numeric object keys instead of arrays:**
```js
carried[exIdx] = {};
carried[exIdx][s] = { weight: ..., reps: ... }; // { 0: {...}, 1: {...}, ... }
```
The stored structure is `{ "0": {...}, "1": {...} }` not `[{...}, {...}]`. This means set count must be tracked externally (it's `ex.sets`), ordering is implicit in the key names, and iterating requires `Object.values()` which doesn't guarantee numeric ordering in all JS engines (though V8 does sort integer keys first). This should be arrays.

**No schema validation at parse time.** Every `JSON.parse(raw)` is trusted completely. If a localStorage value is corrupted (partial write, external modification, storage quota exceeded), the parse either throws (caught silently) or returns unexpected types that propagate as `NaN` or `undefined` through the UI. There's no shape check on profile, day data, or exercise data before use.

**`detectSessionPRs` iterates all of localStorage (store.js lines 391–407):**
```js
Object.keys(localStorage).forEach(key => {
  if (!key.startsWith("foundry:extra:data:")) return;
```
This iterates every key in localStorage (which may include non-foundry keys from other scripts/extensions) to find extra-day data. Should be `Object.keys(localStorage).filter(k => k.startsWith("foundry:"))` at minimum, or better, maintain an index.

**`bwDown` logic is inverted (store.js lines 508–512):**
```js
const bwDown = inWindow[0].weight < inWindow[inWindow.length - 1].weight;
```
`inWindow[0]` is the earliest date and `inWindow[last]` is the latest date (the log is sorted ascending). So `bwDown` is `true` when earliest < latest — meaning weight went *up*, which is the opposite of "protecting strength during a cut." This is a logic bug in the stall detection for `lose_fat` goal users.

**Archive is capped at 10 mesos.** Fine for now, but there's no UI for users to understand this limit. When the 11th meso is archived, the oldest is silently dropped.

---

## 5. Component Design — **4/10**

### HomeView.jsx at 2,195 lines

This is the most egregious structural issue in the codebase. `HomeView` renders:
- Today card
- Calendar view
- Schedule tab
- Progress tab
- Meso overview
- Readiness check-in
- Rest-day sheet
- Edit schedule sheet
- Cardio/mobility CTAs
- Data management (export/import)
- Pricing overlay
- Bottom navigation

A 2,000+ line component is effectively impossible to test, difficult to reason about, and causes cascading re-renders whenever any piece of state changes. Every interaction in the calendar re-renders every section of the home screen.

### DayView.jsx at ~792 lines

Also too large. Contains: workout overlay, BW check-in modal, readiness check-in, stall detection display, leave prompt, exercise swap UI, add-exercise UI, superset rest timer logic, session duration tracking, completion modal, post-strength cardio prompt, session notes, warmup modal. These are distinct concerns.

### Prop drilling

The rest timer (`restTimer`, `restTimerMinimized`, `setRestTimerMinimized`, `startRestTimer`, `dismissRestTimer`) is passed from App → DayView as five separate props. This is manageable now but is a sign that a React Context for the global timer would be cleaner.

### No component reuse

Looking at the codebase: modals, cards, buttons, sheets — each is written inline wherever needed. There is no shared `<Modal>`, `<Card>`, `<Sheet>`, or `<Button>` component. The same `position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.92)"` overlay pattern appears 5+ times in different files.

---

## 6. Performance — **6/10**

### What's good

- React.lazy + Suspense on all views — correct and effective
- Manual chunk splitting in vite.config.js (`vendor-react`, `data-exercises`) — good
- The exercises.js chunk being split out is especially good since it's large static data

### Issues

**`generateProgram()` is called in useMemo in App.jsx AND inside handleComplete.** Since the function shuffles, the two calls can return different exercise lists. Even if they matched, running `generateProgram()` on every render cycle that recalculates the memo is wasteful.

**No `React.memo` anywhere.** HomeView, DayView, ExerciseCard, and all other components re-render on every parent state change. With 5–7 `ExerciseCard` components in a DayView, each re-rendering on every set update, there's likely noticeable jank in the workout logging flow on older Android devices. `React.memo(ExerciseCard)` with a proper equality check would be a quick win.

**`detectStallingLifts` runs on every DayView open.** It iterates up to 6 past weeks of localStorage data and does readiness calculations. It's wrapped in `useMemo` with dependency array `[dayIdx, weekIdx, isDone, isLocked, exercises, day, profile]` — any of those changing triggers a full recalculation. In practice this is fast enough, but it could be deferred to after the initial render.

**Base64 images in JS modules.** The `images-*.js` files contain base64-encoded Midjourney images bundled directly into JS. This inflates the bundle and blocks parsing. They should be static assets served from `public/`.

---

## 7. Error Handling — **4/10**

This is the area most directly linked to the runtime crashes mentioned.

### What's good

- `ErrorBoundary` exists and catches render errors — this is the right pattern
- The storage wrapper (`store.get/set`) has try-catch around every call
- The `if (!day)` guard in DayView.jsx line 39 is excellent — explicit crash prevention

### Issues

**40+ silent catch blocks.** `store.js` has a pattern of `try { ... } catch {}` throughout. When these fail, the app silently returns empty data, which then causes downstream logic errors that look like bugs in the UI rather than the storage layer. Examples:
- `loadDayWeek` returning `{}` silently on parse error — exercises appear blank, user may re-log and overwrite data
- `archiveCurrentMeso` has three nested `try { } catch {}` blocks (lines 600, 607, 656) — if any fail, the archive is partial/corrupt with no warning

**Stack traces shown to end users.** The ErrorBoundary renders the full `error.stack` and component stack in the UI. This is fine for debugging but should be gated to development builds. In production, it exposes file paths and source code structure.

**`exportData` catches errors with `alert("Export failed.")`** (store.js line 263). Using `alert()` in a React app is an antipattern — it blocks the thread, doesn't match the app's UI, and doesn't give the user actionable information.

**Race condition on session start (DayView.jsx lines 175–183):**
```js
React.useEffect(() => {
  const savedStart = store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
  if (savedStart && !isDone && !isLocked) {
    sessionStartRef.current = parseInt(savedStart, 10);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```
The `// eslint-disable-next-line react-hooks/exhaustive-deps` is suppressing a real lint warning. `isDone` and `isLocked` are used in the condition but not in the dependency array. If the component re-renders with `isDone = true` after mount, the effect has already run with `isDone = false` and the session ref is set. This is probably fine in practice but is a latent bug.

**`bwDown` direction bug** (identified in section 4) will cause the wrong coaching message ("protecting strength" vs. "stalling") for cut-focused users.

**The most common crash pattern:** Looking at the architecture, the most likely source of crashes is the `generateProgram()` → profile mismatch pattern. If `profile.aiDays` exists (AI-built program) but the meso config changes (user edits days), `activeDays` will have a different length than `getMeso().days`. The guard at DayView.jsx line 39 catches this, but only in DayView. `handleComplete` at App.jsx line 232 does:
```js
Array.from({ length: getMeso().days }, (_, d) => d)
  .every(d => newCompleted.has(`${d}:${weekIdx}`))
```
If `getMeso().days` doesn't match `activeDays.length`, the week-complete check is wrong.

---

## 8. Testing — **1/10**

There are **zero test files** in the codebase. No unit tests, no integration tests, no end-to-end tests. No test runner is installed (no jest, vitest, playwright, cypress — `package.json` has no test-related devDependencies and no `test` script).

This is the single biggest risk factor in the codebase. Complex, stateful logic like `loadDayWeekWithCarryover`, `detectStallingLifts`, `detectSessionPRs`, and `archiveCurrentMeso` are exactly the kind of functions that benefit most from test coverage. Each has conditional branches, edge cases (weekIdx 0, empty data, overlapping overrides), and side effects (localStorage writes).

The `bwDown` direction bug and the `archiveCurrentMeso` missing-deps bug identified in this review would both be caught by basic unit tests.

**Minimum viable test coverage to add:**
- `loadDayWeekWithCarryover` — carryover logic, nudge calculation, barbell vs. dumbbell increments
- `detectStallingLifts` — 3-week plateau detection, regression detection, BW/fat-loss correlation
- `detectSessionPRs` — both `mode: "meso"` and `mode: "extra"` paths
- `archiveCurrentMeso` — verify anchor peaks are saved correctly
- `generateProgram` — verify each split type returns correct number of days, anchor exercises are always first

Recommended: Vitest (drops in alongside Vite with zero config).

---

## 9. Build & Deploy — **7/10**

### What's good

- Vite 5 — current, fast
- Manual chunk splitting separates React vendor and exercise data — correct
- Source maps enabled in production (`sourcemap: true`) — useful for debugging crashes
- Cloudflare Worker architecture is clean and well-structured
- Capacitor 6 with correct `webDir: "dist"` config
- `wrangler.toml` uses `[vars]` for non-secret config and `wrangler secret put` for keys — correct pattern
- CORS origin validation in the worker is explicit and correct

### Issues

**No linting config.** No `.eslintrc`, no `.prettierrc`, no Biome config. Code formatting is ad hoc. The suppressed `// eslint-disable-next-line react-hooks/exhaustive-deps` comment in DayView suggests linting was tried at some point but never configured properly.

**`allowMixedContent: true` in `capacitor.config.json` (Android section).** This allows HTTP resources to be loaded in an HTTPS context. This is a security downgrade on Android and should be removed unless there's a specific dependency that requires it.

**No CI/CD config.** No GitHub Actions, no Cloudflare Pages integration, no automated build on push. Deployments are manual. As the codebase grows, this becomes a reliability risk.

**`vite.config.js` has `sourcemap: true` in production.** Source maps in production expose source code to anyone who opens devtools. For a commercial app, use `hidden` or `nosources` source map type, or upload maps to an error tracking service (Sentry) and delete them from the public bundle.

**No `engines` field in `package.json`.** No specified Node.js version requirement. Should add `"engines": { "node": ">=18" }` to prevent builds on outdated Node.

---

## 10. Security — **5/10**

### What's good

- Anthropic API key is never on the client — correctly stored as a Cloudflare Worker secret
- The worker auth gate (`X-Foundry-Key` check) prevents unauthorized use of the AI proxy
- The Brevo API key is correctly stored as a worker secret
- CORS is explicitly configured with an allowlist, not `*`

### Issues

**`VITE_FOUNDRY_APP_KEY` is exposed in the client bundle.** In `api.js` line 149:
```js
const appKey = import.meta.env.VITE_FOUNDRY_APP_KEY || "";
```
Any environment variable prefixed with `VITE_` is embedded verbatim in the built JavaScript bundle. Anyone can open devtools → Sources, find the built bundle, and search for the key value. This is not a secret — it's a shared constant embedded in public code. The worker's auth gate therefore provides only mild friction against API abuse, not actual security.

For a personal/small-audience app this is an acceptable tradeoff. For a commercial app with real API costs, consider: removing the key check entirely (rely on CORS allowlist) or implementing proper user authentication (JWT, session tokens) so the auth gate has real credentials to verify.

**Stack traces displayed to end users in production.** The ErrorBoundary renders full `error.stack` (file paths, line numbers, compiled function names) to any user who triggers a crash. This should be hidden in production builds.

**No input sanitization on AI output.** `api.js` line 171:
```js
const clean = text.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
const parsed = JSON.parse(clean);
```
The AI response is parsed and its fields (`day.label`, `ex.name`, `day.muscles`) are rendered directly as React text content. React's JSX escaping prevents XSS, but there's no validation that `ex.sets` is actually a number, `ex.reps` is a valid range string, or `ex.id` exists in EXERCISE_DB. Malformed or adversarially crafted AI responses could produce NaN/undefined that propagates through the workout logging flow.

**`localStorage` stores all user data unencrypted.** For a health/fitness app, body weight, training history, and recovery data are sensitive. On a shared device or if another browser extension can read localStorage, this data is fully exposed. This is a known limitation of the platform, not a bug per se, but worth noting for the privacy policy.

---

## 11. Dependencies — **9/10**

The dependency list is admirably minimal:

```
react@18.2.0       — current minor
@capacitor/*@6.1.0 — current major
vite@5.4.0         — current major
```

No state management library, no router, no form library, no CSS-in-JS, no date library, no utility belt (lodash). Everything is hand-rolled. This is a strength (small bundle, no transitive dep risk, no breaking changes from third parties) but also the source of several quality issues (no router means manual navigation, no form library means manual validation).

The only concern is `vite@5.4.0` when `5.5+` is available with relevant security patches — worth a minor bump.

**No security vulnerabilities** in the current dependency set (Capacitor 6 and React 18 are both actively maintained).

---

## Priority Issues Summary

### Critical (crash-causing, data loss risk)

| # | Issue | File | Line |
|---|-------|------|------|
| 1 | `generateProgram()` is non-deterministic — different call sites generate different programs, causing wrong stats and wrong anchor tracking | `App.jsx`, `store.js` | 237, 419, 607 |
| 2 | `archiveCurrentMeso(profile)` called without `deps` — anchor peaks never saved on manual reset | `App.jsx` | 394 |
| 3 | `bwDown` direction inverted — lose_fat stall detection gives wrong coaching message | `store.js` | 508 |

### High (maintainability, reliability)

| # | Issue | File |
|---|-------|------|
| 4 | `parseRestSeconds`, `loadDayWeek`, `loadNotes/saveNotes`, `shuffle` all defined twice | `helpers.js`, `store.js`, `training.js`, `program.js` |
| 5 | Zero test coverage on complex stateful logic | — |
| 6 | `HomeView.jsx` at 2,195 lines — untestable, unmaintainable | `HomeView.jsx` |
| 7 | 40+ silent `catch {}` blocks in persistence layer | `store.js` |
| 8 | `loadCompleted` called without required mesoConfig argument | `App.jsx:100` |

### Medium (quality, security)

| # | Issue | File | Line |
|---|-------|------|------|
| 9 | `VITE_FOUNDRY_APP_KEY` embedded in client bundle | `api.js` | 149 |
| 10 | Stack traces shown to users in production ErrorBoundary | `App.jsx` | 64–74 |
| 11 | Hardcoded developer name in production error UI | `App.jsx` | 87 |
| 12 | `allowMixedContent: true` on Android | `capacitor.config.json` | — |
| 13 | Import statement after executable code | `App.jsx` | 12–13 |
| 14 | No React.memo on any component | all components | — |
| 15 | Base64 images bundled into JS instead of public assets | `src/data/images-*.js` | — |

### Low (code hygiene)

| # | Issue |
|---|-------|
| 16 | Inline styles throughout — no shared design tokens |
| 17 | No linting config — eslint-disable-next-line suppressing real warnings |
| 18 | Source maps exposed in production bundle |
| 19 | `window.location.reload()` as React state reset |
| 20 | No CI/CD config — manual deployments |

---

## Recommended Actions (ordered by impact)

1. **Fix `generateProgram()` non-determinism.** Store the generated program in the profile when it's created (it already gets stored as `profile.aiDays` for AI programs — do the same for manual programs). Make all subsequent reads use the stored version, not a re-generated one. This likely fixes a class of stats/tracking bugs.

2. **Fix `archiveCurrentMeso` call in `handleReset`.** Pass `{ generateProgram, EXERCISE_DB }` as the second argument so anchor peaks are saved on manual reset.

3. **Fix `bwDown` direction check** in `detectStallingLifts` (flip the comparison).

4. **Add Vitest and write tests for the 5 core utility functions** listed in section 8. One day of test writing would catch the two bugs above before the next deploy.

5. **Consolidate duplicate functions.** Delete `parseRestSeconds` from `store.js` (use the one from `helpers.js`). Delete `loadDayWeek`, `loadNotes`, `saveNotes` from `training.js` (they're already in `store.js`). Delete `shuffle` from `program.js` (import it from `training.js`).

6. **Split `HomeView.jsx`** into tab sub-components (`HomeTab`, `ScheduleTab`, `ProgressTab`) — each file should be under 500 lines.

7. **Add `React.memo` to `ExerciseCard`** with a proper equality check on `weekData[exIdx]`. This is the most render-heavy component in the app.

8. **Move base64 images to `public/`** as static PNG/WebP files. This reduces the initial JS parse time.

9. **Gate stack traces in ErrorBoundary** to `import.meta.env.DEV` only.

10. **Remove `allowMixedContent: true`** from `capacitor.config.json` unless a specific dependency requires it.

---

## Ratings Summary

| Area | Score | Notes |
|------|-------|-------|
| Architecture & Project Structure | 7/10 | Clean intent, but store.js god-module and reload()-based navigation |
| Code Quality | 5/10 | Significant DRY violations, inline styles throughout, live bug in handleReset |
| State Management | 5/10 | Non-deterministic generateProgram, stale getMeso() cache, reload() as reset |
| Data Model | 6/10 | Systematic key schema, but numeric object keys, no validation, inverted bwDown |
| Component Design | 4/10 | 2195-line HomeView, no shared components, prop drilling |
| Performance | 6/10 | Good code splitting, but no React.memo, non-deterministic useMemo dependency |
| Error Handling | 4/10 | ErrorBoundary exists but 40+ silent catches, live bug in stall detection |
| Testing | 1/10 | Zero tests, no test framework |
| Build & Deploy | 7/10 | Solid Vite + Worker setup, missing lint/CI, source maps exposed |
| Security | 5/10 | App key in bundle, stack traces to users, allowMixedContent |
| Dependencies | 9/10 | Minimal and current — the right call for this type of app |

**Overall: 5.4/10** — The fitness domain logic is genuinely good and the app clearly works. The score is dragged down almost entirely by the absence of tests, the DRY violations in the data layer, the `generateProgram` non-determinism, and the monolithic HomeView. None of these are hard to fix — they're the natural accumulation of fast solo development.
