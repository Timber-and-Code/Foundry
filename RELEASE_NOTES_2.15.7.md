# 2.15.7 — build 1

The App Store push: iPad and foldable layouts, Apple Health that actually
posts workouts, friends you can manage, and a new way to share.

---

## New look
- **Opening the app:** black → an orange forge glow → Home, about a second.
  The old launch screen was a leftover placeholder on white.
- **Share a workout:** pick PR, Session or Progress, see exactly the image,
  tap Share — the iPhone share sheet gets the image (Instagram, Messages,
  Snapchat, WhatsApp, Save Image…). Story-size images, readable at a glance.

## iPad, Pro Max and iPhone Duo
- Layouts follow screen width: side navigation on iPad, two-column
  dashboards, dialogs instead of bottom sheets. The unfolded Duo fills its
  screen. Phones look exactly as before. Folding, unfolding and rotating
  keep what you're doing.

## Apple Health
- Workouts never reached Apple Health if you turned it on in an earlier
  build: iOS was never asked for the Workouts permission, and nothing asked
  again. The app now asks once for anything still unanswered, never re-asks
  a "Don't Allow", and Settings shows the real status of each permission.

## Friends
- **Remove a friend** and **choose Full or Basic sharing** from their
  profile. Sharing is mutual — one level for both of you.
- Accepting an invite made a one-sided friendship (the person who accepted
  saw nobody), and invite codes could be reused. Fixed.

## Fixes
- Cardio and mobility "Add to schedule" sat under the tab bar on phones.
- Exercise history's "Best set" ignored a finished session.
- Previous Meso Cycles with one past meso on iPad.
- Empty mesos no longer leave a record; ended-early mesos are labelled.
- Paid-plan screens are hidden in the iOS app until they can be bought.

---

1241 tests passing, typecheck + lint clean. Native changes: launch screen,
Apple Health plugin, @capacitor/filesystem. Server: migrations 012–014
already applied. Not yet verified on device.
