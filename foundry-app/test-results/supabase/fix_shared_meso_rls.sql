-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Fix: ensure training_days + training_day_exercises allow shared     ║
-- ║  meso reads for mesocycle_members. Run AFTER verify_shared_meso_rls ║
-- ║  confirms the policies are missing.                                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Only run the CREATE POLICY statements for policies that DON'T already exist.
-- If you get "policy already exists" errors, that's fine — skip those.

-- ── training_days: members can read shared training days ────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'training_days'
      AND policyname = 'Members can read shared training days'
  ) THEN
    EXECUTE '
      CREATE POLICY "Members can read shared training days"
        ON training_days FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM mesocycle_members
            WHERE mesocycle_members.mesocycle_id = training_days.meso_id
              AND mesocycle_members.user_id = auth.uid()
          )
        )';
  END IF;
END $$;

-- ── training_day_exercises: members can read shared exercises ───────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'training_day_exercises'
      AND policyname = 'Members can read shared training day exercises'
  ) THEN
    EXECUTE '
      CREATE POLICY "Members can read shared training day exercises"
        ON training_day_exercises FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM training_days td
            JOIN mesocycle_members mm ON mm.mesocycle_id = td.meso_id
            WHERE td.id = training_day_exercises.training_day_id
              AND mm.user_id = auth.uid()
          )
        )';
  END IF;
END $$;
