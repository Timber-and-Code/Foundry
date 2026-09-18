import * as Sentry from '@sentry/react';
import { store, loadProfile } from '../store';
import { getHealthService } from './index';
import { estimateKcal } from './calorieEstimate';
import { HEALTH_TOGGLE_KEY, reconcileHealthAccess } from './reconcileAccess';

/**
 * Guard against writing the same session twice. `doCompleteWithStats` can
 * run again if a lifter reopens a finished day and completes it a second
 * time, and HealthKit would happily store a duplicate workout — Apple
 * Fitness has no dedupe of its own.
 *
 * Scoped to the mesocycle: day/week indexes restart at d0/w0 every meso, so
 * an unscoped key written in one meso silently blocked the same slot in
 * every meso after it.
 */
export const workoutWrittenKey = (mesoScope: string | undefined, dayIdx: number, weekIdx: number) =>
  `foundry:health:workout_written:${mesoScope || 'no-meso'}:d${dayIdx}:w${weekIdx}`;

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
 * Fire-and-forget by design, and it never throws: Health is a side effect
 * of finishing a workout, never a precondition for it. The expected no-ops
 * (Health off, workouts refused) return false quietly. A real failure is
 * reported to Sentry — it used to be swallowed, which is how a lifter could
 * finish every session with Health "ON" and nothing ever reach Fitness
 * without a single trace of why.
 */
export async function logWorkoutToHealth(opts: LogWorkoutOpts): Promise<boolean> {
  try {
    if (store.get(HEALTH_TOGGLE_KEY) !== '1') return false;

    const mesoId = store.get('foundry:active_meso_id') || undefined;
    const profile = loadProfile();
    // A lifter who never signed in has no meso id; the meso's start date is
    // the next-best thing that changes from one meso to the next.
    const mesoScope = mesoId || (profile?.startDate as string | undefined);
    const key = workoutWrittenKey(mesoScope, opts.dayIdx, opts.weekIdx);
    if (store.get(key) === '1') return false;

    const health = getHealthService();
    if (!(await health.isAvailable())) return false;

    // Workout sharing is its own grant — a lifter can allow weight sync and
    // refuse workouts. HealthKit reports share status honestly, so this is
    // a real check rather than a guess.
    let granted = await health.checkWorkoutPermission();
    if (!granted) {
      // Not granted can mean refused (respect it) or NEVER ASKED — a lifter
      // who enabled Health on a build whose workout request was dropped.
      // The second case is fixable only by asking, and this lifter turned
      // Health on precisely so sessions would post. reconcile prompts only
      // for never-asked types, so a refusal is never re-asked.
      const status = await reconcileHealthAccess();
      granted = status?.workouts === 'authorized';
    }
    if (!granted) return false;

    const endMs = opts.endMs;
    const startMs =
      opts.startMs ??
      (opts.elapsedSecs > 0 ? endMs - opts.elapsedSecs * 1000 : null);
    if (startMs == null || !(endMs > startMs)) return false;

    const kcal = estimateKcal({
      startMs,
      endMs,
      weightLbs: profile?.weight as number | string | undefined,
    });

    const saved = await health.writeStrengthWorkout({
      startMs,
      endMs,
      kcal,
      mesoId,
      dayLabel: opts.dayLabel,
      weekIndex: opts.weekIdx,
      totalSets: opts.totalSets,
      totalVolumeLbs: Math.round(opts.totalVolumeLbs),
    });

    if (saved) store.set(key, '1');
    return saved;
  } catch (e) {
    console.warn('[Foundry Health] workout write failed', e);
    Sentry.captureException(e, { tags: { context: 'health', operation: 'write_workout' } });
    return false;
  }
}
