-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Train with Friends — share-level privacy gate                       ║
-- ║                                                                      ║
-- ║  Adds mesocycle_members.share_level ('full' | 'basic') with default  ║
-- ║  'full', then updates friend-read RLS on workout_sets and adds a     ║
-- ║  new policy on body_weight_log so both only expose rows whose owner  ║
-- ║  is sharing 'full' on the relevant mesocycle.                        ║
-- ║                                                                      ║
-- ║  Run in the Supabase SQL Editor. Idempotent — safe to re-run.        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── 1. meso_share_level enum + column ──────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'meso_share_level') then
    create type meso_share_level as enum ('full', 'basic');
  end if;
end $$;

alter table mesocycle_members
  add column if not exists share_level meso_share_level not null default 'full';

-- ── 2. workout_sets: replace friends-read with share-level-aware policy ─
-- The existing "Members can read shared workout sets" policy from 002 was
-- unconditional. Drop it and re-create so only owners with share_level =
-- 'full' expose their set logs. Self-reads go through the user's own
-- RLS policies (untouched).
drop policy if exists "Members can read shared workout sets" on workout_sets;

create policy "Members can read shared workout sets"
  on workout_sets for select using (
    exists (
      select 1
      from workout_sessions ws
      join mesocycle_members mm_owner
        on mm_owner.mesocycle_id = ws.meso_id
       and mm_owner.user_id = ws.user_id
      join mesocycle_members mm_viewer
        on mm_viewer.mesocycle_id = ws.meso_id
       and mm_viewer.user_id = auth.uid()
      where ws.id = workout_sets.workout_session_id
        and mm_owner.share_level = 'full'
    )
  );

-- ── 3. body_weight_log: new friends-read policy, gated to 'full' ───────
-- Nothing in 002 shared body_weight_log between members, so adding this
-- policy only opens visibility for share_level='full' members — 'basic'
-- never exposes bodyweight to friends. Self-reads stay on the existing
-- "Users can read their own body weight" policy.
drop policy if exists "Members can read shared bodyweight" on body_weight_log;

create policy "Members can read shared bodyweight"
  on body_weight_log for select using (
    exists (
      select 1
      from mesocycle_members mm_owner
      join mesocycle_members mm_viewer
        on mm_viewer.mesocycle_id = mm_owner.mesocycle_id
      where mm_owner.user_id = body_weight_log.user_id
        and mm_viewer.user_id = auth.uid()
        and mm_viewer.user_id <> body_weight_log.user_id
        and mm_owner.share_level = 'full'
    )
  );

-- ── 4. mesocycle_members: members can update their own share_level ─────
-- Without this, the "edit sharing" toggle in meso settings would be
-- silently blocked by RLS. Narrow to updating only the caller's row.
drop policy if exists "Users can update own share level" on mesocycle_members;

create policy "Users can update own share level"
  on mesocycle_members for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
