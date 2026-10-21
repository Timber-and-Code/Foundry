/**
 * Learned rest lengths — the timer adapts to how the lifter actually rests.
 *
 * Rule (user decision 2026-10-21): no prompts. Two consecutive early ends
 * on the same lift that land within 15 s of each other set that lift's
 * rest to their average, rounded to 5 s. The lifter sees "1:15 learned" on
 * the card and a toast with UNDO. Floors protect the program: anchors
 * never learn below 90 s, everything else never below 45 s. Letting the
 * timer run out is the prescription, so a rest is never lengthened
 * automatically. Keyed by exercise id, so it survives reorders, swaps and
 * the next meso — like weights do. Not part of the meso wipe on purpose.
 */
import { store } from './storage';
import { parseRestSeconds } from './helpers';
import type { Exercise } from '../types';

export const REST_FLOOR_ANCHOR_SECS = 90;
export const REST_FLOOR_SECS = 45;
/** Two early ends count as "the same" when this close together. */
export const REST_LEARN_TOLERANCE_SECS = 15;
/** An end this close to the prescription is not early. */
export const REST_EARLY_MARGIN_SECS = 5;

const overrideKey = (exId: string) => `foundry:restov:${exId}`;
const observationKey = (exId: string) => `foundry:restobs:${exId}`;

const idOf = (ex: Pick<Exercise, 'id'> | undefined): string | null =>
  ex?.id != null && String(ex.id).length > 0 ? String(ex.id) : null;

const round5 = (n: number) => Math.round(n / 5) * 5;

export function programRestSecs(ex: Pick<Exercise, 'rest'>): number {
  return parseRestSeconds(ex.rest || '2 min');
}

export function restFloorSecs(ex: Pick<Exercise, 'anchor'>): number {
  return ex.anchor ? REST_FLOOR_ANCHOR_SECS : REST_FLOOR_SECS;
}

export function loadRestOverride(exId: string): number | null {
  const raw = store.get(overrideKey(exId));
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function saveRestOverride(exId: string, secs: number): void {
  store.set(overrideKey(exId), String(Math.round(secs)));
}

export function clearRestOverride(exId: string): void {
  store.remove(overrideKey(exId));
  store.remove(observationKey(exId));
}

function loadObservation(exId: string): number | null {
  const raw = store.get(observationKey(exId));
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "1:15", "0:45", "2:00". */
export function formatRest(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface EffectiveRest {
  secs: number;
  /** What to hand startRestTimer — round-trips through parseRestSeconds. */
  restStr: string;
  learned: boolean;
  programSecs: number;
}

/**
 * The rest the timer should run for this lift: the learned length when
 * one exists and is shorter than the program's, the program's otherwise.
 */
export function effectiveRest(ex: Pick<Exercise, 'id' | 'rest' | 'anchor'>): EffectiveRest {
  const programSecs = programRestSecs(ex);
  const id = idOf(ex);
  const override = id ? loadRestOverride(id) : null;
  if (override != null && override < programSecs) {
    return { secs: override, restStr: `${override} sec`, learned: true, programSecs };
  }
  return { secs: programSecs, restStr: ex.rest || '2 min', learned: false, programSecs };
}

export interface RestLearnResult {
  exId: string;
  exName: string;
  secs: number;
  /** The override in place before this one, for UNDO. */
  prevSecs: number | null;
}

/**
 * Record how long a rest actually ran when the lifter ended it themselves.
 * Returns the new learned rest when this end completes a matching pair,
 * null otherwise. A non-early end resets the pair.
 */
export function recordRestEnd(
  ex: Pick<Exercise, 'id' | 'name' | 'rest' | 'anchor'>,
  actualSecs: number,
): RestLearnResult | null {
  const id = idOf(ex);
  if (!id || !Number.isFinite(actualSecs) || actualSecs <= 0) return null;
  const current = effectiveRest(ex);
  const early = actualSecs <= current.secs - REST_EARLY_MARGIN_SECS;
  if (!early) {
    store.remove(observationKey(id));
    return null;
  }
  const floor = restFloorSecs(ex);
  if (current.secs <= floor) {
    // Already at the floor — nothing left to learn.
    store.remove(observationKey(id));
    return null;
  }
  const previous = loadObservation(id);
  if (previous == null || Math.abs(previous - actualSecs) > REST_LEARN_TOLERANCE_SECS) {
    store.set(observationKey(id), String(Math.round(actualSecs)));
    return null;
  }
  store.remove(observationKey(id));
  const learned = Math.max(floor, round5((previous + actualSecs) / 2));
  if (learned >= current.secs) return null;
  const prevSecs = loadRestOverride(id);
  saveRestOverride(id, learned);
  return { exId: id, exName: ex.name, secs: learned, prevSecs };
}

/** Put back whatever was in place before `result` was learned. */
export function undoRestLearn(result: RestLearnResult): void {
  if (result.prevSecs != null) saveRestOverride(result.exId, result.prevSecs);
  else clearRestOverride(result.exId);
}
