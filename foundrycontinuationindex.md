# The Foundry — Continuation Index

**Last session:** April 3, 2026
**Version:** 2.0.0
**Repo:** C:\Users\TIMBE\Documents\AI PROJECT\FOUNDRY (GitHub: Timber-and-Code/Foundry)
**Code Review:** `foundry-code-review-v5.md` — Score: 8.6 / 10
**Next Session Target:** 8.6 → 9.5+

---

## What We Got Done (April 3 Session)

### Roadmap Items (All 4 Complete)

| # | Item | What Was Done |
|---|------|---------------|
| 1 | **Sentry Error Monitoring** | Installed `@sentry/react`. Init in `main.tsx` (prod-only, 0.2 trace rate). `Sentry.captureException` in `ErrorBoundary.tsx` with component stack. Every `sync.ts` catch block tagged by operation (profile, workout, readiness, bodyweight, cardio, notes, pull, push, flushDirty). `AuthContext.tsx` sets/clears user on sign-in/sign-out. `VITE_SENTRY_DSN=` added to `.env` (needs prod value). |
| 2 | **Offline Sync Queue** | `markDirty(key)` / `clearDirty(key)` / `flushDirty()` added to `sync.ts`. Dirty keys stored in `foundry:sync:dirty` (localStorage JSON set). `flushDirty()` matches key patterns (day/week, profile, readiness, cardio), upserts to Supabase, 3 retries with exponential backoff (500ms/1s/1.5s). `_flushInProgress` guard prevents concurrent flushes. `storage.ts` wired via `_setMarkDirty` lazy injection (avoids circular dep). `window.addEventListener('online', flushDirty)` in `main.tsx`. |
| 3 | **TypeScript `strict: true`** | Phase 1: Enabled `strictNullChecks` → fixed 120 errors. Phase 2: Flipped `strict: true` → fixed 400 more errors. Total: **520 errors killed across 22 files. Zero tsc errors.** |
| 4 | **Design Tokens** | Added gold, amber, cardioHard, amberHighlight, overlay variants to `tokens.ts` + matching CSS vars in `theme.css`. Replaced all priority hardcoded hex/rgba values across 13+ component files with `tokens.colors.*` references. |

### Code Review v5 Written
Full build/development evaluation at `foundry-code-review-v5.md`. Complete feature inventory, 13 category breakdowns, v1-v5 comparison table, and roadmap to 10/10.

### Files Modified (36 files touched)
`main.tsx`, `ErrorBoundary.tsx`, `sync.ts`, `storage.ts`, `AuthContext.tsx`, `tsconfig.json`, `vite-env.d.ts`, `useMesoState.ts`, `App.tsx`, `HomeView.tsx`, `HomeTab.tsx`, `ScheduleTab.tsx`, `ProgressView.tsx`, `ProgressTab.tsx`, `MesoOverview.tsx`, `EditScheduleSheet.tsx`, `RestDaySheet.tsx`, `DayView.tsx`, `ExerciseCard.tsx`, `ExtraDayView.tsx`, `CardioSessionView.tsx`, `CardioIntervalTimer.tsx`, `MobilitySessionView.tsx`, `ExplorePage.tsx`, `SetupPage.tsx`, `SettingsView.tsx`, `OnboardingFlow.tsx`, `UserMenu.tsx`, `WeekCompleteModal.tsx`, `MinimizedTimerBar.tsx`, `HammerIcon.tsx`, `FoundryBanner.tsx`, `AuthContext.test.tsx`, `tokens.ts`, `theme.css`, `.env`

---

## Next Session Battle Plan

**Goal: Push every category toward 9.5. Execute phases in order. Each item has a concrete plan.**

---

### PHASE 1: BUILD & DEPLOY (5.5 → 9.0)
*Highest leverage — unlocks CI for everything else*

#### 1.1 — GitHub Actions CI Pipeline
**Create:** `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: foundry-app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm run build
```
**Time:** 10 min

#### 1.2 — `.env.example`
**Create:** `foundry-app/.env.example` documenting `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`
**Time:** 2 min

#### 1.3 — Set VITE_SENTRY_DSN
**User action:** Create Sentry project at sentry.io, paste DSN into `.env`
**Time:** 5 min

#### 1.4 — Bundle Size Visualization (Optional)
**Add:** `rollup-plugin-visualizer` to `vite.config.js`
**Time:** 10 min

---

### PHASE 2: TESTING (7.5 → 9.5)
*Second highest leverage — catches regressions in critical UI*

#### 2.1 — Install React Testing Library
```bash
cd foundry-app && npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
**Time:** 2 min

#### 2.2 — Component Test: ExerciseCard
**File:** `src/components/workout/__tests__/ExerciseCard.test.tsx`
**Cases:** Renders exercise name + set count, weight/reps input updates, weight auto-fill, set confirmation toggle, warmup modal opens, history sidebar renders, stalling warning, PR badge
**Mock:** localStorage, profile data
**Time:** 45 min

#### 2.3 — Component Test: DayView
**File:** `src/components/workout/__tests__/DayView.test.tsx`
**Cases:** Renders all exercises, readiness check-in on mount, handleUpdateSet correctness, elapsed timer, finish button shows stats, completion calls onComplete, rest timer triggers, notes persistence
**Mock:** useMesoState, RestTimerContext, localStorage
**Time:** 60 min

#### 2.4 — Component Test: HomeTab
**File:** `src/components/home/__tests__/HomeTab.test.tsx`
**Cases:** Today's workout card, readiness expand, "Start Workout" navigation, rest day sheet, cardio/mobility quick-adds, weekly progress count
**Mock:** Profile, activeDays, completedDays, navigation
**Time:** 45 min

#### 2.5 — Hook Test: useMesoState
**File:** `src/hooks/__tests__/useMesoState.test.ts`
**Cases:** Null profile on empty localStorage, loads profile, completedDays as Set, handleComplete triggers week modal, week stats correct, meso complete anchor gains, handleReset archives + clears, program regenerates on profile change
**Use:** `renderHook` from RTL
**Time:** 45 min

#### 2.6 — Fix Playwright Version Conflict
**Action:** `npm ls @playwright/test` to find conflict, pin/update version
**Time:** 15 min

#### 2.7 — Add Playwright E2E to CI
**Action:** Add E2E job with `npx playwright install --with-deps` to CI workflow
**Time:** 10 min

---

### PHASE 3: COMPONENT DESIGN (7.5 → 9.0)
*Reduce complexity in mega-components*

#### 3.1 — Focus Trap for Modal and Sheet
**Files:** `src/components/ui/Modal.tsx`, `src/components/ui/Sheet.tsx`
**Implementation:** useEffect that queries focusable elements, traps Tab/Shift+Tab, handles Escape. Auto-focus first element on mount. Restore focus on unmount.
**Time:** 20 min

#### 3.2 — Break SetupPage into Sub-Flows
**Extract from SetupPage.tsx (3,900 LOC):**
- `src/components/setup/AutoBuilderFlow.tsx` — AI build path (~1,200 LOC)
- `src/components/setup/ManualBuilderFlow.tsx` — Manual exercise picker + superset pairing (~1,200 LOC)
- `src/components/setup/CardioSetupFlow.tsx` — Cardio day selection, protocol assignment (~800 LOC)
- SetupPage.tsx becomes orchestrator (~700 LOC) holding shared form state

**Approach:** Identify step boundaries → extract JSX blocks → pass form state as props → verify build
**Time:** 90 min

#### 3.3 — Extract ReadinessCard and MobilityCard from HomeTab
**Extract from HomeTab.tsx (2,203 LOC):**
- `src/components/home/ReadinessCard.tsx` — Sleep/soreness/energy inputs, readiness label + advice
- `src/components/home/MobilityCard.tsx` — Mobility quick-add, session status

**HomeTab drops from ~2,203 → ~1,600 LOC**
**Time:** 45 min

#### 3.4 — Loading Skeleton Components
**Create:** `src/components/ui/Skeleton.tsx` — shimmer placeholder
**Add:** `@keyframes shimmer` to global.css
**Update:** All Suspense fallbacks in App.tsx
**Time:** 20 min

---

### PHASE 4: SECURITY (7.0 → 9.0)

#### 4.1 — CSP Meta Tag
**File:** `foundry-app/index.html`
**Add:** `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://*.sentry.io https://foundry-ai.timberandcode3.workers.dev; img-src 'self' data: blob:; font-src 'self';">`
**Verify:** App loads without CSP violations
**Time:** 10 min

#### 4.2 — Supabase Migrations in Repo
**Create:** `foundry-app/supabase/migrations/001_initial_schema.sql`
**Document:** All 6 tables (user_profiles, workout_sessions, readiness_checkins, body_weight_log, cardio_sessions, notes) with RLS policies
**Note:** Pull actual schemas from Supabase dashboard to verify
**Time:** 20 min

#### 4.3 — Sync Debounce
**File:** `src/utils/sync.ts`
**Add:** `debouncedSync(key, fn, delay=1500)` helper using setTimeout
**Wrap:** All fire-and-forget sync calls from persistence functions
**Time:** 20 min

---

### PHASE 5: DATA MODEL & VALIDATION (7.5 → 9.0)

#### 5.1 — Replace Index Signatures in types/index.ts
**Action:** Remove `[key: string]: unknown` from Exercise and Profile, enumerate all known fields as explicit optional properties
**Time:** 30 min (grep for all property accesses first)

#### 5.2 — Zod Validation at Supabase Boundary
**Install:** `npm install zod`
**Create:** `src/utils/schemas.ts` with Profile, DayData, ReadinessEntry schemas
**Usage:** Validate in `pullFromSupabase()` only — not everywhere
**Time:** 45 min

---

### PHASE 6: CODE QUALITY (8.0 → 9.5)

#### 6.1 — Migrate JS Files to TypeScript (6 files)
**Order:**
1. `analytics.js` → `analytics.ts` (80 LOC) — 20 min
2. `archive.js` → `archive.ts` (100 LOC) — 20 min
3. `training.js` → `training.ts` (402 LOC) — 40 min
4. `persistence.js` → `persistence.ts` (323 LOC) — 35 min
5. `api.js` → `api.ts` (400+ LOC) — 40 min
6. `constants.js` → `constants.ts` (957 LOC) — 45 min

**Skip:** `exercises.js` (5,958 LOC data file — low value)
**Total:** ~3.5 hours

#### 6.2 — Replace High-Priority `: any` Annotations
**Create interfaces:** `HomeViewProps`, `DayViewProps`, `ExerciseCardProps`, `HomeTabProps`
**Target:** HomeView.tsx (15 any props), DayView.tsx, ExerciseCard.tsx (15+), HomeTab.tsx
**Import types from:** `types/index.ts` (Profile, TrainingDay[], Set<string>)
**Time:** 2 hours

#### 6.3 — Enable Unused Variable Detection
**Update:** `tsconfig.json` → `"noUnusedLocals": true`, `"noUnusedParameters": true`
**Fix:** Prefix unused params with `_`
**Time:** 30 min

---

### PHASE 7: REMAINING ITEMS

#### 7.1 — Accessibility: axe-core + Skip Links
- Install `@axe-core/playwright`, add a11y tests to E2E suite (20 min)
- Add skip link to App.tsx, `.skip-link` CSS in global.css (10 min)

#### 7.2 — Performance: 404 Route + Sourcemaps
- Add `<Route path="*" element={<NotFoundPage />} />` to App.tsx, create NotFoundPage.tsx (10 min)
- Set `sourcemap: process.env.NODE_ENV !== 'production'` in vite.config.js (5 min)

#### 7.3 — State Management: Sync Badge
- In UserMenu.tsx, read `foundry:sync:dirty` set size, show "X pending" badge (15 min)

#### 7.4 — Design System: borderRadius Tokens
- Grep `borderRadius: \d+` across 26 files (~338 occurrences), replace with `tokens.radius.*` (45 min)

---

## Execution Summary

| Phase | Category | Current | Target | Est. Time |
|-------|----------|:-------:|:------:|:---------:|
| 1 | Build & Deploy | 5.5 | 9.0 | 30 min |
| 2 | Testing | 7.5 | 9.5 | 3.5 hrs |
| 3 | Component Design | 7.5 | 9.0 | 3 hrs |
| 4 | Security | 7.0 | 9.0 | 50 min |
| 5 | Data Model | 7.5 | 9.0 | 1.25 hrs |
| 6 | Code Quality | 8.0 | 9.5 | 6 hrs |
| 7 | Remaining | various | 9.5 | 1.75 hrs |
| **Total** | | **8.6** | **~9.5** | **~16 hrs** |

---

## Quick Reference: Current → Target Scores

```
Architecture:      8.5 → 9.0   (SetupPage split, 404 route)
Code Quality:      8.0 → 9.5   (JS→TS, narrow any, unused vars)
State Management:  9.0 → 9.5   (sync badge)
Data Model:        7.5 → 9.0   (index sigs, Zod)
Component Design:  7.5 → 9.0   (focus trap, splits, skeleton)
Performance:       8.5 → 9.5   (sourcemaps, 404)
Error Handling:    9.0 → 9.5   (granular boundaries)
Testing:           7.5 → 9.5   (component tests, E2E)
Build & Deploy:    5.5 → 9.0   (CI/CD)
Security:          7.0 → 9.0   (CSP, migrations, debounce)
Dependencies:      9.5 → 10.0  (axe-core)
Accessibility:     8.0 → 9.5   (focus trap, skip links, axe-core)
Design System:     8.5 → 9.5   (borderRadius tokens)
```

**Next session: Open this file. Start at Phase 1. Don't stop until we hit 9.5.**
