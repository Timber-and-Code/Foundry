# 2.14.3

Three fixes from on-device reports against 2.14.2.

## Reordering exercises now sticks — and asks how far it should reach

Dragging exercises into a different order only ever moved what was on screen.
The order itself was written nowhere, so backing out of the day threw it away.

It now saves to the program and syncs. When you close the reorder sheet it
asks once whether to keep the new order, and what it says depends on who
you're training with:

- **On your own** — keep it for every week of the meso.
- **Sharing your program** — keeping it changes the order for everyone
  training it, and the sheet says so before you commit.
- **Training someone else's program** — keeping it applies to you only. It
  cannot change the program for whoever shared it.

"Just today" is always available and writes nothing.

If you'd swapped an exercise in a slot, that swap moves with the exercise
rather than staying pinned to the position it used to occupy.

## The cool-down after the last session of a week

Tapping "Start cool-down" at the end of a week looked like it did nothing,
and dropped you on a "coming soon" screen instead. The cool-down was
actually loading — the week-complete celebration was rendering on top of it.

The celebration now waits until you come out of the cool-down.

## "View Week Summary" went nowhere

The primary button on the week-complete screen opened a placeholder that
read "Weekly summary view coming soon". It goes to the meso overview now.
The real weekly summary is still to be built.

## Under the hood

- A member's first change to a day in a shared program no longer drops that
  slot's modifier or warm-up flag.
- Reorder scope is decided from a cached role, so the sheet opens instantly
  and works without a signal.
