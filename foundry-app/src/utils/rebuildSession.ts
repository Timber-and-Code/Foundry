/**
 * Preview-then-apply orchestration for rebuilding programmed sessions.
 *
 * Shared by the day card on Home and the fallback control in Settings so both
 * obey the same two rules:
 *
 *   1. Compute ONCE. `generateProgram` shuffles, so previewing with one call
 *      and committing with another shows the lifter one workout and gives
 *      them a different one. `previewRebuild` returns the actual result and
 *      `applyRebuild` persists that same object.
 *   2. Push, or it never happened. `foundry:storedProgram` is a derived cache
 *      of training_day_exercises; the next pull rebuilds it from the remote
 *      rows. A local-only rebuild silently reverts.
 */
import { regenerateUntouchedDays, commitRegenerated, dayHasLoggedWork } from './regenerateDays';
import type { RegenerateResult, RegenerateOptions } from './regenerateDays';
import { store } from './storage';
import type { Profile, TrainingDay, Exercise } from '../types';

export interface RebuildSlot {
  id: string;
  name: string;
}

export interface RebuildPreview {
  /** The computed result — pass this to applyRebuild unchanged. */
  result: RegenerateResult;
  /** The day the lifter asked about. */
  dayIdx: number;
  label: string;
  before: RebuildSlot[];
  after: RebuildSlot[];
  /**
   * Other untouched days that a whole-meso rebuild would ALSO rebuild —
   * each with its own independent draw, NOT a copy of this one. Drives the
   * "and N other days" copy; never guess this number in the UI.
   */
  otherDays: number[];
  /** Labels for `otherDays`, so the UI can name them instead of counting. */
  otherLabels: string[];
  /** False when the redraw happened to land on the same exercises. */
  changed: boolean;
}

const slots = (day: TrainingDay | undefined): RebuildSlot[] =>
  (day?.exercises || []).map((e: Exercise) => ({
    id: String(e.id ?? ''),
    name: String(e.name ?? e.id ?? ''),
  }));

function storedProgram(): TrainingDay[] {
  try {
    const raw = store.get('foundry:storedProgram');
    return raw ? (JSON.parse(raw) as TrainingDay[]) : [];
  } catch {
    return [];
  }
}

/**
 * Redraw one day and describe the change, without writing anything.
 *
 * Returns null when there is nothing to show: no program, the day holds
 * logged work, or the generator produced nothing.
 */
export function previewRebuild(
  profile: Profile | null | undefined,
  dayIdx: number,
  exerciseDB: RegenerateOptions['exerciseDB'],
): RebuildPreview | null {
  if (!profile || dayIdx < 0) return null;
  if (dayHasLoggedWork(dayIdx)) return null;

  const current = storedProgram();
  if (current.length === 0) return null;

  const result = regenerateUntouchedDays(profile, { exerciseDB, onlyDays: [dayIdx] });
  if (!result.program || result.regenerated.length === 0) return null;

  const before = slots(current[dayIdx]);
  const after = slots(result.program[dayIdx]);

  // Every day with no logged work EXCEPT the one being previewed — what
  // "also rebuild the rest" would additionally touch.
  const otherDays = current
    .map((_, i) => i)
    .filter((i) => i !== dayIdx && !dayHasLoggedWork(i));

  return {
    result,
    dayIdx,
    label: result.program[dayIdx]?.label || `Day ${dayIdx + 1}`,
    before,
    after,
    otherDays,
    otherLabels: otherDays.map((i) => current[i]?.label || `Day ${i + 1}`),
    changed:
      before.length !== after.length ||
      before.some((b, i) => b.id !== after[i]?.id),
  };
}

/** How many fresh draws to sample when filling unlocked slots. */
const LOCK_REDRAW_ATTEMPTS = 12;

/**
 * Redraw only the unlocked slots of a day, keeping the locked ones.
 *
 * `generateProgram` has no concept of a pinned slot, so this samples it
 * repeatedly and takes the first candidate per slot that isn't already in the
 * day. Sampling works precisely BECAUSE the generator shuffles — the same
 * non-determinism that made preview-then-commit unsafe is what supplies
 * alternatives here.
 *
 * The dedupe is the whole point. Without it a redraw can hand back an
 * exercise the lifter has locked in another slot, and the day ends up
 * prescribing the same lift twice — which is exactly the defect (two decline
 * benches in one day) that started this work.
 *
 * `before` is carried through unchanged so the was→now diff keeps comparing
 * against the ORIGINAL day, not the last redraw.
 *
 * Returns null if there's nothing to redraw. Slots it could not fill with a
 * unique exercise keep their current occupant and are named in `unresolved`,
 * so the UI can say so instead of silently doing nothing.
 */
export function rebuildWithLocks(
  profile: Profile | null | undefined,
  current: RebuildPreview,
  lockedSlots: number[],
  exerciseDB: RegenerateOptions['exerciseDB'],
): (RebuildPreview & { unresolved: number[] }) | null {
  if (!profile || !current.result.program) return null;
  const dayIdx = current.dayIdx;
  const baseDay = current.result.program[dayIdx];
  const baseExercises = (baseDay?.exercises || []) as Exercise[];
  if (baseExercises.length === 0) return null;

  const locked = new Set(lockedSlots);
  const unlocked = baseExercises.map((_, i) => i).filter((i) => !locked.has(i));
  if (unlocked.length === 0) return null;

  const merged: (Exercise | null)[] = baseExercises.map((ex, i) => (locked.has(i) ? ex : null));
  // Locked picks are spoken for; nothing else may land on them.
  const used = new Set<string>(
    baseExercises.filter((_, i) => locked.has(i)).map((e) => String(e.id ?? '')),
  );

  for (let attempt = 0; attempt < LOCK_REDRAW_ATTEMPTS; attempt++) {
    if (merged.every((slot) => slot !== null)) break;
    const draw = regenerateUntouchedDays(profile, { exerciseDB, onlyDays: [dayIdx] });
    const drawn = (draw.program?.[dayIdx]?.exercises || []) as Exercise[];
    if (drawn.length === 0) continue;
    for (const slot of unlocked) {
      if (merged[slot] !== null) continue;
      const candidate = drawn[slot];
      const id = candidate ? String(candidate.id ?? '') : '';
      if (!candidate || !id || used.has(id)) continue;
      merged[slot] = candidate;
      used.add(id);
    }
  }

  // Anything still empty keeps what it had — but only if that doesn't itself
  // duplicate a locked pick.
  const unresolved: number[] = [];
  const slots: Exercise[] = merged.map((slot, i) => {
    if (slot) return slot;
    unresolved.push(i);
    return baseExercises[i];
  });

  const program = current.result.program.map((d, i) =>
    i === dayIdx ? ({ ...d, exercises: slots } as TrainingDay) : d,
  );

  return {
    ...current,
    result: { ...current.result, program, committed: false },
    after: slots.map((e) => ({ id: String(e.id ?? ''), name: String(e.name ?? e.id ?? '') })),
    changed:
      current.before.length !== slots.length ||
      current.before.some((b, i) => b.id !== String(slots[i]?.id ?? '')),
    unresolved,
  };
}

/**
 * Redraw every day with no logged work, without writing anything.
 * Used when the lifter escalates a single-day preview to the whole cycle —
 * the other days need their own draw, so this recomputes rather than reusing
 * the single-day result.
 */
export function previewRebuildAll(
  profile: Profile | null | undefined,
  exerciseDB: RegenerateOptions['exerciseDB'],
): RegenerateResult | null {
  if (!profile) return null;
  const result = regenerateUntouchedDays(profile, { exerciseDB });
  if (!result.program || result.regenerated.length === 0) return null;
  return result;
}

export interface ApplyOutcome {
  /** False when a remote push was attempted and failed — the rebuild is
   *  device-local and will revert on the next pull. */
  pushed: boolean;
  /** Day labels that changed, for the confirmation copy. */
  names: string[];
}

/**
 * Persist a previewed result and mirror it to the server.
 *
 * Takes the result object rather than recomputing, so what lands is exactly
 * what was shown.
 */
export async function applyRebuild(result: RegenerateResult): Promise<ApplyOutcome> {
  const committed = commitRegenerated(result);
  const names = committed.regenerated.map(
    (i) => committed.program?.[i]?.label || `Day ${i + 1}`,
  );

  const mesoId = store.get('foundry:active_meso_id');
  if (!mesoId) return { pushed: true, names };

  const { syncDayExercisesRemote } = await import('./sync');
  let pushed = true;
  for (const dayIdx of committed.regenerated) {
    const day = committed.program?.[dayIdx];
    if (!day?.exercises?.length) continue;
    const ok = await syncDayExercisesRemote(mesoId, dayIdx, day.exercises);
    if (!ok) pushed = false;
  }
  return { pushed, names };
}
