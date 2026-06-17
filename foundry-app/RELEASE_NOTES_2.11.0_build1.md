# 2.11.0 build 1 — Release Notes

## What's new

### Resumption sheet for layoffs
If you fall off for a week or more, opening the app now surfaces a "Welcome back" sheet with four choices:
- **Pick up where you left off** — resume your meso, no load changes
- **Repeat last week** — re-do the week you just finished, same loads
- **Recalibrate** — same prescription, 15% lighter for one week, then back to full
- **Restart meso** — start over from week 1, old data archived

Whatever you pick, the calendar grid re-anchors to your real position — no more silent advance into MAV when you're still mid-MEV.

### Smarter weight progression
The "you hit all reps last week" gate now actually checks all reps. Previously, hitting your top set once and abandoning the rest still bumped you next week. Now, if you skip a set or your last set at the prescribed weight came in below the rep cap, you hold the same weight with a +1 rep suggestion.

### Rest timer overhaul
- **OS notification with phone locked** — get rung when rest is up even with the screen off or the app backgrounded. First time you start a rest timer after updating, iOS will ask permission once.
- **Custom chime** — a two-note rising chime (matches the in-app sound) plays for both foreground and background notifications.
- **Never disappears at zero** — fixed a bug where minimizing the timer made it vanish when the countdown hit zero. The full alarm always surfaces now.

### Progress tab — Lifts by Muscle + Previous Mesos
- **Meso History sub-tab** now shows your lifts grouped by muscle (Chest, Back, Quads, Hamstrings, Shoulders, Arms) with start → current weights and PR.
- **Previous Meso Cycles** button now opens a real archive list — each past meso expands to show the same per-muscle breakdown.

## Fixes
- Rest timer no longer hides at zero when minimized
- Progressive overload no longer rewards incomplete sets
- Sentry instrumentation for v2 storage fallbacks (groundwork for the next big cleanup release)

## Coming soon
- Schedule tab full redesign
- Friends tab refresh
- Drop legacy v1 storage (next release, after observability soak)
