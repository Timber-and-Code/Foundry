# 2.15.6 — build 1

Finishing a meso and starting the next one, made safe. Nothing is ended or
created until you tap Start, and the last screen before a meso exists shows
exactly what you'll train.

---

## Finishing a meso

- **Repeat / Build a new meso no longer end your meso the moment you tap
  them.** Backing out or closing the app used to rebuild the same program at
  week 1 on its own and lose the summary. Now setup opens on top of the
  finished meso, and it's only archived when the new one starts.
- **View meso summary** on the What's next screen, so the summary can be
  reopened any time.

## Review your program before it exists

- **New "Your Program" review** for returning lifters, after the builder and
  before cardio. Check every day, swap, add, remove or reorder lifts, then
  confirm. What you confirm is exactly what gets installed.
- **New lifters: the coach runs first.** "Coach-tune my program" puts the
  coach's version into the preview for review. Save installs what's on screen.
  It used to replace the program you'd just approved with a different one.
  You can also skip the coach and save the standard build.

## Setup polish

- **All equipment** — one tap selects everything, in both builders.
- Main buttons across setup are all the same size now.
- **Cardio step marked the wrong days as lifting days** (shifted back one),
  so suggestions could land on a real lifting day. Fixed.

## Meso history

- Mesos with nothing logged no longer leave a record.
- Mesos ended early are labelled "Ended early · Week N of M" and don't take
  a meso number.
- A finished meso could appear twice in Previous Meso Cycles after a sync.
  Fixed.

---

1217 tests passing, typecheck + lint clean. Web-layer only — no native code
changed. Server: migration 012 (`discard_empty_meso`) is already applied.
Not yet verified on device.
