# 2.8.0 build 1 — release notes

## Paste-ready for TestFlight "What to Test" (under 4000 chars)

Build 1 of 2.8.0 — supersets, workout history, cardio Designer, plus a long fix list.

NEW
- Supersets: pair any two exercises from the workout. Round-grouped layout (A's set + B's set per round), interleaved rest timer fires only after each round closes, set counts auto-equalize.
- Workout history modal: tap "LAST WK" on any exercise to see a week-by-week breakdown of every set across the meso.
- Cardio Designer: build a session by intensity / modality / protocol / duration. Custom-minute entry (1-180). Save as a personal preset for reuse.
- Top-bar timer: rest timer chip merged with the session-duration timer at the top of the workout view (no more bottom-of-screen rest bar).
- Next Session card now shows the upcoming prescription per exercise (3 × 8-10 @ 30lb · 2 min).
- Skip workout: missed days no longer bounce back to the front of the queue after today completes.

WORKOUT FIXES
- Suggested weight is uniform across all sets — heaviest from prior week, applied evenly. Old per-index drift is gone.
- Add-set pre-fills weight from the previous set; reps stay blank.
- Remove-set works in focus mode — minus button at the end of each row.
- Number keypad no longer covers the row you're editing.
- Stall warning compares against your last working weight instead of your best, so it doesn't false-alarm when you drop weight on the last set.
- Swap menu surfaces movement variants — assisted pull-ups now appear when swapping pull-ups.
- Rep range header preserved (8-10 reps); per-set suggested reps grow week-over-week.

CHROME / HOME
- Title bar pinned solid across all tabs (no bleed-through on scroll).
- ActiveSessionBar is opaque (was translucent and leaked content through).
- Cardio: persistent timer survives navigation + background. 880Hz chime + haptic at the target time. "+5 min" extend, "End early" with confirm.
- HomeCardioCard is day-mode adaptive (lift-only / lift+cardio / cardio-only / rest).

PLEASE TEST
1. Pair two exercises as a superset — does rest fire after each round?
2. Tap "LAST WK" on any exercise — does the history modal show every week's sets?
3. Open Cardio Designer, build a session, save it as a preset, apply it to today.
4. Scroll on Home with an active workout — active-session strip stays opaque?
5. Add a 4th set to an exercise — does it pre-fill the weight from set 3?
6. Try the keypad on iPhone — stays below the row you're typing into?
7. Skip a missed day — does Home advance to the next scheduled session instead of bouncing back?

Known: skip state and saved cardio presets are local-only across devices for this build (Supabase sync queued for the next migration).
