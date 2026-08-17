import { store, loadProfile } from '../store';
import { getHealthService } from './index';
import { estimateKcal } from './calorieEstimate';

/** Master Apple Health toggle, owned by Settings → Apple Health. */
const HEALTH_TOGGLE_KEY = 'foundry:health:enabled';

/**
 * Guard against writing the same session twice. `doCompleteWithStats` can
 * run again if a lifter reopens a finished day and completes it a second
 * time, and HealthKit would happily store a duplicate workout — Apple
 * Fitness has no dedupe of its own.
 */
const writtenKey = (dayIdx: number, weekIdx: number) =>
  `foundry:health:workout_written:d${dayIdx}:w${weekIdx}`;

export interface LogWorkoutOpts {
  /** Epoch ms the session began. Null falls back to endMs - elapsedSecs. */
  startMs: number | null;
  endMs: number;
  elapsedSecs: number;
  dayIdx: number;
  weekIdx: number;
  dayLabel?: string;
  totalSets: number;
  totalVolumeLbs: number;
}

/**
 * Push a finished session to Apple Health as a real HKWorkout, so it lands
 * in Apple Fitness → Workouts and its energy counts toward the Move ring.
 *
 * Fire-and-forget by design. Every failure path resolves quietly: Health
 * is a side effect of finishing a workout, never a precondition for it,
 * and a lifter who denied workout permission should see no difference.
 */
export async function logWorkoutToHealth(opts: LogWorkoutOpts): Promise<boolean> {
  try {
    if (store.get(HEALTH_TOGGLE_KEY) !== '1') return false;

    const key = writtenKey(opts.dayIdx, opts.weekIdx);
    if (store.get(key) === '1') return false;

    const health = getHealthService();
    if (!(await health.isAvailable())) return false;
    // Workout sharing is its own grant — a lifter can allow weight sync and
    // refuse workouts. Unlike reads, HealthKit reports share status
    // honestly, so this is a real check rather than a guess.
    if (!(await health.checkWorkoutPermission())) return false;

    const endMs = opts.endMs;
    const startMs =
      opts.startMs ??
      (opts.elapsedSecs > 0 ? endMs - opts.elapsedSecs * 1000 : null);
    if (startMs == null || !(endMs > startMs)) return false;

    const profile = loadProfile();
    const kcal = estimateKcal({
      startMs,
      endMs,
      weightLbs: profile?.weight as number | string | undefined,
    });

    const saved = await health.writeStrengthWorkout({
      startMs,
      endMs,
      kcal,
      mesoId: store.get('foundry:active_meso_id') || undefined,
      dayLabel: opts.dayLabel,
      weekIndex: opts.weekIdx,
      totalSets: opts.totalSets,
      totalVolumeLbs: Math.round(opts.totalVolumeLbs),
    });

    if (saved) store.set(key, '1');
    return saved;
  } catch {
    return false;
  }
}
