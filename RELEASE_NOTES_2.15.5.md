# 2.15.5 — build 1

The end-of-meso summary, rebuilt around weekly charts. This closes out a night
of deload and end-of-meso work that shipped across 2.15.3 → 2.15.5.

---

## The meso summary

When you log the last deload session, the summary that follows is now a
full-screen recap in the same style as the lift history sheet:

- **Strength gained, sessions and PRs** as the headline numbers.
- **Volume by week** across the whole block. The biggest week is highlighted
  and the deload is muted.
- **One card per key lift**, showing start → peak, the gain, and its top
  weight week by week.
- **WHAT'S NEXT** pinned at the bottom. It leads to your planned meso, or to
  repeat / new / sample.

**The numbers are more accurate:**
- Lifts are matched by exercise rather than by their position in the day, so
  a reordered or swapped workout can't mix another lift's sets into the chart.
- The peak comes from working weeks only; the deload never counts as the peak.
- Warm-ups no longer count toward volume or PRs.

---

## Everything from tonight

**2.15.3 — the deload**
- Deload weights start from your **week 1** weight, stepping down to 90% by
  the last day, instead of starting from your heaviest week.
- The red "weight drop detected" warning no longer fires during the deload.

**2.15.4 — planning and history**
- **Plan your next meso during the deload** from a card on Home. Start it when
  the deload ends, or early with Start now.
- **The end-of-meso screen now actually appears.** It never did before because
  of an off-by-one.
- The meso recap no longer marks your finished meso as abandoned.
- Building a meso manually no longer lands returning lifters on an empty screen.
- **Exercise history** is a bottom sheet with a big close button, headline
  numbers and a weekly chart.

**2.15.5 — the meso summary** (above).

---

1190 tests passing, typecheck + lint clean. Web-layer only — no native code
changed. Not yet verified on device.
