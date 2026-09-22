-- 017 — in-app feedback
--
-- "Send feedback" posted to a worker route that never existed, so it failed
-- for everyone. Feedback now lands here: insert-only for clients (signed in
-- or not), readable only from the dashboard / service role.
-- APPLIED TO PROD 2026-09-20; verified: anon + authed insert ok, spoofing
-- another user_id blocked, no client can read.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null check (char_length(message) between 1 and 4000),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  platform text check (platform is null or char_length(platform) <= 20),
  device text check (device is null or char_length(device) <= 400)
);

alter table public.feedback enable row level security;

-- No SELECT / UPDATE / DELETE policy on purpose: clients can only add.
create policy "Anyone can send feedback" on public.feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;
