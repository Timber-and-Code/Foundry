# The Foundry — 2.10.0 (Build 1)

_TestFlight "What to Test" — paste the section below into App Store Connect._

---

This build fixes the mesocycle split label, reworks the rest-timer cue,
restores the title bar during workouts, makes whole-meso exercise swaps
stick, and ships the next stage of the workout-data storage upgrade.

WHAT TO TEST

1. Split label
   The split shown in the title-bar subtitle and the profile drawer should
   match the program you actually built (Push/Pull/Legs, Upper/Lower,
   Push/Pull, Traditional, Custom). It previously got stuck on
   "PUSH / PULL / LEGS" for some users.
   • Open the app and check the title-bar subtitle + profile drawer.
   • If it looks wrong on the very first launch, it self-corrects within a
     moment — reopen the app and confirm it's right.

2. Rest timer cue
   When the rest timer hits zero you should hear ONE rising two-note chime
   (plus a haptic) — not repeated dinging.
   • Log sets through a workout and confirm a single chime each time.

3. Rest timer after every set
   The rest timer should start after every set you log, including the LAST
   set of an exercise (it used to skip the last set).
   • Confirm the timer + chime fire on mid-exercise sets AND last sets.

4. THE FOUNDRY title bar during a workout
   The branded "THE FOUNDRY" title bar should stay visible at the top of
   the screen during an active workout, above the session timer.
   • Start a workout and confirm the header is visible (not blank space).

5. Whole-meso exercise swap
   Swapping an exercise "for the whole meso" should persist everywhere.
   This works even when you're training a meso shared from another user —
   your copy changes; the meso you're sharing from does not.
   • In a workout, swap an exercise → choose "whole meso".
   • Leave the day, re-enter it, and check other weeks — the swap should
     have held.

6. Workout data storage upgrade (Big-Big Phase 3)
   Internal change to how per-set data is stored — no visible UI change.
   • Confirm previous-week weights still carry over as suggestions and
     your set history looks correct.

---
