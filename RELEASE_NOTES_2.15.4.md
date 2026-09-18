# 2.15.4 — build 1

Plan your next meso during the deload, a rebuilt exercise history, and three
end-of-meso bugs found along the way. Two of them meant finishing a meso never
worked the way it was designed to.

---

## Plan your next meso during the deload

The deload is when most people start thinking about what's next, so that's
now when you can build it.

- **A "Plan your next meso" card on Home** from the first day of the deload
  week. It opens the normal setup flow, pre-filled from the meso you're on.
  Back out any time; nothing changes.
- **Saving keeps it as a plan.** Your current meso keeps running untouched.
  The card then shows the split, days and weeks, a day-by-day preview, and
  **Edit plan**.
- **Two ways to start it.** Finish your deload and the plan is the first option
  on the "What's next?" screen, one tap. Or tap **Start now** on the card if
  you're recovered early. It asks first, since it ends the current meso.
- **It starts with exactly what you previewed.** The program is saved with the
  plan instead of being rebuilt on start, which would have reshuffled it.
- **It builds on this meso.** Exercise continuity and carryover read the meso
  you're still in, not just finished ones.

Choosing any other option on "What's next?" (repeat, new, samples) discards the
plan.

## Exercise history, rebuilt

The history view was a small popup with a tiny close button and a plain list.
It's now a bottom sheet:

- A 44px close button and a full-width **DONE** at the bottom. Tap outside or
  swipe down to dismiss.
- Your **best set** and **this meso's gain** from week 1 at the top.
- A **top weight by week** chart, with the PR week highlighted.
- Each week as a card with sets as chips, PRs outlined.

## End-of-meso fixes

**The end-of-meso screen never appeared.** Finishing the deload was supposed to
show a recap and then "What's next?". An off-by-one in how the last week was
detected meant neither ever fired. Fixed, and the test that should have caught
it now checks a week that actually exists.

**The recap's button marked your meso "abandoned."** "Build Meso 2" used the
reset path meant for quitting a meso. It now leads to "What's next?", which
records the meso as completed.

**Building a meso manually could drop you on an empty screen.** For anyone past
their first meso, a manual build saved a profile without an experience level.
The app rejected it and showed "The Foundry is waiting" as if you had no
program. This affected Settings → Start New Meso as well as planning. Fixed.

---

1188 tests passing, typecheck + lint clean. Web-layer only — no native code
changed. Planning and starting were driven end to end in a browser; not yet
verified on device.
