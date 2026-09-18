-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  discard_empty_meso — an empty meso leaves no record                 ║
-- ║                                                                      ║
-- ║  Rule: a meso with no logged working sets was a mistake, not         ║
-- ║  history. Ending one used to mark it 'abandoned', and it lived on    ║
-- ║  as a zero-session row (and a Previous Meso Cycles entry).           ║
-- ║                                                                      ║
-- ║  Why an RPC and not a client-side delete: deleting a mesocycle       ║
-- ║  CASCADES to workout_sessions and workout_sets for EVERY user on     ║
-- ║  it, and the owner's client cannot be trusted to see a member's      ║
-- ║  sets. The emptiness check has to run here, with full visibility,    ║
-- ║  in the same statement as the delete.                                ║
-- ║                                                                      ║
-- ║  Deletes only when ALL hold:                                         ║
-- ║    - the caller owns the meso                                        ║
-- ║    - no other user is a member                                       ║
-- ║    - no workout_set in it (anyone's) has reps > 0 and isn't a warm-up║
-- ║  Returns true if deleted. false = keep it (caller marks abandoned).  ║
-- ║                                                                      ║
-- ║  Old clients never call it — they keep marking 'abandoned'.          ║
-- ║  Idempotent. Safe to re-run.                                         ║
-- ╚══════════════════════════════════════════════════════════════════════╝

create or replace function public.discard_empty_meso(p_meso_id uuid)
returns boolean
language plpgsql
security definer
-- Pinned: an unqualified search_path on a SECURITY DEFINER function is a
-- privilege-escalation vector.
set search_path = public, pg_temp
as $$
declare
  v_deleted int;
begin
  delete from mesocycles m
  where m.id = p_meso_id
    and m.user_id = auth.uid()
    and not exists (
      select 1 from mesocycle_members mm
      where mm.mesocycle_id = m.id
        and mm.user_id is not null
        and mm.user_id <> m.user_id
    )
    and not exists (
      select 1
      from workout_sessions ws
      join workout_sets s on s.workout_session_id = ws.id
      where ws.meso_id = m.id
        and coalesce(s.reps, 0) > 0
        and not coalesce(s.is_warmup, false)
    );
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.discard_empty_meso(uuid) from public, anon;
grant execute on function public.discard_empty_meso(uuid) to authenticated;
