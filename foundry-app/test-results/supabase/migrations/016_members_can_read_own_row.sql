-- 016 — a user can always read their own membership row
--
-- Sharing a NEW program failed with "Could not generate invite code".
-- createMesoInvite upserts the owner's row, and INSERT ... ON CONFLICT DO
-- UPDATE requires the new row to pass the SELECT policy. That policy only
-- admitted rows of mesos the caller ALREADY belongs to (get_my_meso_ids(),
-- STABLE, so it cannot see the row being inserted) -- on a meso with no
-- membership yet the upsert was always rejected; a plain INSERT passed.
-- Exposes nothing new. APPLIED TO PROD 2026-09-20; verified as the owner
-- (upsert ok) and as another user (0 foreign rows visible).
drop policy if exists "Members can read shared memberships" on public.mesocycle_members;
create policy "Members can read shared memberships" on public.mesocycle_members
  for select using (
    user_id = auth.uid()
    or mesocycle_id in (select public.get_my_meso_ids())
  );
