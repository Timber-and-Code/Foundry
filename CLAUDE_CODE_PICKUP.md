# Claude Code Pickup — Pending Changes

**Date:** April 6, 2026
**Status:** Changes applied in Cowork worktrees but NOT pushed to main. Need to be re-applied in Claude Code.

---

## PRIORITY 1: Verify what's on main

Before doing anything, check current state:
```bash
git log --oneline -5
git status
```

Also check if the 7 UX bug fixes pushed:
```bash
git log --oneline | grep "Fix 7 workout"
```

If that commit exists, the fixes are on main. If not, they need to be re-applied.

---

## 7 Workout UX Bug Fixes (may or may not be on main)

If NOT already pushed, apply these:

### 1. Exercise card missing rep range and rest interval
In ExerciseCard.tsx, add a subtitle line under the exercise name showing `{ex.reps} reps · {ex.rest}`.

### 2. Rest timer uses upper end of range
In helpers.ts, `parseRestSeconds` function — when parsing a range like "60-90", take the LAST number (90), not the first (60). For "3-4 min", take 4 min = 240 sec.

### 3. Rest timer shows M:SS format
In DayView.tsx where the timer countdown renders, format seconds as minutes:seconds. `Math.floor(s/60) + ':' + String(s%60).padStart(2,'0')`

### 4. Rest timer large centered overlay
Replace the small corner timer with a full-screen overlay. Large font (88px) countdown centered, exercise name, dismiss button. Dark overlay background.

### 5. Home card shows MEV-adjusted set count
In HomeTab.tsx where exercise preview renders, use `getWeekSets(ex.sets, weekIdx, getMeso().weeks)` instead of raw `ex.sets`.

### 6. Weight auto-fills from set 1
In ExerciseCard.tsx, when set 0's weight changes (onChange, not blur), propagate the value to all subsequent sets that don't already have a weight.

### 7. Mobility crash fix
In MobilitySessionView.tsx, add optional chaining: `p?.category?.toUpperCase()` instead of `p.category.toUpperCase()`.

---

## NEW FEATURES (not yet implemented)

### End Workout Early Button
- Add "End Workout" button in DayView header (next to Back button)
- On tap: show confirmation dialog "End workout early? Your logged sets will be saved."
- On confirm: save current weekData, navigate back to home
- Use window.confirm() for simplicity or the shared Modal component

### Auto-Advance to Next Exercise
- When the last set of an exercise is marked done (confirmed), auto-expand the next exercise and scroll to it
- In ExerciseCard or DayView, after the final set confirmation, call setExpandedIdx(exIdx + 1) and use scrollIntoView on a ref

---

## Wave 2 Changes (NOT on main — need re-application)

### Toast Notification System (IS on main)
ToastContext.tsx and Toast.tsx were pushed. Already working.

### ExplorePage Split (NOT on main)
Split ExplorePage.tsx (2,111 lines) into:
- ExplorePage.tsx (~240 lines — orchestrator)
- ExerciseBrowser.tsx (~370 lines)
- SamplePrograms.tsx (~330 lines)
- LearnSection.tsx (~310 lines)
- ExerciseDetailModal.tsx (~190 lines)

### Narrow `: any` Annotations (NOT on main)
234 `: any` were replaced with proper types in worktrees but not merged. Target files:
- HomeTab.tsx, ScheduleTab.tsx, ExtraDayView.tsx, DayView.tsx, HomeView.tsx, ExerciseCard.tsx, ExplorePage.tsx, ProgressView.tsx, useMesoState.ts

---

## CRITICAL BUG: Workout Completion Broken

Workouts cannot be completed. The "complete workout" button/action is missing or broken after the React+Vite migration. This means:
- No workout completion state is saved (foundry:done:d{n}:w{n} never set)
- Volume metrics don't fire
- Post-workout quotes/summary don't show
- Cardio suggestions don't appear
- Week/meso progression doesn't advance

Check DayView.tsx for the doComplete/handleComplete flow. Also check if WeekCompleteModal is properly wired. The completion likely broke during one of the component extractions or the React Router migration.

---

## NEW UX FEATURES (not yet implemented)

### Session Duration Picker in Setup
Neither AutoBuilderFlow nor ManualBuilderFlow currently asks the user how long their sessions are. Duration defaults to 60 min silently.

Add a duration picker (30/45/60/75/90 min) to BOTH setup flows, Step 1 (About You section).

Also implement inverse volume scaling in program.ts — fewer exercises should get more sets:
| Duration | Exercises | Sets per Exercise |
|----------|-----------|------------------|
| 30 min   | 3         | 5                |
| 45 min   | 4         | 4-5              |
| 60 min   | 5         | 3-4              |
| 75 min   | 6         | 3-4              |
| 90 min   | 7         | 3                |

In program.ts `toEx()` function, adjust `e.sets` based on `exCount`:
```ts
const baseSets = exCount <= 3 ? 5 : exCount <= 4 ? 4 : (e.sets || 3);
```

### Supersets / Giant Sets UI
The program generation already supports supersets (exercises have a `supersetWith` field linking paired exercises). But there's NO visual indication in the workout UI:
- ExerciseCard doesn't show which exercises are paired
- No "superset" badge or grouping
- No visual connection between paired exercises
- No giant set support (3+ exercises back-to-back)

Need to add:
- Visual pairing indicator in ExerciseCard (e.g., "Superset with: Cable Fly")
- Grouped rendering in DayView so paired exercises appear together
- Rest timer should only start after BOTH exercises in a superset are done

---

## Remaining Path to 10/10

1. Service Worker (offline asset caching)
2. Multi-device sync conflict resolution
3. Color contrast audit
4. Remaining borderRadius → tokens (376 hardcoded values)

---

## Build & Deploy

```bash
cd foundry-app
npm run build    # must run in WSL2
npm test         # vitest
cd ..
git add foundry-app/
git commit -m "description"
git push origin main
# GitHub Actions CI runs, then auto-deploys to GitHub Pages → thefoundry.coach
```

## Preferences
- Don't ask permission, just do it
- Run vitest before every push
- Use grep + targeted reads, not full file reads
