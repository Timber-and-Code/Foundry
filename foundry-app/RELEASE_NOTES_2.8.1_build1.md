2.8.1 build 1 — four critical workout-flow fixes.

WHAT'S FIXED

• Swap exercise — picking a replacement now triggers the "this session / entire meso" prompt on the FIRST tap. Previously you had to tap swap again before the scope picker appeared.

• Workout completion state — backing out of an active workout and returning now correctly recognizes which exercises are done. Previously the green checkmarks stayed on screen but the progress bar at the top treated everything as incomplete, forcing an uncheck/recheck on the last set per exercise.

• Workout history — the per-exercise history modal now reads the correct exercise's data. Previously it walked every slice in the day and picked whichever exercise had the most logged sets, attributing the heaviest exercise's history to whichever card you tapped on. (Likely the source of "history is making up data" reports.)

• iOS title bar — the bar at the top of the screen now extends solidly into the status-bar area (notch / time / battery). Previously a transparent strip there exposed scrolled-up content. Also fixed: rubber-band overscroll no longer flashes white at the top.

WHAT TO TEST

1. Active workout → tap a swap button → pick a replacement exercise → confirm the "Apply this swap to..." prompt appears immediately on a single selection (not a double-tap).

2. Active workout → log all sets on at least one exercise → navigate Home or Schedule → return to the workout. The progress bar at the top should reflect the completed exercise without any uncheck/recheck.

3. Tap an exercise's "LAST WK" history chip on a day with multiple exercises. The numbers shown should match what you actually logged for THAT exercise — not another exercise in the same day.

4. On any screen, scroll down — the area behind the time/battery indicators should stay solid black, no scrolled-up content visible. Pull the page down past the top — should stay solid, no white flash.

KNOWN OPEN

• Prescribed weight may still display incorrectly in some cases involving prior reorders or supersets. Flagged for investigation in the next patch if it persists after a clean session.
