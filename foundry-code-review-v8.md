# Foundry Code Review v8 — 2026-04-08

**Version:** 2.1.0 | **Reviewer:** Claude Opus 4.6 | **Scope:** Full codebase + feature audit + cardio deep dive + health platform integration plan

---

## Overall Score: 9.2 / 10

| Category | v7 | v8 | Delta | Notes |
|---|---|---|---|---|
| Architecture | 9.0 | 9.0 | — | Solid; mega-components remain the ceiling |
| Code Quality (TS) | 9.3 | 9.1 | -0.2 | 71 `:any` remain; `window.__foundryPendingCompletion` hack |
| State Management | 9.5 | 9.4 | -0.1 | CustomEvent bus growing; `window` object abuse |
| Data Model & Validation | 9.0 | 9.0 | — | Validators solid; some `as unknown as` casts |
| Component Design | 9.2 | 9.0 | -0.2 | DayView 1840 LOC, ExtraDayView 1418 LOC still monolithic |
| Performance | 9.2 | 9.0 | -0.2 | `index.js` 484KB gzipped 147KB; sync.ts not code-split |
| Error Handling | 9.3 | 9.0 | -0.3 | 30+ empty `catch {}` blocks across codebase |
| Testing | 9.2 | 8.8 | -0.4 | 4 tests failing (sync chunk 2); 244/248 pass |
| Build & Deploy | 9.3 | 9.3 | — | CI green; Capacitor configured |
| Security | 9.0 | 9.0 | — | No XSS vectors; RLS in place |
| Dependencies | 9.5 | 9.5 | — | Clean; zod v4 added |
| Accessibility | 9.0 | 9.2 | +0.2 | Focus-visible, skip link, all onClick on buttons |
| Design System | 9.5 | 9.5 | — | Tokens well-used; CSS vars consistent |

**Why v8 < v7 (9.2 vs 9.4):** v7 scored optimistically for in-flight worktree work. v8 scores the *shipped* state. Four sync tests are failing, 30+ empty catches were introduced with recent features, and the `window.__foundryPendingCompletion` pattern in DayView is a regression in code quality. The app is excellent — this is honest calibration.

---

## Phase 1: Deep Code Review

### Score Trajectory (v4 → v8)

| Version | Date | Score | Key Change |
|---|---|---|---|
| v4 | 2026-04-02 | 7.8 | Baseline |
| v5 | 2026-04-03 | 8.6 | +strict TS, +a11y, +CI started |
| v6 | 2026-04-04 | 9.3 | +CI shipped, +component tests, +design tokens |
| v7 | 2026-04-06 | 9.4 | +progression UI, +all 9 regressions fixed |
| v8 | 2026-04-08 | 9.2 | Honest recalibration; new features added tech debt |

### Critical Issues

#### 1. Failing Tests (sync.test.ts)
```
Tests: 4 failed | 244 passed (248)
- syncMesocycleToSupabase: mockUpsert never called (×2)
```
**Location:** `src/utils/__tests__/sync.test.ts:382, :408`
**Root cause:** Likely the sync function's guard clauses (MIGRATED flags, auth check) prevent the mock from being reached. Tests haven't kept up with sync.ts refactors.
**Fix:** Update mock setup to satisfy all guard conditions.

#### 2. `window.__foundryPendingCompletion` Hack
**Location:** `src/components/workout/DayView.tsx:1744-1746`
```typescript
const pendingData = (window as unknown as Record<string, unknown>).__foundryPendingCompletion;
delete (window as unknown as Record<string, unknown>).__foundryPendingCompletion;
```
**Problem:** Using the global `window` object as a data bus between the workout completion modal and the onComplete callback. This is fragile, untestable, and creates invisible coupling.
**Fix:** Pass completion data through component state or a callback ref.

#### 3. 30+ Empty `catch {}` Blocks
Across these files:
| File | Count |
|---|---|
| `useMesoState.ts` | 5 |
| `ExtraDayView.tsx` | 5 |
| `sync.ts` | 5 |
| `SetupPage.tsx` | 3 |
| `ExerciseCard.tsx` | 3 |
| `RestTimerContext.tsx` | 2 |
| Others | 7+ |

**Impact:** Silent failures. If localStorage quota is exceeded, sync fails, or JSON parsing breaks, the user gets no feedback and debugging is impossible.
**Recommended:** At minimum `console.warn` in dev; for sync failures, use the existing ToastContext.

### High-Priority Issues

#### 4. Bundle Size — `index.js` at 484KB (147KB gzipped)
```
dist/assets/index-Bf9o5skm.js         484.33 kB │ gzip: 147.31 kB
dist/assets/data-exercises-B3HyIpjT.js 241.15 kB │ gzip:  54.72 kB
dist/assets/HomeView-5SzWGkOt.js       108.41 kB │ gzip:  24.80 kB
```
**Analysis:** `sync.ts` (2403 lines), `program.ts` (745 lines), `constants.ts` (1040 lines), and `training.ts` (460 lines) are all in the main chunk. `sync.ts` alone could be lazy-imported since it's only needed after auth.
**Recommendation:**
- Lazy-import `sync.ts` — only load when user authenticates
- `data-exercises.js` (241KB) is already code-split — good
- Consider lazy-loading `program.ts` (only needed during meso generation)

#### 5. Mega-Component Files
| File | Lines | Concern |
|---|---|---|
| `DayView.tsx` | 1,840 | Workout logic, swap UI, cardio prompt, friend modal, completion flow |
| `ProgressView.tsx` | 1,430 | Charts, sparklines, calculations all inline |
| `ExtraDayView.tsx` | 1,418 | Near-copy of DayView patterns |
| `ExerciseCard.tsx` | 1,256 | History, warmup, sets, notes, swap, progression — all in one |
| `ManualBuilderFlow.tsx` | 1,248 | Multi-step wizard |
| `SetupPage.tsx` | 1,152 | Orchestration of builder flows |

**Impact:** Hard to test, hard to review, high merge-conflict risk. ExtraDayView duplicates significant DayView logic.
**Recommendation:** Extract from DayView: `SwapSheet`, `CardioPromptModal`, `UnfinishedPromptModal`, `CompletionFlow`. Extract shared workout logic between DayView and ExtraDayView into a custom hook.

#### 6. Direct localStorage Access (193 occurrences across 21 files)
**Convention violation:** `CLAUDE.md` states "store.ts barrel is the only place that should read/write localStorage."
**Worst offenders:**
- `App.tsx` — 4 direct calls (including `localStorage.removeItem`)
- `SettingsView.tsx` — 5 direct calls
- `sync.ts` — 33 direct calls (many via `localStorage.setItem` for done flags, session IDs)
- `persistence.ts` — 10 direct calls

**Recommendation:** Route through `store` for consistency and to maintain the dirty-key tracking system. The sync.ts calls that bypass `store.set()` also bypass the dirty queue, which means those keys won't get pushed on next flush.

#### 7. Type Safety — 71 `:any` / `as any` Remaining
**By file (top offenders):**
| File | Count |
|---|---|
| `MobilitySessionView.tsx` | 6 |
| `program.ts` | 6 |
| `SettingsView.tsx` | 5 |
| `ManualBuilderFlow.tsx` | 5 |
| `EditScheduleSheet.tsx` | 5 |
| `RestDaySheet.tsx` | 5 |
| `ReadinessCard.tsx` | 4 |
| `OnboardingFlow.tsx` | 4 |
| `CardioSetupFlow.tsx` | 4 |

**Notable:** `program.ts:44` uses `(profile as any).dayMuscleConfig` — the `Profile` type doesn't include `dayMuscleConfig`, suggesting a type definition gap.

### Medium-Priority Issues

#### 8. CustomEvent Bus Growing
The app uses `window.dispatchEvent(new CustomEvent(...))` for:
- `foundry:openCardio` — navigate to cardio
- `foundry:resetToSetup` — delete meso
- `foundry:welcomed` — welcome screen done
- `foundry:wants_auth` — auth gate
- `foundry:showPricing` — open pricing
- `foundry:pull-complete` — sync finished

**Risk:** No type safety on event payloads, no discoverability, events fire-and-forget with no guarantee of a listener. As the list grows, this becomes an invisible dependency graph.
**Recommendation:** Consider a lightweight typed event emitter, or consolidate into context/state.

#### 9. ExtraDayView Duplication
`ExtraDayView.tsx` (1418 lines) reimplements much of `DayView.tsx` (1840 lines) — exercise rendering, set logging, notes, swap picker. Changes to DayView's workout flow must be manually mirrored.
**Recommendation:** Extract shared workout session logic into a `useWorkoutSession` hook.

#### 10. Zod Added but Not Used
`zod` v4 is in dependencies but only `schemas.ts` (46 lines) exists. The existing validators in `validate.ts` use manual checks.
**Recommendation:** Either migrate validators to zod schemas or remove the dependency to reduce bundle size.

### What Improved Since v7

- **Capacitor config** fully set up (iOS + Android) with splash screen, status bar, keyboard handling
- **Skip link** added for accessibility (`App.tsx:324`)
- **Code splitting** with React.lazy for all route components
- **ErrorBoundary** comprehensive (235 lines, Sentry integration, recovery UI)
- **PWA** with Workbox precaching (40 entries, 8.8MB)

---

## Phase 2: Feature Audit vs Competitors

### Competitive Comparison Matrix

| Feature | Strong | Hevy | JEFIT | RP Hypertrophy | Foundry |
|---|---|---|---|---|---|
| Custom exercises | Yes | Yes | Yes | No | **Yes** |
| Meso/periodization | No | No | Partial | **Yes** | **Yes** |
| Auto-progression | No | No | No | **Yes** | **Yes** |
| RPE/RIR tracking | Yes | Yes | Partial | **Yes** | **Yes** |
| Fatigue / deload | No | No | No | **Yes** | **Yes** |
| Templates / sharing | Yes | Yes | Yes | No | Partial |
| Social features | Partial | **Yes** | Yes | No | **Yes** (Train with Friends) |
| Health platform sync | **Yes** | **Yes** | **Yes** | Yes | **No** |
| Cardio tracking | Partial | Partial | Yes | No | **Yes** |
| Mobility protocols | No | No | Partial | No | **Yes** |
| Body measurements / photos | Yes | Yes | Yes | Yes | **No** |
| Analytics / charts | **Yes** | Yes | Yes | Partial | **Partial** |
| Rest timer | Yes | Yes | Yes | Yes | **Yes** |
| Plate calculator | Yes | No | No | No | **No** |
| Offline support | Yes | Yes | Partial | Yes | **Yes** |
| Data export | Yes | Yes | Partial | No | **Partial** (JSON) |
| Dark mode | Yes | Yes | Yes | Yes | **Yes** |
| Watch companion | Yes | Yes | Partial | No | **No** |
| Video exercise demos | No | Yes | **Yes** | Yes | **Yes** (312 YouTube links) |

### Pricing Context

| App | Model |
|---|---|
| Strong | Free (3 routines), $4.99/mo or $79.99 lifetime |
| Hevy | Free (limited), $9.99/mo or $49.99/yr |
| JEFIT | Free (ads), $6.99/mo or $39.99/yr |
| RP Hypertrophy | $14.99/mo, no free tier |
| **Foundry** | **Free** (paid tier planned for coaching + social) |

### Foundry's Unique Differentiators

1. **All-in-one periodization + fatigue + auto-progression** — free, where RP charges $15/mo
2. **Cardio AND mobility protocols** integrated into meso planning — no competitor does this
3. **Offline-first PWA** — no app store gatekeeping, works on any device
4. **Train with Friends** with shared meso context (not just a social feed)
5. **Custom exercises inside periodized plans** — RP locks you to their list

### Table-Stakes Gaps (Must Fix)

1. **Health platform sync** (Apple Health / Health Connect) — every competitor has it
2. **Body measurements & progress photos** — expected by all switchers
3. **Analytics dashboard** (volume charts, 1RM trends, muscle group balance) — Strong/Hevy set the bar
4. **CSV data export** — power user expectation, portability signal
5. ~~Video exercise demos~~ — **ALREADY HAVE** (312 exercises with YouTube "Watch Form" links in ExerciseCard + ExerciseDetailModal)

### Top 5 Features to Add (Impact vs Effort)

| # | Feature | Effort | Impact | Why |
|---|---|---|---|---|
| 1 | **Analytics dashboard** | Medium | Very High | #1 retention driver; visual progress = motivation |
| 2 | **Health Connect / Apple Health** | Medium | High | Table-stakes for credibility; blocks adoption |
| 3 | **Progress photos + body measurements** | Low-Med | High | Low effort, high emotional engagement |
| 4 | **CSV/JSON export** | Low | Medium | Trust signal; removes "can I leave?" friction |
| 5 | ~~Exercise video demos~~ | — | — | **Already shipped** — 312 YouTube links across exercise DB |

---

## Phase 3: Cardio Deep Dive

### End-to-End Flow

```
┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐
│  Setup      │───>│  Session         │───>│  Completion       │
│  (Schedule  │    │  (CardioSession  │    │  (Auto-duration,  │
│   or ad-hoc)│    │   View.tsx)      │    │   save, sync)     │
└─────────────┘    └──────────────────┘    └───────────────────┘
       │                    │                       │
       v                    v                       v
  CardioSetupFlow    CARDIO_WORKOUTS         localStorage
  (profile.cardio    (7 protocols w/          foundry:cardio:
   Schedule)         intervals, goals)        session:YYYY-MM-DD
                                                    │
                                                    v
                                              Supabase sync
                                              (cardio_sessions)
```

### How It Works

1. **Setup:** Users schedule cardio days via `CardioSetupFlow` during meso creation, or tap "Log Cardio" ad-hoc from HomeTab or after completing a lifting session (DayView's post-workout prompt).

2. **Session:** `CardioSessionView.tsx` (934 lines) presents protocol selection filtered by user goal, with categories (Endurance, Performance, etc.). Selecting a protocol pre-fills type, duration, and intensity. An elapsed timer starts on "Start" and auto-calculates duration on completion.

3. **Interval Timer:** HIIT protocols trigger `CardioIntervalTimer.tsx` (425 lines) with work/rest phase management, circular progress ring, haptic feedback, and minimize-to-bar support.

4. **Persistence:** `saveCardioSession(dateStr, data)` writes to `foundry:cardio:session:YYYY-MM-DD` and triggers `syncCardioSessionToSupabase()`.

5. **Display:** HomeTab shows "CARDIO TODAY" / "CARDIO DONE" status. ScheduleTab shows dot indicators.

### Issues Found

#### Critical

1. **No Cardio History View**
   - `loadCardioLog()` exists in persistence.js but is **never called**
   - Users cannot view past cardio sessions or trends
   - Only today's session is accessible from the UI
   - **Recommendation:** Add a cardio history section to ProgressView/ProgressTab

2. **Session Overwrite on Same Day**
   - Only one session per date (key: `foundry:cardio:session:YYYY-MM-DD`)
   - Second cardio session on same day silently overwrites the first
   - **Recommendation:** Use array storage or append with timestamp suffix

#### High

3. **No Pause/Resume for Sessions**
   - Once started, the timer runs until completion
   - No way to pause mid-session (e.g., phone call, bathroom)
   - Interval timer has no pause either
   - **Recommendation:** Add pause state with elapsed tracking

4. **Auto-Duration Range Silently Fails**
   - Range limit `1-300 min` drops duration for ultra-endurance (e.g., multi-hour hike)
   - No user feedback when auto-fill is rejected
   - **Recommendation:** Raise cap or show toast

5. **Sync Errors Silent**
   - `syncCardioSessionToSupabase()` catches errors with only `console.warn`
   - User unaware of failed sync
   - **Recommendation:** Use ToastContext or dirty-queue retry

#### Medium

6. **Missing TypeScript Interfaces for Cardio Data**
   - `persistence.js` is plain JavaScript while `sync.ts` is TypeScript
   - `CardioSession` type exists in `types/index.ts` but isn't enforced in persistence layer
   - **Recommendation:** Convert persistence.js to TypeScript

7. **Protocol Discovery**
   - 4 category accordions + recommended zone = 10+ visible buttons
   - No search/filter for protocols
   - **Recommendation:** Add search or collapse to 1-tap selection

8. **No Strength → Cardio Chaining**
   - Post-workout cardio prompt navigates away to cardio route
   - Can't chain cardio within the same session flow
   - **Recommendation:** Consider inline cardio logging on workout completion

### What Competing Apps Do Better

| Feature | Strong/Hevy | Foundry |
|---|---|---|
| Cardio history | Full timeline with trends | None (today only) |
| Session types | Walk, run, bike, swim, row, etc. | 7 protocols with limited types |
| GPS tracking | Yes (run/bike) | No |
| Heart rate integration | Yes (via Health platform) | No |
| Mixed lifting+cardio | Same session | Separate routes |
| Pause/resume | Yes | No |
| Calories estimate | Auto from HR/weight | Manual or absent |

### Recommendations

1. **Quick win:** Wire up `loadCardioLog()` → display in ProgressView (existing code, just needs UI)
2. **Medium effort:** Add pause/resume to session timer and interval timer
3. **Larger scope:** Integrate with Health platform for heart rate + calorie estimation (see Phase 4)
4. **Architectural:** Consider merging the cardio session into the workout flow rather than a separate route — users who do cardio after lifting shouldn't lose context

---

## Phase 4: Apple Health + Google Health Connect Integration Plan

### Current State

Foundry is already configured for native deployment:
- Capacitor 6 with iOS + Android targets (`capacitor.config.json`)
- `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/splash-screen`, `@capacitor/status-bar` installed
- App ID: `com.thefoundry.app`
- Build scripts: `build:ios`, `build:android`, `cap:sync`

**No health plugins installed yet.** This is a greenfield integration.

### Data Mapping

#### What Foundry Should WRITE

| Foundry Data | Apple HealthKit | Google Health Connect |
|---|---|---|
| Lifting session | `HKWorkout` (`.traditionalStrengthTraining`) | `ExerciseSessionRecord` (`STRENGTH_TRAINING`) |
| Session duration | Workout `.duration` | Session `.startTime` / `.endTime` |
| Active calories (est.) | `HKQuantity` `.activeEnergyBurned` | `TotalCaloriesBurnedRecord` |
| Body weight (from profile) | `HKQuantity` `.bodyMass` | `WeightRecord` |
| Cardio session | `HKWorkout` (type by activity) | `ExerciseSessionRecord` (type by activity) |
| Per-set detail | Metadata only (not standard) | `ExerciseRepetitions` + resistance weight |

**Key insight:** Google Health Connect is *far richer* for lifting data — it natively supports per-set reps and weight. HealthKit only records session-level summaries. This means the Android integration can be more detailed than iOS.

#### What Foundry Should READ

| Health Data | Use in Foundry | Priority |
|---|---|---|
| Body weight | Auto-fill profile weight, trend chart | **MVP** |
| Resting heart rate | Readiness score enhancement | Phase 2 |
| Sleep duration/quality | Readiness score enhancement | Phase 2 |
| Active energy | Recovery load estimation | Phase 3 |

### Plugin Recommendation

**Primary:** `@capgo/capacitor-health` — cross-platform (HealthKit on iOS, Health Connect on Android), actively maintained, Capacitor 6 compatible.

**Alternative:** `@perfood/capacitor-healthkit` (iOS-only, v2 alpha) or `@flomentumsolutions/capacitor-health-extended` (more data types, Capacitor 8).

### Architecture

```typescript
// src/services/health/HealthService.ts
interface HealthService {
  isAvailable(): Promise<boolean>;
  requestPermissions(scopes: HealthScope[]): Promise<PermissionResult>;
  writeWorkout(session: FoundryWorkoutSummary): Promise<void>;
  writeCardio(session: FoundryCardioSummary): Promise<void>;
  readBodyWeight(since: Date): Promise<WeightEntry[]>;
  readRestingHR(since: Date): Promise<HREntry[]>;
  readSleep(since: Date): Promise<SleepEntry[]>;
}

// Platform implementations
class CapacitorHealthService implements HealthService {
  // Uses @capgo/capacitor-health under the hood
  // Handles HealthKit vs Health Connect differences internally
}

class NoOpHealthService implements HealthService {
  // Returns empty results, no-ops all writes
  // Used when running as PWA in browser
}

// Factory
function createHealthService(): HealthService {
  if (Capacitor.isNativePlatform()) {
    return new CapacitorHealthService();
  }
  return new NoOpHealthService();
}
```

### Sync Strategy

```
                    ┌─────────────────────────┐
                    │  Workout Complete        │
                    │  (DayView.doComplete)    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────v────────────┐
                    │  Queue Health Write      │
                    │  foundry:health_queue    │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────v──────┐  ┌───────v────────┐  ┌──────v───────┐
    │ Immediate Push │  │ App Resume     │  │ Background   │
    │ (if available) │  │ Flush Queue    │  │ (iOS only)   │
    └────────────────┘  └────────────────┘  └──────────────┘
```

**Write timing:**
- **Primary:** Immediately after workout/cardio completion (inside `doComplete()` / `handleComplete()`)
- **Fallback:** On app resume (`appStateChange` listener), flush any queued writes

**Read timing:**
- On app foreground: pull body weight, resting HR, sleep from last 7 days
- Use pulled body weight to update profile if newer than local value

**Offline queueing:**
- Mirror Foundry's existing dirty-key pattern: `foundry:health_queue` stores pending writes as JSON array
- On each resume, attempt to flush
- Drop after 3 retries (stale data isn't useful in health platforms)

### Permission UX Flow

```
┌──────────────────────┐
│  First Workout       │
│  Completion          │
├──────────────────────┤
│  "Sync to Health?"   │
│  [Connect]  [Skip]   │
└──────────┬───────────┘
           │ Connect
┌──────────v───────────┐
│  System Permission   │
│  Dialog (iOS/Android)│
│  ┌─ Workouts    ☑   │
│  ├─ Body Weight  ☑   │
│  ├─ Heart Rate   ☑   │
│  └─ Sleep        ☑   │
└──────────┬───────────┘
           │
┌──────────v───────────┐
│  Settings toggle:    │
│  "Health Sync: ON"   │
│  Manage permissions  │
└──────────────────────┘
```

### Platform-Specific Gotchas

#### iOS (HealthKit)
- **Cannot check read permission status** — Apple's privacy model returns empty data instead of "denied"
- **Background delivery** requires entitlement + `HKObserverQuery` registration in Swift — `@capgo/capacitor-health` does NOT expose this yet; need native bridge (~50 LOC Swift)
- **Minimum iOS 13** for basics, **iOS 15+** for background delivery
- Per-set lifting data can only be stored as workout metadata — no third-party app reads it

#### Android (Health Connect)
- **No background observer** — must poll on app resume
- **Health Connect app** required on Android 9-13; built-in on Android 14+
- **Play Store declaration form** required for each health permission
- **Richer lifting data** — `ExerciseRepetitions` supports per-set reps + resistance weight natively
- `allowMixedContent: true` in capacitor.config.json should be reviewed for security

### MVP Scope (~2 weeks)

| Task | Effort | Description |
|---|---|---|
| Install `@capgo/capacitor-health` | 1 day | npm install, cap sync, add permissions to manifests |
| `HealthService` interface + implementations | 2 days | Abstraction layer, NoOp fallback, factory |
| Write workout sessions | 2 days | Hook into `doComplete()`, map Foundry data to HK/HC format |
| Write cardio sessions | 1 day | Hook into cardio `handleComplete()` |
| Read body weight | 1 day | Pull on resume, offer to update profile |
| Permission UX | 1 day | First-workout prompt, settings toggle |
| Offline queue | 1 day | `foundry:health_queue` with flush on resume |
| Testing | 2 days | Manual testing on iOS simulator + Android emulator |

**Total MVP: ~10-12 dev days**

### Full Integration (Phase 2+)

| Feature | Effort | Dependency |
|---|---|---|
| Read resting HR + sleep → readiness score | 3 days | ReadinessCard UI update |
| Per-set detail on Android (Health Connect) | 2 days | `ExerciseRepetitions` mapping |
| Body weight trend chart (from health data) | 2 days | ProgressView update |
| Background delivery on iOS | 3 days | Native Swift plugin bridge |
| Backfill historical Foundry data to health platforms | 2 days | Archive iteration |
| Training Plans API (Android, experimental) | 3 days | Google API approval |

---

## Summary: What Blocks 10/10

### Already Done (v7 → v8 status)
- [x] CI/CD pipeline
- [x] All 9 regressions fixed
- [x] Progression UI shipped
- [x] Custom exercises
- [x] Capacitor native config
- [x] Train with Friends
- [x] WCAG focus-visible + skip link
- [x] Workbox PWA caching

### Remaining (~0.8 to go)

| Item | Impact | Effort | Score Delta |
|---|---|---|---|
| Fix 4 failing sync tests | Reliability | Low | +0.1 |
| Remove `window.__foundryPendingCompletion` hack | Code quality | Low | +0.05 |
| Replace 30+ empty `catch {}` with proper handling | Error handling | Medium | +0.15 |
| Route all localStorage through `store` | Consistency | Medium | +0.1 |
| Split DayView into sub-components | Maintainability | Medium | +0.1 |
| Lazy-import sync.ts (save ~100KB from main chunk) | Performance | Low | +0.1 |
| Narrow remaining 71 `:any` types | Type safety | Medium | +0.1 |
| Cardio history view | Feature completeness | Medium | +0.1 |
| Health platform integration (MVP) | Feature gap | High | +0.1 |

**Projected path:** Ship the low-effort items (failing tests, window hack, lazy sync) → 9.5. Add error handling + localStorage routing → 9.7. Component splitting + health integration → 10.0.

---

*Generated by Claude Opus 4.6 — 2026-04-08*
