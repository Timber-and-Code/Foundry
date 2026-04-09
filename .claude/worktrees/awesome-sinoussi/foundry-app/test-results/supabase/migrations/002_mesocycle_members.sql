-- Train with Friends: mesocycle_members table + shared-meso RLS policies
-- Run this in the Supabase SQL Editor before deploying the app update.

-- ── mesocycle_members ──────────────────────────────────────────────────
create table if not exists mesocycle_members (
  mesocycle_id  uuid not null references mesocycles(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'member' check (role in ('owner', 'member')),
  invite_code   text unique,
  joined_at     timestamptz not null default now(),
  primary key (mesocycle_id, user_id)
);

create index if not exists idx_mesocycle_members_invite_code
  on mesocycle_members (invite_code) where invite_code is not null;

alter table mesocycle_members enable row level security;

-- Members can see other members of mesos they belong to
create policy "Members can read shared memberships"
  on mesocycle_members for select using (
    exists (
      select 1 from mesocycle_members mm
      where mm.mesocycle_id = mesocycle_members.mesocycle_id
        and mm.user_id = auth.uid()
    )
  );

-- Anyone authenticated can read a row by invite_code (needed for join preview)
create policy "Anyone can lookup by invite code"
  on mesocycle_members for select using (
    invite_code is not null
  );

-- Users can only insert themselves
create policy "Users can join as themselves"
  on mesocycle_members for insert with check (auth.uid() = user_id);

-- Users can only delete their own membership
create policy "Users can leave"
  on mesocycle_members for delete using (auth.uid() = user_id);

-- ── Additional SELECT policies on existing tables for shared mesos ────

-- mesocycles: members can read shared mesocycles
create policy "Members can read shared mesocycles"
  on mesocycles for select using (
    exists (
      select 1 from mesocycle_members
      where mesocycle_members.mesocycle_id = mesocycles.id
        and mesocycle_members.user_id = auth.uid()
    )
  );

-- training_days: members can read shared training days
create policy "Members can read shared training days"
  on training_days for select using (
    exists (
      select 1 from mesocycle_members
      where mesocycle_members.mesocycle_id = training_days.meso_id
        and mesocycle_members.user_id = auth.uid()
    )
  );

-- training_day_exercises: members can read shared exercises
create policy "Members can read shared training day exercises"
  on training_day_exercises for select using (
    exists (
      select 1 from training_days td
      join mesocycle_members mm on mm.mesocycle_id = td.meso_id
      where td.id = training_day_exercises.training_day_id
        and mm.user_id = auth.uid()
    )
  );

-- workout_sessions: members can read each other's sessions on shared mesos
create policy "Members can read shared workout sessions"
  on workout_sessions for select using (
    exists (
      select 1 from mesocycle_members
      where mesocycle_members.mesocycle_id = workout_sessions.meso_id
        and mesocycle_members.user_id = auth.uid()
    )
  );

-- workout_sets: members can read each other's sets on shared mesos
create policy "Members can read shared workout sets"
  on workout_sets for select using (
    exists (
      select 1 from workout_sessions ws
      join mesocycle_members mm on mm.mesocycle_id = ws.meso_id
      where ws.id = workout_sets.workout_session_id
        and mm.user_id = auth.uid()
    )
  );

-- user_profiles: members can read each other's names (for the friends strip)
create policy "Members can read shared member profiles"
  on user_profiles for select using (
    exists (
      select 1 from mesocycle_members mm1
      join mesocycle_members mm2 on mm1.mesocycle_id = mm2.mesocycle_id
      where mm1.user_id = auth.uid()
        and mm2.user_id = user_profiles.id
    )
  );
