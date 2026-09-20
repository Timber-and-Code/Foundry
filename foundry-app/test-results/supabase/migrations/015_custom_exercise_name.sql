-- 015 — custom exercise names travel with the program
--
-- A custom exercise's typed name lived only in the creating device's
-- localStorage (`foundry:customExercises`), so every other device -- and
-- every member of a shared meso -- could only show the raw id
-- ("custom:cable-y-raise"). The name now rides on the program row.
-- Nullable and additive: older clients never send it and read nothing
-- from it. APPLIED TO PROD 2026-09-20.
alter table public.training_day_exercises
  add column if not exists custom_name text,
  add column if not exists custom_muscle text;

alter table public.training_day_exercises
  add constraint tde_custom_name_len check (custom_name is null or char_length(custom_name) <= 80),
  add constraint tde_custom_muscle_len check (custom_muscle is null or char_length(custom_muscle) <= 40);
