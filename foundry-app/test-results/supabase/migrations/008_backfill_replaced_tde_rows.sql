-- 008_backfill_replaced_tde_rows.sql
--
-- Repairs history orphaned by the old in-place exercise swap.
--
-- Until this release, syncExerciseSwapRemote UPDATEd
-- training_day_exercises.exercise_id in place. That destroyed the only
-- mapping from the swapped-out exercise's workout_sets back to a slot:
-- pullWorkoutHistory resolves a set's position via
-- (training_day_id, exercise_id) -> sort_order and silently drops any set
-- that doesn't resolve. Every set a lifter logged against an exercise they
-- later swapped away vanished from the app on the next pull.
--
-- The sets themselves were never lost — workout_sets still carries
-- exercise_id. Only the tde mapping row is missing, so it can be
-- reconstructed: for each orphaned (training_day_id, exercise_id) pair,
-- insert a tde row stamped replaced_at so the program build ignores it
-- (it filters `replaced_at is null`) while the history mapper still reads
-- it.
--
-- Measured before writing (2026-07-30): 58 of 621 workout_sets orphaned,
-- across 18 distinct exercises.
--
-- Requires 007_tde_replaced_at.sql (the replaced_at column).
--
-- Idempotent: the NOT EXISTS guard means re-running inserts nothing.
-- Reversible: DELETE FROM training_day_exercises WHERE modifier =
-- 'backfill:007' removes exactly what this added and restores the prior
-- (broken) behaviour. NB the tag stays 'backfill:007' even though the file
-- renumbered to 008 — it is already written on 18 production rows, and
-- renaming it there would only break the documented reversal.

begin;

-- Preview — run this alone first and eyeball the count.
-- select count(*) from (
with orphans as (
  select distinct
    s.training_day_id,
    ws.exercise_id
  from workout_sets ws
  join workout_sessions s on s.id = ws.workout_session_id
  left join training_day_exercises tde
    on tde.training_day_id = s.training_day_id
   and tde.exercise_id = ws.exercise_id
  where tde.id is null
)
insert into training_day_exercises (
  training_day_id,
  user_id,
  exercise_id,
  sort_order,
  sets,
  rep_min,
  rep_max,
  progression,
  is_warmup,
  is_anchor,
  modifier,
  replaced_at
)
select
  o.training_day_id,
  td.user_id,
  o.exercise_id,
  -- The true original sort_order is unrecoverable. Do NOT reuse the live
  -- occupant's slot: pullWorkoutHistory rebuilds a [exIdx][set_number]
  -- blob and lets the live exercise win a collision, so a recovered set
  -- sharing a slot with a live one is silently overwritten — mapped but
  -- still invisible, which defeats the entire backfill. (Measured on the
  -- first attempt: 55 of 58 sets lost that way.)
  --
  -- Park each recovered exercise in its own slot ABOVE every live row.
  -- Position doesn't need to be truthful: the program build filters
  -- replaced rows out, so these indices never render, and every history
  -- reader (findPrevSlotForExercise, findSliceByExId, aggregateLiftsByMuscle)
  -- matches on the _exId stamp rather than the slot. What matters is only
  -- that each recovered exercise gets a slot of its own.
  (
    select coalesce(max(live.sort_order), -1)
    from training_day_exercises live
    where live.training_day_id = o.training_day_id
      and live.replaced_at is null
  )
  + row_number() over (
      partition by o.training_day_id order by o.exercise_id
    ) as sort_order,
  3, 8, 12,
  'double_progression'::progression_type,
  false,
  false,
  'backfill:007',
  -- Stamped in the past so it can never be mistaken for a live row or for
  -- a swap that happened after this migration.
  timestamptz '1970-01-01 00:00:00+00'
from orphans o
join training_days td on td.id = o.training_day_id
where not exists (
  select 1
  from training_day_exercises existing
  where existing.training_day_id = o.training_day_id
    and existing.exercise_id = o.exercise_id
);
-- ) preview;

-- REPAIR for the first run of this file (2026-07-30), which assigned every
-- recovered row min(live.sort_order) — i.e. slot 0 — and so left the sets
-- mapped but overwritten. Re-slots them above the live rows. A no-op on a
-- database where the corrected INSERT above ran instead.
update training_day_exercises t
set sort_order = r.new_order
from (
  select
    tde.id,
    (select coalesce(max(live.sort_order), -1)
       from training_day_exercises live
      where live.training_day_id = tde.training_day_id
        and live.replaced_at is null)
    + row_number() over (partition by tde.training_day_id order by tde.exercise_id) as new_order
  from training_day_exercises tde
  where tde.modifier = 'backfill:007'
) r
where t.id = r.id
  and t.sort_order is distinct from r.new_order;

-- Verify. All three must be 0 before committing:
--   remaining_orphaned_sets — every set resolves to a tde row
--   colliding_sessions      — no two recovered exercises share a slot
--   sets_losing_to_live     — no recovered set is overwritten by a live one
select
  (select count(*) from workout_sets ws
     join workout_sessions s on s.id = ws.workout_session_id
     left join training_day_exercises tde
       on tde.training_day_id = s.training_day_id and tde.exercise_id = ws.exercise_id
    where tde.id is null) as remaining_orphaned_sets,
  (select count(*) from (
     select ws.workout_session_id
     from workout_sets ws
     join workout_sessions s on s.id = ws.workout_session_id
     join training_day_exercises tde
       on tde.training_day_id = s.training_day_id
      and tde.exercise_id = ws.exercise_id
      and tde.modifier = 'backfill:007'
     group by ws.workout_session_id, tde.sort_order
     having count(distinct ws.exercise_id) > 1
   ) c) as colliding_sessions,
  (select count(*) from workout_sets ws
     join workout_sessions s on s.id = ws.workout_session_id
     join training_day_exercises tde
       on tde.training_day_id = s.training_day_id
      and tde.exercise_id = ws.exercise_id
      and tde.modifier = 'backfill:007'
    where exists (
      select 1 from workout_sets ws2
      join training_day_exercises live
        on live.training_day_id = s.training_day_id
       and live.exercise_id = ws2.exercise_id
       and live.replaced_at is null
       and live.sort_order = tde.sort_order
      where ws2.workout_session_id = ws.workout_session_id
        and ws2.set_number = ws.set_number
    )) as sets_losing_to_live;

commit;
