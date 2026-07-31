-- 007_backfill_replaced_tde_rows.sql
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
-- Idempotent: the NOT EXISTS guard means re-running inserts nothing.
-- Reversible: DELETE FROM training_day_exercises WHERE modifier =
-- 'backfill:007' removes exactly what this added and restores the prior
-- (broken) behaviour.

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
  -- Best-effort slot. The true original sort_order is unrecoverable, so
  -- reuse the position the replacement occupies today: the swap kept the
  -- slot, only the occupant changed. Falls back to 0 when the day has no
  -- live rows at all.
  coalesce(
    (
      select min(live.sort_order)
      from training_day_exercises live
      where live.training_day_id = o.training_day_id
        and live.replaced_at is null
    ),
    0
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

-- Verify: should return 0 orphaned sets after the insert.
select count(*) as remaining_orphaned_sets
from workout_sets ws
join workout_sessions s on s.id = ws.workout_session_id
left join training_day_exercises tde
  on tde.training_day_id = s.training_day_id
 and tde.exercise_id = ws.exercise_id
where tde.id is null;

commit;
