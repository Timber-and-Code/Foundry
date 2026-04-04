# Foundry Architecture

> A practical map of how the app is put together. Read this before making structural changes or debugging cross-cutting bugs.

---

## 1. What Foundry Is

A mesocycle-based strength training PWA. The user builds (or auto-builds) a 4–8 week program, logs sets during workouts, and the app progresses load/reps week-over-week through accumulation → intensification → peak → deload phases.

- **Stack:** React 18 + TypeScript + Vite + React Router + Supabase (auth + data) + vite-plugin-pwa
- **Deploy:** GitHub Actions → GitHub Pages → custom domain **thefoundry.coach** (workflow: `.github/workflows/deploy.yml`, triggers on push to `main`)
- **State model:** localStorage is the source of truth at runtime. Supabase is the backup/sync layer, pulled on sign-in and pushed via dirty-key queue.

---

## 2. Top-Level Layout

```
foundry-app/
├── src/
│   ├── App.tsx                  # Router + top-level state wiring + onboarding gate
│   ├── main.tsx                 # Mounts App inside AuthProvider, ToastProvider, RestTimerProvider
│   ├── components/
│   │   ├── auth/                # AuthPage, login/signup
│   │   ├── onboarding/          # OnboardingFlow (first-visit gate, returns with "done")
│   │   ├── setup/               # SetupPage → AutoBuilderFlow | ManualBuilderFlow
│   │   ├── home/                # HomeView (tab router), HomeTab, ProgressView, ScheduleTab, MesoOverview, NoMesoShell, ReadinessCard, MobilityCard, EditScheduleSheet
│   │   ├── workout/             # DayView (active workout), ExerciseCard, ExtraDayView, CardioSessionView, MobilitySessionView
│   │   ├── explore/             # ExplorePage (browse exercises + sample programs)
│   │   ├── settings/            # SettingsView (profile drawer)
│   │   ├── shared/              # FoundryBanner, UserMenu, HammerIcon
│   │   ├── ui/                  # Skeleton, Sheet, Toast, ExercisePicker — generic primitives
│   │   └── tour/                # TourOverlay (first-run feature tour)
│   ├── contexts/
│   │   ├── AuthContext.tsx      # Supabase session state, triggers pullFromSupabase on SIGNED_IN
│   │   ├── RestTimerContext.tsx # Global rest timer (lives above DayView so it survives navigation)
│   │   └── ToastContext.tsx     # Global toast queue, dispatched via window CustomEvent('foundry:toast')
│   ├── hooks/
│   │   ├── useMesoState.ts      # Profile + completedDays + currentWeek + activeDays derivation
│   │   └── useSyncState.ts      # Sync status enum + dirty count, listens to foundry:sync event
│   ├── data/
│   │   ├── constants.ts         # MESO config (getMeso, phases, RIRs, progression targets), random quotes, cooldown protocols
│   │   └── exercises.js         # EXERCISE_DB — array of all exercises with name, muscle, equipment, tag, reps, rest, warmup, videoUrl, description
│   ├── utils/
│   │   ├── store.js             # Barrel re-exporting from training/storage/sync — most code imports from here
│   │   ├── storage.ts           # Low-level localStorage wrapper (store.get/set/getTimestamp/setFromRemote) + migrateKeys
│   │   ├── training.ts          # loadProfile, saveProfile, loadDayWeek, saveDayWeek, loadExOverride, warmup helpers
│   │   ├── sync.ts              # Supabase push/pull, dirty-set queue, mergeProfile, flushDirty, pullFromSupabase
│   │   ├── schemas.ts           # Zod schemas for Profile, DayData, ReadinessEntry → used to validate Supabase reads
│   │   ├── validate.ts          # Legacy validateProfile (soft validation with console.warn)
│   │   ├── archive.ts           # Meso transition archive, resetMeso
│   │   ├── api.ts               # Higher-level readers (getCurrentWeek, getMesoTransition, etc.)
│   │   ├── supabase.ts          # Supabase client singleton
│   │   ├── analytics.ts         # PostHog event wrappers
│   │   └── helpers.ts           # Small utilities
│   ├── styles/
│   │   └── tokens.ts            # Design tokens: colors, radius, spacing, fontSize
│   └── types/
│       └── index.ts             # Profile, Exercise, TrainingDay, DayData, WarmupStep, WarmupDetail — shared types
├── public/                      # manifest.json, icons (192/512/apple-touch), favicon
├── dist/                        # Vite build output (gitignored except in CI artifact)
└── .github/workflows/
    ├── deploy.yml               # Build + deploy to GitHub Pages (main push)
    └── ci.yml                   # Lint + test + typecheck on PRs
```

---

## 3. Data Model — localStorage Keys

Everything lives under the `foundry:` namespace (migrated from legacy `ppl:` by `migrateKeys()` in `storage.ts`).

| Key pattern | Shape | Set by | Read by |
|---|---|---|---|
| `foundry:profile` | JSON `Profile` — name, experience, goal, splitType, daysPerWeek, workoutDays, mesoLength, startDate, weight, equipment, sessionDuration | `saveProfile()` | `loadProfile()`, `getMeso()` |
| `foundry:day{d}:week{w}` | JSON `DayData` — `{[exIdx]: {[setIdx]: {weight, reps, rpe, confirmed, warmup?, repsSuggested?}}}` | `saveDayWeek()` on every set edit | `loadDayWeek()`, `loadDayWeekWithCarryover()` |
| `foundry:done:d{d}:w{w}` | `'1'` string flag | `doComplete()` in DayView | Determines `completedDays` Set |
| `foundry:completedDate:d{d}:w{w}` | `'YYYY-MM-DD'` | `markComplete` | Calendar views |
| `foundry:currentWeek` | number string | `saveCurrentWeek()` | App mount |
| `foundry:notes:d{d}:w{w}` | session note string | End of DayView | Notes review |
| `foundry:exnotes:d{d}:w{w}` | JSON `{[exIdx]: string}` | Per-exercise note input | ExerciseCard note UI |
| `foundry:exOv:d{d}:w{w}:ex{i}` | Exercise ID string | `saveExOverride()` when swapping | `loadExOverride()` in DayView |
| `foundry:readiness:YYYY-MM-DD` | JSON `{sleep, soreness, energy}` | ReadinessCard | Home/Progress |
| `foundry:cardio:session:YYYY-MM-DD` | JSON cardio session data | CardioSessionView | HomeTab |
| `foundry:bwlog` | JSON array of `{date, weight}` | BW check-in flow | Progress charts |
| `foundry:meso_transition` | JSON transition object | `resetMeso()` / archive.ts | SetupPage new-meso carry-over |
| `foundry:sessionStart:d{d}:w{w}` | epoch ms string | `beginWorkout()` in DayView | Elapsed timer restore |
| `foundry:strengthEnd:d{d}:w{w}` | epoch ms string | Set completion | Duration split strength vs cardio |
| `foundry:show_tour` | `'1'` | Post-setup flag | App mount → TourOverlay |
| `foundry:toured` | `'1'` | After tour dismissed | Gate so tour only shows once |
| `foundry:onboarded` | `'1'` | OnboardingFlow done | App early-return gate |
| `foundry:storedProgram` | JSON program blueprint | AutoBuilder preview | SetupPage on complete (removed after commit) |
| `foundry:ts:{key}` | ISO timestamp | Every `store.set()` | `remoteIsNewer()` merge logic |
| `foundry:dirty` | JSON array of key strings | `markDirty()` | `flushDirty()` — push queue |

**Meso is not its own key.** `getMeso()` in `data/constants.ts` builds the meso config lazily from fields already on `foundry:profile` (`splitType`, `workoutDays`, `daysPerWeek`, `mesoLength`). Restore the profile → the meso comes back automatically.

---

## 4. Sync Flow (Supabase)

All sync code is in `src/utils/sync.ts`. Cheat sheet:

### Critical gotcha — Supabase error handling

**The Supabase JS client does NOT throw on API errors.** A call like `await supabase.from(...).upsert(...)` resolves with `{ data, error }` where `error` is populated on 4xx/5xx (RLS, schema, auth, etc.). A naive `try { await supabase... } catch {}` catches **nothing** — the try block completes "successfully" even when the server rejected the write.

Every upsert in this codebase must destructure `{ error }` and either throw it or handle it explicitly. A regression here = silent data loss. The bug that made `user_profiles` stay at 0 rows while the UI showed sync as complete was exactly this mistake across every sync helper. If you add a new sync call, follow the pattern:

```ts
const { error } = await supabase.from('table').upsert({...}, {...});
if (error) throw error;
```

### Push (local → remote)
- Every `store.set()` writes both the value AND a timestamp (`foundry:ts:{key}`) and calls `markDirty(key)` for keys matching `SYNC_TRACKED` in `storage.ts`.
- `flushDirty()` reads the dirty set, upserts each key to its matching Supabase table. Each upsert destructures `.error` and throws on failure. Retries up to 3 times with exponential backoff. Clears the dirty entry on success. After 3 failed attempts logs via `reportSyncFailure()` (Sentry + throttled toast).
- Fire-and-forget immediate push helpers: `syncProfileToSupabase`, `syncWorkoutToSupabase`, `syncReadinessToSupabase`, `syncBodyWeightToSupabase`, `syncCardioSessionToSupabase`, `syncNotesToSupabase`. All inspect `.error` and route failures through `reportSyncFailure()`. The dirty queue is the safety net — if the direct push fails, the entry remains dirty and `flushDirty()` retries on the next trigger.
- `pushToSupabase()` does a full scan push. Inspects each `Promise.allSettled` result for both rejected promises AND fulfilled-but-error responses, counts failures, reports via `reportSyncFailure()`.

### Pull (remote → local)
- `pullFromSupabase()` runs on `SIGNED_IN` (from `AuthContext.tsx`) and on manual triggers.
- Uses `Promise.allSettled` to fetch `user_profiles`, `workout_sessions`, `readiness_checkins`, `body_weight_log`, `cardio_sessions`, `notes` in parallel.
- For each row, compares remote `updated_at` vs local timestamp via `remoteIsNewer()`. If remote is newer, `store.setFromRemote(key, value, remoteTs)` — writes without marking dirty. If local is newer, `markDirty(key)` to push on next flush.
- Profile uses `mergeProfile()` for field-level merge (last-write-wins per field).
- On completion, dispatches a `foundry:pull-complete` CustomEvent. `useMesoState` listens for this and re-reads `loadProfile() + loadCompleted() + loadCurrentWeek()` so React state catches up with the freshly-restored localStorage without requiring a page reload.

### Sign-in flush chain

`AuthContext.tsx` on `SIGNED_IN`: `pullFromSupabase().then(() => flushDirty())`. The ordering matters:

1. **Pull first** — merges remote into local. For keys where local is newer, `pullFromSupabase` calls `markDirty()` so they'll be pushed back.
2. **Flush after** — pushes the freshly-dirtied keys PLUS any previously-dirty keys that accumulated while the user was unauthenticated (e.g. created a meso offline, then signed in). Without this step, pre-auth local work sits in the dirty queue forever unless the device goes offline→online to trigger the `window.addEventListener('online', flushDirty)` handler in `main.tsx`.

### Error reporting helper

`reportSyncFailure(operation, err)` in `sync.ts` is the single point for surfacing sync failures. It:
- Logs via `console.warn` for dev
- Captures to Sentry with a `context: 'sync'` tag and the operation name
- Dispatches a `foundry:toast` CustomEvent with a warning message (throttled to once per 30 seconds via `_lastSyncFailureToast` so bulk-failure batches don't spam the user)

Use this helper for any new sync operation that fails — don't reintroduce silent console.warn-only handling.

### Supabase schema (11 tables total)

**Tables the app currently reads/writes (denormalized — jsonb blobs):**

| Table | Columns | onConflict |
|---|---|---|
| `user_profiles` | id (uuid), data (jsonb), updated_at | `id` |
| `workout_sessions` | user_id, day_idx, week_idx, data (jsonb), updated_at | `user_id,day_idx,week_idx` |
| `readiness_checkins` | user_id, date, sleep, soreness, energy, score, updated_at | `user_id,date` |
| `body_weight_log` | user_id, date, weight_lbs, updated_at | `user_id,date` |
| `cardio_sessions` | user_id, date, data (jsonb), updated_at | `user_id,date` |
| `notes` | user_id, day_idx, week_idx, session_notes, exercise_notes (jsonb), updated_at | `user_id,day_idx,week_idx` |

**Tables that exist in Supabase but the app does NOT touch:**

| Table | Intended purpose | Current app behavior |
|---|---|---|
| `mesocycles` | Normalized meso records (one row per meso — mesoLength, splitType, phases, etc.) | App stores meso as fields on `foundry:profile` → `user_profiles.data` jsonb. Never writes to this table. |
| `training_days` | Normalized day definitions (one row per day slot in a meso) | App generates days from `generateProgram(profile, EXERCISE_DB)` at runtime, caches in `foundry:storedProgram`. Never persisted to Supabase. |
| `training_day_exercises` | Normalized exercises per day (join table) | Same as above — computed at runtime. Exercise overrides are stored locally as `foundry:exOv:d{d}:w{w}:ex{i}` keys. Not synced. |
| `workout_sets` | Normalized per-set log (one row per completed set) | App bundles all sets for a session into `workout_sessions.data` jsonb. Never normalizes to per-set rows. |
| `session_prs` | Normalized PR tracking per session | PRs are computed on-the-fly in `useMesoState.handleComplete` from the raw jsonb data. Never persisted. |

**⚠️ Schema mismatch — important.** The Supabase project has a fully normalized relational schema (mesocycles → training_days → training_day_exercises → workout_sets, plus session_prs), but the application code uses a denormalized jsonb approach. Someone (previous session, DB designer, migration plan) set up the normalized tables but the app was never migrated to use them. This means:

- Anything in `mesocycles`, `training_days`, `training_day_exercises`, `workout_sets`, `session_prs` will stay empty regardless of user activity
- If these tables have NOT NULL constraints without defaults, and the app accidentally tries to cascade into them (e.g. via a foreign key), upserts could fail silently
- Exercise overrides (swaps) are localStorage-only — they don't round-trip through Supabase at all, so swapping an exercise on one device won't carry to another device
- PR history is also localStorage-only — clearing storage loses PR history entirely

**Decision pending:** either migrate the app to write to the normalized tables, or drop the unused tables from Supabase to eliminate confusion. Until then, when debugging "data not syncing", confirm the code path is hitting one of the **6 tables the app actually uses**, not one of the 5 dormant ones.

### Gotchas
- **Silent failures.** The push helpers catch errors and warn to console / capture to Sentry. If the Supabase project is **paused** (free-tier auto-pause after ~1 week of inactivity), writes and reads all fail silently and data appears to sync but never leaves the device. No UI indication.
- **`validateProfile` is lenient** (only `experience` is required) so most Supabase rows parse. But `WorkoutSetSchema` requires `weight` and `reps` — a set with neither will be dropped from pull.
- **Race condition on sign-in.** `App.tsx` reads `loadProfile()` at mount, renders NoMesoShell if null. `pullFromSupabase()` kicks off async from AuthContext and writes to localStorage, but App's `profile` state is not re-read when the pull finishes. Until this is fixed, a fresh login may show "no meso" briefly even when remote data exists — a reload fixes it.

---

## 5. Screen Flow

```
                    ┌──────────────────┐
                    │   App.tsx mount  │
                    │  loadProfile()   │
                    └────────┬─────────┘
                             │
              ┌──────────────┴───────────────┐
              │                              │
     profile=null & !onboarded      profile exists
              │                              │
       OnboardingFlow                     HomeView
              │                     (HomeTab | Progress |
              ▼                      Schedule | Explore |
        NoMesoShell                   MesoOverview)
              │                              │
       [start program]                       │
              │              ┌───────────────┴────────────────┐
              ▼              │                                │
         SetupPage       /day/:d/:w                      /extra/:date
     (AutoBuilder or        DayView                     ExtraDayView
      ManualBuilder)           │
              │                │
       saveProfile ────────────┘
```

- **App.tsx** is the state owner. `useMesoState` hook produces `profile`, `completedDays`, `currentWeek`, `activeDays`, `activeWeek`, `handleComplete`, `handleReset`.
- Early returns gate on `profile` + `onboarded` + `showSetup`. Each early-return path is wrapped in `<React.Suspense>` because the screens are lazy-loaded.
- Navigation is React Router: `/`, `/day/:dayIdx/:weekIdx`, `/extra/:dateStr`, `/cardio/:dateStr/:protocolId`, `/mobility/:dateStr`.

---

## 6. Workout Session Lifecycle (DayView)

1. **Mount.** Reads `loadDayWeekWithCarryover(dayIdx, weekIdx, weekDay, profile)` — pulls saved data for this session OR, if empty, suggests values carried over from the previous week's same slot.
2. **Pre-start UI.** Shows meso overlay, "Begin Workout" button. Exercise cards are visible but in a pre-start state. Swap Sheet must be rendered here too (it's in both the pre-start and post-start returns — both branches need it or the swap button looks broken).
3. **`beginWorkout()`** stamps `foundry:sessionStart:d{d}:w{w}` with `Date.now()`, flips `workoutStarted` true, fires BW check-in if applicable.
4. **Set logging.** Each row in the grid is 3 columns: Weight input, Reps input, Check button. Tapping the check → opens the RPE prompt (Easy/Good/Hard) → on selection, writes `rpe` + `confirmed=true`, calls `onSetLogged(restStr, exName, setIdx, isLastSet)` which routes to `handleSetLogged` in DayView → starts rest timer via `useRestTimer.startRestTimer()`.
5. **Superset handling.** `handleSetLogged` checks if the exercise is part of a superset pair (`ex.supersetWith`). If so, defers the rest timer until both exercises have logged the same set index.
6. **Completion.** `doComplete()` writes `foundry:done:d{d}:w{w}='1'`, `foundry:sessionNote:...`, and calls `onComplete(completionData)` which bubbles to `useMesoState.handleComplete` to update `completedDays` and potentially advance `currentWeek`.

### ExerciseCard internals
- Expandable card. Header is the click target. Expanded shows: Warmup Guide button, How To button, stall warning, previous-week hint, cross-meso note, set grid, action buttons (History, Swap).
- **Warmup modal** renders the protocol title, rationale, and ramp-up sets (from `generateWarmupSteps(exercise, workingWeight)`).
- **How To modal** shows the exercise description + "Watch on YouTube" link (wires to `exercise.videoUrl`, which is a YouTube search URL stored on each exercise in `data/exercises.js`).
- **RPE prompt** (introduced 2026-04-04) — intercepts the set-complete checkmark. Writes `rpe` as the string label ("Easy" / "Good" / "Hard").
- **Anchor exercises** use the `<HammerIcon>` SVG, not an emoji. Other exercises have no icon.

---

## 7. Meso Engine (data/constants.ts + archive.ts)

- **`buildMesoConfig(mesoLength, daysPerWeek, splitType)`** → produces `{weeks, days, phases, rirs, mesoRows, progTargets}`.
- **Phases**: accumulation (first ~half), intensification (next ~quarter), peak (week before deload), deload (final week). Colored via `PHASE_COLOR`.
- **`getProgTargets()`** returns per-week load/reps progression strings like "+5 lbs" / "9-11". `ExerciseCard` reads this to show the goal badge.
- **`getMesoRows()`** returns per-week coaching guidance text (phase name + narrative).
- **`_mesoCache`** is a module-level singleton — `resetMesoCache()` must be called after any profile write that changes mesoLength/split/days or the cache is stale.

### Meso carryover (cycle-to-cycle progression)

**Mesos are not independent.** Each new meso carries over ending loads, reps, and anchor PRs from the prior meso, so progressive overload continues across cycles — not just within one cycle. This is a core training principle in Foundry; losing carryover data means the user starts from scratch every 4–8 weeks, which breaks the programming model.

The carryover path:
1. **`archiveCurrentMeso(profile, { generateProgram, EXERCISE_DB })`** in `utils/archive.ts` runs when the user completes or resets a meso. It walks every `foundry:day{d}:week{w}` for the ending cycle, computes final set data per exercise, and writes an archived snapshot.
2. **`resetMeso()`** clears the active cycle's session keys and writes a `foundry:meso_transition` record containing the starting loads/reps to use for the *next* meso (typically last-working-week +progression).
3. **`SetupPage.tsx`** reads `foundry:meso_transition` during new-meso setup — if present, it pre-populates starting weights and shows "Carrying over from your last meso" messaging.
4. **`CardioSetupFlow.tsx`** clears `foundry:meso_transition` (`store.set('foundry:meso_transition', '')`) once the new meso has been committed, so it's consumed exactly once.

**When users say "my meso is gone," they may mean either:**
- The active profile / session data was wiped (what you first think of)
- **OR** the carryover chain from previous mesos was lost — so even though they can rebuild a profile, their next meso won't continue from where they progressed to before. This second kind of loss is the one that matters for long-term users.

**The unused `mesocycles` table in Supabase was almost certainly intended as the remote backup for `foundry:meso_transition` + archive snapshots** — so carryover survives device changes and localStorage wipes. Currently carryover is **localStorage-only**, which means clearing storage breaks the progression chain between cycles even if the user is signed in. Migrating archive/transition data to `mesocycles` is a legitimate follow-up item.

---

## 8. Provider Tree (from main.tsx down)

```tsx
<ErrorBoundary>
  <AuthProvider>                 // Supabase session + triggers pullFromSupabase
    <ToastProvider>              // Global toast queue
      <RestTimerProvider>        // Global rest timer (survives navigation)
        <BrowserRouter>
          <App />                // Router, lazy-loaded screens
```

- `useAuth()` — user, session, loading, authUnavailable, login/signup/logout
- `useToast()` — enqueue toasts (most code uses `window.dispatchEvent(new CustomEvent('foundry:toast', {...}))` instead of the hook for decoupling)
- `useRestTimer()` — restTimer, startRestTimer, dismissRestTimer, setRestTimerMinimized

---

## 9. Styling

- **Design tokens** in `src/styles/tokens.ts`: `colors`, `radius`, `spacing`, `fontSize`. All components reference `tokens.*` rather than hard-coding values.
- **CSS variables** are also in play (`var(--bg-card)`, `var(--text-primary)`, etc.) — defined at a higher level (check `index.html` / CSS imports). There's a slow migration from CSS vars to tokens.
- **Inline styles** are the dominant pattern. Very little use of CSS classes — makes specificity and themeing easy but ballooning file sizes.
- **Mobile-first.** The app is primarily used on phones. When styling:
  - Use `minWidth: 0` on flex/grid children so they can shrink below intrinsic content width
  - Use `boxSizing: 'border-box'` on inputs so padding doesn't push them past `width: 100%`
  - For `<input type="date">` on iOS Safari, set `WebkitAppearance: 'none'`, `appearance: 'none'`, `minWidth: 0`, `maxWidth: '100%'` — iOS has a native intrinsic width that ignores `width: 100%`

---

## 10. Testing

- **Vitest + @testing-library/react**, 239+ tests across components and utils.
- Tests live in `src/**/__tests__/*.{test.ts,test.tsx,test.js}`.
- Heavy dependencies (store, data/constants, Supabase client) are mocked via `vi.mock` + `vi.hoisted`.
- `npx vitest run --reporter=dot` for fast feedback. The forks pool occasionally fails to start a worker on WSL2 (single test file) — the other files still run and report honestly.

---

## 11. Deploy & Domain

- **Branch:** `main`
- **Workflow:** `.github/workflows/deploy.yml`
  1. Checkout → setup Node 22 → `npm install` in `foundry-app/`
  2. `npm run build` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` injected as env vars
  3. Upload `foundry-app/dist` as a Pages artifact
  4. `actions/deploy-pages@v4` publishes it
- **Domain:** thefoundry.coach (custom domain on GitHub Pages)
- **Check deploy status:** https://github.com/Timber-and-Code/Foundry/actions/workflows/deploy.yml — green = live, yellow = building, red = failed
- **PWA / service worker** via `vite-plugin-pwa`. The SW precaches the built bundle, so after a deploy, phones with the PWA installed will keep serving the old bundle until the SW updates. Incognito/private tab bypasses the SW.

---

## 12. Parallel-Session Ownership (ephemeral, reset per work session)

When two Claude Code sessions work in parallel, split by zone to avoid merge conflicts:
- **Backend / sync / infra:** `src/utils/sync.ts`, `src/utils/storage.ts`, `src/utils/schemas.ts`, `vite.config.js`, `package.json`, `public/_headers`, service worker config
- **UI / UX:** `src/components/home/*`, `src/components/workout/*`, `src/components/explore/*`, `src/components/shared/*`, `src/components/ui/*` (except active migrations), `src/styles/*`, `src/components/setup/*` for cosmetic changes

Always check `git status` and `git log --oneline -5` before committing — the other session may have staged files that shouldn't get picked up by a broad `git add`. Use `git commit -- <path>` to scope commits to specific files.

---

## 13. Known Rough Edges (as of 2026-04-04)

### Resolved
- ~~Silent sync failures — Supabase `.error` field was never inspected, so every upsert appeared to succeed even when RLS/schema/auth rejected it. `user_profiles` stayed at 0 rows while UI reported sync complete.~~ Fixed in commit `63d8591`: every upsert now destructures and throws `.error`, failures route through `reportSyncFailure()` → Sentry + throttled toast.
- ~~`pullFromSupabase` didn't propagate completion to App, so fresh logins needed a reload before the profile/meso appeared.~~ Fixed in commit `3c1aa09`: pull dispatches `foundry:pull-complete` CustomEvent, `useMesoState` listens and refreshes.
- ~~Pre-auth local work (meso created while unauthenticated) never pushed on sign-in; only `pullFromSupabase` ran.~~ Fixed in commit `63d8591`: `AuthContext` SIGNED_IN now does `pullFromSupabase().then(() => flushDirty())`.

### Still open
- `ExerciseCard` / `DayView` / `ExtraDayView` have pre-existing TS errors around `exercise.sets` being `string | number | undefined`. The code works at runtime but strict narrowing is pending.
- **Meso carryover is localStorage-only.** `foundry:meso_transition` + archived snapshots never sync to Supabase. The `mesocycles` table sits empty. Clearing storage on a signed-in device still loses the long-term progression chain between cycles. Follow-up: wire `archiveCurrentMeso` + `resetMeso` to write to `mesocycles`, and extend `pullFromSupabase` to read it back.
- **5 dormant Supabase tables** (`mesocycles`, `training_days`, `training_day_exercises`, `workout_sets`, `session_prs`) exist in a normalized schema but the app never writes to them. Either migrate the app's storage model to use them or drop them to eliminate confusion.
- Service worker cache can strand users on old builds after a deploy until they unregister the SW or reinstall the PWA. iOS Safari PWAs are particularly sticky — "clear site data" doesn't always unregister the SW. Workaround: delete home-screen PWA and re-add.
- **Exercise swap overrides are localStorage-only.** `foundry:exOv:d{d}:w{w}:ex{i}` keys never sync. Swapping an exercise on one device won't carry to another.
- **PR history is localStorage-only.** Computed on-the-fly in `useMesoState.handleComplete` from raw jsonb data. Clearing storage loses PR history entirely. The `session_prs` table exists but is never written.
