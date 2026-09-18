# 2.15.3 — build 1

Two deload fixes. Both came straight from using the app in a deload week.

---

## The deload now starts from week 1's weight

**The deload was keeping almost all of the meso's load.** It took last week's
weight — the heaviest, hardest week of the block — and tapered it by at most 10%
across the week. A deadlift that went 180 → 200 over the meso was prescribed
180 on the last day of the deload.

Checked against Mike Israetel / RP's own guidance: their full deload week goes
back to **week 1's** load for the first half of the week and **half** of it for
the second half. Helms and Nuckols sit at the other end and hold the load. The
Foundry now takes the middle:

- **Load is anchored to week 1's working weight**, not last week's.
- **Same shallow taper across the week** — 100% on the first day down to 90%
  by the last.
- **Never heavier than last week.** If you went lighter than week 1 at some point,
  the deload starts from where you actually were.
- **A lift you swapped in mid-meso** has no week 1 to go back to, so it uses last
  week's weight, as before.

Sets (2) and reps (the bottom of the range) are unchanged.

That same deadlift now reads 162.5 on the last day of the deload instead of 180.

## No more "weight drop detected" in the deload

**Every loaded lift lit up red in the deload week.** The warning compares your
first set to last week and flags any drop. In the deload a lighter bar is the
prescription, so it was telling you that you were going backwards for doing
exactly what the program asked. It's now off for the deload week, on both the
normal exercise card and in supersets. Working weeks still flag a real drop.

---

1173 tests passing, typecheck clean. Web-layer only — no native code changed.
