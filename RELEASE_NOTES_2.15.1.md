# 2.15.1 — build 1

## Trimming a set no longer stops the weight climbing

If you dropped an exercise from four sets to three, that exercise quietly
stopped progressing — for the rest of the block. The app judged "did you finish
every working set?" against the number the program prescribed, not the number
you'd actually chosen, so a trimmed lift could never satisfy it again and just
held the same weight week after week.

The same fault was about to bite everyone in week 4. That's the peak-volume
week, where the program adds a set of its own — so every exercise would have
been judged against one more set than it had ever asked for, and the whole
session would have frozen at the previous week's weight.

Progression is now judged against what you were actually asked to do that week,
including any sets you added or removed.

Worth knowing: progression still needs every set at your top weight to reach the
top of the rep range. Three sets of 10, 10, 9 when the range tops out at 10 will
hold the weight — that one short rep is the app reading you as not yet on top of
the load, and it is deliberate.

## Far fewer "Cloud sync failed" warnings

The warning was real but the cause wasn't the server — nothing was ever
rejected. The app was re-uploading your entire logged history every time iOS
handed it a refreshed login, which happens each time you pocket your phone
between sets and pick it back up. One workout was generating thousands of
uploads, and on gym wifi a few of them were always going to time out.

It now uploads what actually changed. Your sets were saved locally throughout,
so nothing was ever lost — but the warnings should largely stop, and the app
should feel quicker and use less battery mid-session.

---

### What to look at

- **Any exercise you've added or removed a set on** — the suggested weight
  should climb the week after you hit the top of the rep range on every set.
- **Week 4 of a block** — the program adds a set here. Weights should still
  progress normally into it.
- **A full session on gym wifi** — the "Cloud sync failed" toast should be rare
  now rather than routine.
