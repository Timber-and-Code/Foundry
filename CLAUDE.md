# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `foundry-app/`:

```bash
npm run dev          # Vite dev server on port 3000
npm run build        # Production build → dist/
npm run test         # Vitest unit tests (170 tests)
npm run lint         # ESLint on src/
npm run format       # Prettier on src/
```

Run a single test file:
```bash
npx vitest run src/utils/__tests__/store.test.ts
```

Run a single test by name:
```bash
npx vitest run --reporter=verbose -t "test name here"
```

E2E tests have a pre-existing `@playwright/test` version conflict — do not attempt to fix them unless explicitly asked.

**Deploy**: `git push origin main` → Cloudflare auto-deploys to thefoundry.coach.

## Architecture

### Project Layout

```
foundry-app/src/
  App.tsx               # Root: auth gate, router, context providers
  contexts/             # AuthContext (Supabase), RestTimerContext (global timer)
  hooks/                # useMesoState — central app state
  components/
    home/               # HomeView, HomeTab, ScheduleTab (tab shell)
    workout/            # DayView, ExerciseCard, CardioSessionView, MobilitySessionView
    onboarding/         # OnboardingFlow (first-run profile setup)
    settings/           # SettingsView
    auth/               # AuthPage, UserMenu
    shared/             # FoundryBanner, HammerIcon, NoMesoShell, Button
  data/
    constants.js        # EXERCISE_DB metadata, PHASE_COLOR, TAG_ACCENT, CARDIO_WORKOUTS, MOBILITY_PROTOCOLS, getMeso(), getWeekPhase()
    exercises.js        # Full EXERCISE_DB array (~200+ exercises)
  utils/
    store.ts            # All localStorage read/write (barrel — import everything from here)
    sync.ts             # Supabase cloud sync functions
    supabase.ts         # Supabase client (reads VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
    validate.ts         # Input/schema validation helpers
    helpers.ts          # haptic(), misc utilities
  styles/
    global.css          # CSS custom properties (--bg-root, --text-primary, etc.)
    tokens.ts           # TypeScript design token constants
  types/index.ts        # Profile, TrainingDay, Exercise, WorkoutSet types
```

### Routing (React Router v7)

Defined in `App.tsx`:
- `/` — HomeView with four tabs (Home, Schedule, Progress, Explore). Auth gate redirects here if not logged in.
- `/day/:dayIdx/:weekIdx` — DayView (active workout session)
- `/extra/:dateStr` — ExtraDayView (ad-hoc sessions)
- `/cardio/:dateStr/:protocolId` — CardioSessionView
- `/mobility/:dateStr` — MobilitySessionView

### State Management

**`useMesoState` hook** is the central state manager. It owns: `profile`, `completedDays`, `activeDays`, `currentWeek`, and program generation. All major components receive these as props from HomeView.

**localStorage** is the primary persistence layer. All keys are prefixed `foundry:`. The `store.ts` barrel is the only place that should read/write localStorage — never call `localStorage` directly in components.

**Supabase sync** is additive — it layers on top of localStorage. `sync.ts` exports fire-and-forget functions (`syncProfileToSupabase`, `syncWorkoutToSupabase`, etc.) called after local saves. If Supabase is unreachable, `AuthContext` sets `authUnavailable: true` and the app continues in localStorage-only mode.

### Program Generation

`generateProgram(profile, EXERCISE_DB)` in `src/utils/program.js` builds the mesocycle. **Always pass `EXERCISE_DB` as the second argument** — the default parameter is `[]`, which produces empty workouts.

Week-level set progression (MEV→MAV→MRV) is applied in `DayView` via `getWeekSets(ex.sets, weekIdx, getMeso().weeks)` before rendering exercise cards.

### Data Flow for a Workout Session

1. `HomeView` renders `ScheduleTab`, user taps a day → navigates to `/day/:dayIdx/:weekIdx`
2. `DayView` loads week data via `loadDayWeekWithCarryover()` (applies previous week's weights as suggestions)
3. Sets are logged via `handleUpdateSet` → `saveDayWeek()` → Supabase sync
4. On completion: `doComplete()` → marks `foundry:done:d{n}:w{n}` → calls `onComplete` prop → `useMesoState` updates `completedDays`

### Design Tokens

CSS custom properties are defined in `global.css` and mirrored as TS constants in `tokens.ts`. Use `var(--bg-root)`, `var(--text-primary)`, `var(--accent)`, etc. in inline styles. Only ~5 components currently import from `tokens.ts` directly — prefer CSS vars for consistency.

### Accessibility Conventions

All interactive non-`<button>` elements that act as buttons must be converted to `<button>`. Modals require `role="dialog" aria-modal="true" aria-labelledby="[id]"`. Alert dialogs use `role="alertdialog"`. Toggle/selection buttons use `aria-pressed` or `aria-expanded`. Groups of related buttons use `role="group" aria-labelledby`. Timers and live regions use `aria-live="polite" aria-atomic="true"`. Arrow characters (`←`, `→`) in button text must be wrapped in `<span aria-hidden="true">`.

### Environment

- Runtime: WSL2 (Linux on Windows)
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set in `foundry-app/.env` — never hardcode fallbacks in source
- TypeScript `strict: false` currently — planned migration to `true`
- Supabase project: `iwresyrdyalwkowyxxwr.supabase.co`
