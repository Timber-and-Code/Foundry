# The Foundry — 2.9.0 (build 1)

## What to Test

This build fixes six issues, several around backing out to Home mid-workout
and coming back. Please run a workout and try each:

1. **Supersets persist** — Pair two exercises as a superset, back out to the
   Home tab, then return to the workout. They should still be supersetted.

2. **Removed sets stay removed** — Remove a set on an exercise and finish it.
   Back out to Home, return: the exercise should still read as complete and
   NOT re-prompt you to fill the deleted set.

3. **"Up Next" is accurate** — After backing out and returning mid-workout,
   the Up Next prompt should point to a genuinely unfinished exercise, not
   one you already completed.

4. **Home banner during a workout** — While a workout is in progress, tap
   the Home tab. "THE FOUNDRY" title bar should be visible, and the session
   bar's arrow and dismiss "✕" should sit side by side (no overlap).

5. **Swap menu shows everything** — Tap to swap an exercise. The picker now
   lists the full exercise database grouped by muscle; the relevant muscle
   is expanded at the top.

6. **Correct split in the banner** — The split shown under "THE FOUNDRY"
   (e.g. UPPER / LOWER) should match the program you're actually training.
   If it was wrong before, it will self-correct on this build.

Plus: newly generated Pure Strength programs use a 4-6 rep range on anchor
lifts (was 3-6).

## Under the hood

Foundational work for a more robust per-exercise workout data model landed
this release behind disabled feature flags — no visible change expected.
