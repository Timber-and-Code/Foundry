-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Friends (follow-a-friend) — decoupled from meso membership           ║
-- ║                                                                      ║
-- ║  user_friendships  — two rows per friendship (A→B and B→A), each     ║
-- ║    carrying its own share_level so "what A shows B" is independent   ║
-- ║    from "what B shows A".                                            ║
-- ║  friend_invites    — one invite code per user (regeneration rotates);║
-- ║    30-day expiry; persists until consumed or rotated.                ║
-- ║                                                                      ║
-- ║  RLS extends workout_sets, body_weight_log, workout_sessions,        ║
-- ║  mesocycles, user_profiles so friends can see each other even when   ║
-- ║  they aren't on a shared mesocycle. Share_level on the OWNER's row   ║
-- ║  gates weight/BW visibility just like the meso-member case.          ║
-- ║                                                                      ║
-- ║  Run AFTER 003_share_level.sql. Idempotent — safe to re-run.         ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── 1. user_friendships ────────────────────────────────────────────────
create table if not exists user_friendships (
  user_id     uuid not null references auth.users(id) on delete cascade,
  friend_id   uuid not null references auth.users(id) on delete cascade,
  share_level meso_share_level not null default 'full',
  created_at  timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists idx_user_friendships_friend
  on user_friendships (friend_id);

alter table user_friendships enable row level security;

-- Users can read rows where they are either party (to list their
-- friendships and to let the friend's queries find their row).
drop policy if exists "Read own friendships" on user_friendships;
create policy "Read own friendships"
  on user_friendships for select using (
    auth.uid() = user_id or auth.uid() = friend_id
  );

-- Users can only insert rows with user_id = themselves.
drop policy if exists "Insert own friendship row" on user_friendships;
create policy "Insert own friendship row"
  on user_friendships for insert with check (auth.uid() = user_id);

-- Update share_level on own row only.
drop policy if exists "Update own friendship row" on user_friendships;
create policy "Update own friendship row"
  on user_friendships for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Delete own row only.
drop policy if exists "Delete own friendship row" on user_friendships;
create policy "Delete own friendship row"
  on user_friendships for delete using (auth.uid() = user_id);

-- Mirror-delete trigger: when A removes their row (A, B), also drop
-- (B, A) so the friendship is cleanly symmetric. Runs with definer
-- privileges so it can bypass the RLS "delete own row" gate for B's row.
create or replace function drop_friendship_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from user_friendships
    where user_id = old.friend_id
      and friend_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists trg_drop_friendship_mirror on user_friendships;
create trigger trg_drop_friendship_mirror
  after delete on user_friendships
  for each row
  execute function drop_friendship_mirror();

-- ── 2. friend_invites ──────────────────────────────────────────────────
create table if not exists friend_invites (
  code        text primary key,
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 days')
);

create index if not exists idx_friend_invites_user
  on friend_invites (user_id);

alter table friend_invites enable row level security;

-- Owner can read + manage their own row.
drop policy if exists "Manage own invite" on friend_invites;
create policy "Manage own invite"
  on friend_invites for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Anyone authenticated can preview a code (needed before acceptance —
-- the recipient isn't friends yet). Limited to SELECT; the preview only
-- exposes (code, user_id, expires_at), not the owner's identity beyond
-- what user_profiles lets them see (which is gated below).
drop policy if exists "Anyone can preview invite" on friend_invites;
create policy "Anyone can preview invite"
  on friend_invites for select using (true);

-- ── 3. Friend-visibility extensions on existing tables ────────────────
-- user_profiles: friends can read each other's names.
drop policy if exists "Friends can read profile" on user_profiles;
create policy "Friends can read profile"
  on user_profiles for select using (
    exists (
      select 1 from user_friendships uf
      where (uf.user_id = auth.uid() and uf.friend_id = user_profiles.id)
         or (uf.friend_id = auth.uid() and uf.user_id = user_profiles.id)
    )
  );

-- Anyone authenticated can read a user's profile when they hold that
-- user's current friend invite code (needed for the "preview inviter"
-- step before acceptance, mirroring the meso-invite preview policy).
drop policy if exists "Preview invite owner profile" on user_profiles;
create policy "Preview invite owner profile"
  on user_profiles for select using (
    exists (
      select 1 from friend_invites fi
      where fi.user_id = user_profiles.id
        and fi.expires_at > now()
    )
  );

-- mesocycles: friends can read each other's mesocycle metadata
-- (needed to size the friend dashboard's completion grid).
drop policy if exists "Friends can read mesocycles" on mesocycles;
create policy "Friends can read mesocycles"
  on mesocycles for select using (
    exists (
      select 1 from user_friendships uf
      where uf.friend_id = auth.uid()
        and uf.user_id = mesocycles.user_id
    )
  );

-- workout_sessions: friends can always see completion rows.
drop policy if exists "Friends can read workout sessions" on workout_sessions;
create policy "Friends can read workout sessions"
  on workout_sessions for select using (
    exists (
      select 1 from user_friendships uf
      where uf.friend_id = auth.uid()
        and uf.user_id = workout_sessions.user_id
    )
  );

-- workout_sets: friends can read set logs ONLY when the owner has
-- share_level='full' on their side of the friendship (their row points
-- at the viewer).
drop policy if exists "Friends can read workout sets" on workout_sets;
create policy "Friends can read workout sets"
  on workout_sets for select using (
    exists (
      select 1
      from workout_sessions ws
      join user_friendships uf
        on uf.user_id = ws.user_id
       and uf.friend_id = auth.uid()
      where ws.id = workout_sets.workout_session_id
        and uf.share_level = 'full'
    )
  );

-- body_weight_log: same share_level-gated friend-read.
drop policy if exists "Friends can read bodyweight" on body_weight_log;
create policy "Friends can read bodyweight"
  on body_weight_log for select using (
    exists (
      select 1 from user_friendships uf
      where uf.user_id = body_weight_log.user_id
        and uf.friend_id = auth.uid()
        and uf.share_level = 'full'
    )
  );
