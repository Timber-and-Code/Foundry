import { useState, useRef } from 'react';
import {
  store,
  markComplete,
  localDateStr,
} from '../utils/store';
import { leftOpenKey } from '../utils/leftOpen';
import { buildShareStats } from '../utils/shareSnapshot';
import {
  upsertWorkoutSessionRemote,
  getOrCreateWorkoutSessionId,
} from '../utils/sync';
import { logWorkoutToHealth } from '../utils/health/logWorkoutToHealth';
import type { WorkoutCompleteStats } from '../components/workout/WorkoutCompleteModal';
import type { Exercise, WorkoutSet } from '../types';

interface UseCompletionFlowArgs {
  exercises: Exercise[];
  weekData: Record<string | number, Record<string | number, WorkoutSet>>;
  exNotes: Record<string | number, string>;
  notes: string;
  dayIdx: number;
  weekIdx: number;
  sessionStartRef: React.RefObject<number | null>;
  elapsedSecs: number;
  /** Day label, forwarded to Apple Health as the workout's metadata. */
  dayLabel?: string;
}

export function useCompletionFlow({
  exercises,
  weekData,
  exNotes,
  notes,
  dayIdx,
  weekIdx,
  sessionStartRef,
  elapsedSecs,
  dayLabel,
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
    // A session left open on an earlier day (utils/leftOpen) is closed out
    // as THAT day's work: dated when the lifter trained, timed from the
    // stored start to the last logged write, posted to Health the same way.
    // The on-screen timer was re-anchored on restore and says nothing
    // about the real session.
    const leftOpenIso = store.get(leftOpenKey(dayIdx, weekIdx));
    const leftOpenMs = leftOpenIso ? Date.parse(leftOpenIso) : NaN;
    const leftOpen = Number.isFinite(leftOpenMs);
    const now = new Date();
    const completedAt = leftOpen ? new Date(leftOpenMs) : now;
    const storedStartRaw = store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
    const storedStart = storedStartRaw ? parseInt(storedStartRaw, 10) : NaN;
    const healthStartMs = leftOpen
      ? (Number.isFinite(storedStart) ? storedStart : null)
      : sessionStartRef.current ?? null;
    const healthElapsedSecs = leftOpen
      ? Math.max(0, Math.floor((completedAt.getTime() - (healthStartMs ?? completedAt.getTime())) / 1000))
      : elapsedSecs;

    const rawDurationSecs = leftOpen
      ? healthElapsedSecs
      : sessionStartRef.current
        ? Math.floor((Date.now() - sessionStartRef.current) / 1000)
        : elapsedSecs > 0 ? elapsedSecs : null;
    // Safety clamp: a duration beyond 24h means the start stamp was stale
    // (abandoned pre-layoff session). Omit the TIME stat rather than report
    // "1700 hrs" — useWorkoutTimer re-anchors these on restore, but guard
    // here too in case a stale ref slips through another path.
    const durationSecs =
      rawDurationSecs !== null && rawDurationSecs > 24 * 3600 ? null : rawDurationSecs;

    // Totals, breakdown, PRs and the anchor comparison — one rule shared
    // with the share-from-history rebuild (utils/shareSnapshot).
    const stats = buildShareStats(exercises, weekData, dayIdx, weekIdx, durationSecs);
    const totalSets = stats.sets;
    const totalVolume = stats.volume;

    setCompletionWeekIdx(weekIdx);
    setWorkoutStats(stats);

    const dateStr = localDateStr(completedAt);
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
      duration: leftOpen ? healthElapsedSecs : elapsedSecs,
      completedAt: completedAt.getTime(),
    };
    markComplete(dayIdx, weekIdx, completedAt);
    store.remove(leftOpenKey(dayIdx, weekIdx));
    store.set(`foundry:sessionNote:d${dayIdx}:w${weekIdx}`, sessionNote);
    const sessionId = getOrCreateWorkoutSessionId(dayIdx, weekIdx);
    upsertWorkoutSessionRemote(dayIdx, weekIdx, {
      sessionId,
      completedAt: completedAt.toISOString(),
      isComplete: true,
    });

    // Apple Health — writes an HKWorkout so the session shows in Apple
    // Fitness and its energy reaches the Move ring. Deliberately not
    // awaited: a slow or refused Health write must not hold up the
    // completion modal, and it self-guards against writing twice.
    void logWorkoutToHealth({
      startMs: healthStartMs,
      endMs: completedAt.getTime(),
      elapsedSecs: healthElapsedSecs,
      dayIdx,
      weekIdx,
      dayLabel,
      totalSets,
      totalVolumeLbs: totalVolume,
    });

    // Onboarding v2: emit first-all-reps-hit once per user when every
    // confirmed set on every anchor exercise met its target rep count.
    // CoachMarkOrchestrator explains that next week adds weight.
    if (!store.get('foundry:first_weight_progression_emitted')) {
      const anchors = exercises.filter((ex: Exercise) => ex.anchor);
      let allAnchorsHit = anchors.length > 0;
      for (const ex of anchors) {
        const raw = String(ex.reps || '');
        const target = parseInt(raw.split('-')[0], 10);
        if (!Number.isFinite(target) || target <= 0) {
          allAnchorsHit = false;
          break;
        }
        const idx = exercises.indexOf(ex);
        const exData = (weekData[idx] || {}) as Record<string, WorkoutSet>;
        const sets = Object.values(exData).filter(
          (s: WorkoutSet) => s.confirmed && !s.warmup,
        );
        if (sets.length === 0) {
          allAnchorsHit = false;
          break;
        }
        for (const s of sets) {
          const r = parseInt(String(s.reps || 0), 10);
          if (!Number.isFinite(r) || r < target) {
            allAnchorsHit = false;
            break;
          }
        }
        if (!allAnchorsHit) break;
      }
      if (allAnchorsHit) {
        store.set('foundry:first_weight_progression_emitted', '1');
        window.dispatchEvent(new Event('foundry:first-all-reps-hit'));
      }
    }

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
    // Trust weekData as the source of truth, not `doneExercises` — the latter
    // is populated by `handleLastSetFilled` which can lag or miss updates
    // (stale closure on the just-confirmed set, un-done+reconfirm flows, etc).
    // An exercise counts as done if every set slot in weekData is confirmed.
    const allExDone = exercises.every((ex, i) => {
      const totalSets = Number(ex?.sets ?? 0);
      if (totalSets <= 0) return true;
      const exData = (weekData[i] || {}) as Record<string, WorkoutSet>;
      for (let s = 0; s < totalSets; s++) {
        if (!exData[s]?.confirmed) return false;
      }
      return true;
    });
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
