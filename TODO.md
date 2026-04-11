# TODO

## Bugs

### Silent Supabase signup failure in SetupPage blocks onboarding

**File:** `foundry-app/src/components/setup/SetupPage.tsx:273-305`

`goNext` awaits `supabase.auth.signUp(email, password)` before letting the user advance from step 1 to step 2. On a collision (email already registered in Supabase), the catch/error path calls `setError(...)`, but the error display is not reliably visible — a user can repeatedly click Continue with no feedback and no progress. In dev this can look identical to the form "just re-prompting for profile info," because every click resets `error` via `setError('')` at the top of `goNext`.

**Repro (dev):**
1. Fresh localStorage, sign out of Supabase
2. Complete OnboardingFlow → land on SetupPage step 1
3. Enter a fake email + password that was previously used in any dev session
4. Click Continue → nothing happens, no visible error, form appears to re-prompt

**Fix ideas:**
- Surface `error` state in a sticky banner above the Continue button, not just inline next to specific inputs
- Log the raw signup error to console for dev visibility
- Consider a "dev mode" bypass when `import.meta.env.DEV` is true and Supabase is unreachable/errors — but probably better to just make the error loud

### Cloud pull can restore a poisoned meso with empty exercises

**Files:** `foundry-app/src/utils/sync.ts` (pull path around `pullTrainingStructure`), `foundry-app/src/hooks/useMesoState.ts`

If a user's original meso was generated before the lazy-loaded `EXERCISE_DB` finished loading, `generateProgram(profile, [])` returned days with empty `exercises` arrays, and that empty program got persisted to both `foundry:storedProgram` locally and the `training_day_exercises` table on Supabase. On any fresh login/install the cloud pull restores the empty meso and the user sees Push/Pull/Legs days with zero exercises inside them.

Partial mitigation landed on `main` (commit after the highlight fix session): `useMesoState.ts` now detects a locally-stored program where every day has empty `exercises` and regenerates from the real DB. **But** the Supabase-side data is still poisoned for affected users — on next device/browser the pull re-imports it.

**Fix ideas:**
- Server-side: query `training_day_exercises` grouped by `meso_id` and find mesocycles with zero rows → flag for regeneration
- Client-side: after a pull, apply the same poison check to the reconstructed `storedProgram` and if poisoned, regenerate locally AND push the regenerated program back up
- Root-cause: change `useMesoState` to `await preloadExerciseDB()` before first generation so no poisoning ever happens in the first place (cleaner long-term fix than the self-heal)
