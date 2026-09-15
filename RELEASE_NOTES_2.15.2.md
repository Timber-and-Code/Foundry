# 2.15.2 — build 1

Six fixes. Three of them were found while chasing the first one, and two came
straight from using the app.

---

## The one that was reported

**A set you removed once in week 2 was governing the whole rest of the meso.**

Removing a set stored the new count for that week, and every later week then
re-applied the difference as a running adjustment. It never expired. The worst
of it landed on the deload: an adjustment made in a 4-set week was re-read
against the deload's 2 sets and floored at **one set**. Ten lifts across all
four days were prescribed a single-set deload, and that is exactly what got
logged.

Two things were wrong underneath:

- An adjustment is only meaningful against a comparable prescription. "One less
  than the working week" is not "one less than the deload." A carried *reduction*
  no longer reaches the deload week at all. A carried *increase* still does, and
  a choice you make **in** the deload still wins outright.
- Adding a set and taking it straight back off left a permanent mark, because the
  count was stored even when it changed nothing. It is now only stored when it
  differs from what you would have been given anyway — which also means adding a
  set back to the prescribed number, while a reduction is being carried, correctly
  reads as *"the full amount this week"* rather than *"no opinion."*

Existing data was repaired: nine leftover no-op rows removed, every real
adjustment left intact.

---

## Three more in the same area

**Removing a set from the middle of a list left a phantom behind.** The row was
removed on your device but the sets after it kept their old position on the
server. History and volume both kept counting the stranded one — while the card
itself never showed it. Anything after a removed set is now renumbered.

**A set removed within a second and a half of editing it could come back.**
Edits are batched briefly before syncing; deleting the set cancelled nothing, so
the pending write recreated the row it had just deleted. That orphan then
reappeared in history on every refresh. Writes to a single set now cancel
cleanly and always land in the order you made them.

**Sessions from old mesocycles could merge into your current one.** A leftover
identifier from before 2.14.2 was still being adopted by new cycles, pulling
months of old training into a single session — in one account, 54 sets spanning
four separate days, which made week-by-week history unstable. Only a session
genuinely still in progress is carried forward now.

---

## The deload week was telling you to go heavier

Every week ran the same progression logic, and nothing exempted the deload. Hit
the top of your rep range in the hard week and the deload told you to add weight.
Fall short and it still told you to add a rep. It cut your sets and then pushed
the intensity up underneath.

The deload now does what a deload does:

- **Two sets**, as before.
- **Reps at the bottom of the range** — this is the part that actually gives you
  room to recover.
- **Your last working weight**, easing down across the week to about 90% by the
  final day.

This follows the research rather than instinct. Both Renaissance Periodization
and Eric Helms cut volume by 30–50% while *holding* the weight, and a 2024 trial
found taking the week off outright came out behind training through it. Volume
and proximity to failure do the work; the bar barely needs to move.

---

## Two things you would have noticed

**"Vs last week" said "0 lbs" when you matched a lift.** Under that heading it
read like you had lifted nothing. Rows now show what is actually being compared,
the way the personal-records block above them already did:

```
Bench Press     185 → 195 lbs   +10
Back Squat      200 → 200 lbs   held
Deadlift        200 → 180 lbs   −20
```

In the deload it says so, and a planned lighter day is no longer coloured like a
loss.

**You could not type over a weight.** The boxes are almost always pre-filled, so
replacing the number meant clearing it by hand first, and a cursor landing
mid-number turned 200 into 2005. Tapping a box now selects what is there — just
start typing.

**And the red warning while you typed** was not the box at all. It was the
"weight drop detected" chip, recalculating on every keystroke: clearing 200 to
retype it triggered the warning at "2" and again at "20" on the way to 205. It
now waits until you have finished. That warning was also comparing against the
wrong exercise after any reorder or swap — fixed.

---

*1167 automated tests. No changes to Apple Health, friends, or scheduling in
this build.*
