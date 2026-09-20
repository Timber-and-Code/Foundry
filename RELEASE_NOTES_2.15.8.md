# 2.15.8 — build 1

The builder pass: what the app builds, how you review it, and a coach that
actually runs.

## Building a meso
- **Every major muscle group, every week.** The builder could structurally
  drop a group — Upper/Lower 4-day at 60 min left out triceps in every
  single build. A final pass now swaps a direct exercise in for a repeated
  accessory. Anchors are never touched; hand-built and coached programs are
  left exactly as made.
- **The AI coach works.** It had been rejected by our own server on every
  request since launch, so every "coach-tuned" program was silently the
  standard build. Fixed, and it now takes about 20 seconds. Sign-in required.
- **First-year lifters were given the advanced exercise pool.** "Under 1
  year" was stored in a form the builder didn't recognise. Fixed.
- **Quick Build no longer hides its questions.** Split cards are compact; a
  footer always shows Split / Schedule / Level / Equipment and one button
  that is always the next thing to do. **Experience level can be changed.**
- **Your Program review:** full exercise names, one SWAP per row. Reorder and
  remove live behind **Edit list**.
- **Leaving the app mid-build no longer loses it.** The builder saves as you
  go and reopens where you left: "Picked up where you left off."

## Custom exercises
- Always show the name you typed, with a small **CUSTOM** tag — never
  `custom:cable-y-raise`. The name now travels with the program, so other
  devices and people sharing your meso see it too. Existing ones repair
  themselves.

## Everywhere
- **The banner and tab bar stay pinned.** They used to slide with the page
  when it rubber-banded at the top or bottom. (Native change.)
- **Friend sheet** (from 2.15.7 build 2): tapping a friend opened a sheet too
  tall to scroll or close. Dialogs scroll now; bigger close button.

Everything from 2.15.7 is included.

---

1271 tests passing, typecheck clean. Native change: WebView bounce off.
Server: migration 015 applied; coach worker deployed. Not yet verified on
device.
