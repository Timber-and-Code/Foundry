-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  user_cardio_presets                                                 ║
-- ║                                                                      ║
-- ║  CardioDesigner saves user-composed sessions ("My usual: bike +     ║
-- ║  zone 2 + 45min") so they reappear as chips on the Home cardio       ║
-- ║  card. Local-only until now (foundry:cardio:user-presets in          ║
-- ║  localStorage); this table mirrors that shape so the chips travel    ║
-- ║  across devices.                                                     ║
-- ║                                                                      ║
-- ║  ID is client-generated and matches the localStorage entry's id      ║
-- ║  for clean round-trips. Composite primary key (user_id, id) so two   ║
-- ║  users can't collide on id space.                                    ║
-- ║                                                                      ║
-- ║  Idempotent. Safe to re-run.                                         ║
-- ╚══════════════════════════════════════════════════════════════════════╝

create table if not exists user_cardio_presets (
  user_id          uuid not null references auth.users(id) on delete cascade,
  id               text not null,
  label            text not null,
  description      text,
  intensity        text not null,
  modality         text not null,
  modality_custom  text,
  protocol         text not null,
  target_minutes   smallint not null check (target_minutes > 0 and target_minutes <= 600),
  intervals        jsonb,
  recommended_for  text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists idx_user_cardio_presets_user
  on user_cardio_presets (user_id, updated_at desc);

alter table user_cardio_presets enable row level security;

drop policy if exists "Read own cardio presets" on user_cardio_presets;
create policy "Read own cardio presets"
  on user_cardio_presets for select using (auth.uid() = user_id);

drop policy if exists "Insert own cardio presets" on user_cardio_presets;
create policy "Insert own cardio presets"
  on user_cardio_presets for insert with check (auth.uid() = user_id);

drop policy if exists "Update own cardio presets" on user_cardio_presets;
create policy "Update own cardio presets"
  on user_cardio_presets for update using (auth.uid() = user_id);

drop policy if exists "Delete own cardio presets" on user_cardio_presets;
create policy "Delete own cardio presets"
  on user_cardio_presets for delete using (auth.uid() = user_id);
