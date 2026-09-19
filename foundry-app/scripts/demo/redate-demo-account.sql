-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Re-date the App Review demo account (demo@thefoundry.coach)          ║
-- ║                                                                      ║
-- ║  The seeded history (active 6-week full-body meso, 2 complete weeks, ║
-- ║  120 sets, readiness, a 5-point body-weight trend) is good — it just ║
-- ║  goes stale. Once the last session is 7+ days old a reviewer lands   ║
-- ║  on the "welcome back after a break" sheet instead of the app.       ║
-- ║                                                                      ║
-- ║  This shifts EVERY dated row for the demo user forward by whole      ║
-- ║  weeks (weekdays stay aligned with the program's training days), as ║
-- ║  far as it can go without putting the last session in the future.   ║
-- ║  updated_at columns are set to now() so a fresh device's pull treats ║
-- ║  the server copy as newest.                                          ║
-- ║                                                                      ║
-- ║  RUN IT AGAIN RIGHT BEFORE EVERY SUBMISSION (and if review stalls).  ║
-- ║  Idempotent: a second run the same day shifts by 0 weeks.            ║
-- ║  Touches only user bf4e02f4-a650-49d9-8c0a-7c070771085f.             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
do $$
declare
  demo uuid := 'bf4e02f4-a650-49d9-8c0a-7c070771085f';
  last_done date;
  shift int;
  d interval;
begin
  -- The LATEST dated row of any kind, not just the last session: the
  -- body-weight trend runs two days past it, and a shift keyed on sessions
  -- alone put a weigh-in in the future (first run, 2026-09-18).
  select greatest(
    (select max(completed_at)::date from workout_sessions where user_id = demo and is_complete),
    (select max(logged_at) from body_weight_log where user_id = demo),
    (select max(checked_at) from readiness_checkins where user_id = demo)
  ) into last_done;
  if last_done is null then
    raise exception 'demo account has no history — re-seed it first';
  end if;

  shift := floor((current_date - last_done) / 7.0)::int * 7;
  d := make_interval(days => shift);
  raise notice 'last session % → shifting by % days', last_done, shift;
  if shift = 0 then return; end if;

  update mesocycles set started_at = started_at + shift,
    completed_at = case when completed_at is null then null else completed_at + shift end,
    created_at = created_at + d, updated_at = now()
  where user_id = demo;

  update workout_sessions set completed_at = completed_at + d, started_at = started_at + d,
    created_at = created_at + d, updated_at = now()
  where user_id = demo;

  update workout_sets set created_at = created_at + d where user_id = demo;
  update session_prs set achieved_at = achieved_at + d where user_id = demo;
  update readiness_checkins set checked_at = checked_at + shift, created_at = created_at + d where user_id = demo;
  update body_weight_log set logged_at = logged_at + shift, created_at = created_at + d, updated_at = now() where user_id = demo;
  update cardio_sessions set performed_at = performed_at + d, created_at = created_at + d, updated_at = now() where user_id = demo;
  update notes set created_at = created_at + d, updated_at = now() where user_id = demo;
  update training_days set created_at = created_at + d where user_id = demo;
  update training_day_exercises set created_at = created_at + d,
    replaced_at = case when replaced_at is null then null else replaced_at + d end
  where user_id = demo;
  update user_profiles set updated_at = now() where id = demo;
end $$;

-- Check: start, last session, sessions done, today's position, and that
-- nothing is dated in the future.
select m.started_at, max(ws.completed_at)::date as last_session,
  count(*) filter (where ws.is_complete) as sessions_done,
  (current_date - m.started_at) / 7 + 1 as current_week,
  (select max(logged_at) from body_weight_log where user_id = m.user_id) <= current_date as bw_not_future
from mesocycles m join workout_sessions ws on ws.meso_id = m.id
where m.user_id = 'bf4e02f4-a650-49d9-8c0a-7c070771085f' and m.status = 'active'
group by m.started_at, m.user_id;
