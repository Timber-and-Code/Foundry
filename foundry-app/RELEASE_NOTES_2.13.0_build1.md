# The Foundry 2.13.0 (build 1)

2 features since 2.12.0 build 1 (2026-07-24): Schedule v2 and the Friends tab. Cut 2026-07-25.

## What to Test

**Schedule v2 — week view is now the default**
- Open the Schedule tab. You land on a pinned 7-day week strip with a phase-colored header (e.g. WK 3 · INTENSIFICATION), not the month grid.
- Page weeks with ‹ › — paging stops at the meso's first/last week. TODAY jumps back to the current week.
- Each day in the strip shows its signals: phase dot, ✓ done, ⚠ missed, a double dot for double-booked days, and pips for cardio/extra sessions.
- Tap a day — its sessions appear below as full-width cards, one card per session (a double-booked day is two cards). Extra and cardio sessions get their own cards; rest days offer an add affordance.
- Card actions: VIEW / MOVE (shows RESCHEDULE on missed days) / SKIP·UNSKIP, and RECAP on completed days. MOVE opens the Move sheet with that session pre-picked.
- Starting a workout still happens from Home — Schedule is view-and-manage only.
- The month grid is still there behind the ▦ toggle, including full-grid Move mode.

**Friends tab — new fifth tab**
- Bottom bar order should be: Home / Progress / Schedule / Friends / Explore (people icon).
- The tab lists your friends vertically: 🔥 + amber ring if they trained today, otherwise last-trained recency, plus their active meso name and a FULL/BASIC share-level chip.
- Tap a friend → their dashboard modal opens (same one as the Home strip).
- + ADD FRIEND in the header (and the empty-state CTA) opens the invite-code sheet with native share.
- Home's horizontal friends strip is unchanged — the tab is the full surface, the strip stays the glance.
- Signed out: the tab should point you at the profile icon to sign in.
