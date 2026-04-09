import React, { useState, useCallback, useMemo } from 'react';
import type { Profile, TrainingDay, Exercise, DayData } from '../../types';
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
} from '../../utils/store';
import { useRestTimer } from '../../contexts/RestTimerContext';

// Components
import ExerciseCard from './ExerciseCard';

interface DayViewProps {
  dayIdx: number;
  weekIdx: number;
  onBack: () => void;
  onComplete: (data?: Record<string, unknown>) => void;
  onNextDay: () => void;
  completedDays: Set<string>;
  profile: Profile;
  activeDays: TrainingDay[];
  onProfileUpdate: (profile: Profile) => void;
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
  const { restTimer, restTimerMinimized, setRestTimerMinimized, startRestTimer, dismissRestTimer: _dismissRestTimer } =
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
      sets: getWeekSets(ex.sets, weekIdx, getMeso().weeks),
    })),
  };

  // Compute active week from completedDays (first week not fully done)
  const activeWeek = (() => {
    for (let w = 0; w < getMeso().weeks; w++) {
      const allDone = activeDays.every((_, i) => completedDays.has(`${i}:${w}`));
      if (!allDone) return w;
    }
    return getMeso().weeks;
  })();

  // Future sessions are completely locked — show empty, no interaction
  const isFutureSession = weekIdx > activeWeek;
  const isLocked = isFutureSession;

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
    if (!isNaN(val) && val > 0 && val !== parseFloat(profile?.weight || 0)) {
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
      const exData = (saved as Record<string, Record<string, unknown>>)[i] || {};
      let allFilled = true;
      for (let s = 0; s < ex.sets; s++) {
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
  // showWorkoutModal, workoutStats, completionWeekIdx, showReadyDialog — reserved for workout completion modal
  const [showMesoOverlay, setShowMesoOverlay] = useState(() => {
    const freshDone = store.get(`foundry:done:d${dayIdx}:w${weekIdx}`) === '1';
    const alreadyStarted = !!store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
    return !freshDone && !isLocked && !alreadyStarted;
  });
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
  const [exercises] = useState(() => {
    return (weekDay.exercises || []).map((ex: Exercise, i: number) => {
      const ovId = loadExOverride(dayIdx, weekIdx, i);
      if (!ovId) return ex;
      const dbEx = EXERCISE_DB.find((e: Exercise) => e.id === ovId);
      if (!dbEx) return ex;
      const wu = ex.anchor
        ? profile?.sessionDuration <= 30
          ? '2 ramp sets — time is tight, be thorough'
          : dbEx.warmup
        : dbEx.warmup || '1 feeler set';
      return {
        id: dbEx.id,
        name: dbEx.name,
        muscle: dbEx.muscle,
        equipment: dbEx.equipment,
        tag: dbEx.tag,
        anchor: ex.anchor,
        sets: getWeekSets(dbEx.sets, weekIdx, getMeso().weeks),
        reps: dbEx.reps,
        rest: dbEx.rest,
        warmup: wu,
        progression: dbEx.pattern === 'isolation' ? 'reps' : 'weight',
        description: dbEx.description || '',
        videoUrl: dbEx.videoUrl || '',
      };
    });
  });

  // prevWeekNotes memo — reserved for previous week notes callout

  // ── Stalling detection — runs once per session open on active, non-deload sessions ──
  // stallingData + stallCardDismissed — reserved for stall detection UI

  // showUnfinishedPrompt — reserved for unfinished workout prompt
  const [swapTarget, setSwapTarget] = useState<{ exIdx: number } | null>(null);
  const [, setShowAddExercise] = useState(false);

  /* ── Swap: build exercise groups for picker ─────────────────────────────── */
  const swapExGroups = useMemo(() => {
    const tag = day?.tag || 'FULL';
    let tagFilter: string[];
    if (tag === 'PUSH') tagFilter = ['PUSH'];
    else if (tag === 'PULL') tagFilter = ['PULL'];
    else if (tag === 'LEGS') tagFilter = ['LEGS'];
    else if (tag === 'UPPER') tagFilter = ['PUSH', 'PULL'];
    else if (tag === 'LOWER') tagFilter = ['LEGS'];
    else tagFilter = ['PUSH', 'PULL', 'LEGS'];
    const exs = EXERCISE_DB.filter((e: Exercise) => tagFilter.includes(e.tag ?? ''));
    const groups: Record<string, Exercise[]> = {};
    exs.forEach((e: Exercise) => {
      if (!groups[e.muscle]) groups[e.muscle] = [];
      groups[e.muscle].push(e);
    });
    return groups;
  }, [day?.tag]);

  const swapMuscle = swapTarget !== null ? exercises[swapTarget.exIdx]?.muscle : undefined;

  const handleSwap = useCallback(
    (newExId: string) => {
      if (swapTarget === null) return;
      // Save override for rest of the meso
      saveExOverride(dayIdx, weekIdx, swapTarget.exIdx, newExId, 'meso');
      setSwapTarget(null);
      // Reload to pick up the override
      window.location.reload();
    },
    [swapTarget, dayIdx, weekIdx],
  );
  const dialogShownRef = React.useRef(new Set());

  // ── Rest timer (state lives in App, received as props) ──────────────────────
  const [pendingRest, setPendingRest] = useState<{ exIdx: number; setIdx: number; partnerIdx: number; restStr: string; exName: string } | null>(null);

  // Superset-aware set logger: defers rest until both exercises in pair have logged the same set
  const handleSetLogged = React.useCallback(
    (restStr: string, exName: string, setIdx: number, isLastSet = false) => {
      // Find if this exercise is part of a superset pair
      const exIdx = exercises.findIndex((e: Exercise) => e.name === exName);

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

      if (exIdx === -1) {
        startRestTimer(effectiveRestStr, exName, dayIdx, weekIdx);
        return;
      }

      const ex = exercises[exIdx];
      const isPrimary = ex.supersetWith != null;
      const isSecondary = !isPrimary && exercises.some((e: Exercise) => e.supersetWith === exIdx);

      if (!isPrimary && !isSecondary) {
        startRestTimer(effectiveRestStr, exName, dayIdx, weekIdx);
        return;
      }

      const partnerIdx = isPrimary
        ? ex.supersetWith
        : exercises.findIndex((e: Exercise) => e.supersetWith === exIdx);

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
    (exIdx: number, setIdx: number, field: string, value: unknown) => {
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

      setWeekData((prev: DayData) => {
        const next = {
          ...prev,
          [exIdx]: {
            ...(prev[exIdx] || {}),
            [setIdx]: {
              ...((prev[exIdx] || {})[setIdx] || {}),
              [field]: value,
            },
          },
        };
        saveDayWeek(dayIdx, weekIdx, next);
        return next;
      });
    },
    [dayIdx, weekIdx]
  );

  const handleWeightAutoFill = useCallback(
    (exIdx: number, weight: number | string, numSets: number) => {
      setWeekData((prev: DayData) => {
        const exData = prev[exIdx] || {};
        const next: DayData = { ...prev, [exIdx]: { ...exData } };
        for (let s = 1; s < numSets; s++) {
          const setData = exData[s] || {};
          // Only skip if the user has actually worked this set (confirmed or reps logged by hand)
          // Suggested reps don't count as worked — always overwrite those
          const alreadyWorked = setData.confirmed === true;
          if (!alreadyWorked) {
            next[exIdx][s] = { ...setData, weight };
          }
        }
        saveDayWeek(dayIdx, weekIdx, next);
        return next;
      });
    },
    [dayIdx, weekIdx]
  );

  const handleLastSetFilled = useCallback(
    (exIdx: number, exName: string, restStr: string) => {
      // Don't fire if already done or already shown since last edit
      if (doneExercises.has(exIdx) || dialogShownRef.current.has(exIdx)) return;
      dialogShownRef.current.add(exIdx);
      setDialog({ exIdx, exName, restStr, isLastSet: true });
    },
    [doneExercises]
  );

  // handleDialogYes — reserved for dialog confirmation flow

  // handleDialogNo — reserved for dialog dismissal

  // handleAddSet — reserved for add-set feature

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

  // openNoteReview — reserved for end-of-session note review flow

  const doComplete = () => {
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
    onComplete && onComplete(completionData);
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
          <div style={{ width: 32 }} />
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
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        />
      </div>

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
          />
        </div>
      ))}

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

      {/* Rest Timer (if active) */}
      {restTimer && !restTimerMinimized && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            padding: 16,
            zIndex: 150,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rest time</div>
          <div
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Rest time remaining: ${restTimer.remaining}`}
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text-accent)',
            }}
          >
            {restTimer.remaining}
          </div>
          <button
            onClick={() => setRestTimerMinimized(true)}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '6px',
              borderRadius: tokens.radius.sm,
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            Minimize
          </button>
        </div>
      )}

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
              borderRadius: '14px 14px 0 0',
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
                doComplete();
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
          userEquipment={profile?.equipment}
          autoExpandMuscle={swapMuscle}
        />
      </Sheet>
    </div>
  );
}

export default React.memo(DayView);
