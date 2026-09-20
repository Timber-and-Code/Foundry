# 2.15.8 — build 1

Two fixes on top of 2.15.7.

- **Leaving the app mid-build no longer loses your meso build.** iOS often
  reloads an app that has been in the background, and the builder kept its
  progress only in memory — so stepping away (most visibly while planning
  the next meso during the deload) threw away your split, equipment,
  hand-picked exercises and swaps. The builder now saves as you go and
  reopens on the step you left: "Picked up where you left off." Cleared when
  you finish or back out.
- **Friend sheet** (from 2.15.7 build 2): tapping a friend opened a sheet too
  tall to scroll or close. Dialogs now scroll; bigger close button.

Everything from 2.15.7 is included: launch fade, new workout sharing, iPad /
Pro Max / iPhone Duo layouts, Apple Health fix, friends remove + mutual sharing.

1247 tests passing, typecheck + lint clean. Web-layer only since 2.15.7.
Not yet verified on device.
