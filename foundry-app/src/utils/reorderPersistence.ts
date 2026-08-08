/**
 * Make an in-session exercise reorder stick.
 *
 * Until now `handleMoveExercise` only moved React state and the week's set
 * data — the exercise ORDER itself was never written anywhere, so backing out
 * of the day threw it away. This module is the write path.
 *
 * The whole thing is a PERMUTATION, deliberately. It would be tempting to
 * bake the resolved (post-swap) exercise list straight into the program, but
 * that quietly promotes a week-scoped swap ("just this week") into a
 * meso-wide one. Moving slots instead leaves every override exactly as
 * intentional as it was — it just carries it to the slot it now belongs to.
 *
 * `foundry:exov:d{day}[:w{week}]:ex{slot}` pins an exercise to a SLOT INDEX,
 * so it MUST be permuted in lockstep with the program. Permuting one without
 * the other silently applies someone's swap to a different exercise.
 */
import { store } from './storage';
import type { TrainingDay, Exercise } from '../types';

/**
 * Where a saved reorder lands.
 *
 * - `session`  — in-memory only; gone when the day unmounts (prior behavior).
 * - `persist`  — written to the program and pushed to the server.
 *
 * `persist` does NOT mean "everyone". Who it reaches falls out of the data
 * model: an owner's rows are the program everybody reads, while a member's
 * rows are an overlay only they see (see pullTrainingStructure's
 * ownership-before-recency resolution). The sheet says which one applies;
 * the write path is identical either way.
 */
export type ReorderScope = 'session' | 'persist';

/** How the current user relates to the program being reordered. */
export type ProgramRole = 'solo' | 'owner' | 'member';

/**
 * Derive `newOrder[i] = index of that exercise in the old list`.
 *
 * Returns null unless this is a clean permutation — same length, no repeated
 * ids on either side, every id accounted for. Anything else (an exercise
 * appended mid-session, the same lift programmed twice) is ambiguous, and a
 * wrong guess here reattaches swap overrides to the wrong exercise.
 */
export function permutationFromIds(
  before: string[],
  after: string[],
): number[] | null {
  if (before.length === 0 || before.length !== after.length) return null;
  if (new Set(before).size !== before.length) return null;
  if (new Set(after).size !== after.length) return null;
  const perm: number[] = [];
  for (const id of after) {
    const idx = before.indexOf(id);
    if (idx < 0) return null;
    perm.push(idx);
  }
  return perm;
}

/** True when the permutation actually moves something. */
export function isIdentity(perm: number[]): boolean {
  return perm.every((oldIdx, i) => oldIdx === i);
}

/**
 * Move this day's swap overrides to follow their exercises.
 *
 * Both scopes are handled: `exov:d{day}:ex{slot}` (meso-wide) and
 * `exov:d{day}:w{week}:ex{slot}` (this week only). Read every key first, then
 * write — an in-place shuffle would clobber slots it hasn't visited yet.
 */
export function permuteOverridesForDay(dayIdx: number, perm: number[]): void {
  const re = new RegExp(`^foundry:exov:d${dayIdx}:(?:w(\\d+):)?ex(\\d+)$`);
  const held: { week: string | null; slot: number; value: string }[] = [];
  for (const key of store.keys('foundry:exov:')) {
    const m = re.exec(key);
    if (!m) continue;
    const value = store.get(key);
    if (value == null) continue;
    held.push({ week: m[1] ?? null, slot: parseInt(m[2], 10), value });
  }
  if (held.length === 0) return;

  // newSlot for an old slot is where that old index landed.
  const newSlotOf = new Map<number, number>();
  perm.forEach((oldIdx, newIdx) => newSlotOf.set(oldIdx, newIdx));

  for (const h of held) {
    store.remove(
      h.week == null
        ? `foundry:exov:d${dayIdx}:ex${h.slot}`
        : `foundry:exov:d${dayIdx}:w${h.week}:ex${h.slot}`,
    );
  }
  for (const h of held) {
    const target = newSlotOf.get(h.slot);
    // A slot the permutation doesn't mention has no defensible destination;
    // dropping the override is safer than leaving it on a foreign exercise.
    if (target == null) continue;
    store.set(
      h.week == null
        ? `foundry:exov:d${dayIdx}:ex${target}`
        : `foundry:exov:d${dayIdx}:w${h.week}:ex${target}`,
      h.value,
    );
  }
}

/** Read the cached program, or null when there isn't one. */
function loadStoredProgram(): TrainingDay[] | null {
  try {
    const raw = store.get('foundry:storedProgram');
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as TrainingDay[]) : null;
  } catch {
    return null;
  }
}

export interface ReorderCommit {
  /** The day's exercises in their new order, for the remote push. */
  exercises: Exercise[];
}

/**
 * Write the new order into `foundry:storedProgram` and carry the day's swap
 * overrides across with it. Local only — see `pushReorderRemote` for the
 * other half.
 *
 * Returns null when there is nothing safe to write.
 */
export function commitReorderLocal(
  dayIdx: number,
  perm: number[],
): ReorderCommit | null {
  if (isIdentity(perm)) return null;
  const program = loadStoredProgram();
  const day = program?.[dayIdx];
  const exercises = (day?.exercises || []) as Exercise[];
  if (!program || !day || exercises.length !== perm.length) return null;

  const reordered = perm.map((oldIdx) => exercises[oldIdx]);
  const nextProgram = program.map((d, i) =>
    i === dayIdx ? ({ ...d, exercises: reordered } as TrainingDay) : d,
  );

  // These two writes have to agree or a swap override ends up pinned to the
  // wrong lift, and there is no transaction across them. `store.set` swallows
  // quota errors, so do the big, failure-prone write first and read it back
  // before touching the overrides. Program-written-but-overrides-stale and
  // overrides-moved-but-program-stale are equally wrong; the difference is
  // that this order lets us detect the failure and do neither.
  const serialized = JSON.stringify(nextProgram);
  store.set('foundry:storedProgram', serialized);
  if (store.get('foundry:storedProgram') !== serialized) return null;

  permuteOverridesForDay(dayIdx, perm);

  return { exercises: reordered };
}

/**
 * Mirror a committed reorder to the server.
 *
 * `foundry:storedProgram` is a derived cache of training_day_exercises — the
 * next pull rebuilds it from those rows. Without this the reorder survives
 * exactly until the next sync and then silently reverts, which is the same
 * defect that made "Rebuild upcoming days" a no-op.
 *
 * Returns false only when a push was attempted and failed.
 */
export async function pushReorderRemote(
  dayIdx: number,
  exercises: Exercise[],
): Promise<boolean> {
  const mesoId = store.get('foundry:active_meso_id');
  if (!mesoId || exercises.length === 0) return true;
  const { syncDayExercisesRemote } = await import('./sync');
  return syncDayExercisesRemote(mesoId, dayIdx, exercises);
}
