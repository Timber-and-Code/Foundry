# 2.15.9 — build 1

The App Store readiness pass, plus the three things reported on 2.15.8.

## Reported on 2.15.8
- **The banner and tab bar are pinned — for real this time.** 2.15.8 turned
  off the WebView bounce, but Capacitor already had. The actual cause was
  `contentInset: automatic`: iOS was adding its own notch/home-bar inset on
  top of the one the app draws, so the whole page slid at both ends. Set to
  `never`; every full-screen screen now pads the safe area itself. Proven in
  the simulator. (Native change.)
- **You can see whether the coach tuned your meso.** The review screen shows
  COACH-TUNED with the coach's note, or STANDARD BUILD with the reason and a
  way to go back and try again. Before, both looked identical.
- **"Could not generate an invite code."** Fixed on the server (migration
  016) — sharing works on any build from now on.

## New meso, first week
- **The reference weight is last meso's last HARD week, not its deload.**
  The chip at week 1 was taking the most recent week with data — always the
  deload — and hard-coding the set count to 1. DB bench: 80 × 4 sets in the
  peak week, 70 × 2 in the deload, and the new meso said "Last week 1-70×4".
  It now reads **LAST MESO 4-80×6**, and the note names the week.
- **The previous meso is in lift history.** Tap the tile: the last block is
  listed week by week under the current one, deload dimmed, the week to
  train off marked.
- **Rep ranges come from your goal, everywhere.** Swapping in a lift used to
  copy the library's raw reps, and twelve entries carried a bare number
  ("15" on face pulls) instead of a range. One rule now.

## App Store readiness
- **Save Image from the share sheet no longer crashes** (missing Photos
  permission text).
- **Privacy Policy and Support are linked in Settings**, and the privacy
  policy is linked under every Create Account form.
- **The AI coach asks before its first use.** A one-time sheet says what is
  sent (your training profile, notes and lift history — never your name or
  gender, which are no longer sent at all) and offers "Build without the
  coach", which gives you the same program with nothing sent.
- **Crash reports are anonymous.** Sentry no longer receives your email or
  account id.
- **Send feedback works.** It posted to a route that didn't exist; it now
  saves to a private table.
- **Password-reset and friend-invite links no longer 404** on the web (a
  leftover GitHub Pages redirect was intercepting them).
- **Extra-day Swap and Add Exercise** open the real picker instead of
  "coming soon".
- **Under-13 signups are refused**; the free-tier copy is hidden on iOS.
- Privacy and support pages updated (Timber and Code Collective LLC).

---

1290 tests passing, typecheck + lint clean. Native changes: `contentInset`
never, Photos usage string. Server: migrations 016 + 017 already applied.
Not yet verified on device.
