/**
 * Share snapshots — the share card as an ASSET of a finished session, not a
 * step in the completion wizard.
 *
 * Rule: sharing is never a dead end and never a one-shot. The completion
 * modal saves exactly what it rendered (stats + the quote the lifter read),
 * keyed by session, so the same card can be opened again later from Home
 * (today's finished session), the Schedule tab (any finished session) or the
 * "logged · Share" toast after NEXT SESSION. Sessions finished before this
 * existed have no snapshot; those are rebuilt from the logged sets with the
 * same stats rules the completion flow uses.
 */
import { store, detectSessionPRs, findPrevSlotForExercise, loadSessionDuration } from './store';
import { sessionHasLoggedWork } from './leftOpen';
import { getMeso, getWeekPhase, randomQuote } from '../data/constants';
import type {
  WorkoutCompleteStats,
  WorkoutCompleteExerciseBreakdown,
} from '../components/workout/WorkoutCompleteModal';
import type { Exercise, TrainingDay, WorkoutSet } from '../types';

export interface ShareQuote {
  text: string;
  author: string;
}

export interface ShareSnapshot {
  v: 1;
  dayIdx: number;
  weekIdx: number;
  dayLabel: string;
  phase: string;
  stats: WorkoutCompleteStats;
  quote: ShareQuote | null;
  /** Local YYYY-MM-DD the session was completed. */
  dateStr: string;
}

export const shareSnapshotKey = (dayIdx: number, weekIdx: number): string =>
  `foundry:share:d${dayIdx}:w${weekIdx}`;

export function saveShareSnapshot(snap: ShareSnapshot): void {
  store.set(shareSnapshotKey(snap.dayIdx, snap.weekIdx), JSON.stringify(snap));
}

export function loadShareSnapshot(dayIdx: number, weekIdx: number): ShareSnapshot | null {
  const raw = store.get(shareSnapshotKey(dayIdx, weekIdx));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ShareSnapshot;
    if (!parsed || parsed.v !== 1 || !parsed.stats) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Caption for "Copy caption" — the image carries the workout, text is optional. */
export function buildShareCaption(
  dayLabel: string,
  weekIdx: number,
  phase: string,
  stats: WorkoutCompleteStats,
): string {
  return (
    (stats.prs.length > 0 ? `New PR: ${stats.prs[0].name} ${stats.prs[0].newBest} lb. ` : '') +
    `${dayLabel}, week ${weekIdx + 1} · ${phase}. ` +
    `${stats.sets} sets, ${Math.round(stats.volume).toLocaleString()} lb moved.\n\nthefoundry.coach`
  );
}

/**
 * The completion stats for a session: totals, per-exercise breakdown, PRs and
 * the week-over-week anchor comparison. One rule for the live completion flow
 * and for a rebuild from stored data.
 *
 * `resolveByExId` — a stored week's slots may no longer line up with today's
 * program (reorder, swap, superset shift), so a rebuild resolves each lift's
 * slice by its `_exId` stamp (utils/exerciseSlice). The live flow passes the
 * slot-aligned data DayView just logged and keeps positional reads.
 */
export function buildShareStats(
  exercises: Exercise[],
  weekData: Record<string | number, Record<string | number, WorkoutSet>>,
  dayIdx: number,
  weekIdx: number,
  durationSecs: number | null,
  opts: { resolveByExId?: boolean } = {},
): WorkoutCompleteStats {
  const sliceFor = (ex: Exercise, i: number): Record<string, WorkoutSet> =>
    opts.resolveByExId
      ? (findPrevSlotForExercise(
          weekData as never,
          ex.id,
          i,
        ) as unknown as Record<string, WorkoutSet>)
      : ((weekData[i] || {}) as Record<string, WorkoutSet>);

  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  const breakdown: WorkoutCompleteExerciseBreakdown[] = [];
  exercises.forEach((ex, i) => {
    const exData = sliceFor(ex, i);
    const exSets: { reps: number; weight: number; warmup?: boolean }[] = [];
    Object.values(exData).forEach((s) => {
      if (s.confirmed || (s.reps && String(s.reps).trim() !== '')) {
        const r = parseInt(String(s.reps || 0), 10);
        const w = parseFloat(String(s.weight || 0));
        if (!s.warmup) {
          totalSets++;
          if (!isNaN(r)) totalReps += r;
          if (!isNaN(w) && !isNaN(r)) totalVolume += w * r;
        }
        exSets.push({ reps: isNaN(r) ? 0 : r, weight: isNaN(w) ? 0 : w, warmup: !!s.warmup });
      }
    });
    if (exSets.length > 0) breakdown.push({ name: ex.name, anchor: !!ex.anchor, sets: exSets });
  });

  // PR detection reads today's blob by slot. Hand it a slot-aligned view
  // when we resolved by stamp so a reordered program can't produce
  // phantom PRs against another lift's slot.
  const prData = opts.resolveByExId
    ? (Object.fromEntries(exercises.map((ex, i) => [i, sliceFor(ex, i)])) as Record<
        string | number,
        Record<string | number, WorkoutSet>
      >)
    : weekData;
  const prs = detectSessionPRs(exercises, prData as never, 'meso', { dayIdx, weekIdx });

  const anchorComparison: { name: string; today: number; prev: number; delta: number }[] = [];
  if (weekIdx > 0) {
    exercises.forEach((ex, i) => {
      if (!ex.anchor) return;
      const exData = sliceFor(ex, i);
      let todayBest = 0;
      Object.values(exData).forEach((s) => {
        const w = parseFloat(String(s.weight || 0));
        if (!isNaN(w) && w > todayBest && s.reps) todayBest = w;
      });
      if (todayBest <= 0) return;
      try {
        const rawPrev = store.get(`foundry:day${dayIdx}:week${weekIdx - 1}`);
        if (rawPrev) {
          const prevData = JSON.parse(rawPrev);
          // Match last week's slice by exercise IDENTITY, not slot index.
          const prevExData = findPrevSlotForExercise(prevData, ex.id, i) as unknown as Record<
            string,
            WorkoutSet
          >;
          let prevBest = 0;
          Object.values(prevExData).forEach((s) => {
            const w = parseFloat(String(s.weight || 0));
            if (!isNaN(w) && w > prevBest && s.reps) prevBest = w;
          });
          if (prevBest > 0) {
            anchorComparison.push({
              name: ex.name,
              today: todayBest,
              prev: prevBest,
              delta: Math.round(todayBest - prevBest),
            });
          }
        }
      } catch {
        // ignore parse errors
      }
    });
  }

  return {
    // Last week of the meso. A lighter bar is prescribed there, so the
    // comparison must not paint it as lost ground.
    isDeload: weekIdx >= getMeso().totalWeeks - 1,
    sets: totalSets,
    reps: totalReps,
    volume: totalVolume,
    exercises: exercises.length,
    duration: durationSecs,
    prs,
    anchorComparison,
    breakdown,
  };
}

/** True when there is something to put on a card for this session. */
export function canShareSession(dayIdx: number, weekIdx: number): boolean {
  return !!store.get(shareSnapshotKey(dayIdx, weekIdx)) || sessionHasLoggedWork(dayIdx, weekIdx);
}

/**
 * Rebuild a snapshot for a session finished before snapshots existed: the
 * stored week's logged sets, the stored session duration, a fresh quote.
 * Null when nothing was logged.
 */
export function rebuildShareSnapshot(
  activeDays: TrainingDay[],
  dayIdx: number,
  weekIdx: number,
  gender?: string,
): ShareSnapshot | null {
  const day = activeDays[dayIdx];
  if (!day || !sessionHasLoggedWork(dayIdx, weekIdx)) return null;
  let weekData: Record<string | number, Record<string | number, WorkoutSet>> = {};
  try {
    weekData = JSON.parse(store.get(`foundry:day${dayIdx}:week${weekIdx}`) || '{}') || {};
  } catch {
    return null;
  }
  const minutes = loadSessionDuration(dayIdx, weekIdx);
  const durationSecs = minutes != null && minutes > 0 ? minutes * 60 : null;
  const stats = buildShareStats(
    (day.exercises || []) as Exercise[],
    weekData,
    dayIdx,
    weekIdx,
    durationSecs,
    { resolveByExId: true },
  );
  if (stats.sets === 0) return null;
  const completedAt = store.get(`foundry:completedDate:d${dayIdx}:w${weekIdx}`);
  return {
    v: 1,
    dayIdx,
    weekIdx,
    dayLabel: day.label || `Day ${dayIdx + 1}`,
    phase: getWeekPhase()[weekIdx] || 'Accumulation',
    stats,
    quote: randomQuote(gender),
    dateStr: completedAt || '',
  };
}

/** Saved snapshot first, rebuild from logged sets otherwise. */
export function resolveShareSnapshot(
  activeDays: TrainingDay[],
  dayIdx: number,
  weekIdx: number,
  gender?: string,
): ShareSnapshot | null {
  return loadShareSnapshot(dayIdx, weekIdx) ?? rebuildShareSnapshot(activeDays, dayIdx, weekIdx, gender);
}
