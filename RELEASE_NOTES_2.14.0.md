# The Foundry 2.14.0 — build 1

## What to test

**Your past lifts should finally show up.**
Open a workout and look under any exercise you've trained before. You should
see "Last meso: 185 lbs × 8" — and on a lift you haven't touched in a while,
"3 mesos ago: 155 lbs × 10". This used to appear only in week 1; it now shows
on every week, and only when there's nothing more recent to show you instead.
Back squat and overhead press are the two worth checking first.

**Your new cycles should keep your main lifts.**
When you start a new mesocycle, the big compound on each day now prefers a
lift you already have numbers for, instead of rolling a fresh variant. Your
accessories still rotate — that's deliberate.

**Full-body programs now train arms and calves.**
If you run a full-body split, check the week for curls, triceps and calf
work. They were structurally impossible to program before at any session
length under 75 minutes.

**The schedule should stop skipping ahead.**
Finish a workout, then check the Home card. If you've fallen behind, the
remaining sessions slide forward from today instead of staying stranded in
the past. The specific bug: training Monday and Tuesday on a Mon/Tue/Thu/Fri
split and being told your next workout is *next Monday*.

**Rebuild upcoming days** (Profile → Rebuild upcoming days)
Rebuilds only the days you haven't trained yet, so nothing you've logged is
touched. It previews and names the exact days before doing anything — please
read that confirm and tell us if the day list looks wrong.

**The profile drawer has been reorganised.**
Lifetime totals under your name, sync status as a dot, "N of M done" on the
cycle card, and Sessions now shows a denominator. About moved to the top of
the lower half. Tell us if anything you used regularly got harder to find.

**Account deletion** (Profile → Data → Delete account)
Please *don't* run it on your main account. Data deletion works; removing the
login itself needs a server function that isn't deployed yet, and the app
will tell you so honestly if you try.

## Known limitations in this build

- Meso names now include the start day (`6 Week FB — July 30, 2026`). Cycles
  created before this build keep their old month-only names.
- Deleting your account removes all training data but leaves the login until
  the server function is deployed. The app says so rather than pretending.

## Fixed

- Past-cycle history was never synced, so a fresh install or a sign-out lost
  every previous mesocycle. It now rebuilds from the server.
- Ending a cycle from the profile drawer didn't archive it, so whether your
  finished cycle survived depended on which button you used.
- A stale training-day schedule could carry over from one cycle into the next
  and put sessions on the wrong weekdays.
- Box Jump could be selected as a day's main lift despite carrying no load,
  which left nothing for progression to work with.
- Planks, sit-ups and other bodyweight work were being given weight-based
  progression they can never satisfy.
- Svend press and plate front raise could be programmed for lifters who told
  us they had no equipment.
