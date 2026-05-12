import type { Exercise } from '../types';
import type { SupersetPair } from './persistence';

export function newSupersetId(): string {
  try {
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* fallthrough */
  }
  return `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Replay persisted superset pairings on top of a freshly-resolved exercise
 * list. For each saved `[exIdA, exIdB]` pair, stamp a fresh groupId on both
 * matches, equalise their set counts to the max of the two, and splice the
 * target slot to sit directly after the source so the SupersetGroup wrapper
 * (which collects contiguous same-groupId neighbours) renders them as one.
 *
 * Bails out per-pair if either side is missing from the rebuilt list or
 * already wears a groupId — defensive against EXERCISE_DB id renames + the
 * "same exercise in two slots same day" edge case (we match the first free
 * slot for each id; persistence doesn't disambiguate that case today).
 */
export function applyPersistedSupersets(
  exercises: Exercise[],
  pairs: SupersetPair[],
): Exercise[] {
  if (!pairs.length) return exercises;
  const working = exercises.slice();
  for (const [exIdA, exIdB] of pairs) {
    const iA = working.findIndex((e) => e.id === exIdA && !e.supersetGroupId);
    if (iA < 0) continue;
    const iB = working.findIndex(
      (e, i) => i !== iA && e.id === exIdB && !e.supersetGroupId,
    );
    if (iB < 0) continue;
    const id = newSupersetId();
    const setsA = Number(working[iA].sets ?? 0);
    const setsB = Number(working[iB].sets ?? 0);
    const maxSets = Math.max(setsA, setsB, 1);
    working[iA] = { ...working[iA], supersetGroupId: id, sets: maxSets };
    working[iB] = { ...working[iB], supersetGroupId: id, sets: maxSets };
    if (iB === iA + 1) continue;
    const [moved] = working.splice(iB, 1);
    const insertAt = iB > iA ? iA + 1 : iA;
    working.splice(insertAt, 0, moved);
  }
  return working;
}
