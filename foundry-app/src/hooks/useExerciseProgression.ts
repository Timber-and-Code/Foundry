/**
 * useExerciseProgression — derive the per-exercise "what changed since last
 * week" cues that drive the progression banner and the stall warning.
 *
 * Bundle I (2.8.0): extracted from ExerciseCard so SupersetRoundView can
 * surface the same hints in its header strip without re-implementing the
 * logic. Behaviour is held verbatim against the prior inline memos so the
 * solo-card refactor is observably a no-op (same banner copy, same stall
 * threshold).
 *
 * The hook owns two pieces of derived state:
 *
 *  1. `progressionBanner` — when set 0 of the current week is system-
 *     suggested at a higher weight than last week's set 0, returns the
 *     "+X lbs" copy + accent color. Bodyweight exercises swap to a
 *     "+1 rep" message.
 *
 *  2. `stallWarning` / `stallTarget` — when the current set 0 weight has
 *     dropped >2 lb vs last week's last completed working set without
 *     enough rep compensation, flags a stall and exposes the target
 *     (last-week weight × reps) for the chip copy.
 *
 * Both gates require `weekIdx > 0` — week 0 has no prior week to compare
 * against. The banner additionally requires set 0 to still carry suggestion
 * flags (`suggested` or `repsSuggested`), so once the lifter edits the
 * weight the banner disappears.
 */
import { useMemo } from 'react';
import type { Exercise, DayData } from '../types';

interface SetData {
  weight?: string | number;
  reps?: string | number;
  rpe?: string | number;
  warmup?: boolean;
  confirmed?: boolean;
  suggested?: boolean;
  repsSuggested?: boolean;
  [key: string]: unknown;
}

export interface ExerciseProgressionInputs {
  exIdx: number;
  exercise: Exercise;
  weekData: DayData;
  /** Last week's raw data, same shape as `weekData`. SupersetRoundView and
   *  ExerciseCard both load this from `foundry:day{N}:week{N-1}`. */
  prevWeekRaw: Record<string | number, Record<string, SetData>>;
  weekIdx: number;
}

export interface ProgressionBanner {
  text: string;
  color: string;
}

export interface StallTarget {
  w: number;
  r: number;
}

export interface ExerciseProgressionOutput {
  progressionBanner: ProgressionBanner | null;
  stallWarning: boolean;
  stallTarget: StallTarget | null;
}

export function useExerciseProgression({
  exIdx,
  exercise,
  weekData,
  prevWeekRaw,
  weekIdx,
}: ExerciseProgressionInputs): ExerciseProgressionOutput {
  // Progression hint — derived from whether set 0 has suggested flags.
  // Lifted verbatim from ExerciseCard.tsx (commit 7c103dd, lines ~369-391).
  const progressionBanner = useMemo<ProgressionBanner | null>(() => {
    if (weekIdx === 0) return null; // No progression on first week
    const set0 = ((weekData[exIdx] || {}) as Record<string, SetData>)[0];
    if (!set0) return null;
    // Only show banner if set 0 still carries suggestion flags (user hasn't edited yet)
    if (!set0.suggested && !set0.repsSuggested) return null;

    const prevData = prevWeekRaw[exIdx] || {};
    const prevWeight = parseFloat(String((prevData[0] || {}).weight || '0'));
    const currWeight = parseFloat(String(set0.weight || '0'));

    if (set0.suggested && currWeight > prevWeight) {
      const bump = Math.round((currWeight - prevWeight) * 10) / 10;
      return { text: `+${bump} lbs — you hit all reps last week`, color: 'var(--success)' };
    }
    if (exercise.bw && set0.repsSuggested) {
      return { text: '+1 rep — bodyweight progression', color: 'var(--text-accent)' };
    }
    if (set0.repsSuggested && !set0.suggested) {
      return { text: 'Same weight, +1 rep — building toward top of range', color: 'var(--text-accent)' };
    }
    return null;
  }, [weekData, exIdx, weekIdx, prevWeekRaw, exercise.bw]);

  // Stall detection — compare current set 0 vs last week's LAST completed
  // working set (highest set index with non-empty weight + reps that isn't
  // a warmup). This matches the lifter's "last working weight" mental
  // model; comparing against the BEST set was misreading mid-session
  // fatigue as a stall (#8 in 2.8.0 fix list).
  // Lifted verbatim from ExerciseCard.tsx (commit 7c103dd, lines ~398-422).
  const { stallWarning, stallTarget } = useMemo<{
    stallWarning: boolean;
    stallTarget: StallTarget | null;
  }>(() => {
    const curr = ((weekData[exIdx] || {}) as Record<string, SetData>)[0] || {};
    const reps = parseInt(String(curr.reps || 0));
    const weight = parseFloat(String(curr.weight || 0));
    const prevData = prevWeekRaw[exIdx] || {};
    let stallTarget: StallTarget | null = null;
    let stallWarning = false;
    for (let ps = (Number(exercise.sets) || 4) - 1; ps >= 0; ps--) {
      const psd = (prevData[ps] || {}) as SetData;
      if (!psd.reps || !psd.weight || psd.warmup) continue;
      const pw = parseFloat(String(psd.weight));
      const pr = parseInt(String(psd.reps));
      if (!Number.isFinite(pw) || pw <= 0) continue;
      stallTarget = { w: pw, r: pr };
      break;
    }
    // Stall if weight drops and reps don't increase enough to compensate
    if (stallTarget && weight > 0) {
      const prevRepsEquiv = stallTarget.r * (stallTarget.w / weight); // Reps equivalent at new weight
      if (weight < stallTarget.w - 2 && reps < prevRepsEquiv) {
        stallWarning = true;
      }
    }
    return { stallTarget, stallWarning };
  }, [weekData, exIdx, prevWeekRaw, exercise.sets]);

  return { progressionBanner, stallWarning, stallTarget };
}
