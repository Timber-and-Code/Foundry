/**
 * Which slice of a day's DayData belongs to which exercise.
 *
 * DayData is keyed by SLOT INDEX, but the program can be reordered, swapped
 * or superset-shifted between weeks, so slot 2 in week 1 is not necessarily
 * the lift that sits in slot 2 today. Every logged set is stamped with
 * `_exId`; readers must resolve by that stamp and fall back to the slot only
 * when the slot's sets carry no stamp at all (pre-stamp data). A slot
 * stamped as a DIFFERENT exercise is that exercise's data — post-swap
 * leftovers — and must never be shown as this lift's numbers.
 *
 * No dependencies beyond the types, so both the aggregation layer and the
 * low-level training readers can import it.
 */
import type { DayData, WorkoutSet } from '../types';

type Slice = Record<string, WorkoutSet>;

function stampOf(set: unknown): string | null {
  if (!set || typeof set !== 'object') return null;
  const stamp = (set as Record<string, unknown>)._exId;
  return typeof stamp === 'string' && stamp.length > 0 ? stamp : null;
}

/** Find a slice in DayData whose sets carry `_exId === id`. */
export function findSliceByExId(data: DayData | undefined, id: string | undefined): Slice | undefined {
  if (!data || !id) return undefined;
  for (const slice of Object.values(data)) {
    if (!slice) continue;
    const entries = Object.entries(slice);
    if (!entries.some(([, s]) => stampOf(s) === id)) continue;
    // Mixed slice (swap left the old exercise's sets behind and new ones
    // were logged alongside): keep only this exercise's sets, or its
    // start/current/PR inherit the other lift's numbers.
    const hasForeign = entries.some(([, s]) => {
      const stamp = stampOf(s);
      return stamp != null && stamp !== id;
    });
    if (!hasForeign) return slice as Slice;
    return Object.fromEntries(entries.filter(([, s]) => stampOf(s) === id)) as Slice;
  }
  return undefined;
}

/**
 * The slice for exercise `exId` sitting in slot `exIdx` today. Stamp first;
 * the positional slot only when it is unstamped; nothing when the slot
 * belongs to another lift.
 */
export function resolveExerciseSlice(
  wd: DayData | undefined,
  exId: string | number | null | undefined,
  exIdx: number,
): Slice | undefined {
  if (!wd) return undefined;
  const id = exId != null ? String(exId) : undefined;
  const stamped = findSliceByExId(wd, id);
  if (stamped) return stamped;
  const positional = (wd[exIdx] as Slice | undefined) || undefined;
  if (!positional) return undefined;
  const stampedAsOther = id != null && Object.values(positional).some((s) => {
    const stamp = stampOf(s);
    return stamp != null && stamp !== id;
  });
  return stampedAsOther ? undefined : positional;
}
