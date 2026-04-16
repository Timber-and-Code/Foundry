import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { tokens } from '../../styles/tokens';

// Data
import {
  randomQuote,
  getMeso,
} from '../../data/constants';
import { getExerciseDB, findExercise, type ExerciseEntry } from '../../data/exerciseDB';

// UI

// Utils
import { emit } from '../../utils/events';
import {
  store,
  loadDayWeek,
  loadDayWeekWithCarryover,
  saveDayWeek,
  loadNotes,
  loadExNotes,
  loadExOverride,
  saveExOverride,
  bwPromptShownThisWeek,
  getWeekSets,
  getWorkoutDaysForWeek,
} from '../../utils/store';
import {
  syncExerciseSwapRemote,
  upsertWorkoutSessionRemote,
  upsertWorkoutSetRemote,
  deleteWorkoutSetRemote,
  getOrCreateWorkoutSessionId,
  debouncedSync,
} from '../../utils/sync';
import { useRestTimer } from '../../contexts/RestTimerContext';
import { useWorkoutTimer, formatElapsed } from '../../hooks/useWorkoutTimer';
import { useCompletionFlow } from '../../hooks/useCompletionFlow';

// Components
import ExerciseCard from './ExerciseCard';
import WorkoutSplash from './WorkoutSplash';
import WorkoutCompleteModal from './WorkoutCompleteModal';
import CardioPromptModal from './CardioPromptModal';
import UnfinishedPromptModal from './UnfinishedPromptModal';
import NoteReviewSheet from './NoteReviewSheet';
import ReadinessSheet from './ReadinessSheet';
import SwapSheet from './SwapSheet';
import type { Profile, TrainingDay, Exercise } from '../../types';

interface DayViewProps {
  dayIdx: number;
  weekIdx: number;
  onBack: () => void;
  onComplete: (data?: Record<string, unknown>) => void;
  onNextDay: () => void;
  onNavigateToDay?: (dayIdx: number, weekIdx: number) => void;
  completedDays: Set<string>;
  profile: Profile;
  activeDays: TrainingDay[];
  onProfileUpdate: (profile: Partial<Profile>) => void;
}

function DayView({
  dayIdx,
  weekIdx,
  onBack,
  onComplete,
  onNextDay: _onNextDay,
  onNavigateToDay,
  completedDays,
  profile,
  activeDays,
  onProfileUpdate,
}: DayViewProps) {
  const { restTimer, restTimerMinimized, setRestTimerMinimized, startRestTimer, dismissRestTimer } =
    useRestTimer();
  const day = activeDays[dayIdx];

  // Guard: if the day slot doesn't exist (profile/MESO mismatch after restore), bail gracefully
  if (!day) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-root)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          gap: 16,
        }}
      >
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary)',
            textAlign: 'center',
          }}
        >
          Session unavailable
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          Day {dayIdx + 1} doesn't exist in the current program ({activeDays.length} days
          configured). This usually means a backup was restored with a different program structure.
        </div>
        <button
          onClick={onBack}
          className="btn-primary"
          style={{
            padding: '12px 28px',
            borderRadius: tokens.radius.md,
            fontSize: 14,
            fontWeight: 700,
            marginTop: 8,
            background: 'var(--btn-primary-bg)',
            border: '1px solid var(--btn-primary-border)',
            color: 'var(--btn-primary-text)',
          }}
        >
          ← Go Back
        </button>
      </div>
    );
  }

  const isDone = completedDays.has(`${dayIdx}:${weekIdx}`);

  // Week-adjusted day: injects MEV→MAV→MRV set progression into every exercise.
  // Must be computed before useState initializers that consume ex.sets.
  const weekDay = {
    ...day,
    exercises: day.exercises.map((ex: Exercise) => ({
      ...ex,
      sets: getWeekSets(Number(ex.sets ?? 0), weekIdx, getMeso().weeks),
    })),
  };

  // Compute active week from completedDays (first week not fully done)
  const activeWeek = (() => {
    for (let w = 0; w < getMeso().weeks; w++) {
      const allDone = activeDays.every((_: TrainingDay, i: number) => completedDays.has(`${i}:${w}`));
      if (!allDone) return w;
    }
    return getMeso().weeks;
  })();

  // Future sessions are completely locked — show empty, no interaction
  const isFutureSession = weekIdx > activeWeek;
  const isLocked = isFutureSession;

  const mesoId = store.get('foundry:active_meso_id');

  // BW confirm modal — fires once per session per BW exercise
  const [bwConfirmed, setBwConfirmed] = React.useState(new Set());
  const [bwModal, setBwModal] = React.useState<{ exIdx: number; exName: string } | null>(null);
  const [bwInput, setBwInput] = React.useState('');

  const handleExpandToggle = (i: number) => {
    const ex = day.exercises[i];
    // If BW exercise, not yet confirmed this session, and not read-only
    if (ex.bw && !bwConfirmed.has(i) && !isDone && !isLocked) {
      setBwInput(String(profile?.weight || ''));
      setBwModal({ exIdx: i, exName: ex.name });
    }
    setExpandedIdx(expandedIdx === i ? null : i);
  };

  const handleBwConfirm = () => {
    if (!bwModal) return;
    const val = parseFloat(bwInput);
    if (!isNaN(val) && val > 0 && val !== parseFloat(String(profile?.weight || 0))) {
      onProfileUpdate && onProfileUpdate({ weight: bwInput });
    }
    setBwConfirmed((prev) => new Set([...prev, bwModal.exIdx]));
    setBwModal(null);
  };

  // Future sessions: load raw (empty) data so inputs show blank, not suggestions
  const [weekData, setWeekData] = useState(() =>
    isFutureSession
      ? loadDayWeek(dayIdx, weekIdx)
      : loadDayWeekWithCarryover(dayIdx, weekIdx, weekDay, profile)
  );
  const [notes] = useState(() => loadNotes(dayIdx, weekIdx));
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const [doneExercises, setDoneExercises] = useState<Set<number>>(() => {
    if (isFutureSession) return new Set<number>(); // future — nothing is done
    const saved = loadDayWeekWithCarryover(dayIdx, weekIdx, weekDay, profile);
    const restored = new Set<number>();
    weekDay.exercises.forEach((ex: Exercise, i: number) => {
      const exData = (saved as unknown as Record<string, Record<string, Record<string, unknown>>>)[i] || {};
      let allFilled = true;
      for (let s = 0; s < Number(ex.sets ?? 0); s++) {
        const sd = exData[s] || {};
        // Only count as done if user actually confirmed — not from suggestion engine
        if (!sd.reps || sd.reps === '' || sd.repsSuggested) {
          allFilled = false;
          break;
        }
      }
      if (allFilled) restored.add(i);
    });
    return restored;
  });
  const [, setDialog] = useState<{ exIdx: number; exName?: string; restStr?: string; isLastSet?: boolean } | null>(null);
  const [showMesoOverlay, setShowMesoOverlay] = useState(() => {
    const freshDone = store.get(`foundry:done:d${dayIdx}:w${weekIdx}`) === '1';
    const alreadyStarted = !!store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
    return !freshDone && !isLocked && !alreadyStarted;
  });

  // Splash: auto-fires when this day is today's scheduled session OR the most
  // overdue incomplete scheduled session (a "behind" day). First entry only —
  // once dismissed it won't re-appear for this (day, week) pair.
  const [showSplash, setShowSplash] = useState(() => {
    if (isLocked) return false;
    const freshDone = store.get(`foundry:done:d${dayIdx}:w${weekIdx}`) === '1';
    if (freshDone) return false;
    const alreadyStarted = !!store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
    if (alreadyStarted) return false;
    if (store.get(`foundry:splash-seen:d${dayIdx}:w${weekIdx}`) === '1') return false;
    // Find earliest scheduled session on or before today that is NOT completed.
    const startDate = profile?.startDate ? new Date(profile.startDate + 'T00:00:00') : null;
    if (!startDate || activeDays.length === 0) return false;
    const todayStr = new Date().toISOString().slice(0, 10);
    const total = (getMeso().weeks + 1) * activeDays.length;
    const cursor = new Date(startDate);
    let count = 0;
    for (let d = 0; d < 400 && count < total; d++) {
      const wk = Math.floor(count / activeDays.length);
      if (getWorkoutDaysForWeek(profile, wk).includes(cursor.getDay())) {
        const di = count % activeDays.length;
        const cursorStr = cursor.toISOString().slice(0, 10);
        if (cursorStr > todayStr) return false;
        if (!completedDays.has(`${di}:${wk}`)) {
          return di === dayIdx && wk === weekIdx;
        }
        count++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return false;
  });
  const dismissSplash = () => {
    store.set(`foundry:splash-seen:d${dayIdx}:w${weekIdx}`, '1');
    setShowSplash(false);
  };
  // warmupOpen, readinessBannerDismissed — reserved for warmup/readiness UI

  // Readiness check-in state — reserved for in-workout readiness flow

  // editMode — reserved for edit-mode toggle
  const [showLeavePrompt] = useState(false);
  const leaveQuoteRef = React.useRef<{ text: string; author: string } | null>(null);
  React.useEffect(() => {
    if (showLeavePrompt && !leaveQuoteRef.current) {
      leaveQuoteRef.current = randomQuote('neutral');
    }
    if (!showLeavePrompt) leaveQuoteRef.current = null;
  }, [showLeavePrompt]);

  // Session duration tracking — shared hook manages timer, start/end timestamps
  const {
    workoutStarted,
    elapsedSecs,
    sessionStartRef,
    beginWorkout: startTimer,
  } = useWorkoutTimer({
    startKey: `foundry:sessionStart:d${dayIdx}:w${weekIdx}`,
    strengthEndKey: `foundry:strengthEnd:d${dayIdx}:w${weekIdx}`,
    isDone,
    isLocked,
  });

  // Readiness is one row per day; prompt only if today's entry isn't already complete
  const isReadinessIncompleteToday = () => {
    const d = new Date();
    const key = `foundry:readiness:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    try {
      const r = JSON.parse(store.get(key) || 'null');
      return !r || !r.sleep || !r.soreness || !r.energy;
    } catch {
      return true;
    }
  };

  // Begin workout — stamps localStorage, starts timer, dismisses overlay
  const beginWorkout = () => {
    startTimer();
    setShowMesoOverlay(false);
    if (!bwPromptShownThisWeek()) setShowBwCheckin(true);
    if (isReadinessIncompleteToday()) setShowReadinessSheet(true);
    // Chunk 4a: create/upsert the remote workout_sessions row with
    // started_at. Fire-and-forget. Failures are surfaced via toast.
    const sessionId = getOrCreateWorkoutSessionId(dayIdx, weekIdx);
    upsertWorkoutSessionRemote(dayIdx, weekIdx, {
      sessionId,
      startedAt: new Date().toISOString(),
      isComplete: false,
    });
  };

  // showPostStrengthPrompt, showCardioPrompt — reserved for post-strength/cardio prompts
  // BW check-in — triggered from beginWorkout(), not at mount
  const [, setShowBwCheckin] = useState(false);
  // Readiness check-in — triggered from beginWorkout() if today's entry is incomplete
  const [showReadinessSheet, setShowReadinessSheet] = useState(false);
  // bwCheckinInput, setBwCheckinInput — reserved for BW check-in input
  // Per-exercise notes
  const [exNotes, setExNotes] = useState(() => loadExNotes(dayIdx, weekIdx));
  // prevNotesDismissed — reserved for previous week notes callout

  // Build resolved exercises by applying any saved overrides
  // MUST be declared before prevWeekNotes useMemo — Babel hoists var to undefined otherwise
  const resolveExercises = useCallback(() => {
    const customExercises = JSON.parse(store.get('foundry:customExercises') || '{}');
    return (weekDay.exercises || []).map((ex: Exercise, i: number) => {
      const ovId = loadExOverride(dayIdx, weekIdx, i);
      if (!ovId) return ex;
      const dbEx = findExercise(ovId);
      // Check custom exercises if not in DB
      const customEx = !dbEx && ovId.startsWith('custom:') ? customExercises[ovId] : null;
      const resolved = dbEx || customEx;
      if (!resolved) return ex;
      const wu = ex.anchor
        ? Number(profile?.sessionDuration ?? 60) <= 30
          ? '2 ramp sets — time is tight, be thorough'
          : resolved.warmup
        : resolved.warmup || '1 feeler set';
      return {
        id: resolved.id,
        name: resolved.name,
        muscle: resolved.muscle || ex.muscle,
        equipment: resolved.equipment || 'other',
        tag: resolved.tag || ex.tag,
        anchor: ex.anchor,
        sets: getWeekSets(Number((resolved.sets || ex.sets) ?? 0), weekIdx, getMeso().weeks),
        reps: resolved.reps || ex.reps,
        rest: resolved.rest || ex.rest,
        warmup: wu,
        progression: resolved.pattern === 'isolation' ? 'reps' : 'weight',
        description: resolved.description || '',
        videoUrl: resolved.videoUrl || '',
        supersetWith: ex.supersetWith,
      } as Exercise;
    });
  }, [weekDay.exercises, dayIdx, weekIdx]);
  const [exercises, setExercises] = useState(resolveExercises);

  // Defensive sync: if the component mounted while activeDays was empty/stale
  // (e.g. exercise DB still lazy-loading), local `exercises` state would be
  // stuck at []. When the upstream day populates, pick it up.
  useEffect(() => {
    if (exercises.length === 0 && weekDay.exercises && weekDay.exercises.length > 0) {
      setExercises(resolveExercises());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDay.exercises]);

  // Active exercise: first exercise not yet completed (for highlight)
  const activeExIdx = useMemo(() => {
    if (isDone || isLocked) return -1;
    for (let i = 0; i < exercises.length; i++) {
      if (!doneExercises.has(i)) return i;
    }
    return -1; // all done
  }, [exercises.length, doneExercises, isDone, isLocked]);

  // prevWeekNotes memo — reserved for previous week notes callout

  // ── Stalling detection — runs once per session open on active, non-deload sessions ──
  // stallingData + stallCardDismissed — reserved for stall detection UI

  // showUnfinishedPrompt — reserved for unfinished workout prompt
  const [swapTarget, setSwapTarget] = useState<{ exIdx: number } | null>(null);
  const [swapPending, setSwapPending] = useState<{ exIdx: number; newExId: string } | null>(null);
  const [, setShowAddExercise] = useState(false);

  /* ── Swap: build exercise groups for picker ─────────────────────────────── */
  const swapExGroups = useMemo(() => {
    const tag = day?.tag || 'FULL';
    let tagFilter: string[];
    // Push/Pull split includes leg exercises (squats in push, hinges in pull),
    // so the swap picker must show LEGS alongside PUSH/PULL.
    if (tag === 'PUSH') tagFilter = ['PUSH', 'LEGS'];
    else if (tag === 'PULL') tagFilter = ['PULL', 'LEGS'];
    else if (tag === 'LEGS') tagFilter = ['LEGS'];
    else if (tag === 'UPPER') tagFilter = ['PUSH', 'PULL'];
    else if (tag === 'LOWER') tagFilter = ['LEGS'];
    else tagFilter = ['PUSH', 'PULL', 'LEGS'];
    const exs = getExerciseDB().filter((e: Exercise) => tagFilter.includes(e.tag || ''));
    const groups: Record<string, ExerciseEntry[]> = {};
    exs.forEach((e: ExerciseEntry) => {
      if (!groups[e.muscle]) groups[e.muscle] = [];
      groups[e.muscle].push(e);
    });
    return groups;
  }, [day?.tag]);

  const swapMuscle = swapTarget !== null ? exercises[swapTarget.exIdx]?.muscle : undefined;
  const userEquipment = Array.isArray(profile?.equipment) ? profile.equipment : profile?.equipment ? [profile.equipment] : undefined;

  const handleSwap = useCallback(
    (newExId: string) => {
      if (swapTarget === null) return;
      // Show scope selector before executing
      setSwapPending({ exIdx: swapTarget.exIdx, newExId });
      setSwapTarget(null);
    },
    [swapTarget],
  );

  const handleCustomExercise = useCallback(
    (name: string) => {
      if (swapTarget === null) return;
      const customId = `custom:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      // Store custom exercise so ExerciseCard and other components can look it up
      const existing = JSON.parse(store.get('foundry:customExercises') || '{}');
      if (!existing[customId]) {
        const original = exercises[swapTarget.exIdx];
        existing[customId] = {
          id: customId,
          name,
          muscle: original?.muscle || 'other',
          tag: original?.tag || day?.tag || 'FULL',
          sets: original?.sets || 3,
          reps: original?.reps || '8-12',
          rest: original?.rest || '2 min',
          equipment: 'other',
          pattern: 'compound',
          bw: false,
        };
        store.set('foundry:customExercises', JSON.stringify(existing));
      }
      // Feed through the same swap flow
      setSwapPending({ exIdx: swapTarget.exIdx, newExId: customId });
      setSwapTarget(null);
    },
    [swapTarget, exercises, day?.tag],
  );

  const executeSwap = useCallback(
    (scope: 'week' | 'meso') => {
      if (!swapPending) return;
      const { exIdx, newExId } = swapPending;
      saveExOverride(dayIdx, weekIdx, exIdx, newExId, scope);
      // Sync to Supabase for meso-wide swaps
      if (scope === 'meso') {
        const mesoId = store.get('foundry:active_meso_id');
        if (mesoId) {
          const newDbEx = findExercise(newExId);
          const customExercises = JSON.parse(store.get('foundry:customExercises') || '{}');
          const customEx = !newDbEx && newExId.startsWith('custom:') ? customExercises[newExId] : null;
          const resolved = newDbEx || customEx;
          if (resolved) {
            syncExerciseSwapRemote(mesoId, dayIdx, exIdx, {
              id: resolved.id,
              sets: resolved.sets,
              reps: resolved.reps,
              progression: resolved.pattern === 'isolation' ? 'reps' : 'weight',
              anchor: exercises[exIdx]?.anchor,
            });
          }
        }
      }
      setSwapPending(null);
      setExercises(resolveExercises());
    },
    [swapPending, dayIdx, weekIdx, exercises, resolveExercises],
  );
  const dialogShownRef = React.useRef(new Set());

  // ── Rest timer (state lives in App, received as props) ──────────────────────
  const [pendingRest, setPendingRest] = useState<{ exIdx: number; setIdx: number; partnerIdx: number; restStr: string; exName: string } | null>(null);

  // Superset-aware set logger: defers rest until both exercises in pair have logged the same set
  const handleSetLogged = React.useCallback(
    (restStr: string, exName: string, setIdx: number, isLastSet = false) => {
      // Find if this exercise is part of a superset pair
      const exIdx = exercises.findIndex((e) => e.name === exName);

      // On the last set of an exercise, use the next exercise's rest period
      // so the timer guides the transition between exercises
      let effectiveRestStr = restStr;
      if (isLastSet && exIdx !== -1) {
        const nextEx = exercises[exIdx + 1];
        if (nextEx && nextEx.rest) {
          effectiveRestStr = nextEx.rest;
        } else if (!nextEx) {
          // Final exercise of the session — short rest, they're done
          effectiveRestStr = '90 sec';
        }
      }

      // Auto-advance: expand next exercise card and scroll to it
      if (isLastSet && exIdx !== -1 && exIdx + 1 < exercises.length) {
        const nextIdx = exIdx + 1;
        setExpandedIdx(nextIdx);
        setTimeout(() => {
          const el = document.getElementById(`ex-${nextIdx}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }

      if (exIdx === -1) {
        startRestTimer(effectiveRestStr, exName, dayIdx, weekIdx);
        return;
      }

      const ex = exercises[exIdx];
      const isPrimary = ex.supersetWith != null;
      const isSecondary = !isPrimary && exercises.some((e) => e.supersetWith === exIdx);

      if (!isPrimary && !isSecondary) {
        startRestTimer(effectiveRestStr, exName, dayIdx, weekIdx);
        return;
      }

      const partnerIdx = isPrimary
        ? (ex.supersetWith ?? -1)
        : exercises.findIndex((e) => e.supersetWith === exIdx);

      if (pendingRest && pendingRest.partnerIdx === exIdx && pendingRest.setIdx === setIdx) {
        startRestTimer(pendingRest.restStr || effectiveRestStr, exName, dayIdx, weekIdx);
        setPendingRest(null);
      } else {
        setPendingRest({
          exIdx,
          setIdx,
          partnerIdx,
          restStr: effectiveRestStr,
          exName,
        });
      }
    },
    [exercises, pendingRest, startRestTimer, dayIdx, weekIdx]
  );

  // Timer lives in App — no local interval to clean up on unmount

  // handleSwap — reserved for exercise swap feature

  // handleAddExercise — reserved for add exercise feature

  const handleUpdateSet = useCallback(
    (exIdx: number, setIdx: number, field: string, value: string | number | boolean) => {
      // If user edits actual data for a done exercise, un-done it so they can re-complete
      // Don't un-done on confirmed flag writes — those are checkmark actions, not edits
      if (field !== 'confirmed') {
        setDoneExercises((prev) => {
          if (prev.has(exIdx)) {
            const next = new Set(prev);
            next.delete(exIdx);
            return next;
          }
          return prev;
        });
        // Allow dialog to fire again for this exercise after an edit
        dialogShownRef.current.delete(exIdx);
      }

      setWeekData((prev) => {
        // Generate a stable set id on first write if missing, so remote
        // upserts target the same workout_sets row across edits.
        const prevExData = ((prev[exIdx] || {}) as unknown) as Record<string, Record<string, unknown>>;
        const prevSet = (prevExData[setIdx] || {}) as Record<string, unknown>;
        const setId = (prevSet.id as string | undefined) || crypto.randomUUID();

        // Chunk 4b: if the user is unchecking a confirmed set, delete the
        // corresponding workout_sets row. Uncheck means "I didn't actually do
        // this" — the row should disappear, not linger with stale data.
        if (
          field === 'confirmed' &&
          value === false &&
          (prevSet.id as string | undefined)
        ) {
          deleteWorkoutSetRemote(prevSet.id as string);
        }

        const nextSet = {
          ...prevSet,
          id: setId,
          [field]: value,
          // Clear suggestion flags when user manually edits weight or reps
          ...(field === 'weight' ? { suggested: false } : {}),
          ...(field === 'reps' ? { repsSuggested: false } : {}),
        };
        const next = {
          ...prev,
          [exIdx]: {
            ...prevExData,
            [setIdx]: nextSet,
          },
        };
        saveDayWeek(dayIdx, weekIdx, next);

        // Chunk 4a: sync this set to workout_sets (debounced per-set to
        // coalesce rapid typing). Only fire if the set has meaningful
        // data (reps present) so we don't spam empty rows for sets the
        // user is just auto-filling weight on.
        const merged = nextSet as {
          id: string;
          weight?: string | number;
          reps?: string | number;
          rpe?: string | number | boolean;
          confirmed?: boolean;
          warmup?: boolean;
        };
        const hasData = merged.reps != null && merged.reps !== '';
        if (hasData) {
          const exercise = exercises[exIdx];
          const exerciseId = String(exercise?.id ?? '');
          if (exerciseId) {
            const sessionId = getOrCreateWorkoutSessionId(dayIdx, weekIdx);
            const weightNum =
              merged.weight != null && merged.weight !== ''
                ? parseFloat(String(merged.weight))
                : null;
            const repsNum =
              merged.reps != null && merged.reps !== ''
                ? parseInt(String(merged.reps), 10)
                : null;
            // rpe can be a string label ("Easy"/"Good"/"Hard") from the
            // RPE prompt, or numeric. Map labels to approximate numbers
            // for the numeric column; leave numeric values as-is.
            let rpeNum: number | null = null;
            if (typeof merged.rpe === 'number') {
              rpeNum = merged.rpe;
            } else if (typeof merged.rpe === 'string' && merged.rpe) {
              const label = merged.rpe.toLowerCase();
              if (label === 'easy') rpeNum = 7;
              else if (label === 'good') rpeNum = 8;
              else if (label === 'hard') rpeNum = 9.5;
              else {
                const parsed = parseFloat(merged.rpe);
                rpeNum = isNaN(parsed) ? null : parsed;
              }
            }

            debouncedSync(
              `set:${setId}`,
              () => {
                upsertWorkoutSetRemote(
                  sessionId,
                  setId,
                  exerciseId,
                  setIdx,
                  {
                    weight: weightNum && !isNaN(weightNum) ? weightNum : null,
                    reps: repsNum && !isNaN(repsNum) ? repsNum : null,
                    rpe: rpeNum,
                    isWarmup: !!merged.warmup,
                  },
                );
              },
              1500,
            );
          }
        }

        return next;
      });
    },
    [dayIdx, weekIdx, exercises]
  );

  const handleWeightAutoFill = useCallback(
    (exIdx: number, weight: string, numSets: number | string | undefined) => {
      setWeekData((prev) => {
        const exData = prev[exIdx] || ({} as typeof prev[string]);
        const exCopy: typeof prev[string] = { ...exData };
        for (let s = 1; s < Number(numSets ?? 0); s++) {
          const setData = exData[s] || {};
          // Only fill sets that don't already have a user-entered weight
          const hasWeight = setData.weight && String(setData.weight).trim() !== '';
          if (!hasWeight) {
            exCopy[s] = { ...setData, weight, suggested: false };
          }
        }
        const next = { ...prev, [exIdx]: exCopy };
        saveDayWeek(dayIdx, weekIdx, next);
        return next;
      });
    },
    [dayIdx, weekIdx]
  );

  const handleLastSetFilled = useCallback(
    (exIdx: number, setIdx: number) => {
      const ex = exercises[exIdx];

      // Mark exercise done when all sets are confirmed.
      // weekData in closure is stale for the set just confirmed
      // (handleUpdateSet's setWeekData is still queued), so trust setIdx
      // as confirmed and verify only the other sets.
      const exData = weekData[exIdx] || {};
      const totalSets = Number(ex?.sets ?? 0);
      let allConfirmed = totalSets > 0;
      for (let s = 0; s < totalSets; s++) {
        if (s === setIdx) continue;
        const sd = (exData as unknown as Record<string, Record<string, unknown>>)[s] || {};
        if (!sd.confirmed) {
          allConfirmed = false;
          break;
        }
      }
      if (allConfirmed) {
        setDoneExercises((prev) => {
          if (prev.has(exIdx)) return prev;
          const next = new Set(prev);
          next.add(exIdx);
          return next;
        });
      }

      // Don't fire if already done or already shown since last edit
      if (doneExercises.has(exIdx) || dialogShownRef.current.has(exIdx)) return;
      dialogShownRef.current.add(exIdx);
      setDialog({ exIdx, exName: ex?.name, restStr: ex?.rest, isLastSet: true });
    },
    [doneExercises, exercises, weekData]
  );

  // handleDialogYes — reserved for dialog confirmation flow

  // handleDialogNo — reserved for dialog dismissal

  const handleAddSet = useCallback(
    (exIdx: number) => {
      setExercises((prev) => {
        const updated = [...prev];
        const ex = updated[exIdx];
        if (ex) {
          updated[exIdx] = { ...ex, sets: (Number(ex.sets) || 0) + 1 };
        }
        return updated;
      });
    },
    [],
  );

  const handleRemoveSet = useCallback(
    (exIdx: number, setIdx: number) => {
      setExercises((prev) => {
        const updated = [...prev];
        const ex = updated[exIdx];
        if (ex) {
          const nextCount = Math.max(1, (Number(ex.sets) || 0) - 1);
          updated[exIdx] = { ...ex, sets: nextCount };
        }
        return updated;
      });
      setWeekData((prev) => {
        const exData = (prev[exIdx] || {}) as unknown as Record<string, Record<string, unknown>>;
        const removed = exData[setIdx] as Record<string, unknown> | undefined;
        const removedId = removed?.id as string | undefined;
        const reindexed: Record<string, Record<string, unknown>> = {};
        Object.keys(exData)
          .map((k) => parseInt(k, 10))
          .sort((a, b) => a - b)
          .forEach((k) => {
            if (k === setIdx) return;
            reindexed[k < setIdx ? k : k - 1] = exData[k];
          });
        const next = { ...prev, [exIdx]: reindexed as unknown as typeof prev[number] } as typeof prev;
        saveDayWeek(dayIdx, weekIdx, next);
        if (removedId) {
          deleteWorkoutSetRemote(removedId);
        }
        return next;
      });
    },
    [dayIdx, weekIdx],
  );

  const handleMoveExercise = useCallback(
    (fromIdx: number, toIdx: number) => {
      setExercises((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(fromIdx, 1);
        updated.splice(toIdx, 0, moved);
        return updated;
      });
      // Also reorder the weekData keys so set data follows the exercise
      setWeekData((prev) => {
        const entries = Object.entries(prev).sort(([a], [b]) => Number(a) - Number(b));
        const reordered: typeof prev = {};
        const fromData = prev[fromIdx];
        const dir = toIdx > fromIdx ? 1 : -1;
        for (let i = 0; i < entries.length; i++) {
          if (i === fromIdx) continue;
          if (dir === 1 && i > fromIdx && i <= toIdx) {
            reordered[i - 1] = prev[i];
          } else if (dir === -1 && i >= toIdx && i < fromIdx) {
            reordered[i + 1] = prev[i];
          } else {
            reordered[i] = prev[i];
          }
        }
        reordered[toIdx] = fromData;
        return reordered;
      });
      // Follow the moved exercise — keep it expanded at its new position
      setExpandedIdx(toIdx);
    },
    [],
  );

  // handleNoteChange — reserved for note editing

  // Completion flow — state + logic extracted to hook
  const {
    showNoteReview, setShowNoteReview,
    sessionNote, setSessionNote,
    showUnfinishedPrompt, setShowUnfinishedPrompt,
    showWorkoutModal, setShowWorkoutModal,
    workoutStats,
    showCardioPrompt, setShowCardioPrompt,
    completionWeekIdx,
    pendingCompletionRef,
    handleComplete, openNoteReview, doCompleteWithStats,
  } = useCompletionFlow({
    exercises,
    weekData,
    exNotes,
    notes,
    dayIdx,
    weekIdx,
    sessionStartRef,
    elapsedSecs,
  });

  // Auto-prompt: when every set across every exercise is confirmed, wait 1.5s
  // and open the NoteReviewSheet. Re-fires if the user taps "Keep going",
  // adds/edits more sets, and completes again (re-fire gated by autoFiredRef).
  const autoFiredRef = React.useRef(false);
  React.useEffect(() => {
    if (!workoutStarted || isDone || isLocked) return;
    const allExDone = exercises.every((ex, i) => {
      const totalSets = Number(ex?.sets ?? 0);
      if (totalSets <= 0) return true;
      const exData = (weekData[i] || {}) as Record<string, { confirmed?: boolean }>;
      for (let s = 0; s < totalSets; s++) {
        if (!exData[s]?.confirmed) return false;
      }
      return true;
    });
    if (!allExDone) {
      autoFiredRef.current = false;
      return;
    }
    if (autoFiredRef.current || showNoteReview || showWorkoutModal) return;
    autoFiredRef.current = true;
    const timer = setTimeout(() => {
      dismissRestTimer();
      setShowNoteReview(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [weekData, exercises, workoutStarted, isDone, isLocked, showNoteReview, showWorkoutModal, dismissRestTimer, setShowNoteReview]);

  if (!workoutStarted && showSplash) {
    return (
      <WorkoutSplash
        dayName={day.name || `Day ${dayIdx + 1}`}
        dayIdx={dayIdx}
        weekIdx={weekIdx}
        exercises={exercises}
        mesoId={mesoId}
        onStart={() => {
          dismissSplash();
          beginWorkout();
        }}
        onBack={() => {
          dismissSplash();
          onBack();
        }}
      />
    );
  }

  if (!workoutStarted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-root)',
          padding: '20px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <button
            onClick={onBack}
            aria-label="Go back"
            style={{
              fontSize: 18,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-accent)',
            }}
          >
            <span aria-hidden="true">←</span> Back
          </button>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text-primary)',
              textAlign: 'center',
              flex: 1,
              margin: 0,
            }}
          >
            {day.name} - Week {weekIdx + 1}
          </h1>
          <div style={{ width: 72 }} aria-hidden="true" />
        </div>

        {/* Future-session block: prior week incomplete */}
        {isFutureSession && (() => {
          const incomplete = activeDays
            .map((d, i) => ({ d, i }))
            .filter(({ i }) => !completedDays.has(`${i}:${activeWeek}`));
          return (
            <div
              role="alert"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--phase-intens, #E8651A)',
                borderRadius: tokens.radius.lg,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                Finish Week {activeWeek + 1} first
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                You can't start Week {weekIdx + 1} until every day in Week {activeWeek + 1} is complete.
                {incomplete.length > 0 && ' Tap a day below to finish it:'}
              </div>
              {incomplete.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {incomplete.map(({ d, i }) => (
                    <button
                      key={i}
                      onClick={() => onNavigateToDay?.(i, activeWeek)}
                      disabled={!onNavigateToDay}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: tokens.radius.md,
                        background: 'var(--bg-inset)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        fontWeight: 700,
                        textAlign: 'left',
                        cursor: onNavigateToDay ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>Day {i + 1} · {d.name}</span>
                      {onNavigateToDay && <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>→</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Meso Overlay */}
        {showMesoOverlay && (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Ready to train?</div>
            <button
              onClick={beginWorkout}
              style={{
                width: '100%',
                padding: 16,
                borderRadius: tokens.radius.lg,
                background: 'var(--btn-primary-bg)',
                border: '1px solid var(--btn-primary-border)',
                color: 'var(--btn-primary-text)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Begin Workout
            </button>
          </div>
        )}

        {/* Exercise Cards */}
        {exercises.map((ex: Exercise, i: number) => {
          // Resolve superset partner name
          let supersetPartnerName: string | undefined;
          if (ex.supersetWith != null) {
            supersetPartnerName = exercises[ex.supersetWith]?.name;
          } else {
            const primary = exercises.find((e) => e.supersetWith === i);
            if (primary) supersetPartnerName = primary.name;
          }
          return (
            <div key={i} id={`ex-${i}`} style={{ marginBottom: 12 }}>
              <ExerciseCard
                exercise={ex}
                exIdx={i}
                dayIdx={dayIdx}
                weekIdx={weekIdx}
                weekData={weekData}
                onUpdateSet={handleUpdateSet}
                onWeightAutoFill={handleWeightAutoFill}
                onLastSetFilled={handleLastSetFilled}
                expanded={expandedIdx === i}
                onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
                done={isDone}
                readOnly={isLocked}
                onSwapClick={(idx) => setSwapTarget({ exIdx: idx })}
                onSetLogged={handleSetLogged}
                bodyweight={profile?.weight}
                note={exNotes[i] || ''}
                onNoteChange={(idx: number, val: string) => {
                  const next = { ...exNotes, [idx]: val };
                  setExNotes(next);
                }}
                onAddSet={handleAddSet}
                onRemoveSet={handleRemoveSet}
                onMoveUp={(idx) => handleMoveExercise(idx, idx - 1)}
                onMoveDown={(idx) => handleMoveExercise(idx, idx + 1)}
                isFirst={i === 0}
                isLast={i === exercises.length - 1}
                supersetPartnerName={supersetPartnerName}
              />
            </div>
          );
        })}

        {/* Add Exercise Button */}
        {!isDone && !isLocked && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowAddExercise(true)}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: tokens.radius.lg,
                background: 'var(--bg-card)',
                border: '2px dashed var(--border)',
                color: 'var(--text-accent)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Add Exercise
            </button>
          </div>
        )}

        {/* Complete Button */}
        {!isDone && !isLocked && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => beginWorkout()}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: tokens.radius.lg,
                background: 'var(--btn-primary-bg)',
                border: '1px solid var(--btn-primary-border)',
                color: 'var(--btn-primary-text)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Begin Workout
            </button>
          </div>
        )}

        {/* ── Exercise Swap (pre-workout) ──────────────────────────── */}
        <SwapSheet
          open={swapTarget !== null}
          onClose={() => setSwapTarget(null)}
          replacingName={swapTarget !== null ? exercises[swapTarget.exIdx]?.name || '' : ''}
          exerciseGroups={swapExGroups}
          autoExpandMuscle={swapMuscle}
          userEquipment={userEquipment}
          onSelect={handleSwap}
          onCustomExercise={handleCustomExercise}
          scopePending={swapPending ? { exerciseName: exercises[swapPending.exIdx]?.name || '' } : null}
          onScopeMeso={() => executeSwap('meso')}
          onScopeWeek={() => executeSwap('week')}
          onScopeCancel={() => setSwapPending(null)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root)',
        padding: '20px',
      }}
    >
      {/* Header with Timer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Go back"
          style={{
            fontSize: 18,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-accent)',
          }}
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <div
          aria-live="polite"
          aria-label={`Elapsed time: ${formatElapsed(elapsedSecs)}`}
          style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-accent)' }}
        >
          {formatElapsed(elapsedSecs)}
        </div>
        <div style={{ width: 72 }} aria-hidden="true" />
      </div>

      {/* Exercise Cards */}
      {exercises.map((ex: Exercise, i: number) => {
        let supersetPartnerName2: string | undefined;
        if (ex.supersetWith != null) {
          supersetPartnerName2 = exercises[ex.supersetWith]?.name;
        } else {
          const primary = exercises.find((e) => e.supersetWith === i);
          if (primary) supersetPartnerName2 = primary.name;
        }
        return (
          <div key={i} id={`ex-${i}`} style={{ marginBottom: 12 }}>
            <ExerciseCard
              exercise={ex}
              exIdx={i}
              dayIdx={dayIdx}
              weekIdx={weekIdx}
              weekData={weekData}
              onUpdateSet={handleUpdateSet}
              onWeightAutoFill={handleWeightAutoFill}
              onLastSetFilled={handleLastSetFilled}
              expanded={expandedIdx === i}
              onToggle={() => handleExpandToggle(i)}
              done={isDone}
              readOnly={isLocked}
              onSwapClick={(idx) => setSwapTarget({ exIdx: idx })}
              onSetLogged={handleSetLogged}
              bodyweight={profile?.weight}
              note={exNotes[i] || ''}
              onNoteChange={(idx: number, val: string) => {
                const next = { ...exNotes, [idx]: val };
                setExNotes(next);
              }}
              onAddSet={handleAddSet}
              onRemoveSet={handleRemoveSet}
              onMoveUp={(idx) => handleMoveExercise(idx, idx - 1)}
              onMoveDown={(idx) => handleMoveExercise(idx, idx + 1)}
              isFirst={i === 0}
              isLast={i === exercises.length - 1}
              active={workoutStarted && activeExIdx === i}
              supersetPartnerName={supersetPartnerName2}
            />
          </div>
        );
      })}

      {/* Complete Workout Button */}
      {!isDone && !isLocked && (
        <div style={{ margin: '20px 0 12px' }}>
          <button
            onClick={handleComplete}
            style={{
              width: '100%',
              padding: '18px',
              borderRadius: tokens.radius.lg,
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            Complete Workout ✓
          </button>
        </div>
      )}

      {/* Bodyweight Modal */}
      {bwModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setBwModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bw-dialog-title"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
              padding: 20,
              maxWidth: 300,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div id="bw-dialog-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Bodyweight Check</div>
            <input
              type="number"
              value={bwInput}
              onChange={(e) => setBwInput(e.target.value)}
              placeholder="Enter weight (lbs)"
              aria-label="Your bodyweight in pounds"
              autoFocus
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: tokens.radius.sm,
                border: '1px solid var(--border)',
                marginBottom: 16,
                background: 'var(--bg-inset)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={handleBwConfirm}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: tokens.radius.sm,
                background: 'var(--btn-primary-bg)',
                border: '1px solid var(--btn-primary-border)',
                color: 'var(--btn-primary-text)',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Full-screen Rest Timer Overlay */}
      {restTimer && !restTimerMinimized && (() => {
        const rt = restTimer;
        const pct = rt.total > 0 ? rt.remaining / rt.total : 0;
        const done = rt.remaining === 0;
        const mins = Math.floor(rt.remaining / 60);
        const secs = rt.remaining % 60;
        const timeDisplay = mins > 0
          ? `${mins}:${String(secs).padStart(2, '0')}`
          : `${secs}`;
        const R = 100;
        const CIRC = 2 * Math.PI * R;
        const dash = CIRC * pct;
        const gap = CIRC - dash;
        const ringColor = done ? 'var(--phase-accum)' : pct > 0.25 ? '#D4A03C' : '#a03333';

        return (
          <div
            onClick={done ? dismissRestTimer : undefined}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.92)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              cursor: done ? 'pointer' : 'default',
            }}
          >
            {/* Exercise name */}
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {rt.exName}
            </div>

            {/* Countdown ring + time */}
            <div style={{ position: 'relative', width: 224, height: 224 }}>
              <svg width="224" height="224" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="112" cy="112" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                <circle
                  cx="112" cy="112" r={R}
                  fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${dash} ${gap}`}
                  style={{ transition: 'stroke-dasharray 0.5s linear, stroke 0.5s' }}
                />
              </svg>
              <div
                aria-live="polite"
                aria-atomic="true"
                aria-label={`Rest time remaining: ${rt.remaining} seconds`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{
                  fontSize: 88,
                  fontWeight: 900,
                  color: done ? 'var(--phase-accum)' : 'var(--text-primary)',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.04em',
                }}>
                  {done ? 'GO' : timeDisplay}
                </div>
                {!done && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
                    {mins > 0 ? 'min' : 'sec'}
                  </div>
                )}
              </div>
            </div>

            {/* I'm Ready / Dismiss button */}
            <button
              onClick={dismissRestTimer}
              style={{
                padding: '16px 48px',
                borderRadius: tokens.radius.xl,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: '0.04em',
                background: done ? 'var(--phase-accum)' : 'transparent',
                border: done ? 'none' : '2px solid rgba(255,255,255,0.25)',
                color: done ? '#000' : 'var(--text-primary)',
                transition: 'all 0.3s',
              }}
            >
              {done ? "LET'S GO" : "I'm Ready"}
            </button>

            {/* Minimize button */}
            <button
              onClick={() => setRestTimerMinimized(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text-dim)',
                fontWeight: 600,
                letterSpacing: '0.06em',
                marginTop: 8,
              }}
            >
              MINIMIZE
            </button>
          </div>
        );
      })()}

      {/* Readiness check-in (pre-workout) */}
      {showReadinessSheet && (
        <ReadinessSheet onDismiss={() => setShowReadinessSheet(false)} />
      )}

      {/* Note Review Step */}
      {showNoteReview && (
        <NoteReviewSheet
          note={sessionNote}
          onChange={setSessionNote}
          onFinish={() => {
            setShowNoteReview(false);
            doCompleteWithStats();
          }}
          onKeepGoing={() => {
            setShowNoteReview(false);
          }}
        />
      )}

      {/* ── Exercise Swap (in-workout) ──────────────────────────────── */}
      <SwapSheet
        open={swapTarget !== null}
        onClose={() => setSwapTarget(null)}
        replacingName={swapTarget !== null ? exercises[swapTarget.exIdx]?.name || '' : ''}
        exerciseGroups={swapExGroups}
        autoExpandMuscle={swapMuscle}
        userEquipment={userEquipment}
        onSelect={handleSwap}
        scopePending={swapPending ? { exerciseName: exercises[swapPending.exIdx]?.name || '' } : null}
        onScopeMeso={() => executeSwap('meso')}
        onScopeWeek={() => executeSwap('week')}
        onScopeCancel={() => setSwapPending(null)}
      />

      {/* Workout Complete Modal */}
      {showWorkoutModal && workoutStats && (
        <WorkoutCompleteModal
          dayLabel={day.label || day.name || ''}
          dayTag={day.tag}
          gender={profile?.gender}
          stats={workoutStats}
          weekIdx={completionWeekIdx !== null ? completionWeekIdx : weekIdx}
          onOk={() => {
            setShowWorkoutModal(false);
            const pendingData = pendingCompletionRef.current;
            pendingCompletionRef.current = null;
            setShowCardioPrompt(true);
            // Fire onComplete with the saved completion data
            if (pendingData) {
              onComplete && onComplete(pendingData);
            }
          }}
        />
      )}

      {/* Cardio Prompt */}
      {showCardioPrompt && (
        <CardioPromptModal
          onLogCardio={() => {
            setShowCardioPrompt(false);
            const d = new Date();
            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            onBack();
            setTimeout(() => emit('foundry:openCardio', { dateStr }), 80);
          }}
          onDismiss={() => { setShowCardioPrompt(false); onBack(); }}
        />
      )}

      {/* Unfinished Workout Prompt */}
      {showUnfinishedPrompt && (
        <UnfinishedPromptModal
          onKeepGoing={() => setShowUnfinishedPrompt(false)}
          onMarkComplete={() => { setShowUnfinishedPrompt(false); openNoteReview(); }}
        />
      )}

    </div>
  );
}

export default React.memo(DayView);
