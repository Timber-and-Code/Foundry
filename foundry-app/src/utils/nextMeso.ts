/**
 * Planning the NEXT mesocycle while the current one is still in its deload.
 *
 * Almost everything about a meso lives in single global slots — the profile
 * (split, days, length), `foundry:storedProgram`, the session keys, the
 * active meso id — so the next meso can't be built "for real" without
 * clobbering the one still being trained. It's held as a draft instead and
 * only goes live through `startPlannedMeso`, which runs the same
 * archive → complete → detach sequence the end-of-meso sheet does and then
 * installs the draft.
 *
 * The draft carries the concrete PROGRAM, not just the settings.
 * generateProgram shuffles, so regenerating at start would hand the lifter
 * a different meso from the one they reviewed.
 *
 * Device-local for now. It is dropped by wipeMesoSessionData, so any other
 * way of ending this meso discards it.
 */
import { store } from './storage';
import { saveProfile, loadProfile } from './training';
import {
  archiveCurrentMeso,
  resetMesoAfterCompletion,
  snapshotCurrentMeso,
  buildMesoTransition,
  loadArchive,
} from './archive';
import { collectTrainedExerciseIds } from './progressAggregation';
import { getMeso } from '../data/constants';
import type { Profile, TrainingDay } from '../types';

const DRAFT_KEY = 'foundry:next_meso_draft';

export interface NextMesoDraft {
  v: 1;
  savedAt: string;
  profile: Profile;
  program: TrainingDay[];
}

export function loadNextMesoDraft(): NextMesoDraft | null {
  try {
    const parsed = JSON.parse(store.get(DRAFT_KEY) || 'null');
    if (!parsed || parsed.v !== 1 || !parsed.profile) return null;
    if (!Array.isArray(parsed.program) || parsed.program.length === 0) return null;
    return parsed as NextMesoDraft;
  } catch {
    return null;
  }
}

export function saveNextMesoDraft(profile: Profile, program: TrainingDay[]): void {
  const draft: NextMesoDraft = { v: 1, savedAt: new Date().toISOString(), profile, program };
  store.set(DRAFT_KEY, JSON.stringify(draft));
}

export function clearNextMesoDraft(): void {
  store.remove(DRAFT_KEY);
}

/** True from the first day of the deload week onward. */
export function isPlanningWindow(activeWeek: number): boolean {
  const total = getMeso().totalWeeks;
  return total > 0 && activeWeek >= total - 1;
}

/**
 * Seed the setup flow for planning: the carryover context the builders read
 * (`foundry:meso_transition`) from the LIVE meso. The normal path writes it at
 * archive time, which hasn't happened yet — and often not at all, since the
 * end-of-meso sheet archives without it.
 */
export function preparePlanningContext(profile: Profile, program: TrainingDay[]): void {
  try {
    const transition = buildMesoTransition(profile, program.slice(0, getMeso().days));
    store.set('foundry:meso_transition', JSON.stringify(transition));
  } catch (e) {
    console.warn('[Foundry]', 'Failed to build planning context', e);
  }
}

/**
 * Exercise ids with real logged work, INCLUDING the meso still in progress.
 * Anchor continuity reads the archive, and this meso isn't in it yet — left
 * out, the plan would ignore every lift trained this block.
 */
export function trainedIdsIncludingCurrent(profile: Profile): Set<string> {
  return collectTrainedExerciseIds([snapshotCurrentMeso(profile), ...loadArchive()]);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * End the current meso and make the draft the live one. Returns the new
 * profile, or null when there is no draft to start.
 *
 * Order matters:
 *  1. Archive the finished meso while its session keys still exist.
 *  2. Wipe + mark completed + detach, and WAIT for it — saveProfile only
 *     mints a fresh meso id once the old pointer is gone (see
 *     resetMesoAfterCompletion).
 *  3. Install the reviewed program BEFORE saveProfile, so the training
 *     structure sync pushes this program rather than generating its own.
 */
export async function startPlannedMeso(current: Profile | null): Promise<Profile | null> {
  const draft = loadNextMesoDraft();
  if (!draft) return null;
  try {
    archiveCurrentMeso(current ?? loadProfile());
  } catch (e) {
    console.warn('[Foundry]', 'archiveCurrentMeso failed', e);
  }
  await resetMesoAfterCompletion();
  store.remove('foundry:meso_transition');
  store.remove('foundry:meso_complete_shown');
  store.remove('foundry:meso_complete_emitted');
  clearNextMesoDraft();

  // validateProfile rejects a profile with no experience, and the app then
  // reads "no profile" — carry the lifter's over rather than risk that.
  const next: Profile = {
    ...draft.profile,
    experience: draft.profile.experience || current?.experience || 'intermediate',
    startDate: todayISO(),
  };
  store.set('foundry:storedProgram', JSON.stringify(draft.program));
  saveProfile(next);
  return next;
}
