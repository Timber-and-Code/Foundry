2.8.3 build 1 — prescribed-weight fix + cardio/superset polish + cloud sync extensions.

WHAT'S FIXED

• Prescribed weight — the suggested weight on each set now follows the exercise itself, not the slot it sits in. After a swap or reorder, your last-week numbers stay attached to the right movement instead of jumping to whichever exercise happens to be in that position. Resolves the "history is making up data" / "wrong target weight" reports flagged at end of 2.8.1.

• Cardio session cold restore — backgrounding a cardio session and coming back no longer re-fires the chime or resets the clock to zero. The original start time is preserved across app suspends.

• Superset header — on narrow screens, the chips (target / progression / stall) now wrap cleanly below the exercise name instead of getting cut off.

WHAT'S NEW

• Per-exercise notes in superset rounds — each exercise inside a superset now has its own notes textarea in the header, and those notes persist across reloads.

• Cloud sync for skipped sessions + saved cardio presets — workouts you mark skipped, and any cardio presets you save in the designer, now round-trip through Supabase and follow you between devices.

WHAT TO TEST

1. On a meso where you've already swapped or reordered exercises, open today's workout and confirm the suggested weight on each set matches what you actually lifted last week for THAT exercise (not the previous slot occupant).

2. Start a cardio session, background the app for 30+ seconds, return — the timer should resume from where it actually was, no chime should fire, and the displayed start time should be unchanged.

3. Inside a superset, type a note on one exercise → reload → the note should still be there, on the right exercise.

4. Mark a session as skipped on one device, then sign in on another — the skip should sync over. Same for saving a cardio preset.

KNOWN OPEN

• None blocking. Continuing to monitor TestFlight feedback.
