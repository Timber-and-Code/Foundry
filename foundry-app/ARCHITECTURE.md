# Foundry Architecture

> A practical map of how the app is put together. Read this before making structural changes or debugging cross-cutting bugs.

---

## 1. What Foundry Is

A mesocycle-based strength training PWA. The user builds (or auto-builds) a 4–8 week program, logs sets during workouts, and the app progresses load/reps week-over-week through accumulation → intensification → peak → deload phases.

- **Stack:** React 18 + TypeScript + Vite + React Router + Supabase (auth + data) + vite-plugin-pwa
- **Deploy:** GitHub Actions → GitHub Pages → custom domain **thefoundry.coach** (workflow: `.github/workflows/deploy.yml`, triggers on push to `main`)
- **State model:** localStorage is the runtime source of truth. Supabase (normalized 11-table schema) is the durable backup, pulled on sign-in and pushed via direct fire-and-forget helpers + dirty-key queue safety net. The full sync migration landed 2026-04-04 — see Section 4 for architecture and war-room lessons.

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

Everything lives under the `foundry:` namespace (migrated from legacy `ppl:` by `migrateKeys()` in `storage.ts`). localStorage is the runtime source of truth; Supabase is the durable backup (see Section 4 for the sync architecture).

### Data keys (synced to Supabase)

| Key pattern | Shape | Supabase table | Chunk |
|---|---|---|---|
| `foundry:profile` | JSON `Profile` — identity + preferences + meso config (legacy bag) | `user_profiles` (identity fields) + `mesocycles` (meso fields) | 1, 2 |
| `foundry:day{d}:week{w}` | JSON `DayData` — `{[exIdx]: {[setIdx]: {id, weight, reps, rpe, confirmed, warmup?}}}`. `id` is a stable UUID that round-trips with the remote row. | `workout_sessions` + per-set rows in `workout_sets` | 4 |
| `foundry:done:d{d}:w{w}` | `'1'` flag | `workout_sessions.is_complete` + `completed_at` | 4 |
| `foundry:completedDate:d{d}:w{w}` | `'YYYY-MM-DD'` | derived from `workout_sessions.completed_at` on pull | 4 |
| `foundry:notes:d{d}:w{w}` | Session note text | `notes` row, `target_type='workout_session'`, `target_id=workout_sessions.id` | 5d |
| `foundry:exnotes:d{d}:w{w}` | `{[exIdx]: string}` | one `notes` row per exercise with a note, `target_type='exercise'`, `target_id=training_day_exercises.id`. On pull, the same row fans out across every week (notes attach to the exercise template, not a specific week's instance). | 5d |
| `foundry:readiness:YYYY-MM-DD` | `{sleep, soreness, energy}` | `readiness_checkins` row with `checked_at`, `sleep`, `soreness`, `energy`, `score` (computed 0-6) | 5b |
| `foundry:cardio:session:YYYY-MM-DD` | Cardio session blob | `cardio_sessions` row — only synced when `session.completed === true` (NOT NULL constraints on protocol/duration/performed_at). Full blob preserved in the `data` jsonb column. | 5c |
| `foundry:bwlog` | Array of `{date, weight}` (capped at 52) | one `body_weight_log` row per entry, keyed on `(user_id, logged_at)` | 5a |
| `foundry:exOv:d{d}:w{w}:ex{i}` | Exercise ID override (swap) | Mirrored to `training_day_exercises` row via `syncExerciseSwapRemote` — updates the exercise for that slot across all weeks | 3 |

### Caches (local-only, derived from sync pulls)

| Key pattern | Shape | Written by | Read by |
|---|---|---|---|
| `foundry:active_meso_id` | uuid (the currently active mesocycle) | `syncMesocycleToSupabase` on first meso creation; `pullFromSupabase` on sign-in | all workout writes, notes sync |
| `foundry:td_ids:{mesoId}` | `{[day_index]: training_days.id}` map | `ensureTrainingStructureRemote` + `pullTrainingStructure` | `upsertWorkoutSessionRemote` for `training_day_id` FK lookup |
| `foundry:tde_ids:{mesoId}` | `{"dayIdx:exIdx": training_day_exercises.id}` map | `ensureTrainingStructureRemote` + `pullTrainingStructure` | `syncNotesToSupabase` for exercise note `target_id` resolution |
| `foundry:ws_id:d{d}:w{w}` | uuid (stable `workout_sessions.id` for this slot) | `getOrCreateWorkoutSessionId` on first Begin Workout; `pullWorkoutHistory` on sign-in | per-set upserts (`workout_session_id` FK), notes sync |
| `foundry:storedProgram` | Array of `TrainingDay` — generated program cache | `useMesoState.activeDays` memo (regen from profile); `pullTrainingStructure` (reconstruct from `training_days` + `training_day_exercises`) | `useMesoState.activeDays` reads of the active program |
| `foundry:meso_transition` | `MesoTransition` — carryover data for next meso | `archiveCurrentMeso` / `resetMeso` | `SetupPage` new-meso carry-over |

### Timing + state (local-only, not synced)

| Key pattern | Shape | Purpose |
|---|---|---|
| `foundry:sessionStart:d{d}:w{w}` | epoch ms | Elapsed timer restore on page reload |
| `foundry:strengthEnd:d{d}:w{w}` | epoch ms | Strength-vs-cardio duration split |
| `foundry:sessionNote:d{d}:w{w}` | string | End-of-session note buffer (synced via `notes` table on commit) |
| `foundry:currentWeek` | number | Current week index for nav |
| `foundry:show_tour` | `'1'` | Post-setup flag to trigger TourOverlay |
| `foundry:toured` | `'1'` | Tour seen marker (local UX state) |
| `foundry:onboarded` | `'1'` | OnboardingFlow done (local UX state) |

### Sync infrastructure

| Key pattern | Shape | Purpose |
|---|---|---|
| `foundry:ts:{key}` | ISO timestamp | Last-write timestamp for `remoteIsNewer()` merge logic |
| `foundry:sync:dirty` | Array of key strings | The dirty queue — keys that need pushing to Supabase on next `flushDirty()` |
| `foundry:migrated_from_ppl` | `'1'` | Legacy key-name migration marker (ppl: → foundry:) |

**Meso is derived, not its own key.** `getMeso()` in `data/constants.ts` builds the meso config from fields on `foundry:profile` (`splitType`, `workoutDays`, `daysPerWeek`, `mesoLength`). After chunk 2, those fields also live in the `mesocycles` row; on pull, `supabaseMesoRowToAppFields` overlays them on the local profile so `getMeso()` returns the correct value.

---

## 4. Sync Flow (Supabase)

All sync code lives in `src/utils/sync.ts`. This section is critical — read it before touching sync, and read the **war-room lessons** at the end before debugging anything that "isn't syncing."

### 4.1 The normalized schema (11 tables, all shipped)

As of 2026-04-04, all 10 user-facing Supabase tables round-trip through the app via a chunked migration. Only `session_prs` (PR indexing) remains unwired — it's a pure query optimization since PRs are derivable client-side from `workout_sets`.

```
user_profiles ──── active_meso_id ──→ mesocycles ──┬── training_days ──── training_day_exercises
     │                                             │
     │                                             └── workout_sessions ──── workout_sets
     │                                                                       │
     │                                                                       └── session_prs (pending)
     │
     ├── body_weight_log (by date)
     ├── readiness_checkins (by date)
     ├── cardio_sessions (by date)
     └── notes (polymorphic: target_type + target_id)
```

**Every upsert/select goes through `src/utils/sync.ts`. The `MIGRATED` feature-flag object at the top of that file declares which tables are wired. Every helper, pull branch, and flushDirty branch gates on its flag.**

### 4.2 Migration status table

| Chunk | Table(s) | Status | Commit |
|---|---|---|---|
| 1 | `user_profiles` (identity + preferences) | ✅ | `8498305` |
| 2 | `mesocycles` + `user_profiles` new columns (`workout_days`, `session_duration_min`, `active_meso_id`) | ✅ | `35fb5c1` |
| 3 | `training_days` + `training_day_exercises` (program structure, exercise swaps) | ✅ | `a68b19c` |
| 4a | `workout_sessions` + `workout_sets` WRITE path (per-set upserts, debounced) | ✅ | `ba91f64` |
| 4b | `workout_sessions` + `workout_sets` PULL path + delete-on-uncheck | ✅ | `bed4e02` |
| 5a | `body_weight_log` | ✅ | `b438455` |
| 5b | `readiness_checkins` | ✅ | `b438455` |
| 5c | `cardio_sessions` | ✅ | `b438455` |
| 5d | `notes` (session + exercise, polymorphic) | ✅ | `6dc8d59` |
| 4c (follow-up) | `session_prs` (PR indexing, derivable client-side) | ⏳ optional | — |

### 4.3 Push architecture

**Two write paths:**

1. **Direct fire-and-forget helpers** — called from the UI at the moment a change happens (e.g. `saveProfile → syncMesocycleToSupabase().then(syncProfileToSupabase).then(ensureTrainingStructureRemote)`). Each helper destructures `.error` from the Supabase response and throws on failure, routing to `reportSyncFailure()`.

2. **Dirty queue (`foundry:sync:dirty`)** — every `store.set()` of a sync-tracked key calls `markDirty()`, adding the key to the queue. `flushDirty()` reads the queue and re-attempts the matching upserts with retry + backoff. The queue is the safety net: if a direct write fails (network, auth race, etc.), the entry stays dirty and gets retried on the next flush trigger.

**Flush triggers:**
- `window.addEventListener('online', flushDirty)` in `main.tsx` — device comes back online
- `AuthContext.tsx` SIGNED_IN → `pullFromSupabase().then(() => flushDirty())` — pushes any pre-auth or previously-failed work once a valid session exists

**Per-set writes bypass the dirty queue.** Chunk 4a's workout sync uses direct `upsertWorkoutSetRemote` calls debounced per stable set UUID via `debouncedSync('set:${setId}', ..., 1500)`. The legacy `foundry:day{d}:week{w}` jsonb dirty keys are still cleared as no-ops in `flushDirty` for backward compat, but they're not the source of truth anymore.

### 4.4 Pull architecture

`pullFromSupabase()` runs on `SIGNED_IN` from `AuthContext`. It must fetch in a strict order because of FK dependencies and cache priming:

```
1. user_profiles          (identity + preferences + active_meso_id)
2. mesocycles             (uses active_meso_id from step 1)
3. training_days          (uses meso_id from step 2) ─┐
4. training_day_exercises (uses training_day_id)    ─┴─ writes foundry:td_ids + foundry:tde_ids caches
5. workout_sessions       (uses meso_id, writes foundry:ws_id cache) 
6. workout_sets           (uses workout_session_id from step 5; reconstructs foundry:day{d}:week{w} jsonb)
7. body_weight_log        (per-user, not per-meso)
8. readiness_checkins     (per-user)
9. cardio_sessions        (per-user)
10. notes                 (joins via foundry:ws_id and foundry:tde_ids caches)
```

**Dispatches `foundry:pull-complete` CustomEvent on success.** `useMesoState.ts` listens for this and re-reads `loadProfile() + loadCompleted() + loadCurrentWeek()` so React state catches up with the freshly-restored localStorage. **Without this, fresh sign-ins show "no meso" until a page reload** — the old race condition bug is fixed via this event.

### 4.5 Critical patterns (non-negotiable)

#### A. Always destructure `.error` from Supabase responses

The Supabase JS client does NOT throw on API errors. It resolves with `{ data, error }` where `error` is populated on 4xx/5xx (RLS misconfig, schema mismatch, NOT NULL violation, auth failure, etc.). A naive `try { await supabase... } catch {}` catches **nothing** — the try block completes "successfully" even when the server rejected the write.

**Every upsert, update, delete, and select must follow this pattern:**

```ts
const { data, error } = await supabase.from('table').upsert({...}, {...});
if (error) throw error;
```

For `Promise.allSettled` batches, you must also inspect each fulfilled result for `.error` — `allSettled` only catches thrown errors, not fulfilled-but-error responses. See `pushToSupabase` for the pattern.

**This exact mistake is what made sync silently fail for weeks before chunk 1.** The app thought everything was synced while `user_profiles` had 0 rows. If you see new sync code without `.error` handling, it's a regression — flag it immediately.

#### B. Use `reportSyncFailure()` for all error reporting

```ts
} catch (e) { reportSyncFailure('operation_name', e); }
```

`reportSyncFailure()` in `sync.ts`:
- Logs to `console.warn` (dev)
- Captures to Sentry with `context: 'sync'` + operation tag (prod monitoring)
- Dispatches `foundry:toast` CustomEvent with a warning message, throttled to one per 30 seconds via `_lastSyncFailureToast` so bulk failures don't spam the user

Never do silent `console.warn` only. That's what hid the original bug.

#### C. FK ordering matters

Several tables have foreign keys to others. Writes must sequence correctly or the FK constraint fails. Specifically:

```
saveProfile(profile)
  └─→ syncMesocycleToSupabase(profile)     # writes mesocycles FIRST
      └─→ syncProfileToSupabase(profile)   # user_profiles.active_meso_id FK → mesocycles.id
          └─→ ensureTrainingStructureRemote(mesoId, profile)  # training_days.meso_id FK → mesocycles.id
```

See `src/utils/training.ts:saveProfile` for the `.then()` chain. The chain is fire-and-forget at the top level (saveProfile stays synchronous) but sequences internally so FKs are satisfied.

#### D. Client-side generated UUIDs for idempotency

Several tables use stable client-generated UUIDs so that repeated writes target the same row rather than creating duplicates:

- `mesocycles.id` ← `foundry:active_meso_id`
- `training_days.id` ← generated in `ensureTrainingStructureRemote`, cached in `foundry:td_ids:{mesoId}`
- `training_day_exercises.id` ← generated in `ensureTrainingStructureRemote`, cached in `foundry:tde_ids:{mesoId}`
- `workout_sessions.id` ← `foundry:ws_id:d{d}:w{w}` via `getOrCreateWorkoutSessionId`
- `workout_sets.id` ← stored inline in the per-set jsonb as `sd.id`

**These caches are not optional infrastructure — they're load-bearing.** `upsertWorkoutSessionRemote` early-returns if `foundry:td_ids:{mesoId}` is missing because it can't resolve the `training_day_id` FK. `syncNotesToSupabase` skips exercise notes if `foundry:tde_ids:{mesoId}` is missing.

#### E. Never drop or rewrite normalized tables as a shortcut

The normalized schema exists for a reason: paid-tier features (coaching dashboard, "train with friends" shared mesos) fundamentally require `workout_sets` as rows and `mesocycles` as shared entities. During chunk 0 debugging, dropping + recreating with denormalized `data jsonb` columns was considered as a "quick fix" — **don't do it**. See `foundry_paid_tier.md` in session memory for the reasoning.

### 4.6 Mapper helpers (app ↔ Supabase)

The app and the schema use different names and formats for some fields. Mapper functions in `sync.ts` translate between them:

| App value | Supabase value | Mapper |
|---|---|---|
| `profile.experience === 'new'` | `user_profiles.experience === 'beginner'` | `appExperienceToEnum` |
| `profile.goal === 'build_muscle'` (matches) | `user_profiles.primary_goal === 'build_muscle'` | `appGoalToEnum` |
| `profile.splitType === 'ppl'` | `user_profiles.preferred_split === 'PPL'` (uppercase) | `appSplitToEnum` |
| `profile.weight === '185'` | `user_profiles.weight_lbs === 185` (numeric) | inline |
| `profile.birthdate === '1990-01-15'` | `user_profiles.date_of_birth === '1990-01-15'` | inline |
| `profile.workoutDays === [1,3,5]` | `user_profiles.workout_days === [1,3,5]` (smallint[]) | inline |
| `profile.equipment === ['full_gym']` | `user_profiles.equipment === ['full_gym']` (text[]) | inline |
| `exercise.reps === '6-10'` | `training_day_exercises.rep_min=6, rep_max=10` | `parseRepRange` |
| `exercise.progression === 'weight'` | `training_day_exercises.progression === 'double_progression'` | `mapProgressionType` |
| `exercise.progression === 'reps'` | `training_day_exercises.progression === 'linear'` | `mapProgressionType` |
| `sd.rpe === 'Easy'` | `workout_sets.rpe === 7` | inline encode/decode |
| `sd.rpe === 'Good'` | `workout_sets.rpe === 8` | inline encode/decode |
| `sd.rpe === 'Hard'` | `workout_sets.rpe === 9.5` | inline encode/decode |

**Enum values for reference:**
- `experience_level`: `beginner`, `intermediate`, `advanced`
- `primary_goal`: `build_muscle`, `build_strength`, `lose_fat`, `improve_fitness`, `sport_conditioning`
- `split_type`: `PPL`, `UL`, `FB`, `PP`
- `meso_status`: `active`, `completed`, `abandoned`
- `progression_type`: `double_progression`, `linear`, `rpe_based`, `wave`, `maintenance` (app currently only uses first two — `rpe_based`, `wave`, `maintenance` are reserved for future programming models)
- `note_target_type`: `exercise`, `training_day`, `workout_session`, `mesocycle` (app uses `workout_session` for session notes and `exercise` for per-exercise notes; `training_day` and `mesocycle` are reserved)

### 4.7 War-room lessons (read before debugging "sync isn't working")

These are the actual root causes of multi-hour rabbit holes. Check them in order before guessing.

**Silent sync failures — the one that cost the most time.** Every upsert returning `{data, error}` without throwing on `error` populated. App logs look clean, UI says synced, Supabase tables are empty. **Always check the actual table row counts in Supabase dashboard, not the app's internal state.** Fixed in `63d8591` by destructuring error and threading through `reportSyncFailure`. If you see this pattern again, it's a new regression.

**Schema mismatch vs paused project.** The first debug session assumed the Supabase project was paused or RLS was broken. Neither was true. The real cause: the app was writing to columns that didn't exist (`data` jsonb on `user_profiles`) while the actual schema was normalized (`name`, `experience`, `primary_goal`, etc.). Every write 400'd silently. **Never trust "the project must be paused" as a first-order hypothesis. Check the actual schema via `information_schema.columns` before writing more SQL.**

**"Disabled" in the Supabase dashboard is Realtime, not project status.** A column showing "Disabled" next to tables in the Table Editor means Realtime subscriptions are off for that table, not that the project is paused. Projects pause separately and have explicit "Restore" buttons in the dashboard header. Don't confuse the two.

**SQL Editor cell pastes prose as SQL.** If a multiline SQL query returns `syntax error at or near "Single"` or similar, you pasted the explanation text into the editor along with the query. Paste only the SQL, nothing else, each query on its own.

**PWA service worker cache is extremely sticky.** After a deploy, phones with the PWA installed keep serving the old bundle indefinitely. "Clear website data" in iOS Safari does NOT reliably unregister the service worker. What works: incognito/private tab (bypasses SW), uninstall home-screen PWA and re-add (nuclear), or remote DevTools via desktop Chrome `chrome://inspect` pointed at the phone. **When telling a user "the fix is deployed," always include the SW kill step or they'll see stale code and assume you lied.**

**PostgREST schema cache can be stale after ALTER TABLE.** Even with `IF NOT EXISTS` statements that succeed, PostgREST can keep serving the old schema and return 400s on newly-added columns. Fix: `NOTIFY pgrst, 'reload schema';` as the last statement in any DDL migration.

**Supabase JS client returns errors, doesn't throw them.** (Repeated intentionally — this is the top source of hidden bugs.) Anywhere you see `await supabase.from(...).<method>(...)` without `{ error }` destructuring + throw, treat it as broken.

**Onboarding uses `'new'`, rest of app uses `'beginner'`.** `OnboardingFlow.tsx` stores `profile.experience = 'new'` for the beginner option, but the rest of the codebase expects `'beginner'`. `appExperienceToEnum` normalizes both to `beginner` at the sync boundary. Don't "fix" one side without updating the mapper.

**FK constraints fail silently through the dirty queue.** A `user_profiles` write with `active_meso_id` pointing to a `mesocycles.id` that doesn't exist yet returns a 409/400 that the dirty queue might swallow as a retry. Solution: always write parent rows first. See the `saveProfile` `.then()` chain.

**Pull must run BEFORE flushDirty on sign-in.** If you flush first, you might push stale local data over fresher remote. The chain is `pullFromSupabase().then(() => flushDirty())` so pull populates local state (marking local-newer keys dirty), then flush only pushes what the pull identified as actually-newer-locally.

**Per-set writes need stable client UUIDs, not auto-generated server UUIDs.** If you let Supabase generate `workout_sets.id`, you have no way to target the same row for updates (weight edit, unconfirm-then-reconfirm). Client-generated UUIDs cached inline in the `sd.id` field are idempotent. Same rule for `training_days`, `training_day_exercises`, `mesocycles`, `workout_sessions`.

**Exercise notes attach to the exercise template, not the weekly instance.** The app stores `foundry:exnotes:d{d}:w{w}[exIdx]` as if notes are per-(week, day, exercise), but in the normalized model they attach to `training_day_exercises.id` which is per-(day, exercise) shared across all weeks. The `pullNotes` helper fans out a single remote note into every week's `foundry:exnotes` key so the existing per-week UI sees identical data. This is a deliberate semantic improvement, not a bug.

**iOS Safari `<input type="date">` ignores `width: 100%`.** It has an intrinsic content width that overflows narrow phones in portrait. Required styles: `WebkitAppearance: 'none'`, `appearance: 'none'`, `minWidth: 0`, `maxWidth: '100%'`. Already applied to `AutoBuilderFlow` and `ManualBuilderFlow` date inputs. Any new date input needs the same treatment.

**Grid children with default `<input>` width need `minWidth: 0`.** Browser inputs have a default min-width (~150px). Inside `gridTemplateColumns: '1fr 1fr 1fr'`, children can't shrink below that without `minWidth: 0`. The exercise card set-logging grid had this exact bug — Weight/Reps/Done columns overflowed on portrait phones until `minWidth: 0` was added.

**`{isDone ? '✓' : '✓'}` is always truthy.** Both ternary branches returning the same value is a silent bug that can burn 30+ minutes. If you intend "show checkmark if done, empty otherwise", write `{isDone ? '✓' : ''}`.

**`information_schema.columns` is your friend.** When a column "doesn't exist" per PostgREST, query `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'x';` to see the actual schema. Don't guess. Don't rely on the dashboard Table Editor view — it can be cached.

**`pg_enum` + `pg_type` for enum values.** When `data_type = 'USER-DEFINED'` on a column, query `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'your_enum_name'::regtype ORDER BY enumsortorder;` to list allowed values. Never hardcode enum strings without verifying.

**Don't drop normalized tables as a "quick fix."** If the schema and app disagree, rewrite the app to match the schema, not the other way around. The normalized schema was designed for paid features that require it.

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

- **Vitest + @testing-library/react**, 243 tests across components and utils (as of 2026-04-04 post-migration).
- Tests live in `src/**/__tests__/*.{test.ts,test.tsx,test.js}`.
- Heavy dependencies (store, data/constants, Supabase client) are mocked via `vi.mock` + `vi.hoisted`.
- The sync test suite (`src/utils/__tests__/sync.test.ts`) has 33 tests covering `remoteIsNewer`, `mergeProfile`, the dirty queue, `flushDirty` (including chunk-specific deferred behavior), and `syncMesocycleToSupabase`. When adding a new chunk or modifying sync logic, update these tests — they're the first line of defense against silent regressions.
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

## 13. Known Rough Edges

### Resolved (during the sync migration marathon)

- ~~**Silent sync failures across every sync helper.**~~ Supabase `.error` field was never inspected; every upsert silently "succeeded" while returning 4xx/5xx. `user_profiles` stayed at 0 rows for weeks while the UI reported sync complete. **Fixed in `63d8591`.** Every upsert now destructures `.error` and throws; failures route through `reportSyncFailure()` → Sentry + throttled toast.

- ~~**`pullFromSupabase` completion race condition.**~~ Pull wrote to localStorage but React state wasn't re-read, so fresh logins showed "no meso" until page reload. **Fixed in `3c1aa09`.** Pull dispatches `foundry:pull-complete` CustomEvent; `useMesoState` listens and refreshes.

- ~~**Pre-auth local work never pushed on sign-in.**~~ Only `pullFromSupabase` ran on SIGNED_IN, leaving dirty keys stranded if created offline. **Fixed in `63d8591`.** `AuthContext` SIGNED_IN now does `pullFromSupabase().then(() => flushDirty())`.

- ~~**Schema mismatch — app wrote to columns that didn't exist.**~~ The Supabase schema was normalized (`user_profiles.name`, `user_profiles.experience`, etc.) but the app was writing `{ id, data: jsonb, updated_at }`. Every write 400'd silently behind the silent-failures bug. **Fixed across chunks 1-5** by migrating the app's sync layer to use the actual normalized columns with proper field mappers (`appProfileToSupabaseRow`, `supabaseRowToAppProfileFields`, etc.).

- ~~**Meso config (splitType, mesoLength, workoutDays, etc.) localStorage-only.**~~ **Fixed in chunk 2 (`35fb5c1`).** Meso fields now sync to `mesocycles` via `syncMesocycleToSupabase` and round-trip through `active_meso_id` FK on `user_profiles`.

- ~~**Training_days, training_day_exercises, workout_sessions, workout_sets all empty.**~~ **Fixed in chunks 3 and 4.** Program structure writes on setup via `ensureTrainingStructureRemote`. Workout sessions create on Begin Workout, complete on Finish. Every set is a per-set upsert debounced 1.5s per stable client UUID.

- ~~**Exercise swap overrides localStorage-only.**~~ **Fixed in chunk 3 (`a68b19c`).** `DayView.handleSwap` fires `syncExerciseSwapRemote` which updates the `training_day_exercises` row. Swaps now round-trip and will carry to other devices.

- ~~**Readiness, body weight log, cardio sessions, notes all localStorage-only.**~~ **Fixed in chunk 5 (`b438455` + `6dc8d59`).** All four tables now round-trip. Notes use polymorphic `note_target_type` with `workout_session` for session notes and `exercise` for per-exercise notes (attached to `training_day_exercises.id`, shared across weeks).

- ~~**Delete-on-uncheck for workout sets.**~~ **Fixed in chunk 4b (`bed4e02`).** Unchecking a confirmed set deletes the remote row rather than leaving stale data.

- ~~**Checkmark ternary bug `{isDone ? '✓' : '✓'}`.**~~ Both branches returned the same glyph, so every set always showed a checkmark regardless of confirmed state. **Fixed.** Use `{isDone ? '✓' : ''}`.

- ~~**iOS Safari date input overflow on narrow phones.**~~ Intrinsic content width ignored `width: 100%`. **Fixed in `AutoBuilderFlow` and `ManualBuilderFlow`** with `WebkitAppearance: 'none'`, `appearance: 'none'`, `minWidth: 0`, `maxWidth: '100%'`.

- ~~**ExerciseCard set-logging grid overflow in portrait.**~~ Default `<input>` min-width prevented columns from shrinking below 150px. **Fixed** by adding `minWidth: 0` + `width: '100%'` + `boxSizing: 'border-box'` to every grid child.

- ~~**Swap button did nothing in the pre-workout-started branch of DayView.**~~ The `<Sheet open={swapTarget !== null}>` was only rendered in the `workoutStarted === true` branch, so tapping Swap before Begin Workout set state but had nowhere to render. **Fixed** by adding the Sheet to both branches.

### Still open

- **`session_prs` not wired.** PR detection logic in `useMesoState.handleComplete` isn't writing to the `session_prs` table. PRs can still be re-derived client-side from `workout_sets`, so no data loss — this is purely an indexing optimization for future queries like "all PRs in last 30 days." ~30-45 min of work. Not urgent.

- **Pre-existing TS narrowing errors in `ExerciseCard.tsx`, `DayView.tsx`, `ExtraDayView.tsx`** around `exercise.sets` being `string | number | undefined`. Code works at runtime. Strict narrowing is a separate cleanup pass.

- **Offline per-set writes fail silently.** Chunk 4a's debounced per-set upserts don't use the dirty queue — if offline when a set is logged, the call fails and the set is not re-attempted when the device comes back online. The local jsonb still has `sd.id` so a subsequent edit would re-fire the upsert, but a set that's never edited again after an offline log stays only-local. Proper offline mode would queue per-set writes. Out of scope for current milestone.

- **Orphaned `workout_sets` after exercise swap.** If a user logs sets for exercise A, then swaps to exercise B, the old `workout_sets` rows still reference the original exercise_id. The pull path silently skips sets whose exercise_id doesn't match any `training_day_exercises` sort_order. Data is retained in the DB (not deleted) but not shown on restore. Follow-up: decide whether to delete orphaned sets or support "swap history" visualization.

- **Service worker cache stickiness after deploys.** iOS Safari PWAs especially. Workaround: incognito tab to verify new deploys; uninstall + reinstall home-screen PWA if cache is stuck. Proper fix: set `VitePWA({ registerType: 'autoUpdate' })` in `vite.config.js` so SWs self-update on navigation. Not yet applied — touch point for whichever session owns the PWA config.

- **Onboarding field-value drift (`'new'` vs `'beginner'`).** `OnboardingFlow.tsx` still stores `experience: 'new'` while the rest of the app uses `'beginner'`. `appExperienceToEnum` normalizes this at the sync boundary so remote data is clean, but local data has both variants coexisting. Follow-up: update OnboardingFlow to store `'beginner'` directly.

---

## 14. Sync Migration Commit Log

A full chronological record of the 2026-04-04 sync migration marathon. Useful for `git blame`-ing specific behaviors or understanding why a particular decision was made.

| Commit | Scope |
|---|---|
| `63d8591` | **Critical fix** — silent sync failures (Supabase `.error` never inspected). Added `reportSyncFailure` helper with throttled toast. `AuthContext` SIGNED_IN chain now does `pullFromSupabase().then(flushDirty)`. |
| `9fa5a31` | Update ARCHITECTURE with the silent-failures fix and related rough-edges changes. |
| `8743e2e` | UI — ExerciseCard third-column header text: "✓" → "Done". |
| `8498305` | **Chunk 1** — profile migrated to normalized `user_profiles` columns. Mapper helpers (`appProfileToSupabaseRow`, `supabaseRowToAppProfileFields`, `appExperienceToEnum`, `appGoalToEnum`, `appSplitToEnum`). `MIGRATED` feature-flag pattern introduced. |
| `35fb5c1` | **Chunk 2** — mesocycles + new `user_profiles` columns (`workout_days`, `session_duration_min`, `active_meso_id` FK). `syncMesocycleToSupabase` with client-generated stable UUIDs. `archiveMesocycleRemote` called from `resetMeso`. Pull path fetches the mesocycle via `active_meso_id` with fallback to most-recent-active. |
| `a68b19c` | **Chunk 3** — training_days + training_day_exercises. `ensureTrainingStructureRemote` runs on setup complete, idempotent check-then-insert. `syncExerciseSwapRemote` wired into `DayView.handleSwap`. `pullTrainingStructure` reconstructs `foundry:storedProgram` from normalized rows + `EXERCISE_DB` metadata join. `parseRepRange` for `"6-10"` → `{min, max}`. `mapProgressionType` for the app's `'weight'`/`'reps'` → `progression_type` enum. Dynamic `import()` to break static circular dep (`sync → program → training → sync`). |
| `ba91f64` | **Chunk 4a** — workout_sessions + workout_sets WRITE path. Per-set upserts debounced 1.5s per stable client UUID. `training_day_id` resolved via `foundry:td_ids:{mesoId}` cache. `foundry:ws_id:d{d}:w{w}` for stable session ids. RPE label encode: `'Easy'` → 7, `'Good'` → 8, `'Hard'` → 9.5. Legacy `syncWorkoutToSupabase` becomes a no-op — per-set writes go direct from DayView. |
| `bed4e02` | **Chunk 4b** — workout_sessions + workout_sets PULL path + delete-on-uncheck. `pullWorkoutHistory` fetches sessions + sets + training_day_exercises, reconstructs `foundry:day{d}:week{w}` jsonb. RPE numeric decode back to label strings. `deleteWorkoutSetRemote` called on uncheck. |
| `b438455` | **Chunks 5a/5b/5c** — body_weight_log, readiness_checkins, cardio_sessions. ALTER TABLE added `sleep`, `soreness`, `energy` columns to `readiness_checkins` so individual components round-trip (not just the computed score). Cardio only syncs when `session.completed === true` (NOT NULL constraints). |
| `6dc8d59` | **Chunk 5d** — notes (polymorphic). Session notes → `note_target_type='workout_session'`; exercise notes → `note_target_type='exercise'` attached to `training_day_exercises.id`. Delete-then-insert idempotency. Exercise notes fan out across weeks on pull. `foundry:tde_ids:{mesoId}` cache populated by chunks 3 write and pull. |

**Test counts:**
- Pre-migration: 239 tests
- Post-migration: 243 tests (4 new for `syncMesocycleToSupabase`)
- Regressed during migration: 0
- Green at every commit in the chain

**Schema migrations run manually in Supabase** (all idempotent, safe to re-run):

```sql
-- Chunk 2: user_profiles new columns
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS workout_days smallint[] NOT NULL DEFAULT '{1,3,5}';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS session_duration_min smallint NOT NULL DEFAULT 60;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS active_meso_id uuid REFERENCES mesocycles(id) ON DELETE SET NULL;

-- Chunk 5b: readiness_checkins component columns
ALTER TABLE readiness_checkins ADD COLUMN IF NOT EXISTS sleep text;
ALTER TABLE readiness_checkins ADD COLUMN IF NOT EXISTS soreness text;
ALTER TABLE readiness_checkins ADD COLUMN IF NOT EXISTS energy text;

-- After any DDL — force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
```
