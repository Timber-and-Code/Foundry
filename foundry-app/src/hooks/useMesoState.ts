import { useState, useMemo, useEffect } from 'react';
import type { WorkoutSet, TrainingDay, Exercise } from '../types';
import type { WeekCompleteModalData } from '../components/WeekCompleteModal';
import { on } from '../utils/events';

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
}
import { getMeso, resetMesoCache } from '../data/constants';
import { getExerciseDB, findExercise } from '../data/exerciseDB';
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
} from '../utils/store';
import { generateProgram } from '../utils/program';

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

  const activeDays = useMemo(() => {
    if (!profile) return [];
    const stored = store.get('foundry:storedProgram');
    const base = stored
      ? JSON.parse(stored)
      : (() => {
          const result = generateProgram(profile, getExerciseDB() as any);
          store.set('foundry:storedProgram', JSON.stringify(result));
          return result;
        })();
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
  }, [profile]);

  const activeWeek = (() => {
    for (let w = 0; w < getMeso().weeks; w++) {
      const allDone = activeDays.every((_: TrainingDay, i: number) => completedDays.has(`${i}:${w}`));
      if (!allDone) return w;
    }
    return getMeso().weeks;
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

      const isFinal = weekIdx === getMeso().weeks;

      // Meso retrospective data (isFinal only)
      let mesoAnchorGains: AnchorGain[] = [];
      let mesoTotalVolume = 0;
      let mesoTotalPRs = 0;
      let mesoCompletedSessions = 0;
      const mesoTotalSessions = getMeso().weeks * getMeso().days;

      if (isFinal) {
        for (let w = 0; w < getMeso().weeks; w++) {
          for (let d = 0; d < getMeso().days; d++) {
            if (newCompleted.has(`${d}:${w}`)) mesoCompletedSessions++;
          }
        }
        for (let w = 0; w <= getMeso().weeks; w++) {
          prog.forEach((day: TrainingDay, d: number) => {
            const raw = store.get(`foundry:day${d}:week${w}`);
            if (!raw) return;
            try {
              const wd = JSON.parse(raw);
              day.exercises.forEach((ex: Exercise, exIdx: number) => {
                const exData = wd[exIdx] || {};
                let thisBest = 0;
                Object.values(exData as Record<string, WorkoutSet>).forEach((s) => {
                  if (!s || !s.reps) return;
                  const weight = parseFloat(String(s.weight || 0));
                  const reps = parseInt(String(s.reps));
                  if (!reps) return;
                  const eff = ex.bw ? bw + weight : weight;
                  mesoTotalVolume += eff * reps;
                  if (eff * reps > thisBest) thisBest = eff * reps;
                });
                if (w > 0) {
                  let priorBest = 0;
                  for (let pw = 0; pw < w; pw++) {
                    const pr = store.get(`foundry:day${d}:week${pw}`);
                    if (!pr) continue;
                    try {
                      const pwd = JSON.parse(pr);
                      Object.values(pwd[exIdx] as Record<string, WorkoutSet> || {}).forEach((s) => {
                        if (!s || !s.reps) return;
                        const weight = parseFloat(String(s.weight || 0));
                        const reps = parseInt(String(s.reps));
                        const eff = ex.bw ? bw + weight : weight;
                        if (eff * reps > priorBest) priorBest = eff * reps;
                      });
                    } catch { /* JSON parse fallback — data optional */ }
                  }
                  if (thisBest > priorBest && priorBest > 0) mesoTotalPRs++;
                }
              });
            } catch { /* JSON parse fallback — data optional */ }
          });
        }

        // Anchor lift progression
        prog.forEach((day: TrainingDay, d: number) => {
          day.exercises.forEach((ex: Exercise, exIdx: number) => {
            if (!ex.anchor) return;
            const w1Raw = store.get(`foundry:day${d}:week0`);
            let w1Best = 0;
            if (w1Raw) {
              try {
                const w1d = JSON.parse(w1Raw);
                Object.values(w1d[exIdx] as Record<string, WorkoutSet> || {}).forEach((s) => {
                  if (!s || !s.weight) return;
                  const w = parseFloat(String(s.weight));
                  if (w > w1Best) w1Best = w;
                });
              } catch { /* JSON parse fallback — data optional */ }
            }
            let peakBest = 0;
            let peakWeek = 0;
            for (let w = 0; w < getMeso().weeks; w++) {
              const raw = store.get(`foundry:day${d}:week${w}`);
              if (!raw) continue;
              try {
                const wd = JSON.parse(raw);
                Object.values(wd[exIdx] as Record<string, WorkoutSet> || {}).forEach((s) => {
                  if (!s || !s.weight) return;
                  const weight = parseFloat(String(s.weight));
                  if (weight > peakBest) {
                    peakBest = weight;
                    peakWeek = w;
                  }
                });
              } catch { /* JSON parse fallback — data optional */ }
            }
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
      });

      const nextWeek = weekIdx + 1;
      if (nextWeek <= getMeso().weeks) {
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
    setCurrentWeek(1);
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
