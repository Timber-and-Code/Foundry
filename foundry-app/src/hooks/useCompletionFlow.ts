import { useState, useRef } from 'react';
import {
  store,
  detectSessionPRs,
} from '../utils/store';
import {
  upsertWorkoutSessionRemote,
  getOrCreateWorkoutSessionId,
} from '../utils/sync';
import type { WorkoutCompleteStats } from '../components/workout/WorkoutCompleteModal';
import type { Exercise, WorkoutSet } from '../types';

interface UseCompletionFlowArgs {
  exercises: Exercise[];
  weekData: Record<string | number, Record<string | number, WorkoutSet>>;
  exNotes: Record<string | number, string>;
  notes: string;
  doneExercises: Set<number>;
  dayIdx: number;
  weekIdx: number;
  sessionStartRef: React.RefObject<number | null>;
  elapsedSecs: number;
}

export function useCompletionFlow({
  exercises,
  weekData,
  exNotes,
  notes,
  doneExercises,
  dayIdx,
  weekIdx,
  sessionStartRef,
  elapsedSecs,
}: UseCompletionFlowArgs) {
  const compileSessionNote = () => {
    const parts: string[] = [];
    exercises.forEach((ex: Exercise, i: number) => {
      const exNote = (exNotes as Record<string, string>)[i];
      if (exNote && exNote.trim()) {
        parts.push(`${ex.name}: ${exNote}`);
      }
    });
    if (notes && notes.trim()) {
      parts.push(notes);
    }
    return parts.join('\n\n');
  };

  const [showNoteReview, setShowNoteReview] = useState(false);
  const [sessionNote, setSessionNote] = useState(() => compileSessionNote());
  const [showUnfinishedPrompt, setShowUnfinishedPrompt] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [workoutStats, setWorkoutStats] = useState<WorkoutCompleteStats | null>(null);
  const [showCardioPrompt, setShowCardioPrompt] = useState(false);
  const [completionWeekIdx, setCompletionWeekIdx] = useState<number | null>(null);
  const pendingCompletionRef = useRef<Record<string, unknown> | null>(null);

  const doCompleteWithStats = () => {
    let totalSets = 0;
    let totalReps = 0;
    let totalVolume = 0;
    exercises.forEach((_ex: Exercise, i: number) => {
      const exData = (weekData[i] || {}) as Record<string, WorkoutSet>;
      Object.values(exData).forEach((s: WorkoutSet) => {
        if (s.confirmed || (s.reps && String(s.reps).trim() !== '')) {
          const r = parseInt(String(s.reps || 0), 10);
          const w = parseFloat(String(s.weight || 0));
          if (!s.warmup) {
            totalSets++;
            if (!isNaN(r)) totalReps += r;
            if (!isNaN(w) && !isNaN(r)) totalVolume += w * r;
          }
        }
      });
    });

    const prs = detectSessionPRs(exercises, weekData, 'meso', { dayIdx, weekIdx });

    const anchorComparison: { name: string; today: number; prev: number; delta: number }[] = [];
    if (weekIdx > 0) {
      exercises.forEach((ex: Exercise, i: number) => {
        if (!ex.anchor) return;
        const exData = (weekData[i] || {}) as Record<string, WorkoutSet>;
        let todayBest = 0;
        Object.values(exData).forEach((s: WorkoutSet) => {
          const w = parseFloat(String(s.weight || 0));
          if (!isNaN(w) && w > todayBest && s.reps) todayBest = w;
        });
        if (todayBest <= 0) return;
        try {
          const rawPrev = store.get(`foundry:day${dayIdx}:week${weekIdx - 1}`);
          if (rawPrev) {
            const prevData = JSON.parse(rawPrev);
            const prevExData = (prevData[i] || {}) as Record<string, WorkoutSet>;
            let prevBest = 0;
            Object.values(prevExData).forEach((s: WorkoutSet) => {
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
        } catch (_e) {
          // ignore parse errors
        }
      });
    }

    const durationSecs = sessionStartRef.current
      ? Math.floor((Date.now() - sessionStartRef.current) / 1000)
      : elapsedSecs > 0 ? elapsedSecs : null;

    setCompletionWeekIdx(weekIdx);
    setWorkoutStats({
      sets: totalSets,
      reps: totalReps,
      volume: totalVolume,
      exercises: exercises.length,
      duration: durationSecs,
      prs,
      anchorComparison,
    });

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const completionData = {
      date: dateStr,
      dayIdx,
      weekIdx,
      exercises: exercises.map((ex: Exercise, i: number) => ({
        name: ex.name,
        sets: ex.sets,
        data: weekData[i] || {},
      })),
      sessionNote,
      duration: elapsedSecs,
      completedAt: Date.now(),
    };
    store.set(`foundry:done:d${dayIdx}:w${weekIdx}`, '1');
    store.set(`foundry:sessionNote:d${dayIdx}:w${weekIdx}`, sessionNote);
    const sessionId = getOrCreateWorkoutSessionId(dayIdx, weekIdx);
    upsertWorkoutSessionRemote(dayIdx, weekIdx, {
      sessionId,
      completedAt: now.toISOString(),
      isComplete: true,
    });

    setShowWorkoutModal(true);
    pendingCompletionRef.current = completionData;
  };

  const openNoteReview = () => {
    const hasNotes = exercises.some((_: Exercise, i: number) => ((exNotes as Record<string, string>)[i] || '').trim()) || sessionNote.trim();
    if (!hasNotes) {
      doCompleteWithStats();
      return;
    }
    setShowNoteReview(true);
  };

  const handleComplete = () => {
    const allExDone = doneExercises.size === exercises.length;
    if (!allExDone) {
      setShowUnfinishedPrompt(true);
      return;
    }
    openNoteReview();
  };

  return {
    // State
    showNoteReview,
    setShowNoteReview,
    sessionNote,
    setSessionNote,
    showUnfinishedPrompt,
    setShowUnfinishedPrompt,
    showWorkoutModal,
    setShowWorkoutModal,
    workoutStats,
    showCardioPrompt,
    setShowCardioPrompt,
    completionWeekIdx,
    pendingCompletionRef,
    // Actions
    handleComplete,
    openNoteReview,
    doCompleteWithStats,
  };
}
