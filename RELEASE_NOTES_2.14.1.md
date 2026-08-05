# 2.14.1 — Rebuild a session you don't want

Patch release on top of 2.14.0. One feature, one silent-failure fix behind it,
and a copy pass.

## Rebuild

You can now rebuild a programmed session you haven't started. It's on the day
card on Home — beside Preview and Skip on a training day, beside Skip on the
next-session card every other day.

Press it and you see the redrawn session first: each slot with the exercise
it replaces struck through beneath it, unchanged slots marked, dropped slots
listed. Only then do you choose:

- **Keep this <day>** — that day only
- **Rebuild my other days too** — the other untrained days, each with its own
  independent draw (this does NOT copy one session onto the others)
- **Keep what I had**

A day with any logged set is never offered, and never touched. Settings keeps
a whole-meso version for rest days, when there's no day card to press.

## Fixes

**"Rebuild upcoming days" never left the device.** `foundry:storedProgram` is
a derived cache of the `training_day_exercises` rows, and nothing pushed a
rebuilt day, so the next sync rebuilt the cache from the untouched remote rows
and the change reverted. The button reported success either way. It now
mirrors each rebuilt day to the server append-only — old rows keep their
`exercise_id` and are stamped `replaced_at`, so no logged set is ever orphaned
— and says so plainly when the push fails.

**Stale swap overrides masked rebuilt days.** A `foundry:exov:` override pins
an exercise to a slot index and is layered on top of the program by five
different surfaces, so a day you'd ever swapped on kept showing the old
exercise after a rebuild. Overrides are now cleared for rebuilt days only;
days you kept keep theirs.

**You could approve one workout and get another.** `generateProgram` shuffles,
and the preview and the commit each called it — so the program that landed
wasn't the one described. The commit now persists the previewed result
verbatim. A test pins the non-determinism so this can't quietly return.

**Empty founder avatar** on the pricing page — a styled circle with no
content beside the signature.

## Copy

- "cycle" → "meso" throughout, matching the rest of the app
- "Rebuild the rest of the cycle" → "Rebuild my other days too", naming the
  days, because the old wording read as "copy this session onto them"
- The rebuild modal now states that a day applies to every week of the meso —
  only the set count changes week to week
- About links the founder's letter with a two-line lead-in; the existing
  copy is untouched

## Known, not fixed here

A shared-meso member who swaps an exercise logs sets the slot map can't
place, so that history is dropped on the next pull. Needs a member-scoped
`training_day_exercises` row; scoped as its own change.
