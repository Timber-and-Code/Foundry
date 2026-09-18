import { useState, useMemo, useEffect } from 'react';
import type { WorkoutSet, TrainingDay, Exercise } from '../types';
import type { WeekCompleteModalData } from '../components/WeekCompleteModal';
import { on, emit } from '../utils/events';

interface UseMesoStateParams {
  setView: (view: string) => void;
  setOnboarded: (v: boolean) => void;
}

interface AnchorGain {
  name: string;
  start: number;
  peak: number;
  delta: number;
  peakWeek: number;
  /** Top working weight per week (0 = not logged), deload last. */
  weekly: number[];
}
import { getMeso, resetMesoCache } from '../data/constants';
import { getExerciseDB, findExercise, useExerciseDB } from '../data/exerciseDB';
import {
  store,
  loadProfile,
  loadCompleted,
  markComplete,
  loadCurrentWeek,
  saveCurrentWeek,
  snapshotData,
  resetMeso,
  archiveCurrentMeso,
  findPrevSlotForExercise,
} from '../utils/store';
import { generateProgram } from '../utils/program';
import { getTrainedExerciseIds } from '../utils/trainingHistory';

export function useMesoState({ setView, setOnboarded }: UseMesoStateParams) {
  const [profile, setProfile] = useState(loadProfile);
  const [completedDays, setCompletedDays] = useState(() => loadCompleted(getMeso()));
  const [currentWeek, setCurrentWeek] = useState(loadCurrentWeek);
  const [weekCompleteModal, setWeekCompleteModal] = useState<WeekCompleteModalData | null>(null);

  // When Supabase pull finishes (on sign-in or manual sync), re-read local
  // storage so freshly-restored profile + completion data show up without
  // requiring a page reload.
  useEffect(() => {
    const handlePullComplete = () => {
      resetMesoCache();
      const fresh = loadProfile();
      setProfile(fresh);
      setCompletedDays(loadCompleted(getMeso()));
      setCurrentWeek(loadCurrentWeek());
    };
    const unsub = on('foundry:pull-complete', handlePullComplete);
    return unsub;
  }, []);

  // Subscribe to DB readiness so activeDays recomputes once exercises load.
  const exerciseDB = useExerciseDB();

  const activeDays = useMemo(() => {
    if (!profile) return [];
    const stored = store.get('foundry:storedProgram');
    const storedParsed = stored ? JSON.parse(stored) : null;
    // Detect a "poisoned" stored program: one generated before the exercise
    // DB finished lazy-loading, so every day has an empty exercises array.
    const storedIsPoisoned =
      Array.isArray(storedParsed) &&
      storedParsed.length > 0 &&
      storedParsed.every((d: TrainingDay) => !d.exercises || d.exercises.length === 0);
    let base;
    if (storedParsed && !storedIsPoisoned) {
      base = storedParsed;
    } else {
      // Don't generate (or cache) until the DB is actually loaded, otherwise
      // we'd just re-poison the storedProgram key.
      if (exerciseDB.length === 0) return [];
      // Anchor continuity: keep progressing the compounds this lifter
      // already has numbers for instead of rolling fresh variants every
      // cycle. Accessories still rotate — see generateProgram.
      base = generateProgram(profile, exerciseDB as any, {
        trainedIds: getTrainedExerciseIds(),
      });
      store.set('foundry:storedProgram', JSON.stringify(base));
    }
    const days = base.slice(0, getMeso().days);
    const added = profile.addedDayExercises || {};
    return days.map((day: TrainingDay, dayIdx: number) => {
      const extraIds = (added as Record<string, any>)[dayIdx] || [];
      if (extraIds.length === 0) return day;
      const extraExs = extraIds
        .map((id: string) => findExercise(id))
        .filter(Boolean)
        .map((e: Record<string, unknown>) => ({
          id: e.id,
          name: e.name,
          muscle: e.muscle,
          muscles: e.muscles,
          equipment: e.equipment,
          tag: e.tag,
          anchor: false,
          sets: e.sets,
          reps: e.reps,
          rest: e.rest,
          warmup: '1 feeler set',
          progression: e.pattern === 'isolation' ? 'reps' : 'weight',
          description: e.description || '',
          videoUrl: e.videoUrl || '',
          bw: !!e.bw,
          addedMidMeso: true,
        }));
      return { ...day, exercises: [...day.exercises, ...extraExs] };
    });
  }, [profile, exerciseDB]);

  const activeWeek = (() => {
    for (let w = 0; w < getMeso().totalWeeks; w++) {
      const allDone = activeDays.every((_: TrainingDay, i: number) => completedDays.has(`${i}:${w}`));
      if (!allDone) return w;
    }
    return getMeso().totalWeeks;
  })();

  const handleComplete = (dayIdx: number, weekIdx: number) => {
    markComplete(dayIdx, weekIdx);
    const newCompleted = new Set([...completedDays, `${dayIdx}:${weekIdx}`]);
    setCompletedDays(newCompleted);

    const weekFinished = Array.from({ length: getMeso().days }, (_, d) => d).every((d) =>
      newCompleted.has(`${d}:${weekIdx}`)
    );

    if (weekFinished) {
      snapshotData();

      // Onboarding v2: emit first-week-done once per user, when week 0
      // completes. Gated by foundry:first_week_done_emitted.
      if (weekIdx === 0 && !store.get('foundry:first_week_done_emitted')) {
        store.set('foundry:first_week_done_emitted', '1');
        emit('foundry:first-week-done');
      }

      // Resumption recalibrate: clear the re-entry deload flag when the
      // flagged week wraps. We clear on week-complete (not on
      // markResumptionHandled) because the flag's whole job is to scale
      // carryover for THIS week — clearing earlier would defeat it.
      const mesoId = store.get('foundry:active_meso_id');
      if (mesoId) {
        store.remove(`foundry:reentry_deload:${mesoId}:${weekIdx}`);
      }

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
            const exData = wd[exIdx] || {};
            let thisBest = 0;
            Object.values(exData as Record<string, WorkoutSet>).forEach((s) => {
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
                Object.values(pwd[exIdx] as Record<string, WorkoutSet> || {}).forEach((s) => {
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
            if (newCompleted.has(`${d}:${w}`)) mesoCompletedSessions++;
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

      setWeekCompleteModal({
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
      });

      // Onboarding v2: emit meso-complete once per user when the final week
      // of the first meso wraps. Gated so a multi-meso veteran doesn't get
      // re-prompted at the end of every block.
      if (isFinal && !store.get('foundry:meso_complete_emitted')) {
        store.set('foundry:meso_complete_emitted', '1');
        emit('foundry:meso-complete');
      }

      const nextWeek = weekIdx + 1;
      if (nextWeek <= getMeso().totalWeeks) {
        setCurrentWeek(nextWeek);
        saveCurrentWeek(nextWeek);
      }
    }
  };

  const handleReset = () => {
    archiveCurrentMeso(profile, { generateProgram, EXERCISE_DB: getExerciseDB() });
    resetMeso();
    store.remove('foundry:profile');
    store.remove('foundry:storedProgram');
    resetMesoCache();
    setProfile(null);
    setCompletedDays(new Set());
    // Weeks are 0-indexed — resetMeso just persisted '0'; keep memory in
    // step or the restarted meso opens on WEEK 2.
    setCurrentWeek(0);
    setView('home');
    setOnboarded(!!store.get('foundry:onboarded'));
  };

  return {
    profile,
    setProfile,
    completedDays,
    setCompletedDays,
    currentWeek,
    setCurrentWeek,
    weekCompleteModal,
    setWeekCompleteModal,
    activeDays,
    activeWeek,
    handleComplete,
    handleReset,
  };
}
