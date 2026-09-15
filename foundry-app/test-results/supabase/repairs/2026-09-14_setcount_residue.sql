-- Repair: clear no-op set-count override rows on meso 90f0d431.
--
-- Context: before 7db9380, saveSetCount stored a row even when the lifter's
-- chosen count changed nothing, so adding a set and taking it straight back
-- off left a permanent mark. pickSetCount reads any stored row as an
-- explicit choice, so these rows are inert only until a swap or program edit
-- moves the base under them — at which point they become a real delta.
--
-- Week 2 of this 7-week meso is an MAV week, so that week's base is exactly
-- training_day_exercises.sets. A stored value equal to it is residue.
--
-- SCOPE. user_id is NOT optional: this meso is shared with Tyler, and his
-- rows must not be touched. Only week-2 rows with a live tde row are
-- considered; the three week-5 rows are deliberate add-backs and stay.
--
-- Run the SELECT first and confirm it returns the 9 expected rows. The
-- DELETE is wrapped so it can be inspected before COMMIT.

with live_tde as (
  select td.day_index, tde.exercise_id, tde.sets as base_sets
  from training_day_exercises tde
  join training_days td on td.id = tde.training_day_id
  where td.meso_id = '90f0d431-2e83-42f1-8be4-a81da7c5942a'
    and tde.user_id = 'c38c0991-b2f3-4ce7-8583-9cd8efbdaa65'
    and tde.replaced_at is null
)
select o.day_index, o.week_number, o.exercise_id, o.sets, t.base_sets
from set_count_overrides o
join live_tde t on t.day_index = o.day_index and t.exercise_id = o.exercise_id
where o.user_id = 'c38c0991-b2f3-4ce7-8583-9cd8efbdaa65'
  and o.meso_id  = '90f0d431-2e83-42f1-8be4-a81da7c5942a'
  and o.week_number = 2
  and o.sets = t.base_sets
order by o.day_index, o.exercise_id;

-- Expected, 9 rows:
--   d0 cable_fly_low_high / custom:seated-cable-row-close-grip /
--      half_kneeling_cable_pulldown
--   d1 db_bulgarian_split_squat / incline_db_curl
--   d2 preacher_curl_db
--   d3 inverted_row / machine_chest_press / single_leg_machine_curl

begin;

with live_tde as (
  select td.day_index, tde.exercise_id, tde.sets as base_sets
  from training_day_exercises tde
  join training_days td on td.id = tde.training_day_id
  where td.meso_id = '90f0d431-2e83-42f1-8be4-a81da7c5942a'
    and tde.user_id = 'c38c0991-b2f3-4ce7-8583-9cd8efbdaa65'
    and tde.replaced_at is null
)
delete from set_count_overrides o
using live_tde t
where o.user_id = 'c38c0991-b2f3-4ce7-8583-9cd8efbdaa65'
  and o.meso_id  = '90f0d431-2e83-42f1-8be4-a81da7c5942a'
  and o.week_number = 2
  and t.day_index   = o.day_index
  and t.exercise_id = o.exercise_id
  and o.sets = t.base_sets;
-- expect: DELETE 9

-- rollback;  -- if the count is anything other than 9
commit;
