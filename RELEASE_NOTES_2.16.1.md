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

## The rest-timer ding fires every time
One chime and one buzz at zero, every set, phone in hand or in a pocket.
Five separate things made it miss.
- **The chime file was never in the iOS app.** Every rest that ended with
  the phone locked or another app in front played a notification with a
  missing sound. The file is in the bundle now. PLEASE TEST: lock the
  phone with a minute left, you should hear the two-note chime at zero.
- **Locking the phone just before zero killed the cue entirely.** The
  countdown kept running for a few seconds after the app went to the
  background, fired into a muted speaker, and then cancelled the very
  notification it had just scheduled. The countdown now hands off to the
  OS the moment the app hides. PLEASE TEST: lock the phone with 5 to 10
  seconds left.
- **A first "Don't Allow" was remembered forever.** Turning notifications
  on later in iOS Settings had no effect. The OS is asked again now.
- **No double ding.** When the notification rang on the lock screen,
  unlocking the phone used to ring again. It doesn't.
- **A rest started as the previous one hit zero could freeze silent.**
  Fixed at the source.
- **A zero-rep skip no longer starts a rest timer** (it used to run the
  exercise's rest, or 90 seconds).

## Under the hood
- The finish screen saves a snapshot of the card per session
  (`foundry:share:d{day}:w{week}`), wiped with the meso's other session
  data. One stats rule now serves both the live finish and the rebuild.
- Toasts can carry an inline action button.
- `rest-complete.wav` is a member of the App target in `project.pbxproj`.
  Verify every archive: `ls App.app/rest-complete.wav`.
- RestTimerContext now has its own tests (hidden before zero, return
  after the OS rang, return before zero, start-at-zero, zero-rep skip).

---

1375 tests passing, typecheck clean. Native change: the chime WAV joins
the bundle. Not yet verified on device.
