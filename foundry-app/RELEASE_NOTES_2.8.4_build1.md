# 2.8.4 build 1 — workout polish + reliability patches

What to test in this build (paste this list into TestFlight "What to Test"):

1. **Set complete checkbox visibility** — the unchecked checkbox now has a
   thin amber outline so it's easy to spot before tapping. Check that done
   sets still show solid amber/green and the look isn't otherwise changed.

2. **Superset pairings persist** — pair two exercises into a superset, back
   out of the workout, return to it. The pairing should still be there with
   both exercises grouped and a fresh SUPERSET chip. Also: the "+ Superset
   With" button is now a solid amber button instead of a dashed grey
   outline.

3. **Rest timer alarm at zero** — let a rest timer run all the way down.
   Chime + haptic should now LOOP every ~2.5s until you tap I'M READY (the
   prior single-fire was easy to miss, especially with the phone in a
   pocket).

4. **Stop Workout button** — accidentally start a workout from Home, look
   for the "STOP" button in the upper right corner of the workout view.
   Tapping it on an empty session exits silently to Home with no Resume
   Workout CTA. If you have logged sets, it asks you to confirm first.
   (Distinct from Complete Workout — does NOT mark the day done.)

5. **Workout title matches your meso** — title bar should reflect the
   day's tag (Upper Body / Lower Body / Push Day / Pull Day / Leg Day /
   Arm Day / Full Body / Cardio / Mobility / Bodyweight) instead of the
   stale name baked in at meso-generation time. If the title was wrong
   before — e.g. "Push Day 1" on an Upper/Lower meso — it should now
   show correctly.

6. **Exercise swap — Back muscles included** — open the swap picker on a
   back-focused exercise (Pull-up, Row, Lat Pulldown). All back family
   exercises should appear regardless of how the day is tagged. The picker
   no longer hides a muscle when the day-tag and split have drifted.

7. **Swap picker BACK button (iPhone)** — open the swap picker. The BACK
   button in the upper-left should now sit BELOW the Dynamic Island /
   status bar and be tappable. Previously the button was visible but iOS
   was swallowing the tap because it overlapped the system area.

8. **Pure-strength rep target** — newly generated Pure Strength mesos land
   on 4-6 reps for compound anchors (was 3-6). Existing mesos keep their
   stored values until regenerated.

## Still in progress, not in this build

- Friday sync error toast + disappearing title bar — need a screenshot /
  repro to diagnose.
- Forward arrow + X button overlap upper-right on workout entry — need a
  screenshot to identify which screen.
