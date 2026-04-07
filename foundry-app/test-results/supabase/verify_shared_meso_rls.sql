-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Diagnostic: verify training_days / training_day_exercises RLS      ║
-- ║  Run in the Supabase SQL Editor to check what policies exist        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 1. Check if RLS is enabled on training_days and training_day_exercises
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('training_days', 'training_day_exercises', 'mesocycle_members', 'mesocycles');

-- 2. List all RLS policies on these tables
SELECT
  schemaname,
  tablename,
  policyname,
  cmd AS operation,
  qual AS using_expression,
  with_check
FROM pg_policies
WHERE tablename IN ('training_days', 'training_day_exercises', 'mesocycle_members', 'mesocycles')
ORDER BY tablename, policyname;

-- 3. Check if there are ANY training_days rows for any meso
-- (verifies the owner's ensureTrainingStructureRemote actually ran)
SELECT m.id AS meso_id, m.name, m.status, m.user_id,
       count(td.id) AS training_day_count
FROM mesocycles m
LEFT JOIN training_days td ON td.meso_id = m.id
GROUP BY m.id, m.name, m.status, m.user_id
ORDER BY m.status, m.name;

-- 4. Check mesocycle_members to see who joined what
SELECT mm.mesocycle_id, mm.user_id, mm.role, mm.invite_code, mm.joined_at,
       m.name AS meso_name, m.status
FROM mesocycle_members mm
JOIN mesocycles m ON m.id = mm.mesocycle_id
ORDER BY mm.joined_at DESC;
