-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Close the invite-preview read holes                                 ║
-- ║                                                                      ║
-- ║  ⚠  APPLY ONLY AFTER a client using the migration-010 RPCs is        ║
-- ║     DEPLOYED. These five policies are what the old client's direct   ║
-- ║     table selects rely on; dropping them first makes every invite    ║
-- ║     code read as invalid and blocks joining a shared program.        ║
-- ║                                                                      ║
-- ║  Each policy below granted a read whenever the TARGET had an invite  ║
-- ║  code, never checking whether the CALLER knew it. Measured effect,   ║
-- ║  from a brand-new account with no friends and no shared programs:    ║
-- ║  every user_profiles row (name, gender, date of birth, body weight), ║
-- ║  every mesocycle, every mesocycle_members row, and every live join   ║
-- ║  code readable.                                                      ║
-- ║                                                                      ║
-- ║  preview_friend_invite / preview_meso_invite replace all of it:      ║
-- ║  present the exact code, get back only what the join screen shows.   ║
-- ║                                                                      ║
-- ║  Deliberately NOT touched — these are correct and carry the real     ║
-- ║  sharing behaviour:                                                  ║
-- ║    user_profiles      "Friends can read profile"                     ║
-- ║    user_profiles      "Members can read shared member profiles"      ║
-- ║    mesocycles         "Friends can read mesocycles"                  ║
-- ║    mesocycles         "Members can read shared mesocycles"           ║
-- ║    mesocycle_members  "Members can read shared memberships"          ║
-- ║    every "manage own" / INSERT / UPDATE / DELETE policy              ║
-- ║                                                                      ║
-- ║  Idempotent. Safe to re-run.                                         ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Blanket `USING (true)` — every invite row readable by anyone signed in.
drop policy if exists "Anyone can preview invite" on friend_invites;

-- Readable if the target merely HAS a meso invite code.
drop policy if exists "Anyone can read invite owner profile" on user_profiles;

-- Readable if the target merely HAS an unexpired friend invite.
drop policy if exists "Preview invite owner profile" on user_profiles;

-- Readable if the mesocycle merely HAS an invite code.
drop policy if exists "Anyone can preview invited mesocycles" on mesocycles;

-- Readable for any membership row carrying a code.
drop policy if exists "Anyone can lookup by invite code" on mesocycle_members;
