-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Mutual sharing — one level per friendship, applied both ways        ║
-- ║                                                                      ║
-- ║  Product rule (owner, 2026-09-18): a friendship shares the same      ║
-- ║  level in both directions. The accepter's choice on the invite       ║
-- ║  applies to both rows, and changing it from the friend sheet changes ║
-- ║  both rows. The two-row table stays (RLS reads the owner's row), the ║
-- ║  rows are just kept equal.                                           ║
-- ║                                                                      ║
-- ║  Supersedes 013's accept (inviter row was hard-coded 'full').        ║
-- ║  Idempotent. Safe to re-run.                                         ║
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

  insert into user_friendships (user_id, friend_id, share_level)
  values (v_me, v_inviter, v_level), (v_inviter, v_me, v_level)
  on conflict (user_id, friend_id) do update set share_level = excluded.share_level;

  delete from friend_invites where code = upper(trim(p_code));

  return v_inviter;
end;
$$;

-- Change the level of an EXISTING friendship, both rows. Refuses to create a
-- friendship: at least one row must already connect the two users.
create or replace function public.set_friend_share_level(p_friend_id uuid, p_share_level text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_level meso_share_level;
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not exists (
    select 1 from user_friendships
    where (user_id = v_me and friend_id = p_friend_id)
       or (user_id = p_friend_id and friend_id = v_me)
  ) then
    return false;
  end if;
  v_level := case when p_share_level = 'basic' then 'basic'::meso_share_level else 'full'::meso_share_level end;

  insert into user_friendships (user_id, friend_id, share_level)
  values (v_me, p_friend_id, v_level), (p_friend_id, v_me, v_level)
  on conflict (user_id, friend_id) do update set share_level = excluded.share_level;
  return true;
end;
$$;

revoke all on function public.set_friend_share_level(uuid, text) from public, anon;
grant execute on function public.set_friend_share_level(uuid, text) to authenticated;
