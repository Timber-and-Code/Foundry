# 2.8.0 build 1 — release notes

## Short (paste-ready for TestFlight "What to Test")

Build 1 of 2.8.0 — supersets, history modal, cardio Designer, and a long fix list.

**New big things:**
- Supersets: pair any two exercises from the workout. Round-grouped layout (A's set + B's set per round), interleaved rest timer fires only after each round closes, set counts auto-equalize.
- Workout history modal: tap "LAST WK" on any exercise to see the full week-by-week breakdown of that exercise across the meso.
- Cardio Designer: build a session by intensity / modality / protocol / duration. Save as a personal preset for later. Custom-minute duration entry.
- Top-bar timer: rest timer chip merged with the session-duration timer at the top of the workout view (no more bottom-of-screen rest bar).

**Workout fixes:**
- Suggested weight is now uniform across all sets (heaviest from prior week, applied evenly) instead of drifting set-to-set.
- Add-set pre-fills weight from the previous set; reps stay blank.
- Remove-set works in focus mode (minus button at the end of each row).
- Number keypad no longer blocks the row you're editing.
- Stall warning compares to your last working weight instead of your best, so it doesn't false-alarm.
- Swap menu now surfaces movement variants (assisted pull-ups when swapping pull-ups, etc.).

**Home + chrome fixes:**
- Title bar pinned solid across all tabs (no more bleed-through on scroll).
- ActiveSessionBar is opaque (was translucent and let scrolling content show through).
- Next Session card shows the prescription (`3 × 8-10 @ 30lb`).
- Skip-workout option in the day action sheet; missed days don't bounce back to the front of the queue.

Please test: pairing exercises as a superset (round flow + rest after each round), tapping "LAST WK" on any exercise to see history, and designing a cardio session from the Designer + applying it to today.

## Full changelog

### Supersets (new feature)
- Pair any two exercises from the workout via "+ SUPERSET WITH" picker. Non-adjacent pairs auto-splice to be contiguous; weekData reindexes alongside.
- Round-grouped layout: round N shows A's set N and B's set N together, repeated for max(A.sets, B.sets).
- Set-count parity: shorter exercise gains empty rows so rounds line up.
- Interleaved rest timer: fires only when every paired exercise has its same-index set confirmed (the round is complete).
- NextUpCard interstitial skipped when advancing within a pair.
- Order-tolerant: do A1, A2, A3 first or interleave A1 → B1 → A2 → B2 — round-completion check catches up either way.
- Unpair button on the SupersetGroup header.
- Per-exercise progression + stall chips render in the superset header strip so you don't lose those signals when paired.

### Workout history modal
- "LAST WK" stat reformatted from `30 × 10` to `3-30×12` (sets / weight / reps).
- Tap the stat to open a per-exercise meso history view — every logged set across every week, with PR row highlight.

### Suggested-weight algorithm
- Working weight is now the heaviest weight from prior week's completed sets, applied uniformly to every set this week.
- Per-set reps still grow week-over-week within the prescribed range; weight bumps when last week's reps hit the top of range.
- Rep range header (e.g., `8-10 reps`) preserved on every exercise card.

### Cardio
- New CardioDesigner: 4-axis composer (intensity, modality, protocol, duration) with cross-axis rules — Tabata clamps to multiples of 4, protocol-change resets to default duration, swim removes Tabata, etc.
- Custom-minute entry in the duration axis (1-180 min, with Tabata multiple-of-4 rounding).
- Save as personal preset (localStorage; Supabase sync flagged as follow-up).
- Apply path accepts both built-in protocols and composed sessions; composed apply mints a fresh user preset and schedules it.
- New CardioTimerContext: persistent count-up + optional target with one-shot 880 Hz chime + haptic. "+5 min" extend, "End early" with confirm. Survives navigation + background.
- CardioSessionView refactored to read from the context.
- HomeCardioCard with day-mode adaptive layout (lift-only / lift+cardio / cardio-only / rest).
- CardioIntervalTimer restyled to match the new chrome.

### Home + chrome
- Title bar pinned with solid background across all four tabs.
- ActiveSessionBar opaque (was translucent gradient with backdrop blur — content showed through on scroll).
- Next Session card shows the upcoming prescription (`3 × 8-10 @ 30lb · 2 min`) per exercise.
- Skip workout from the day action sheet (localStorage; Supabase sync flagged as follow-up).
- Skip-aware next-session resolver — missed days no longer bounce back to the front after today completes.
- Minimized rest timer moved to the top header bar with the session timer.

### Workout polish
- Add-set pre-fills weight from the previous set; reps stay blank for explicit entry.
- Remove-set affordance shows in focus (editorial) mode at the end of each row.
- Set rows scroll into view on focus so the iOS numeric keypad doesn't cover the active input.
- Stall warning ("⚠ Weight drop detected") compares against the last completed set instead of the heaviest, so weight drops at the end of a fatigue chain don't trigger false alarms next session.
- Swap menu broadens via muscle-family bucket — `Back`, `Lats`, and `Traps` collapse so assisted/back variants surface for movements like pull-ups.

### Internal
- Audio chime extracted to `src/utils/audio.ts` and shared between rest + cardio timer contexts.
- SetRow extracted from ExerciseCard for reuse across solo + superset paths.
- `useExerciseProgression` hook extracted to drive both ExerciseCard and SupersetRoundView header chips.
- Test mock-layer no-op fixed (`vi.mock('../../utils/store')` was resolving to a non-existent path; corrected to `../../../utils/store`). Tests now actually exercise the store paths instead of silently passing.
- 2 pre-existing TypeScript errors cleaned up.

### Tester focus
1. Pair two exercises as a superset and run through a round — does rest fire after each B set?
2. Tap "LAST WK" on any exercise — does the history modal show every week's sets correctly?
3. Open the Cardio Designer, build a session, save it as a preset, then apply it to today.
4. Scroll on Home with an active workout — does the active-session strip stay opaque?
5. Add a 4th set to an exercise — does it pre-fill the weight from set 3?
6. Try the keypad on iPhone — does it stay below the row you're typing into?
