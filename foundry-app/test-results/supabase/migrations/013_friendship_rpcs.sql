-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Friendship RPCs — accept and remove as ONE server-side operation     ║
-- ║                                                                      ║
-- ║  user_friendships holds two rows per friendship (A→B, B→A), and RLS  ║
-- ║  only lets a user write their OWN row. So the client's accept could  ║
-- ║  only insert the accepter's row: the inviter's mirror insert and the ║
-- ║  "consume the invite" delete were both silently denied. Every        ║
-- ║  accepted invite produced a one-sided friendship (the inviter saw    ║
-- ║  the accepter; the accepter saw nobody) and left the one-time code   ║
-- ║  reusable. Removing a friend had the mirror problem in reverse: a    ║
-- ║  user with no row of their own could not remove someone at all.     ║
-- ║                                                                      ║
-- ║  SECURITY DEFINER, search_path pinned, callers limited to            ║
-- ║  `authenticated`, and every statement is scoped to auth.uid().       ║
-- ║                                                                      ║
-- ║  Additive: old clients keep working (their direct inserts/deletes    ║
-- ║  are unchanged). Idempotent. Safe to re-run.                         ║
-- ║                                                                      ║
-- ║  The one-sided rows already in production are NOT repaired here —    ║
-- ║  making them mutual changes who can see whose training, so it is a   ║
-- ║  separate, explicitly approved statement.                            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

create or replace function public.accept_friend_invite(p_code text, p_share_level text default 'full')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_inviter uuid;
  v_level meso_share_level;
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  v_level := case when p_share_level = 'basic' then 'basic'::meso_share_level else 'full'::meso_share_level end;

  select fi.user_id into v_inviter
  from friend_invites fi
  where fi.code = upper(trim(p_code)) and fi.expires_at > now()
  limit 1;

  if v_inviter is null then
    raise exception 'invalid or expired code' using errcode = 'P0002';
  end if;
  if v_inviter = v_me then
    raise exception 'own code' using errcode = '22023';
  end if;

  -- The accepter chose their level; the inviter's side starts at 'full'
  -- (they shared the code) and can be changed from the friend sheet.
  insert into user_friendships (user_id, friend_id, share_level)
  values (v_me, v_inviter, v_level)
  on conflict (user_id, friend_id) do update set share_level = excluded.share_level;

  insert into user_friendships (user_id, friend_id, share_level)
  values (v_inviter, v_me, 'full')
  on conflict (user_id, friend_id) do nothing;

  -- One-time code.
  delete from friend_invites where code = upper(trim(p_code));

  return v_inviter;
end;
$$;

create or replace function public.remove_friend(p_friend_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_deleted int;
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from user_friendships
  where (user_id = v_me and friend_id = p_friend_id)
     or (user_id = p_friend_id and friend_id = v_me);
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.accept_friend_invite(text, text) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.accept_friend_invite(text, text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
