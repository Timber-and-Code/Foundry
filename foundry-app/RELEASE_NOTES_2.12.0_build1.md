# The Foundry 2.12.0 (build 1)

10 fixes and features since 2.11.0 build 1 (2026-06-16). Cut 2026-07-24.

## What to Test

**Launch speed**
- Cold-launch the app. It should be usable within seconds — the ~1 minute "Loading…" hang after a layoff is fixed (auth now has an 8s deadline and boots offline-first).

**Mid-workout navigation (iPhone-specific fix)**
- Start a workout. The ← Back button and SESSION timer must be visible in the top bar (they were hidden under the banner on notched iPhones).
- Minimize the rest timer — the REST countdown chip should be visible in the same bar; tapping it re-expands the timer.

**Rest chime reliability**
- During a rest, lock the screen or background the app, come back before zero — the chime should still sound at zero (in-app audio now recovers from iOS interruptions).
- With the phone locked at zero, the OS notification + custom chime fires as before.

**Exercise history**
- Mid-workout, tap the LAST WK chip on any exercise. Every logged week should appear with the RIGHT exercise's sets (reorders no longer cross-wire data).
- A new LAST MESO row shows the weight you last lifted in a previous meso — including unfinished ones.

**Cool-down flow**
- Finish a workout → Start cool-down. You land directly in the Post-Training Downshift protocol (no dead protocol picker). Timers, left/right sides, and real dose lines ("30 sec / side") all work.

**Workout duration**
- Finish a workout — the TIME stat shows this session's real length (no more 1700-hour readings from stale timestamps).

**Schedule: Move mode**
- Schedule tab → MOVE button. Tap any workout (past days included), tap a destination day. Double-booked days ask WHICH workout. The old tap-a-day sheet also now offers a labeled Move row per workout.

**Reorder integrity**
- Reorder exercises mid-workout, log sets, leave, come back — every exercise shows its own data. Previously-corrupted weeks self-heal on open.

**Sets & friends**
- Set counts should match the prescription week to week (MRV weeks add +1 by design). An extra set added one session does not carry into next week.
