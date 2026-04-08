import React, { useState, useCallback, useMemo } from 'react';
import { tokens } from '../../styles/tokens';

// Data
import {
  randomQuote,
  getMeso,
} from '../../data/constants';
import { EXERCISE_DB } from '../../data/exercises';

// UI
import Sheet from '../ui/Sheet';
import ExercisePicker from '../ui/ExercisePicker';

// Utils
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
  detectSessionPRs,
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

// Components
import ExerciseCard from './ExerciseCard';
import FriendsStrip from '../social/FriendsStrip';
import FriendWorkoutModal from '../social/FriendWorkoutModal';
import WorkoutCompleteModal from './WorkoutCompleteModal';
import type { WorkoutCompleteStats } from './WorkoutCompleteModal';
import type { Profile, TrainingDay, Exercise, MesoMember, WorkoutSet } from '../../types';

interface DayViewProps {
  dayIdx: number;
  weekIdx: number;
  onBack: () => void;
  onComplete: (data?: Record<string, unknown>) => void;
  onNextDay: () => void;
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

  // Train with Friends
  const mesoId = typeof window !== 'undefined' ? localStorage.getItem('foundry:active_meso_id') : null;
  const [selectedFriend, setSelectedFriend] = React.useState<MesoMember | null>(null);

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
  const [doneExercises, setDoneExercises] = useState(() => {
    if (isFutureSession) return new Set(); // future — nothing is done
    const saved = loadDayWeekWithCarryover(dayIdx, weekIdx, weekDay, profile);
    const restored = new Set();
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
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [workoutStats, setWorkoutStats] = useState<WorkoutCompleteStats | null>(null);
  const [showCardioPrompt, setShowCardioPrompt] = useState(false);
  const [showUnfinishedPrompt, setShowUnfinishedPrompt] = useState(false);
  const [completionWeekIdx, setCompletionWeekIdx] = useState<number | null>(null);
  const [showMesoOverlay, setShowMesoOverlay] = useState(() => {
    const freshDone = store.get(`foundry:done:d${dayIdx}:w${weekIdx}`) === '1';
    const alreadyStarted = !!store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
    return !freshDone && !isLocked && !alreadyStarted;
  });
  // warmupOpen, readinessBannerDismissed — reserved for warmup/readiness UI

  // Readiness check-in state — reserved for in-workout readiness flow

  // editMode — reserved for edit-mode toggle
  const [showLeavePrompt] = useState(false);
  const [showEndEarlyConfirm, setShowEndEarlyConfirm] = useState(false);
  const leaveQuoteRef = React.useRef<{ text: string; author: string } | null>(null);
  React.useEffect(() => {
    if (showLeavePrompt && !leaveQuoteRef.current) {
      leaveQuoteRef.current = randomQuote('neutral');
    }
    if (!showLeavePrompt) leaveQuoteRef.current = null;
  }, [showLeavePrompt]);

  // Session duration tracking — timer starts explicitly on "Begin Workout", not on mount
  const sessionStartRef = React.useRef<number | null>(null);
  const strengthEndRef = React.useRef<number | null>(null);
  const [workoutStarted, setWorkoutStarted] = useState(() => {
    const saved = store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
    return !!saved && !isDone && !isLocked;
  });
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const elapsedIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: restore sessionStart and strengthEnd from localStorage if workout was begun
  React.useEffect(() => {
    const savedStart = store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
    if (savedStart && !isDone && !isLocked) {
      sessionStartRef.current = parseInt(savedStart, 10);
      const savedEnd = store.get(`foundry:strengthEnd:d${dayIdx}:w${weekIdx}`);
      if (savedEnd) strengthEndRef.current = parseInt(savedEnd, 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elapsed timer — runs while workout is active and not complete
  React.useEffect(() => {
    if (!workoutStarted || isDone) return;
    const tick = () => {
      if (sessionStartRef.current) {
        setElapsedSecs(Math.floor((Date.now() - sessionStartRef.current) / 1000));
      }
    };
    tick();
    elapsedIntervalRef.current = setInterval(tick, 1000);
    return () => { if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current); };
  }, [workoutStarted, isDone]);

  // Format elapsed seconds as M:SS or H:MM:SS
  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Begin workout — stamps localStorage, starts timer, dismisses overlay
  const beginWorkout = () => {
    const now = Date.now();
    sessionStartRef.current = now;
    store.set(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`, String(now));
    setWorkoutStarted(true);
    setShowMesoOverlay(false);
    if (!bwPromptShownThisWeek()) setShowBwCheckin(true);
    // Chunk 4a: create/upsert the remote workout_sessions row with
    // started_at. Fire-and-forget. Failures are surfaced via toast.
    const sessionId = getOrCreateWorkoutSessionId(dayIdx, weekIdx);
    upsertWorkoutSessionRemote(dayIdx, weekIdx, {
      sessionId,
      startedAt: new Date(now).toISOString(),
      isComplete: false,
    });
  };

  // showPostStrengthPrompt, showCardioPrompt — reserved for post-strength/cardio prompts
  // BW check-in — triggered from beginWorkout(), not at mount
  const [, setShowBwCheckin] = useState(false);
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
      const dbEx = EXERCISE_DB.find((e: Exercise) => e.id === ovId);
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
    const exs = EXERCISE_DB.filter((e: Exercise) => tagFilter.includes(e.tag || ''));
    const groups: Record<string, typeof EXERCISE_DB[number][]> = {};
    exs.forEach((e: typeof EXERCISE_DB[number]) => {
      if (!groups[e.muscle]) groups[e.muscle] = [];
      groups[e.muscle].push(e);
    });
    return groups;
  }, [day?.tag]);

  const swapMuscle = swapTarget !== null ? exercises[swapTarget.exIdx]?.muscle : undefined;

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
        const mesoId = typeof window !== 'undefined' ? localStorage.getItem('foundry:active_meso_id') : null;
        if (mesoId) {
          const newDbEx = EXERCISE_DB.find((e: Exercise) => e.id === newExId);
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
    (exIdx: number, _setIdx: number) => {
      // Don't fire if already done or already shown since last edit
      if (doneExercises.has(exIdx) || dialogShownRef.current.has(exIdx)) return;
      dialogShownRef.current.add(exIdx);
      const ex = exercises[exIdx];
      setDialog({ exIdx, exName: ex?.name, restStr: ex?.rest, isLastSet: true });
    },
    [doneExercises, exercises]
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

  // Compile per-exercise notes + existing session note into a single string.
  // Used to pre-populate the end-of-session note textarea.
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

  const handleComplete = () => {
    const allExDone = doneExercises.size === exercises.length;
    if (!allExDone) {
      setShowUnfinishedPrompt(true);
      return;
    }
    openNoteReview();
  };

  const openNoteReview = () => {
    const hasNotes = exercises.some((_: Exercise, i: number) => ((exNotes as Record<string, string>)[i] || '').trim()) || sessionNote.trim();
    if (!hasNotes) {
      doCompleteWithStats();
      return;
    }
    setShowNoteReview(true);
  };

  const doCompleteWithStats = () => {
    // Compute stats from weekData
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

    // Detect PRs
    const prs = detectSessionPRs(exercises, weekData, 'meso', { dayIdx, weekIdx });

    // Anchor comparison: compare best weight on anchor lifts this week vs last week
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
        // Load last week data for comparison
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

    // Compute duration
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

    // Save completion data
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const completionData = {
      date: dateStr,
      dayIdx: dayIdx,
      weekIdx: weekIdx,
      exercises: exercises.map((ex: Exercise, i: number) => ({
        name: ex.name,
        sets: ex.sets,
        data: weekData[i] || {},
      })),
      sessionNote: sessionNote,
      duration: elapsedSecs,
      completedAt: Date.now(),
    };
    store.set(`foundry:done:d${dayIdx}:w${weekIdx}`, '1');
    store.set(`foundry:sessionNote:d${dayIdx}:w${weekIdx}`, sessionNote);
    // Chunk 4a: mark the remote workout_sessions row complete with
    // completed_at. Fire-and-forget.
    const sessionId = getOrCreateWorkoutSessionId(dayIdx, weekIdx);
    upsertWorkoutSessionRemote(dayIdx, weekIdx, {
      sessionId,
      completedAt: now.toISOString(),
      isComplete: true,
    });

    // Show the workout complete modal — onComplete fires when user dismisses it
    setShowWorkoutModal(true);
    // Store completion data for when modal is dismissed
    (window as unknown as Record<string, unknown>).__foundryPendingCompletion = completionData;
  };


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
          <button
            onClick={() => setShowEndEarlyConfirm(true)}
            aria-label="End workout early"
            style={{
              fontSize: 11,
              fontWeight: 700,
              background: 'none',
              border: '1px solid var(--danger, #a03333)',
              borderRadius: tokens.radius.sm,
              cursor: 'pointer',
              color: 'var(--danger, #a03333)',
              padding: '4px 8px',
              whiteSpace: 'nowrap',
            }}
          >
            End Early
          </button>
        </div>

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
        {exercises.map((ex: Exercise, i: number) => (
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
              onMoveUp={(idx) => handleMoveExercise(idx, idx - 1)}
              onMoveDown={(idx) => handleMoveExercise(idx, idx + 1)}
              isFirst={i === 0}
              isLast={i === exercises.length - 1}
            />
          </div>
        ))}

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

        {/* ── Exercise Swap Sheet (pre-workout-start) ──────────────────── */}
        <Sheet open={swapTarget !== null} onClose={() => setSwapTarget(null)}>
          <div style={{ padding: '8px 16px 4px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Swap Exercise
          </div>
          <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--text-muted)' }}>
            {swapTarget !== null && exercises[swapTarget.exIdx]
              ? `Replacing: ${exercises[swapTarget.exIdx].name}`
              : 'Select a replacement'}
          </div>
          <ExercisePicker
            exercises={swapExGroups}
            selected={[]}
            onToggle={handleSwap}
            onReorder={() => {}}
            userEquipment={Array.isArray(profile?.equipment) ? profile.equipment : profile?.equipment ? [profile.equipment] : undefined}
            autoExpandMuscle={swapMuscle}
            onCustomExercise={handleCustomExercise}
          />
        </Sheet>

        {/* Swap Scope Selector (pre-workout) */}
        {swapPending && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 310,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
            onClick={() => setSwapPending(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.xl,
                padding: 24,
                maxWidth: 320,
                width: '100%',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Swap {exercises[swapPending.exIdx]?.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                Apply this swap to...
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => executeSwap('meso')}
                  style={{
                    padding: '14px 20px',
                    borderRadius: tokens.radius.lg,
                    background: 'var(--btn-primary-bg)',
                    border: '1px solid var(--btn-primary-border)',
                    color: 'var(--btn-primary-text)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Entire Meso
                </button>
                <button
                  onClick={() => executeSwap('week')}
                  style={{
                    padding: '14px 20px',
                    borderRadius: tokens.radius.lg,
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  This Session Only
                </button>
                <button
                  onClick={() => setSwapPending(null)}
                  style={{
                    padding: '10px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                    cursor: 'pointer',
                    marginTop: 4,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
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
        <button
          onClick={() => setShowEndEarlyConfirm(true)}
          aria-label="End workout early"
          style={{
            fontSize: 11,
            fontWeight: 700,
            background: 'none',
            border: '1px solid var(--danger, #a03333)',
            borderRadius: tokens.radius.sm,
            cursor: 'pointer',
            color: 'var(--danger, #a03333)',
            padding: '4px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          End Early
        </button>
      </div>

      {/* Friends Strip */}
      {mesoId && (
        <FriendsStrip
          mesoId={mesoId}
          onSelectFriend={(m) => setSelectedFriend(m)}
        />
      )}

      {/* Exercise Cards */}
      {exercises.map((ex: Exercise, i: number) => (
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
            onMoveUp={(idx) => handleMoveExercise(idx, idx - 1)}
            onMoveDown={(idx) => handleMoveExercise(idx, idx + 1)}
            isFirst={i === 0}
            isLast={i === exercises.length - 1}
          />
        </div>
      ))}

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

      {/* End Workout Early Confirmation */}
      {showEndEarlyConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowEndEarlyConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.xl,
              padding: 24,
              maxWidth: 320,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
              End workout early?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Your logged sets will be saved.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowEndEarlyConfirm(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: tokens.radius.md,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                Keep Going
              </button>
              <button
                onClick={() => {
                  setShowEndEarlyConfirm(false);
                  if (dismissRestTimer) dismissRestTimer();
                  onBack();
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: tokens.radius.md,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  background: 'var(--danger, #a03333)',
                  border: 'none',
                  color: '#fff',
                }}
              >
                End Workout
              </button>
            </div>
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

      {/* Note Review Step */}
      {showNoteReview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: tokens.colors.overlayHeavy,
            zIndex: 220,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-review-title"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: `${tokens.radius.xxl}px ${tokens.radius.xxl}px 0 0`,
              width: '100%',
              maxWidth: 480,
              padding: '24px 20px 36px',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
                marginBottom: 10,
              }}
            >
              SESSION NOTES
            </div>
            <div
              id="note-review-title"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: 18,
              }}
            >
              Anything to add before you go?
            </div>
            <textarea
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              aria-label="Session notes"
              autoFocus
              rows={5}
              style={{
                width: '100%',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-accent)',
                borderRadius: tokens.radius.lg,
                color: 'var(--text-primary)',
                fontSize: 13,
                padding: '12px 14px',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.6,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                marginBottom: 16,
              }}
            />
            <button
              onClick={() => {
                setShowNoteReview(false);
                doCompleteWithStats();
              }}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: tokens.radius.lg,
                background: 'var(--btn-primary-bg)',
                border: '1px solid var(--btn-primary-border)',
                color: 'var(--btn-primary-text)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Finish Session ✓
            </button>
          </div>
        </div>
      )}

      {/* ── Exercise Swap Sheet ──────────────────────────────────────────── */}
      <Sheet open={swapTarget !== null} onClose={() => setSwapTarget(null)}>
        <div style={{ padding: '8px 16px 4px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          Swap Exercise
        </div>
        <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--text-muted)' }}>
          {swapTarget !== null && exercises[swapTarget.exIdx]
            ? `Replacing: ${exercises[swapTarget.exIdx].name}`
            : 'Select a replacement'}
        </div>
        <ExercisePicker
          exercises={swapExGroups}
          selected={[]}
          onToggle={handleSwap}
          onReorder={() => {}}
          userEquipment={Array.isArray(profile?.equipment) ? profile.equipment : profile?.equipment ? [profile.equipment] : undefined}
          autoExpandMuscle={swapMuscle}
        />
      </Sheet>

      {/* Swap Scope Selector */}
      {swapPending && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 310,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setSwapPending(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.xl,
              padding: 24,
              maxWidth: 320,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Swap {exercises[swapPending.exIdx]?.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Apply this swap to...
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => executeSwap('meso')}
                style={{
                  padding: '14px 20px',
                  borderRadius: tokens.radius.lg,
                  background: 'var(--btn-primary-bg)',
                  border: '1px solid var(--btn-primary-border)',
                  color: 'var(--btn-primary-text)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Entire Meso
              </button>
              <button
                onClick={() => executeSwap('week')}
                style={{
                  padding: '14px 20px',
                  borderRadius: tokens.radius.lg,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                This Session Only
              </button>
              <button
                onClick={() => setSwapPending(null)}
                style={{
                  padding: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  cursor: 'pointer',
                  marginTop: 4,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
            const pendingData = (window as unknown as Record<string, unknown>).__foundryPendingCompletion as Record<string, unknown> | undefined;
            delete (window as unknown as Record<string, unknown>).__foundryPendingCompletion;
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
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 210,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: tokens.radius.xl, padding: '32px 24px', maxWidth: 340, width: '100%',
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8 }}>
              Add Cardio?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
              Your lifting session is complete. Want to log a cardio session?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => {
                setShowCardioPrompt(false);
                const d = new Date();
                const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                onBack();
                setTimeout(() => window.dispatchEvent(new CustomEvent('foundry:openCardio', { detail: { dateStr } })), 80);
              }} style={{
                padding: 16, borderRadius: tokens.radius.lg, cursor: 'pointer',
                background: 'var(--phase-accum)22', border: '1px solid var(--phase-accum)',
                color: 'var(--phase-accum)', fontSize: 14, fontWeight: 700,
              }}>Log Cardio →</button>
              <button onClick={() => { setShowCardioPrompt(false); onBack(); }} style={{
                padding: 14, borderRadius: tokens.radius.lg, cursor: 'pointer',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
              }}>Done for Today</button>
            </div>
          </div>
        </div>
      )}

      {/* Unfinished Workout Prompt */}
      {showUnfinishedPrompt && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg, padding: '28px 24px', maxWidth: 340, width: '100%',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8 }}>
              Not quite done
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
              Looks like this workout isn&apos;t finished yet. Do you still want to mark it complete?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setShowUnfinishedPrompt(false)} style={{
                padding: 16, borderRadius: tokens.radius.md, cursor: 'pointer',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700,
              }}>Keep Going</button>
              <button onClick={() => { setShowUnfinishedPrompt(false); openNoteReview(); }} style={{
                padding: 16, borderRadius: tokens.radius.md, cursor: 'pointer',
                background: 'var(--btn-primary-bg)', border: '1px solid var(--btn-primary-border)',
                color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 700,
              }}>Mark Complete</button>
            </div>
          </div>
        </div>
      )}

      {/* Friend Workout Modal */}
      {mesoId && (
        <FriendWorkoutModal
          open={selectedFriend !== null}
          member={selectedFriend}
          mesoId={mesoId}
          dayIdx={dayIdx}
          weekIdx={weekIdx}
          onClose={() => setSelectedFriend(null)}
        />
      )}
    </div>
  );
}

export default React.memo(DayView);
