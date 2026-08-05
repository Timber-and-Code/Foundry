# 2.14.2 — Keep what you like; stop losing shared-program history

## Keep the exercises you like

In the rebuild preview, tap any exercise to keep it, then **Rebuild the other N**.
Repeat until the session is right.

Locks are held by exercise, not by position — a redraw can move a lift between
slots, and a positional lock would silently start protecting whatever landed
there instead of the exercise you actually chose.

`generateProgram` has no notion of a pinned slot, so this samples it repeatedly
and takes the first candidate per slot that isn't already in the day. The
dedupe is the point: without it a redraw hands back an exercise you've locked
elsewhere and the day prescribes the same lift twice — the exact defect (two
decline benches in one session) that started this work. A slot that runs out of
unique options keeps its occupant and says so.

## Shared-program history loss — two fixes

**Session ids are now scoped to the mesocycle.** The key was
`foundry:ws_id:d{day}:w{week}` with no meso in it, so (day 0, week 0) resolved
to the *same* `workout_sessions` row forever. Starting a new cycle clears it —
but only for the person who starts it. A member of someone else's program never
runs that wipe, because the owner starting a cycle isn't an event on the
member's device.

Months of work therefore piled into one session row, pointing at whichever
training day existed last, and every exercise from the older program became
unplaceable. Observed in production: two session rows holding four distinct
workout dates from April to August, with 64 sets that could not be placed.

A legacy id is adopted once into the scoped key so a cycle already in flight
doesn't fork into a second row.

**A member's swap now reaches the server.** Both the swap and rebuild paths
looked up training days filtered by `user_id`. Training days belong to the
program's owner, so a member found no row and returned early — their swap never
synced, and the sets they logged against it had nothing to map to.

Members now write their own overlay rows: they see their pick, the owner never
does, and neither one rewrites the other. Where both hold a slot, ownership
decides before recency, so a member's older choice still beats the owner's newer
default.

## iOS

Minimum supported version raised from 14.0 to 15.0, ahead of Apple's Spring 2027
requirement. Verified in the built archive.

## Not fixed

The 64 already-orphaned sets on the shared August program are **not** recovered.
Which slot each one belonged to isn't recoverable from the data — one day holds
16 distinct exercises against 5 slots across four months — and guessing would
attach history to the wrong lift, corrupting progression suggestions. That is
worse than leaving it hidden. These fixes stop new orphans from forming.
