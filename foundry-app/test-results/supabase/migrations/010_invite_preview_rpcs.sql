-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Invite preview RPCs                                                 ║
-- ║                                                                      ║
-- ║  Redeeming an invite requires knowing something about its owner —    ║
-- ║  their name, the program's name — before you've joined. That was     ║
-- ║  served by RLS policies that granted a blanket read whenever the     ║
-- ║  TARGET had an invite code, never checking whether the CALLER knew   ║
-- ║  it. Net effect: any signed-in account could enumerate every user    ║
-- ║  profile (name, gender, date of birth, body weight), every           ║
-- ║  mesocycle, and every live join code.                                ║
-- ║                                                                      ║
-- ║  These functions invert that. You must present the exact code to     ║
-- ║  learn anything, and you learn only what the join screen shows.      ║
-- ║  SECURITY DEFINER so the underlying tables can go back to            ║
-- ║  owner-only in migration 011.                                        ║
-- ║                                                                      ║
-- ║  ORDER MATTERS: apply this one FIRST and ship the client that calls  ║
-- ║  these RPCs. Only then apply 011, which removes the permissive       ║
-- ║  policies. Reversing that breaks invite previews for every client    ║
-- ║  still running the old code.                                         ║
-- ║                                                                      ║
-- ║  Idempotent. Safe to re-run.                                         ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── Friend invite (friend_invites.code) ─────────────────────────────────
create or replace function public.preview_friend_invite(p_code text)
returns table (
  code         text,
  inviter_id   uuid,
  inviter_name text,
  expires_at   timestamptz
)
language sql
security definer
-- Pinned: an unqualified search_path on a SECURITY DEFINER function is a
-- privilege-escalation vector.
set search_path = public, pg_temp
stable
as $$
  select
    fi.code,
    fi.user_id,
    coalesce(nullif(up.name, ''), 'Friend'),
    fi.expires_at
  from friend_invites fi
  left join user_profiles up on up.id = fi.user_id
  where fi.code = upper(trim(p_code))
    and fi.expires_at > now()
  limit 1;
$$;

-- ── Mesocycle invite (mesocycle_members.invite_code) ────────────────────
create or replace function public.preview_meso_invite(p_code text)
returns table (
  meso_id    uuid,
  meso_name  text,
  owner_name text
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    m.id,
    m.name,
    coalesce(nullif(up.name, ''), 'Someone')
  from mesocycle_members mm
  join mesocycles m on m.id = mm.mesocycle_id
  left join user_profiles up on up.id = m.user_id
  where mm.invite_code = upper(trim(p_code))
  limit 1;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, which would leave these
-- callable by `anon` — exactly the exposure we're closing. Signed-in
-- callers only.
revoke execute on function public.preview_friend_invite(text) from public;
revoke execute on function public.preview_friend_invite(text) from anon;
grant  execute on function public.preview_friend_invite(text) to authenticated;

revoke execute on function public.preview_meso_invite(text) from public;
revoke execute on function public.preview_meso_invite(text) from anon;
grant  execute on function public.preview_meso_invite(text) to authenticated;
