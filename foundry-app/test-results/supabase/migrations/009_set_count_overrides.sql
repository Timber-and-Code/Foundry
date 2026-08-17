-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  set_count_overrides                                                 ║
-- ║                                                                      ║
-- ║  When a lifter adds or removes a set mid-workout, that choice was    ║
-- ║  local-only (foundry:setcount:d{day}:w{week} in localStorage), so    ║
-- ║  it never survived a reinstall or a second device. This table        ║
-- ║  mirrors that shape so the choice travels.                           ║
-- ║                                                                      ║
-- ║  Stored as the ABSOLUTE count the lifter chose for that (day, week), ║
-- ║  not as a delta. The delta is derived on read against whatever the   ║
-- ║  program prescribes for the week (see pickSetCount), which keeps     ║
-- ║  the periodization the source of truth for volume and lets the row   ║
-- ║  stay meaningful even if the program is later edited.                ║
-- ║                                                                      ║
-- ║  PER-USER, deliberately. On a shared mesocycle the training_day_     ║
-- ║  exercises row belongs to the owner — writing the override there     ║
-- ║  would change a training partner's prescription too. One lifter      ║
-- ║  adding a set must never touch the other's program.                  ║
-- ║                                                                      ║
-- ║  Idempotent. Safe to re-run.                                         ║
-- ╚══════════════════════════════════════════════════════════════════════╝

create table if not exists set_count_overrides (
  user_id      uuid not null references auth.users(id) on delete cascade,
  meso_id      uuid not null references mesocycles(id) on delete cascade,
  day_index    smallint not null check (day_index >= 0),
  week_number  smallint not null check (week_number >= 0),
  -- Matches workout_sets.exercise_id: EXERCISE_DB ids plus `custom:` slugs.
  exercise_id  text not null,
  sets         smallint not null check (sets >= 1 and sets <= 20),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, meso_id, day_index, week_number, exercise_id)
);

-- Pull path fetches a whole mesocycle at once.
create index if not exists idx_set_count_overrides_meso
  on set_count_overrides (user_id, meso_id);

alter table set_count_overrides enable row level security;

drop policy if exists "Read own set count overrides" on set_count_overrides;
create policy "Read own set count overrides"
  on set_count_overrides for select using (auth.uid() = user_id);

drop policy if exists "Insert own set count overrides" on set_count_overrides;
create policy "Insert own set count overrides"
  on set_count_overrides for insert with check (auth.uid() = user_id);

drop policy if exists "Update own set count overrides" on set_count_overrides;
create policy "Update own set count overrides"
  on set_count_overrides for update using (auth.uid() = user_id);

drop policy if exists "Delete own set count overrides" on set_count_overrides;
create policy "Delete own set count overrides"
  on set_count_overrides for delete using (auth.uid() = user_id);
