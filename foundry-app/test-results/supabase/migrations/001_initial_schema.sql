-- Foundry Initial Schema
-- 6 tables with RLS policies for user-scoped data isolation

-- ── user_profiles ──────────────────────────────────────────────────
create table if not exists user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

alter table user_profiles enable row level security;

create policy "Users can read own profile"
  on user_profiles for select using (auth.uid() = id);
create policy "Users can upsert own profile"
  on user_profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on user_profiles for update using (auth.uid() = id);

-- ── workout_sessions ───────────────────────────────────────────────
create table if not exists workout_sessions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  day_idx     int not null,
  week_idx    int not null,
  data        jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  unique (user_id, day_idx, week_idx)
);

alter table workout_sessions enable row level security;

create policy "Users can read own sessions"
  on workout_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions"
  on workout_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions"
  on workout_sessions for update using (auth.uid() = user_id);

-- ── readiness_checkins ─────────────────────────────────────────────
create table if not exists readiness_checkins (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  sleep       text,
  soreness    text,
  energy      text,
  score       int,
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

alter table readiness_checkins enable row level security;

create policy "Users can read own checkins"
  on readiness_checkins for select using (auth.uid() = user_id);
create policy "Users can insert own checkins"
  on readiness_checkins for insert with check (auth.uid() = user_id);
create policy "Users can update own checkins"
  on readiness_checkins for update using (auth.uid() = user_id);

-- ── body_weight_log ────────────────────────────────────────────────
create table if not exists body_weight_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  weight_lbs  numeric(6,2) not null,
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

alter table body_weight_log enable row level security;

create policy "Users can read own weight log"
  on body_weight_log for select using (auth.uid() = user_id);
create policy "Users can insert own weight log"
  on body_weight_log for insert with check (auth.uid() = user_id);
create policy "Users can update own weight log"
  on body_weight_log for update using (auth.uid() = user_id);

-- ── cardio_sessions ────────────────────────────────────────────────
create table if not exists cardio_sessions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  data        jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

alter table cardio_sessions enable row level security;

create policy "Users can read own cardio"
  on cardio_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own cardio"
  on cardio_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own cardio"
  on cardio_sessions for update using (auth.uid() = user_id);

-- ── notes ──────────────────────────────────────────────────────────
create table if not exists notes (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  day_idx         int not null,
  week_idx        int not null,
  session_notes   text,
  exercise_notes  jsonb,
  updated_at      timestamptz not null default now(),
  unique (user_id, day_idx, week_idx)
);

alter table notes enable row level security;

create policy "Users can read own notes"
  on notes for select using (auth.uid() = user_id);
create policy "Users can insert own notes"
  on notes for insert with check (auth.uid() = user_id);
create policy "Users can update own notes"
  on notes for update using (auth.uid() = user_id);
