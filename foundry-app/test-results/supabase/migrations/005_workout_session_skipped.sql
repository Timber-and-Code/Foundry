-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  workout_sessions.skipped                                            ║
-- ║                                                                      ║
-- ║  Adds an explicit skipped flag so a user's "I'm skipping this        ║
-- ║  session" decision propagates across devices. Source of truth was    ║
-- ║  localStorage (foundry:skip:d{n}:w{n}); the syncSkippedToSupabase    ║
-- ║  helper in sync.ts was a stub waiting for this column.               ║
-- ║                                                                      ║
-- ║  Idempotent. Safe to re-run.                                         ║
-- ╚══════════════════════════════════════════════════════════════════════╝

alter table workout_sessions
  add column if not exists skipped boolean not null default false;

-- Partial index — most rows are not skipped; only index the ones that are.
create index if not exists idx_workout_sessions_skipped
  on workout_sessions (user_id, week_number, day_number)
  where skipped = true;
