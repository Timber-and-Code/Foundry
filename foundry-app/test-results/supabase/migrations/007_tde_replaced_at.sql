-- 007: append-only exercise swaps.
--
-- syncExerciseSwapRemote used to overwrite training_day_exercises.exercise_id
-- in place, orphaning every workout_sets row logged under the old exercise
-- (history pulls could no longer map them to a slot). Swaps now INSERT a new
-- row for the replacement and stamp the old row's replaced_at instead.
--
-- NULL = active. Program pulls keep only the newest active row per
-- (training_day_id, sort_order); workout-history pulls keep ALL rows so old
-- sets still resolve to their slot.
--
-- Additive and invisible to pre-007 clients: they never reference the column
-- and their inserts leave it NULL.

ALTER TABLE public.training_day_exercises
  ADD COLUMN IF NOT EXISTS replaced_at timestamptz;

COMMENT ON COLUMN public.training_day_exercises.replaced_at IS
  'Set when an exercise swap retires this row (append-only swaps). NULL = active row for its slot.';
