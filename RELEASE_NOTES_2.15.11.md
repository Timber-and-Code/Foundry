# 2.15.11 — build 1

Numbers you can trust. Five places were showing the wrong lift's weight,
one screen was missing a whole meso, and two labels were off.

## Wrong numbers, fixed
- **Every set reader now goes by the exercise, not the slot.** Logged sets
  are keyed by position in the day, but the program can be reordered,
  swapped or superset-shifted between weeks, so slot 2 last week is not
  always the lift in slot 2 today. Five readers still went by position and
  could put another lift's weight on screen. They all resolve by the set's
  exercise id now, fall back to position only for old unstamped data, and
  show nothing rather than another lift's number.
  - Progress → Current Weights. It also took the *first* set with a weight,
    so a feeler could stand in for the working weight. Now the heaviest
    working set.
  - Estimated 1RM card, PR timeline and anchor charts. These also read a
    fixed seven weeks, so an 8-week meso lost its last two.
  - Home next-session "last wk" pill. It showed set 0's weight, warmup
    included. Now the heaviest working set.
  - Week recap volume and PR pass; archive anchor peaks; muscle sets by tag.
- **A member's previous meso was missing from lift history.** The archive
  pull fetched only mesos the user *owns*. A member of a shared meso (Tyler)
  had nothing to train off: incline DB press showed "last week", never
  LAST MESO. The archive now includes every meso the user joined; their
  sessions and sets are their own.

## Labels
- **Full-body days wore a LEGS chip** on Progress → Current Weights. A
  program rebuilt from the server took its day tag from the first exercise.
  The tag comes from the day's label now (Full Body B → FULL).
- **Lifts by Muscle said "0 total lb"** all through week 1: the header was
  the sum of start → current deltas. It now shows the muscle's tonnage this
  meso (weight × reps over every working set, all weeks), labelled
  "lb moved". The per-lift delta stays on each row.
- **The Quote share card carries LB MOVED** above the stat row, like the
  Session card.

---

1304 tests passing, typecheck clean. No native changes beyond the web
bundle. Not yet verified on device.
