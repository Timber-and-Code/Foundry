# Claude Code Pickup V2 — Foundry Path to 10/10

**Last updated:** 2026-04-08
**Score:** 9.2 → ~9.7 (after V1 work) → targeting 10/10

---

## ✅ DONE (do not redo)

| Item | Commit | Notes |
|------|--------|-------|
| 6 failing tests fixed | `61405ad` | 248/248 pass — sync mock chain + parseRestSeconds |
| Empty catches annotated | `96e9987` | console.warn for save failures, comments for parse fallbacks |
| localStorage routed through store | `72b2a28` | store.remove + store.keys added; infra files (sync/persistence/archive) intentionally direct |
| window.__foundryPendingCompletion removed | `d9fd832` | Replaced with React ref in DayView |
| DayView partial split | `22aa0f5` | Extracted: CardioPromptModal, UnfinishedPromptModal, NoteReviewSheet, SwapScopeSelector, useWorkoutTimer |
| `:any` narrowing | `bcaa00f` + `22aa0f5` | 0 remaining (only `anyLogged` variable name, not a type annotation) |
| Session duration picker | `bcaa00f` | 30/45/60/75/90m in both AutoBuilder + ManualBuilder |
| Superset partner badge | `bcaa00f` | ExerciseCard shows superset indicator |
| Service Worker | Already existed | VitePWA/Workbox (review incorrectly flagged as missing) |

---

## 🔨 REMAINING WORK

### 1. DayView split — finish extraction (HIGH)
**File:** `src/components/workout/DayView.tsx` (1559 lines → target ~800)

Already extracted: CardioPromptModal, UnfinishedPromptModal, NoteReviewSheet, SwapScopeSelector, useWorkoutTimer

Still need:

- **SwapSheet** → `src/components/workout/SwapSheet.tsx`
  - State: `swapTarget`, `swapPending`, `swapExGroups` memo, `swapMuscle`
  - Logic: `handleSwap()`, `handleCustomExercise()`, `executeSwap()`
  - Render: Sheet + ExercisePicker (appears twice: pre-workout ~L1037-1066, in-workout ~L1471-1499)
  - Also includes SwapScopeSelector render

- **useWorkoutSession** → `src/hooks/useWorkoutSession.ts`
  - Session lifecycle: beginWorkout, completion flow
  - Completion logic: compileSessionNote, handleComplete, openNoteReview, doCompleteWithStats
  - State: showWorkoutModal, workoutStats, completionWeekIdx, pendingCompletionRef, sessionNote, showNoteReview, showUnfinishedPrompt, showCardioPrompt, showEndEarlyConfirm

### 2. Typed event emitter (HIGH)
**Create:** `src/utils/events.ts` (~50 lines)

8 custom events across the codebase — all use untyped `window.dispatchEvent(new CustomEvent(...))`:

| Event | Detail type | Dispatchers | Listeners |
|-------|-------------|-------------|-----------|
| `foundry:sync` | `{ inflight: number }` | sync.ts ×2 | useSyncState.ts ×2 |
| `foundry:toast` | `{ message: string, type: ToastType }` | sync.ts ×2 | ToastContext.tsx |
| `foundry:pull-complete` | none | sync.ts ×2 | useMesoState.ts |
| `foundry:openCardio` | `{ dateStr: string }` | DayView.tsx | App.tsx |
| `foundry:showPricing` | none | SettingsView.tsx | HomeView.tsx |
| `foundry:wants_auth` | none | OnboardingFlow.tsx, SetupPage.tsx | App.tsx |
| `foundry:welcomed` | none | WelcomeScreen.tsx | App.tsx |
| `foundry:resetToSetup` | none | SettingsView.tsx | App.tsx |

**Plan:** Create typed `emit()` and `on()` wrappers. Replace all dispatch/listen sites.

### 3. Cardio history view (MEDIUM)
**Problem:** `loadCardioLog()` in persistence.ts exists but is never called. `loadCardioSession()` / `saveCardioSession()` also exist.
**Plan:** Add a cardio history tab/section in ProgressView (1430 lines) that loads and displays past cardio sessions.

### 4. Zod cleanup (MEDIUM)
**Problem:** `zod` (^4.3.6) is a dependency but `schemas.ts` is imported by **zero** files.
**Plan:** Delete `src/utils/schemas.ts`, remove `zod` from package.json, run `npm install`.

### 5. borderRadius token (LOW)
**Problem:** 19 instances of `borderRadius: '50%'` across 12 files for circular elements.
**Plan:** Add `tokens.radius.full = '50%'` to tokens.ts, replace all 19 instances.

---

## Architecture notes

- **DayView** has two render paths: pre-workout (showMesoOverlay, begin workout button) and in-workout (timer, exercise cards, complete button). Both share swap/completion logic.
- **Swap Sheet** appears in both render paths with slightly different props (pre-workout has `onCustomExercise`, in-workout doesn't).
- **Completion flow**: handleComplete → unfinished check → note review → doCompleteWithStats → WorkoutCompleteModal → cardio prompt → onBack
- **Event bus**: All events flow through `window.dispatchEvent` — no event bus library. Typed wrappers should be a drop-in replacement.
