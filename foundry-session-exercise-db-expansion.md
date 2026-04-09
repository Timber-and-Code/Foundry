# THE FOUNDRY — Session Summary: Exercise Database Expansion & ExercisePicker UI
**Date:** April 3, 2026
**Session scope:** Exercise database audit, 47 new exercises, accordion-based ExercisePicker component, exercise swap feature, UI fixes

---

## What Was Done This Session

### 1. Exercise Database Audit & Review

Conducted a full audit of the existing exercise database (`src/data/exercises.js`) organized by muscle group. Researched well-established exercises from reputable sources (ACE, NASM, NSCA, Jeff Nippard, Renaissance Periodization, John Meadows, Bret Contreras, Jeff Cavaliere, KneesOverToesGuy) and identified gaps.

**Key findings:**
- Adductors had only 1 exercise (Machine Adductor)
- Traps had only 4 exercises, with no lower/mid trap work
- Lats had only 3 exercises (all standard pulldown variations)
- Core was over-represented at 40+ exercises
- Several widely-used "coach-named" variations were missing (Pendlay Row, Meadows Row, Seal Row)

Full review document saved to: `exercise-database-review.md`

---

### 2. Exercise Database Expansion — 47 New Exercises Added

**File modified:** `src/data/exercises.js`

All exercises follow the existing schema with full objects: id, videoUrl (YouTube search links), name, muscle, muscles, tag, splits, equipment, pattern, fatigue, anchor, diff, sets, reps, rest, warmup, and detailed form descriptions.

| Muscle Group | Exercises Added | Names |
|-------------|----------------|-------|
| **Chest** (3) | Decline Barbell Bench Press, Svend Press, Resistance Band Push-up |
| **Shoulders** (3) | Cable Rear Delt Fly, Lu Raise, Plate Front Raise |
| **Triceps** (4) | DB Tricep Kickback, Single Arm Cable Overhead Tricep Ext., Bench Dips, Reverse Grip Cable Pushdown |
| **Back** (4) | Chest-Supported DB Row, Pendlay Row, Meadows Row, Seal Row |
| **Lats** (4) | Lat Pulldown (close/V-grip), Single Arm Lat Pulldown, Lat Pulldown (reverse grip), Half-Kneeling Single Arm Cable Pulldown |
| **Biceps** (4) | Zottman Curl, Drag Curl, Cable Bayesian Curl, Preacher Curl (DB) |
| **Traps** (5) | Trap Bar Shrug, Cable Shrug, Prone Y-Raise, Overhead Shrug, Power Shrug |
| **Quads** (5) | Barbell Walking Lunges, Barbell Split Squat, Reverse Nordic Curl, Cyclist Squat, Wall Sit |
| **Hamstrings** (3) | Swiss Ball Hamstring Curl, Seated Good Morning, Single Leg Machine Leg Curl |
| **Glutes** (3) | Frog Pump, Lateral Band Walk, Banded Clamshell |
| **Adductors** (5) | Copenhagen Plank, Cable Hip Adduction, Cossack Squat, Lateral Lunge (DB), DB Sumo Squat |
| **Calves** (3) | Donkey Calf Raise, Smith Machine Calf Raise, Barbell Calf Raise |
| **Core** (1) | Hanging Knee Raise |

**Database totals:** ~187 exercises -> ~234 exercises

---

### 3. ExercisePicker Component — New Accordion-Based UI

**New file:** `src/components/ui/ExercisePicker.tsx` (~300 LOC, 6KB bundled)

Replaced the flat pill-button grid in ManualBuilderFlow with a reusable accordion-based exercise picker. Designed collaboratively with the user through multiple rounds of Q&A to lock in the UX spec.

**Features:**
| Feature | Detail |
|---------|--------|
| **Search bar** | Sticky at top, filters exercises across all muscle groups. Matching groups auto-expand, empty groups hide. Clear button to reset. |
| **Selected strip** | Shows current selections as pills with "x" remove button. Hammer icon on anchor (first exercise). Drag-to-reorder via native pointer events (no external dependency). |
| **Accordion groups** | Each muscle group is a collapsible section with chevron indicator. Only one group open at a time (auto-close). All collapsed by default. |
| **Badge counts** | Each group header shows the number of selected exercises + accent dot when > 0. |
| **Equipment graying** | Exercises that don't match the user's equipment profile render at 45% opacity with muted text, but remain tappable (no hard block). |
| **Drag-to-reorder** | Pointer-based reorder on the selected strip. Dragged pill scales up with shadow. Drop target highlighted with accent border. Works on touch and mouse. No external library needed. |

**Props interface:**
```typescript
interface ExercisePickerProps {
  exercises: Record<string, ExerciseItem[]>;  // grouped by muscle
  selected: string[];                          // ordered exercise IDs
  onToggle: (exId: string) => void;           // add/remove
  onReorder: (newOrder: string[]) => void;    // drag reorder
  userEquipment?: string[];                    // for graying
  autoExpandMuscle?: string;                   // auto-open group (for swap)
  accent?: string;                             // color override
}
```

---

### 4. ManualBuilderFlow Integration

**File modified:** `src/components/setup/ManualBuilderFlow.tsx`

- Replaced ~120 lines of flat pill grid rendering (old ORDER strip + exercise group buttons) with a single `<ExercisePicker>` component
- Passes `form.equipment` for equipment-aware graying
- Passes `dayExercises[dayIdx]` for selection state
- Wires `toggleExercise` and `setDayExercises` for toggle/reorder callbacks

---

### 5. Exercise Swap Feature — Fully Wired

**File modified:** `src/components/workout/DayView.tsx`

The swap feature was previously scaffolded but not connected (state declared, button present, no modal). This session completed the implementation:

- **Swap state** — `swapTarget` state changed from write-only (`[, setSwapTarget]`) to readable
- **Swap groups** — `useMemo` builds exercise groups filtered by the current day's tag (PUSH/PULL/LEGS/UPPER/LOWER/FULL)
- **Swap handler** — Uses existing `saveExOverride()` to persist the swap for the rest of the mesocycle via the `foundry:exov:` localStorage key pattern
- **Swap UI** — Renders a `<Sheet>` bottom-sheet containing `<ExercisePicker>` when user taps "Swap" on any exercise card
- **Auto-expand** — The muscle group of the exercise being swapped auto-expands in the picker
- **Swap header** — Shows "Swap Exercise" title and "Replacing: [exercise name]" subtitle

**New imports added:** `Sheet`, `ExercisePicker`, `saveExOverride`, `useMemo`

---

### 6. Count Badge Readability Fix

**File modified:** `src/components/setup/ManualBuilderFlow.tsx`

The "X selected — min 3" badge in the ManualBuilderFlow day headers was hard to read when below minimum (red text on faint red background).

**Before:**
- Background: `rgba(var(--danger-rgb,220,38,38),0.1)` — broken CSS variable fallback, nearly invisible
- Text: `var(--danger)` (#f44336) — dark red on dark background

**After:**
- Background: `rgba(220,38,38,0.25)` — hardcoded, stronger 25% opacity
- Text: `#fca5a5` — light salmon/pink, much better contrast against dark card

---

## Files Changed

| File | Action | Lines Changed |
|------|--------|--------------|
| `src/data/exercises.js` | Modified | +~1,200 (47 exercise objects) |
| `src/components/ui/ExercisePicker.tsx` | **Created** | ~300 LOC |
| `src/components/setup/ManualBuilderFlow.tsx` | Modified | -120 / +15 (replaced pills with ExercisePicker, fixed badge) |
| `src/components/workout/DayView.tsx` | Modified | +60 (swap feature wired, Sheet + ExercisePicker integrated) |
| `exercise-database-review.md` | **Created** | Full audit document with current vs. proposed exercises |

---

## Design Decisions Made (via collaborative Q&A)

1. **Accordion auto-close** — only one muscle group open at a time (cleaner UX on mobile)
2. **Search bar** — filters across all groups; matching groups auto-expand, empty groups hide
3. **Swap modal** — shows ALL exercises (not just same muscle group) but auto-expands the relevant group
4. **Equipment mismatch** — grayed out at 45% opacity, still tappable (no hard block)
5. **Default state** — all groups collapsed on load
6. **Deselect** — "x" button on each pill in the selected strip (not tap-to-remove, to prevent accidental removals)
7. **Reorder** — drag-to-reorder in the selected strip via native pointer events (no dependency added)
8. **Swap persistence** — uses `saveExOverride` with 'meso' scope so the swap applies for the rest of the mesocycle

---

## Build Verification

- `npm run build` passes cleanly
- `ExercisePicker` bundles as its own 6KB chunk
- `data-exercises` chunk grew from ~200KB to ~241KB with the 47 new exercises
- No TypeScript or compilation errors
- Chunk size warning on `index` (522KB) is pre-existing, not introduced by this session

---

## What's Next

- **Test the accordion** — hard refresh (Ctrl+Shift+R) to bust any cached builds
- **Test the swap feature** — start a workout, tap Swap on any exercise, verify the Sheet opens with the accordion picker
- **Test drag reorder** — in ManualBuilderFlow, select exercises, then hold and drag pills in the selected strip to reorder
- **User feedback** — review exercise descriptions and suggest adjustments if any form cues need refinement
