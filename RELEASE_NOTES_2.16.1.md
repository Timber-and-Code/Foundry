# 2.16.1 — build 1

Sharing a workout is never a dead end and never a one-shot. The card you
saw when you finished can be shared again from Home or the Schedule.

## Share closes the loop
- Share from the finish screen and, once the image has left the app, the
  share screen closes itself with a single haptic and you are back on the
  finish screen with the SHARE button reading SHARED. Cancel the system
  sheet and the share screen stays put so you can pick another card.
- NEXT SESSION is unchanged. No confirm step, no forced detour.

## Mis-tapped NEXT SESSION? Share from the toast
- Tap NEXT SESSION without sharing and a "Push A logged. · SHARE" toast
  sits at the bottom for eight seconds. Tap SHARE and the same card opens.
  Already shared? No toast.

## Share today's session from Home
- When today's session is done, the green TODAY · DONE header carries a
  SHARE chip. It opens the card you saw at the finish, same quote and all.
  It leaves with the header, so no stale share prompt follows you into the
  next day.

## Share any finished session from the Schedule
- Every ✓ DONE session card in the week view has a SHARE chip next to
  RECAP. The month view's day sheet gets a "Share this workout" row for
  each finished session.
- Sessions finished before this build have no saved card, so one is
  rebuilt from the logged sets: totals, set-by-set breakdown, PRs and the
  week-over-week anchor comparison, with a fresh quote.

## Under the hood
- The finish screen saves a snapshot of the card per session
  (`foundry:share:d{day}:w{week}`), wiped with the meso's other session
  data. One stats rule now serves both the live finish and the rebuild.
- Toasts can carry an inline action button.

---

1361 tests passing, typecheck clean. No native changes beyond the web
bundle. Not yet verified on device.
