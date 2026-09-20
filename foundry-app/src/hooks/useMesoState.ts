import { useState, useMemo, useEffect } from 'react';
import type { TrainingDay } from '../types';
import type { WeekCompleteModalData } from '../components/WeekCompleteModal';
import { on, emit } from '../utils/events';

interface UseMesoStateParams {
  setView: (view: string) => void;
  setOnboarded: (v: boolean) => void;
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
} from '../utils/store';
import { buildWeekRecap } from '../utils/weekRecap';
import { generateProgram } from '../utils/program';
import { getTrainedExerciseIds } from '../utils/trainingHistory';
import { healCustomNames, resolveCustomExercise } from '../utils/customExercises';

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
      // Pulls before migration 015 saved a custom lift's id as its name.
      // Repair the stored copy, not just this render: the recap, archive
      // and rebuild paths all read the key directly.
      base = healCustomNames<TrainingDay>(storedParsed);
      if (base.some((d: TrainingDay, i: number) => d !== storedParsed[i])) {
        store.set('foundry:storedProgram', JSON.stringify(base));
      }
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
        .map((id: string) => findExercise(id) || resolveCustomExercise(id))
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

      setWeekCompleteModal(buildWeekRecap(weekIdx, newCompleted));
      const isFinal = weekIdx === getMeso().totalWeeks - 1;

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
    archiveCurrentMeso(profile, { generateProgram, EXERCISE_DB: getExerciseDB(), status: 'abandoned' });
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
