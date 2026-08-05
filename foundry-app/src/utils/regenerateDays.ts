/**
 * Rebuild only the training days you haven't started yet.
 *
 * The whole-meso regenerate is a blunt instrument: it throws away the days
 * you've already logged against, and the exercise ids in those blobs are what
 * every history reader matches on. Two days into a cycle that's a bad trade.
 *
 * A day's exercise list applies to every week of the mesocycle, so replacing
 * day 2 changes day 2 for the whole block — which is exactly right when you
 * have never trained it. A day with any logged work is left completely alone.
 *
 * Lives in its own module because program.ts imports training.ts, so the
 * generator can't be called from there without closing a cycle.
 */
import { store } from './storage';
import { generateProgram } from './program';
import { getTrainedExerciseIds } from './trainingHistory';
import type { Profile, TrainingDay, WorkoutSet } from '../types';

/** Generous upper bound — a meso is at most 12 weeks + deload in practice. */
const MAX_WEEKS = 16;

/**
 * Has this day index been trained in ANY week of the current meso?
 *
 * Checks the done flag *and* the raw blob: a session you logged sets into but
 * never tapped Complete on is still work you'd lose. Warmups don't count —
 * they carry no progression and shouldn't pin a day you never really started.
 */
export function dayHasLoggedWork(dayIdx: number, maxWeeks: number = MAX_WEEKS): boolean {
  for (let w = 0; w < maxWeeks; w++) {
    if (store.get(`foundry:done:d${dayIdx}:w${w}`) === '1') return true;
    const raw = store.get(`foundry:day${dayIdx}:week${w}`);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw) as Record<string, Record<string, WorkoutSet>>;
      for (const slice of Object.values(data || {})) {
        for (const set of Object.values(slice || {})) {
          if (!set || set.warmup) continue;
          const hasWeight = Number(set.weight) > 0;
          const hasReps = Number(set.reps) > 0;
          if (hasWeight || hasReps || set.confirmed) return true;
        }
      }
    } catch {
      // An unparseable blob is still evidence something was written here.
      return true;
    }
  }
  return false;
}

/**
 * Drop swap overrides belonging to days we just replaced.
 *
 * `foundry:exov:d{day}[:w{week}]:ex{slot}` pins an exercise id to a SLOT
 * INDEX, and Home, WorkoutSplash, NextUpCard, WorkoutOverviewAccordion and
 * DayView all apply it on top of the stored program. So a day the lifter had
 * ever swapped on would keep rendering the old exercise in every one of those
 * surfaces after a rebuild — the program changed underneath and nothing
 * visibly moved. The override describes a choice about a program that no
 * longer exists; it has to go with it.
 *
 * Only the regenerated days are touched. Overrides on preserved days are
 * real, current choices.
 */
function clearOverridesForDays(dayIndices: number[]): void {
  if (dayIndices.length === 0) return;
  const targets = new Set(dayIndices);
  const exovRe = /^foundry:exov:d(\d+):(?:w\d+:)?ex\d+$/;
  for (const key of store.keys('foundry:exov:')) {
    const m = exovRe.exec(key);
    if (m && targets.has(Number(m[1]))) store.remove(key);
  }
}

export interface RegenerateResult {
  /** Day indices that were (or would be) replaced. */
  regenerated: number[];
  /** Day indices left alone because they hold logged work. */
  preserved: number[];
  /** The resulting program. Null when there was nothing to work with. */
  program: TrainingDay[] | null;
  /** True when the new program was written to storage. */
  committed: boolean;
}

export interface RegenerateOptions {
  /** Write the result to `foundry:storedProgram`. Defaults to false. */
  commit?: boolean;
  /** Injected for tests. Defaults to the lazily-loaded exercise DB. */
  exerciseDB?: Parameters<typeof generateProgram>[1];
  /** Injected for tests. Defaults to the archive-derived set. */
  trainedIds?: Iterable<string>;
  /**
   * Restrict the rebuild to these day indices. Anything outside the list is
   * preserved even if it has no logged work — this is how "rebuild today"
   * differs from "rebuild the rest of the cycle".
   *
   * Narrowing only. A day in this list that HAS logged work is still
   * preserved; the no-touching-logged-work rule is not overridable.
   */
  onlyDays?: number[];
}

/**
 * Persist a result produced by an earlier `regenerateUntouchedDays` call.
 *
 * Exists because `generateProgram` SHUFFLES. Previewing with one call and
 * committing with a second produces two different programs — the lifter
 * approves one set of exercises and gets another. Any preview-then-confirm
 * flow must compute once and commit that exact object.
 *
 * Idempotent and safe to call on a dry-run result; returns the same shape
 * with `committed: true`.
 */
export function commitRegenerated(result: RegenerateResult): RegenerateResult {
  if (!result.program || result.regenerated.length === 0) return result;
  store.set('foundry:storedProgram', JSON.stringify(result.program));
  clearOverridesForDays(result.regenerated);
  return { ...result, committed: true };
}

/**
 * Regenerate every day that has no logged work, preserving the rest.
 *
 * Defaults to a DRY RUN — pass the result to `commitRegenerated` to persist.
 * Do NOT call this a second time to commit: see the note there. The preview
 * matters because this is destructive for the days it touches, and on a
 * shared mesocycle it changes what a training partner sees too.
 */
export function regenerateUntouchedDays(
  profile: Profile | null | undefined,
  options: RegenerateOptions = {},
): RegenerateResult {
  const empty: RegenerateResult = {
    regenerated: [], preserved: [], program: null, committed: false,
  };
  if (!profile) return empty;

  const exerciseDB = options.exerciseDB;
  if (!exerciseDB || exerciseDB.length === 0) return empty;

  let current: TrainingDay[] = [];
  try {
    const raw = store.get('foundry:storedProgram');
    if (raw) current = JSON.parse(raw) as TrainingDay[];
  } catch (e) {
    console.warn('[Foundry]', 'Stored program unreadable; regenerating whole', e);
  }

  const fresh = generateProgram(profile, exerciseDB, {
    trainedIds: options.trainedIds ?? getTrainedExerciseIds(),
  });
  if (!fresh || fresh.length === 0) return empty;

  // No stored program to preserve — the fresh one IS the answer, and nothing
  // is being destroyed. A scoped rebuild has nothing to scope to here, so it
  // declines rather than quietly writing a whole program the caller didn't
  // ask for; useMesoState generates one on its own in this state anyway.
  if (current.length === 0) {
    if (options.onlyDays) return empty;
    if (options.commit) {
      store.set('foundry:storedProgram', JSON.stringify(fresh));
      clearOverridesForDays(fresh.map((_, i) => i));
    }
    return {
      regenerated: fresh.map((_, i) => i),
      preserved: [],
      program: fresh,
      committed: !!options.commit,
    };
  }

  const scope = options.onlyDays ? new Set(options.onlyDays) : null;

  const regenerated: number[] = [];
  const preserved: number[] = [];
  const merged = current.map((day, i) => {
    if (scope && !scope.has(i)) {
      preserved.push(i);
      return day;
    }
    if (dayHasLoggedWork(i)) {
      preserved.push(i);
      return day;
    }
    // Only swap in a replacement that actually exists — a short fresh
    // program must not blank a day off the end of the stored one.
    if (!fresh[i]) {
      preserved.push(i);
      return day;
    }
    regenerated.push(i);
    return fresh[i];
  });

  // Days the fresh program adds beyond the stored one (day count went up).
  // A scoped rebuild is about one existing day and must not also change the
  // shape of the week, so it never appends.
  if (!scope) {
    for (let i = current.length; i < fresh.length; i++) {
      regenerated.push(i);
      merged.push(fresh[i]);
    }
  }

  if (options.commit) {
    store.set('foundry:storedProgram', JSON.stringify(merged));
    clearOverridesForDays(regenerated);
  }
  return { regenerated, preserved, program: merged, committed: !!options.commit };
}
