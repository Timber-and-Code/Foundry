import type { WorkoutSet, TrainingDay, Exercise } from '../types';
import type { WeekCompleteModalData } from '../components/WeekCompleteModal';
import { getMeso } from '../data/constants';
import { getExerciseDB, findExercise } from '../data/exerciseDB';
import { store, loadProfile, findPrevSlotForExercise } from './store';
import { generateProgram } from './program';

interface AnchorGain {
  name: string;
  start: number;
  peak: number;
  delta: number;
  peakWeek: number;
  /** Top working weight per week (0 = not logged), deload last. */
  weekly: number[];
}

/**
 * The week-complete recap — and, for the deload, the whole-meso summary —
 * read from the live session keys.
 *
 * Built on demand rather than only when the last day is logged, so the
 * end-of-meso summary can be reopened from the "What's next?" sheet. That
 * only works while the meso hasn't been archived: archiving wipes the keys
 * this reads.
 */
export function buildWeekRecap(weekIdx: number, completed: Set<string>): WeekCompleteModalData {
  let totalSets = 0;
  const _storedProg = store.get('foundry:storedProgram');
  const prof = loadProfile();
  const prog = (_storedProg ? JSON.parse(_storedProg) : prof ? generateProgram(prof, getExerciseDB() as any) : []).slice(
    0,
    getMeso().days
  );
  const bw = parseFloat(String(loadProfile()?.weight ?? 0));
  let totalVolume = 0;
  let prCount = 0;

  prog.forEach((day: TrainingDay, d: number) => {
    const raw = store.get(`foundry:day${d}:week${weekIdx}`);
    if (!raw) return;
    try {
      const wd = JSON.parse(raw);
      day.exercises.forEach((ex: Exercise, exIdx: number) => {
        // By _exId stamp (slot fallback for legacy data), same as the
        // meso recap below: positional reads credited another lift's sets
        // to this one after a reorder or swap.
        const exData = findPrevSlotForExercise(wd, ex.id, exIdx);
        let thisBest = 0;
        Object.values(exData as unknown as Record<string, WorkoutSet>).forEach((s) => {
          if (!s || !s.reps || s.reps === '' || s.repsSuggested) return;
          totalSets++;
          const w = parseFloat(String(s.weight || 0));
          const r = parseInt(String(s.reps));
          if (!r) return;
          const eff = ex.bw ? bw + w : w;
          totalVolume += eff * r;
          if (eff * r > thisBest) thisBest = eff * r;
        });
        let priorBest = 0;
        for (let pw = 0; pw < weekIdx; pw++) {
          const pr = store.get(`foundry:day${d}:week${pw}`);
          if (!pr) continue;
          try {
            const pwd = JSON.parse(pr);
            Object.values(findPrevSlotForExercise(pwd, ex.id, exIdx) as unknown as Record<string, WorkoutSet>).forEach((s) => {
              if (!s || !s.reps) return;
              const w = parseFloat(String(s.weight || 0));
              const r = parseInt(String(s.reps));
              const eff = ex.bw ? bw + w : w;
              if (eff * r > priorBest) priorBest = eff * r;
            });
          } catch { /* JSON parse fallback — data optional */ }
        }
        if (thisBest > priorBest && priorBest > 0) prCount++;
      });
    } catch { /* JSON parse fallback — data optional */ }
  });

  // Weeks are 0-indexed and the deload is the last one, so the final week
  // is totalWeeks - 1. This compared against totalWeeks — a week no route
  // can reach — so the meso-complete recap and the "what's next" sheet
  // never fired from a real completion.
  const isFinal = weekIdx === getMeso().totalWeeks - 1;

  // Meso retrospective data (isFinal only)
  let mesoAnchorGains: AnchorGain[] = [];
  let mesoTotalVolume = 0;
  let mesoTotalPRs = 0;
  let mesoCompletedSessions = 0;
  let mesoWeeklyVolume: number[] = [];
  const mesoTotalSessions = getMeso().totalWeeks * getMeso().days;

  if (isFinal) {
    const totalWeeks = getMeso().totalWeeks;
    for (let w = 0; w < totalWeeks; w++) {
      for (let d = 0; d < getMeso().days; d++) {
        if (completed.has(`${d}:${w}`)) mesoCompletedSessions++;
      }
    }
    // Each week's day blobs, read once. Slices are matched to an
    // exercise by its `_exId` stamp (slot fallback for legacy data):
    // reading `wd[exIdx]` by position credited another lift's sets to
    // this one whenever a reorder, swap or superset moved it.
    const weekData: Record<string, Record<string, WorkoutSet>>[][] = [];
    for (let w = 0; w < totalWeeks; w++) {
      weekData[w] = prog.map((_: TrainingDay, d: number) => {
        try {
          return JSON.parse(store.get(`foundry:day${d}:week${w}`) || '{}');
        } catch {
          return {};
        }
      });
    }
    const sliceFor = (w: number, d: number, ex: Exercise, exIdx: number) =>
      findPrevSlotForExercise(weekData[w][d] as never, ex.id, exIdx) as unknown as Record<string, WorkoutSet>;

    mesoWeeklyVolume = Array.from({ length: totalWeeks }, () => 0);
    for (let w = 0; w < totalWeeks; w++) {
      prog.forEach((day: TrainingDay, d: number) => {
        day.exercises.forEach((ex: Exercise, exIdx: number) => {
          let thisBest = 0;
          Object.values(sliceFor(w, d, ex, exIdx)).forEach((s) => {
            if (!s || !s.reps || s.warmup) return;
            const weight = parseFloat(String(s.weight || 0));
            const reps = parseInt(String(s.reps));
            if (!reps) return;
            const eff = ex.bw ? bw + weight : weight;
            mesoTotalVolume += eff * reps;
            mesoWeeklyVolume[w] += eff * reps;
            if (eff * reps > thisBest) thisBest = eff * reps;
          });
          if (w > 0) {
            let priorBest = 0;
            for (let pw = 0; pw < w; pw++) {
              Object.values(sliceFor(pw, d, ex, exIdx)).forEach((s) => {
                if (!s || !s.reps || s.warmup) return;
                const weight = parseFloat(String(s.weight || 0));
                const reps = parseInt(String(s.reps));
                const eff = ex.bw ? bw + weight : weight;
                if (eff * reps > priorBest) priorBest = eff * reps;
              });
            }
            if (thisBest > priorBest && priorBest > 0) mesoTotalPRs++;
          }
        });
      });
    }

    // Anchor lifts: top working weight per week, which feeds both the
    // start → peak line and the per-lift chart. The peak is taken over
    // WORKING weeks — the deload is lighter by design, never the peak.
    prog.forEach((day: TrainingDay, d: number) => {
      day.exercises.forEach((ex: Exercise, exIdx: number) => {
        if (!ex.anchor) return;
        const weekly = Array.from({ length: totalWeeks }, (_, w) => {
          let top = 0;
          Object.values(sliceFor(w, d, ex, exIdx)).forEach((s) => {
            if (!s || s.warmup || !s.weight) return;
            const weight = parseFloat(String(s.weight));
            if (weight > top) top = weight;
          });
          return top;
        });
        const w1Best = weekly[0];
        let peakBest = 0;
        let peakWeek = 0;
        weekly.slice(0, totalWeeks - 1).forEach((v, w) => {
          if (v > peakBest) {
            peakBest = v;
            peakWeek = w;
          }
        });
        const ovId = store.get(`foundry:exov:d${d}:ex${exIdx}`);
        const dbEx = ovId ? findExercise(ovId) ?? null : null;
        const exName = dbEx ? dbEx.name : ex.name;
        if (w1Best > 0 && peakBest > 0) {
          mesoAnchorGains.push({
            name: exName,
            start: w1Best,
            peak: peakBest,
            delta: parseFloat((peakBest - w1Best).toFixed(1)),
            peakWeek: peakWeek + 1,
            weekly,
          });
        }
      });
    });
    const seen = new Set();
    mesoAnchorGains = mesoAnchorGains.filter((g) => {
      if (seen.has(g.name)) return false;
      seen.add(g.name);
      return true;
    });
  }

  return {
    weekIdx,
    sessions: getMeso().days,
    totalSessions: getMeso().days,
    sets: totalSets,
    volume: Math.round(totalVolume),
    prs: prCount,
    isFinal,
    anchorGains: mesoAnchorGains,
    mesoTotalVolume: Math.round(mesoTotalVolume),
    mesoTotalPRs,
    mesoCompletedSessions,
    mesoTotalSessions,
    mesoWeeklyVolume: mesoWeeklyVolume.map((v) => Math.round(v)),
   };
}
