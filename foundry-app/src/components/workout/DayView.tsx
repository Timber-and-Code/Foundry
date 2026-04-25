import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { tokens } from '../../styles/tokens';

// Data
import {
  randomQuote,
  getMeso,
  getWeekPhase,
} from '../../data/constants';
import { loadArchive } from '../../utils/archive';
import { getExerciseDB, findExercise } from '../../data/exerciseDB';

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
  bwLoggedThisWeek,
  markBwPromptShown,
  addBwEntry,
  loadBwLog,
  getWeekSets,
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
import { useToast } from '../../contexts/ToastContext';
import { useActiveSession } from '../../contexts/ActiveSessionContext';
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
import SwapMenu from './SwapMenu';
import ReorderSheet from './ReorderSheet';
import { buildSwapGroups } from '../../utils/swapGroups';
import { expandEquipment } from '../../utils/program';
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
  const { showToast } = useToast();
  const {
    session: activeSessionFromCtx,
    setActiveSession: setActiveSessionBar,
    clearActiveSession: clearActiveSessionBar,
  } = useActiveSession();
  const notStartedWarnRef = React.useRef(0);
  const day = activeDays[dayIdx];

  // Onboarding v2: emit the establish-week event the first time the user
  // opens ANY workout in week 0 — week 0 IS the Establish phase, regardless
  // of which calendar weekday they're on. Gated by a one-time flag so it
  // fires once per user ever. The CoachMarkOrchestrator listens and shows
  // the `establish` coach mark.
  useEffect(() => {
    if (weekIdx === 0 && !store.get('foundry:first_establish_day_emitted')) {
      store.set('foundry:first_establish_day_emitted', '1');
      window.dispatchEvent(new Event('foundry:first-day1-week1-open'));
    }
  }, [weekIdx]);

  // Onboarding v2: emit first-deload-week once per user when the user opens
  // a day during the deload phase. CoachMarkOrchestrator explains why the
  // deload week is lighter.
  useEffect(() => {
    const phases = getWeekPhase();
    const phase = phases[weekIdx];
    if (phase === 'Deload' && !store.get('foundry:first_deload_emitted')) {
      store.set('foundry:first_deload_emitted', '1');
      window.dispatchEvent(new Event('foundry:first-deload-week'));
    }
  }, [weekIdx]);

  // Onboarding v2: emit first-meso-carryover once per user when the user
  // opens Day 0 / Week 0 of a follow-up meso (archive has at least one
  // completed entry). CoachMarkOrchestrator explains the carryover story.
  useEffect(() => {
    if (weekIdx !== 0 || dayIdx !== 0) return;
    if (store.get('foundry:first_carryover_emitted')) return;
    try {
      if (loadArchive().length >= 1) {
        store.set('foundry:first_carryover_emitted', '1');
        window.dispatchEvent(new Event('foundry:first-meso-carryover'));
      }
    } catch { /* archive load fallback — skip */ }
  }, [weekIdx, dayIdx]);

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
      sets: getWeekSets(Number(ex.sets ?? 0), weekIdx, getMeso().totalWeeks),
    })),
  };

  // Compute active week from completedDays (first week not fully done)
  const activeWeek = (() => {
    for (let w = 0; w < getMeso().totalWeeks; w++) {
      const allDone = activeDays.every((_: TrainingDay, i: number) => completedDays.has(`${i}:${w}`));
      if (!allDone) return w;
    }
    return getMeso().totalWeeks;
  })();

  // Future sessions are normally locked; user can opt in via the
  // "Start anyway" button to record this session without finishing the
  // prior week first (e.g. when matching a friend's day).
  const [futureOverride, setFutureOverride] = useState(false);
  const isFutureSession = weekIdx > activeWeek;
  const isLocked = isFutureSession && !futureOverride;

  const mesoId = store.get('foundry:active_meso_id');

  // Weekly bodyweight check-in — fires once at workout start if the day
  // has any BW-based exercises AND the prompt hasn't been shown yet this
  // week. Mid-workout per-exercise prompts were removed: they interrupted
  // the user's flow and didn't match the "gather signals up front" model.
  // Future sessions: load raw (empty) data so inputs show blank, not suggestions
  const [weekData, setWeekData] = useState(() =>
    isFutureSession
      ? loadDayWeek(dayIdx, weekIdx)
      : loadDayWeekWithCarryover(dayIdx, weekIdx, weekDay, profile)
  );
  const [notes] = useState(() => loadNotes(dayIdx, weekIdx));
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  // Focus Mode: which exercise is on screen in-workout. User-controlled via
  // prev/next + progress-strip taps; auto-advances when the current exercise
  // becomes done.
  const [focusedIdx, setFocusedIdx] = useState<number>(0);
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

  // Splash gates every entry to a not-yet-started session. It's the single
  // start surface — there are no other "Begin Workout" buttons in DayView.
  // Skipped only when the session is locked, already in progress, or done.
  const [showSplash, setShowSplash] = useState(() => {
    if (isLocked) return false;
    const freshDone = store.get(`foundry:done:d${dayIdx}:w${weekIdx}`) === '1';
    if (freshDone) return false;
    const alreadyStarted = !!store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
    if (alreadyStarted) return false;
    return true;
  });
  const dismissSplash = () => {
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

  // Backfill the active-session context when DayView mounts on a workout
  // that's already in progress (started in a prior page load — workoutStarted
  // is restored from localStorage, but commitStartWorkout doesn't re-fire).
  // Without this, the Home tab's "Resume Workout" CTA never appears for
  // restored sessions.
  useEffect(() => {
    if (!workoutStarted || isDone || isLocked) return;
    const expectedRoute = `/day/${dayIdx}/${weekIdx}`;
    if (
      activeSessionFromCtx?.kind === 'lifting' &&
      activeSessionFromCtx.route === expectedRoute
    ) {
      return;
    }
    const dayLabel = (day?.label || day?.tag || day?.name || 'WORKOUT') as string;
    let totalSetsCount = 0;
    (day?.exercises || []).forEach((ex: Exercise) => {
      totalSetsCount += Number(ex.sets) || 0;
    });
    setActiveSessionBar({
      kind: 'lifting',
      label: dayLabel,
      route: expectedRoute,
      startedAt: sessionStartRef.current || Date.now(),
      setsDone: 0,
      totalSets: totalSetsCount,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutStarted, dayIdx, weekIdx, isDone, isLocked]);

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

  // Commit the workout start — stamps localStorage, starts timer, dismisses
  // overlay, and registers the remote session. Called after the user has
  // confirmed intent (either directly, or via the readiness sheet).
  const commitStartWorkout = () => {
    startTimer();
    setShowSplash(false);
    // Register the active session immediately on start so the Home tab
    // can flip its CTA to "Resume Workout" without waiting for the user
    // to log a set. Pre-set state shows 0/N — the per-set update path
    // patches setsDone as the lifter works.
    const dayLabel = (day.label || day.tag || day.name || 'WORKOUT') as string;
    let initialTotalSets = 0;
    (day.exercises || []).forEach((ex: Exercise) => {
      const sets = Number(ex.sets) || 0;
      initialTotalSets += sets;
    });
    setActiveSessionBar({
      kind: 'lifting',
      label: dayLabel,
      route: `/day/${dayIdx}/${weekIdx}`,
      startedAt: Date.now(),
      setsDone: 0,
      totalSets: initialTotalSets,
    });
    // Weekly bodyweight check-in: prompt only when (a) this day has a
    // BW-based exercise, (b) we haven't already prompted this week, and
    // (c) we don't already have a bodyweight entry this week (HealthKit
    // sync may have populated it silently — no need to interrupt the user).
    const hasBwExercise = (day.exercises || []).some((e: Exercise) => e.bw);
    if (hasBwExercise && !bwPromptShownThisWeek() && !bwLoggedThisWeek()) {
      setShowBwCheckin(true);
    }
    const sessionId = getOrCreateWorkoutSessionId(dayIdx, weekIdx);
    upsertWorkoutSessionRemote(dayIdx, weekIdx, {
      sessionId,
      startedAt: new Date().toISOString(),
      isComplete: false,
    });
  };

  // Intent to begin — if readiness is incomplete, show the sheet first so
  // the user has a real "Go back" option before the timer starts.
  const beginWorkout = () => {
    if (isReadinessIncompleteToday()) {
      setShowSplash(false);
      setShowReadinessSheet(true);
      return;
    }
    commitStartWorkout();
  };

  // showPostStrengthPrompt, showCardioPrompt — reserved for post-strength/cardio prompts
  // BW check-in — triggered from commitStartWorkout when the day has BW
  // exercises and we haven't prompted yet this week.
  const [showBwCheckin, setShowBwCheckin] = useState(false);
  const [bwCheckinInput, setBwCheckinInput] = useState(() => {
    const log = loadBwLog();
    return log.length > 0 ? String(log[0].weight) : profile?.weight ? String(profile.weight) : '';
  });
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
        sets: getWeekSets(Number((resolved.sets || ex.sets) ?? 0), weekIdx, getMeso().totalWeeks),
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

  // Focus Mode auto-advance: when the currently-focused exercise becomes done,
  // jump to the next incomplete one. Respects user-intent: if they've already
  // navigated past a completed ex (forward or backward), don't yank them.
  useEffect(() => {
    if (exercises.length === 0) return;
    if (focusedIdx >= exercises.length) {
      setFocusedIdx(Math.max(0, exercises.length - 1));
      return;
    }
    if (doneExercises.has(focusedIdx) && activeExIdx >= 0 && activeExIdx !== focusedIdx) {
      setFocusedIdx(activeExIdx);
    }
  }, [doneExercises, activeExIdx, focusedIdx, exercises.length]);

  // Keep expandedIdx pinned to focusedIdx in-workout so the active card is
  // always the one on screen (other cards are hidden entirely in Focus Mode).
  useEffect(() => {
    if (workoutStarted && expandedIdx !== focusedIdx) {
      setExpandedIdx(focusedIdx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIdx, workoutStarted]);

  // prevWeekNotes memo — reserved for previous week notes callout

  // ── Stalling detection — runs once per session open on active, non-deload sessions ──
  // stallingData + stallCardDismissed — reserved for stall detection UI

  // showUnfinishedPrompt — reserved for unfinished workout prompt
  const [swapTarget, setSwapTarget] = useState<{ exIdx: number } | null>(null);
  const [swapPending, setSwapPending] = useState<{ exIdx: number; newExId: string } | null>(null);
  const [, setShowAddExercise] = useState(false);
  // Reorder sheet (Focus Mode bottom-nav REORDER button) — drag-to-reorder
  // + "+ Add exercise" entry point. The add path opens SwapMenu in
  // append-mode via `addingExercise`; on select, we push instead of swap.
  const [reorderOpen, setReorderOpen] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);

  /* ── Swap: build exercise groups for picker ─────────────────────────────── */
  // Day-tag → EXERCISE_DB tag-set mapping lives in swapGroups.ts so the
  // setup builder (DayAccordion) and the workout view share one source of
  // truth. See `foundry/beat2_preview_fixes.md` #2.
  const swapExGroups = useMemo(
    () => buildSwapGroups(getExerciseDB(), day?.tag),
    [day?.tag],
  );

  const swapMuscle = swapTarget !== null ? exercises[swapTarget.exIdx]?.muscle : undefined;
  // Expand preset tokens (`full_gym`, `home_gym`, `minimal`) into the atomic
  // equipment types the DB is tagged with — otherwise every non-bodyweight row
  // reads "requires dumbbell/barbell" in the swap menu and biceps look missing.
  const userEquipment = useMemo(() => expandEquipment(profile?.equipment), [profile?.equipment]);

  // Append a brand-new exercise onto the live session. Used by the Reorder
  // sheet's "+ Add exercise" path. Resolves the picked id (DB or custom)
  // into the same Exercise shape the rest of DayView renders, with sane
  // defaults for sets/reps/rest. In-memory only — matches the existing
  // reorder behavior; persistence is a separate feature.
  const appendExercise = useCallback(
    (newExId: string) => {
      const dbEx = findExercise(newExId);
      const customs = JSON.parse(store.get('foundry:customExercises') || '{}');
      const customEx = !dbEx && newExId.startsWith('custom:') ? customs[newExId] : null;
      const src = dbEx || customEx;
      if (!src) return;
      const next: typeof exercises[number] = {
        id: src.id,
        name: src.name,
        muscle: src.muscle || 'other',
        muscles: src.muscles || [src.muscle || 'other'],
        equipment: src.equipment || 'other',
        tag: src.tag || day?.tag || 'FULL',
        anchor: false,
        sets: src.sets || 3,
        reps: src.reps || '8-12',
        rest: src.rest || '2 min',
        warmup: src.warmup || '1 feeler set',
        progression: src.pattern === 'isolation' ? 'reps' : 'weight',
        description: src.description || '',
        videoUrl: src.videoUrl || '',
        bw: !!src.bw,
      };
      setExercises((prev) => [...prev, next]);
    },
    [day?.tag],
  );

  const handleSwap = useCallback(
    (newExId: string) => {
      // Add-exercise path takes priority — Reorder sheet → SwapMenu (add mode).
      if (addingExercise) {
        appendExercise(newExId);
        setAddingExercise(false);
        return;
      }
      if (swapTarget === null) return;
      // Show scope selector before executing
      setSwapPending({ exIdx: swapTarget.exIdx, newExId });
      setSwapTarget(null);
    },
    [addingExercise, appendExercise, swapTarget],
  );

  const handleCustomExercise = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const customId = `custom:${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const existing = JSON.parse(store.get('foundry:customExercises') || '{}');
      // Add-exercise path: persist the custom to localStorage with the
      // current day's tag so other views (sync, swap) resolve it later.
      if (addingExercise) {
        if (!existing[customId]) {
          existing[customId] = {
            id: customId,
            name: trimmed,
            muscle: 'other',
            tag: day?.tag || 'FULL',
            sets: 3,
            reps: '8-12',
            rest: '2 min',
            equipment: 'other',
            pattern: 'compound',
            bw: false,
          };
          store.set('foundry:customExercises', JSON.stringify(existing));
        }
        appendExercise(customId);
        setAddingExercise(false);
        return;
      }
      if (swapTarget === null) return;
      // Store custom exercise so ExerciseCard and other components can look it up
      if (!existing[customId]) {
        const original = exercises[swapTarget.exIdx];
        existing[customId] = {
          id: customId,
          name: trimmed,
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
    [addingExercise, appendExercise, swapTarget, exercises, day?.tag],
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

  // Superset-aware set logger: defers rest until both exercises in pair have logged the same set.
  // Rest timer NEVER fires after the last set of an exercise — the user is moving on, not resting.
  const handleSetLogged = React.useCallback(
    (restStr: string, exName: string, setIdx: number, isLastSet = false) => {
      const exIdx = exercises.findIndex((e) => e.name === exName);

      // Auto-advance to the next exercise card on the last set, but skip the
      // rest timer entirely — between exercises is transition, not rest.
      if (isLastSet) {
        if (exIdx !== -1 && exIdx + 1 < exercises.length) {
          const nextIdx = exIdx + 1;
          setExpandedIdx(nextIdx);
          setTimeout(() => {
            const el = document.getElementById(`ex-${nextIdx}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        }
        // Drop any pending superset partner rest — it would also be a last-set rest.
        if (pendingRest) setPendingRest(null);
        return;
      }

      if (exIdx === -1) {
        startRestTimer(restStr, exName, dayIdx, weekIdx);
        return;
      }

      const ex = exercises[exIdx];
      const isPrimary = ex.supersetWith != null;
      const isSecondary = !isPrimary && exercises.some((e) => e.supersetWith === exIdx);

      if (!isPrimary && !isSecondary) {
        startRestTimer(restStr, exName, dayIdx, weekIdx);
        return;
      }

      const partnerIdx = isPrimary
        ? (ex.supersetWith ?? -1)
        : exercises.findIndex((e) => e.supersetWith === exIdx);

      if (pendingRest && pendingRest.partnerIdx === exIdx && pendingRest.setIdx === setIdx) {
        startRestTimer(pendingRest.restStr || restStr, exName, dayIdx, weekIdx);
        setPendingRest(null);
      } else {
        setPendingRest({
          exIdx,
          setIdx,
          partnerIdx,
          restStr,
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
      // Gate set edits behind Begin Workout. Workout must be started (or
      // locked/done for retro edits) before data can be logged — otherwise
      // users can type into fields without realizing they haven't started.
      if (!workoutStarted && !isDone && !isLocked) {
        const now = Date.now();
        if (now - notStartedWarnRef.current > 1500) {
          notStartedWarnRef.current = now;
          showToast('Tap Begin Workout to start logging sets', 'info');
        }
        return;
      }

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

        // Onboarding v2:
        //  - first-set-logged fires on the first confirmed set ever (used by
        //    WelcomeRibbon to hide once the user actually starts training).
        //  - second-exercise-complete fires after the user has completed
        //    TWO exercises. This is the SaveProgressSheet trigger — firing
        //    after the second exercise keeps it off the same beat as the
        //    RPE coach mark (which fires on the first exercise's last set).
        if (field === 'confirmed' && value === true) {
          // Defer emits out of the setWeekData updater — firing synchronously
          // from inside a state updater triggers cross-component setState
          // during render (React warning), since subscribers in App.tsx
          // call their own setState.
          if (!store.get('foundry:first_set_emitted')) {
            store.set('foundry:first_set_emitted', '1');
            queueMicrotask(() => emit('foundry:first-set-logged'));
          }
          if (!store.get('foundry:second_exercise_complete_emitted')) {
            // Count how many exercises have all their work sets confirmed,
            // based on the freshly-merged state.
            const weekData = next as Record<
              string | number,
              Record<string, { confirmed?: boolean; warmup?: boolean }>
            >;
            let completeCount = 0;
            exercises.forEach((ex: Exercise, i: number) => {
              const totalWorkSets = Number(ex?.sets ?? 0);
              if (totalWorkSets <= 0) return;
              const exData = (weekData[i] || {}) as Record<
                string,
                { confirmed?: boolean; warmup?: boolean } | undefined
              >;
              let confirmed = 0;
              for (const k of Object.keys(exData)) {
                const s = exData[k];
                if (s && s.confirmed && !s.warmup) confirmed++;
              }
              if (confirmed >= totalWorkSets) completeCount++;
            });
            if (completeCount >= 2) {
              store.set('foundry:second_exercise_complete_emitted', '1');
              queueMicrotask(() => emit('foundry:second-exercise-complete'));
            }
          }

        }

        // ActiveSessionBar — first confirmed set plants the persistent
        // session; every subsequent confirm/uncheck keeps setsDone in sync
        // so the bar's SET X/Y counter tracks reality. Session survives
        // route changes via localStorage. We fire on any confirmed toggle
        // (true OR false) so un-checking the only confirmed set still
        // decrements the displayed count.
        if (field === 'confirmed') {
          const mergedWeek = next as Record<
            string | number,
            Record<string, { confirmed?: boolean; warmup?: boolean }>
          >;
          let setsDoneCount = 0;
          let totalWorkSetsCount = 0;
          exercises.forEach((ex: Exercise, i: number) => {
            const workSets = Number(ex?.sets ?? 0);
            if (workSets <= 0) return;
            totalWorkSetsCount += workSets;
            const exData = (mergedWeek[i] || {}) as Record<
              string,
              { confirmed?: boolean; warmup?: boolean } | undefined
            >;
            for (const k of Object.keys(exData)) {
              const s = exData[k];
              if (s && s.confirmed && !s.warmup) setsDoneCount++;
            }
          });
          queueMicrotask(() => {
            const dayLabel = (day.label || day.tag || day.name || 'WORKOUT') as string;
            setActiveSessionBar({
              kind: 'lifting',
              label: dayLabel,
              route: `/day/${dayIdx}/${weekIdx}`,
              startedAt: sessionStartRef.current || Date.now(),
              setsDone: setsDoneCount,
              totalSets: totalWorkSetsCount,
            });
          });
        }

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
    [dayIdx, weekIdx, exercises, workoutStarted, isDone, isLocked, showToast]
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
        profile={profile}
        onStart={beginWorkout}
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
        {isFutureSession && !futureOverride && (() => {
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
              <button
                onClick={() => setFutureOverride(true)}
                style={{
                  width: '100%',
                  marginTop: 14,
                  padding: '12px 14px',
                  borderRadius: tokens.radius.md,
                  background: 'transparent',
                  border: '1px dashed var(--phase-intens, #E8651A)',
                  color: 'var(--phase-intens, #E8651A)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Start this session anyway
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 8, textAlign: 'center' }}>
                Records this day independently. Earlier days stay marked incomplete.
              </div>
            </div>
          );
        })()}

        {/* WorkoutSplash is the single start gate; pre-start "Ready to train?"
            overlay was redundant and has been removed. */}

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

        {/* Pre-start "Begin Workout" CTA removed — WorkoutSplash gates entry. */}

        {/* ── Exercise Swap (pre-workout) ──────────────────────────── */}
        <SwapMenu
          open={swapTarget !== null || addingExercise}
          onClose={() => {
            setSwapTarget(null);
            setAddingExercise(false);
          }}
          replacingName={
            addingExercise
              ? 'Add exercise'
              : swapTarget !== null
              ? exercises[swapTarget.exIdx]?.name || ''
              : ''
          }
          exerciseGroups={swapExGroups}
          autoExpandMuscle={addingExercise ? undefined : swapMuscle}
          userEquipment={userEquipment}
          onSelect={handleSwap}
          onCustomExercise={handleCustomExercise}
          scopePending={swapPending ? { exerciseName: exercises[swapPending.exIdx]?.name || '' } : null}
          onScopeMeso={() => executeSwap('meso')}
          onScopeWeek={() => executeSwap('week')}
          onScopeCancel={() => setSwapPending(null)}
        />

        {/* Readiness check-in gate — fires from beginWorkout() when today's
            readiness is incomplete. Mounted here too because the main return
            below only renders after workoutStarted flips true. */}
        {showReadinessSheet && (
          <ReadinessSheet
            onDismiss={() => {
              setShowReadinessSheet(false);
              if (!workoutStarted) commitStartWorkout();
            }}
            onCancel={() => {
              setShowReadinessSheet(false);
              setShowSplash(true);
            }}
          />
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
      {/* Sticky session timer bar — escapes parent padding via negative margins
          and sits above the FoundryBanner (zIndex 60 > banner's 50) so it
          remains the persistent top surface during a workout. */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 60,
          marginTop: -20,
          marginLeft: -20,
          marginRight: -20,
          marginBottom: 20,
          padding: '12px 16px',
          background: 'var(--bg-root)',
          borderBottom: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: '72px 1fr 72px',
          alignItems: 'center',
        }}
      >
        <button
          onClick={onBack}
          aria-label="Go back"
          style={{
            justifySelf: 'start',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-accent)',
            padding: '8px 6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>←</span> Back
        </button>
        <div
          aria-live="polite"
          aria-atomic="true"
          aria-label={`Elapsed time: ${formatElapsed(elapsedSecs)}`}
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--text-primary)',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          {formatElapsed(elapsedSecs)}
        </div>
        <div aria-hidden="true" />
      </div>

      {/* ── Focus Mode: progress strip + single exercise + up-next + prev/next nav ── */}
      {(() => {
        const clampedFocus = Math.max(0, Math.min(focusedIdx, exercises.length - 1));
        const focusEx = exercises[clampedFocus];
        if (!focusEx) return null;
        // Up next = first incomplete exercise strictly after the focused one
        let upNextIdx: number | null = null;
        for (let j = clampedFocus + 1; j < exercises.length; j++) {
          if (!doneExercises.has(j)) { upNextIdx = j; break; }
        }
        let supersetPartnerName2: string | undefined;
        if (focusEx.supersetWith != null) {
          supersetPartnerName2 = exercises[focusEx.supersetWith]?.name;
        } else {
          const primary = exercises.find((e) => e.supersetWith === clampedFocus);
          if (primary) supersetPartnerName2 = primary.name;
        }
        return (
          <>
            <ProgressStrip
              exercises={exercises}
              doneExercises={doneExercises}
              focusedIdx={clampedFocus}
              onJump={(idx) => setFocusedIdx(idx)}
            />
            {/* Active exercise — single orange accent border lives on the
                inner ExerciseCard via its `active` prop. The outer wrapper
                used to add a second border + glow, which read as a double
                ring. Wrapper is now layout-only. */}
            <div
              id={`ex-${clampedFocus}`}
              style={{
                marginBottom: 12,
              }}
            >
              <ExerciseCard
                exercise={focusEx}
                exIdx={clampedFocus}
                dayIdx={dayIdx}
                weekIdx={weekIdx}
                weekData={weekData}
                onUpdateSet={handleUpdateSet}
                onWeightAutoFill={handleWeightAutoFill}
                onLastSetFilled={handleLastSetFilled}
                expanded={true}
                onToggle={() => { /* no-op in Focus Mode — card stays open */ }}
                done={isDone}
                readOnly={isLocked}
                onSwapClick={(idx) => setSwapTarget({ exIdx: idx })}
                onSetLogged={handleSetLogged}
                bodyweight={profile?.weight}
                note={exNotes[clampedFocus] || ''}
                onNoteChange={(idx: number, val: string) => {
                  const next = { ...exNotes, [idx]: val };
                  setExNotes(next);
                }}
                onAddSet={handleAddSet}
                onRemoveSet={handleRemoveSet}
                onMoveUp={(idx) => { handleMoveExercise(idx, idx - 1); setFocusedIdx(idx - 1); }}
                onMoveDown={(idx) => { handleMoveExercise(idx, idx + 1); setFocusedIdx(idx + 1); }}
                isFirst={clampedFocus === 0}
                isLast={clampedFocus === exercises.length - 1}
                active={workoutStarted}
                supersetPartnerName={supersetPartnerName2}
                editorial
                totalExercises={exercises.length}
              />
            </div>
            {upNextIdx !== null && (
              <UpNextCard
                exercise={exercises[upNextIdx]}
                onJump={() => setFocusedIdx(upNextIdx!)}
              />
            )}
            <FocusNav
              canPrev={clampedFocus > 0}
              canNext={clampedFocus < exercises.length - 1}
              onPrev={() => setFocusedIdx(Math.max(0, clampedFocus - 1))}
              onNext={() => setFocusedIdx(Math.min(exercises.length - 1, clampedFocus + 1))}
              onReorder={() => setReorderOpen(true)}
              position={clampedFocus + 1}
              total={exercises.length}
            />
          </>
        );
      })()}

      {/* Reorder sheet — drag-to-reorder + add-exercise entry point. Mounted
          here so it overlays Focus Mode. Drag commits via handleMoveExercise,
          jumps via setFocusedIdx, add opens SwapMenu in append mode. */}
      {reorderOpen && (
        <ReorderSheet
          exercises={exercises}
          currentIdx={Math.max(0, Math.min(focusedIdx, exercises.length - 1))}
          doneIndices={doneExercises}
          onClose={() => setReorderOpen(false)}
          onMove={(fromIdx, toIdx) => {
            handleMoveExercise(fromIdx, toIdx);
            // Keep the focused card pointed at the same exercise after move.
            if (fromIdx === focusedIdx) setFocusedIdx(toIdx);
            else if (focusedIdx > fromIdx && focusedIdx <= toIdx) setFocusedIdx(focusedIdx - 1);
            else if (focusedIdx < fromIdx && focusedIdx >= toIdx) setFocusedIdx(focusedIdx + 1);
          }}
          onJump={(idx) => setFocusedIdx(idx)}
          onAddExercise={() => {
            setAddingExercise(true);
          }}
        />
      )}

      {/* Complete Workout Button — Bebas all-caps to match editorial
          Focus Mode typography (exercise title, set numerals, etc). */}
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
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 400,
              cursor: 'pointer',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Complete Workout <span aria-hidden="true">✓</span>
          </button>
        </div>
      )}

      {/* Weekly bodyweight check-in (first workout of the week) */}
      {showBwCheckin && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: tokens.colors.overlayMed,
            zIndex: 290,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bw-checkin-title"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-accent)',
              borderRadius: tokens.radius.xl,
              padding: '28px 24px',
              maxWidth: 320,
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 10 }}>
              WEEKLY CHECK-IN
            </div>
            <div id="bw-checkin-title" style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              Log your bodyweight
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              Tracking weekly bodyweight alongside your lifts gives you the full picture of how your training is working.
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={bwCheckinInput}
              onChange={(e) => setBwCheckinInput(e.target.value)}
              placeholder="lbs"
              autoFocus
              style={{
                width: '100%',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-accent)',
                borderRadius: tokens.radius.lg,
                padding: '14px',
                fontSize: 28,
                fontWeight: 900,
                color: 'var(--accent)',
                textAlign: 'center',
                marginBottom: 16,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => { markBwPromptShown(); setShowBwCheckin(false); }}
                style={{
                  padding: '14px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Skip
              </button>
              <button
                disabled={(() => {
                  const v = parseFloat(bwCheckinInput);
                  return isNaN(v) || v <= 0;
                })()}
                onClick={() => {
                  const val = parseFloat(bwCheckinInput);
                  if (isNaN(val) || val <= 0) return;
                  addBwEntry(val);
                  onProfileUpdate && onProfileUpdate({ weight: String(val) });
                  markBwPromptShown();
                  setShowBwCheckin(false);
                }}
                className="btn-primary"
                style={{
                  padding: '14px',
                  borderRadius: tokens.radius.lg,
                  cursor: (() => {
                    const v = parseFloat(bwCheckinInput);
                    return isNaN(v) || v <= 0 ? 'not-allowed' : 'pointer';
                  })(),
                  fontSize: 13,
                  fontWeight: 800,
                  background: 'var(--btn-primary-bg)',
                  border: '1px solid var(--btn-primary-border)',
                  color: 'var(--btn-primary-text)',
                  opacity: (() => {
                    const v = parseFloat(bwCheckinInput);
                    return isNaN(v) || v <= 0 ? 0.5 : 1;
                  })(),
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Rest Timer Overlay — pure typography on a blurred
          backdrop. No card, no ring, no box. Just the countdown and an
          ack button. Go back collapses to the toast. */}
      {restTimer && !restTimerMinimized && (() => {
        const rt = restTimer;
        const done = rt.remaining === 0;
        const mins = Math.floor(rt.remaining / 60);
        const secs = rt.remaining % 60;
        const timeDisplay = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        return (
          <div
            data-coach="rest-timer"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 24px',
              fontFamily: 'inherit',
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: '0.28em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: 18,
                fontWeight: 700,
              }}
            >
              {done ? 'Rest Complete' : 'Resting'}
            </div>
            <div
              aria-live="polite"
              aria-atomic="true"
              aria-label={`Rest time remaining: ${rt.remaining} seconds`}
              style={{
                fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                fontSize: 'clamp(120px, 36vw, 200px)',
                fontWeight: 400,
                color: done ? 'var(--accent)' : 'var(--text-primary)',
                lineHeight: 0.9,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
                marginBottom: 8,
                textShadow: done ? '0 0 32px rgba(232,101,26,0.55)' : 'none',
                animation: done ? 'restPulseText 1.4s ease-in-out infinite' : undefined,
              }}
            >
              {done ? 'GO' : timeDisplay}
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                marginBottom: 36,
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              {rt.exName}
            </div>
            <button
              onClick={dismissRestTimer}
              style={{
                width: '100%',
                maxWidth: 320,
                height: 56,
                borderRadius: tokens.radius.md,
                background: 'var(--accent)',
                color: 'var(--bg-root, #0A0A0C)',
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(232,101,26,0.45)',
                fontFamily: 'inherit',
                marginBottom: 10,
              }}
            >
              {done ? "Let's Go" : "I'm Ready"}
            </button>
            <button
              onClick={() => setRestTimerMinimized(true)}
              style={{
                width: '100%',
                maxWidth: 320,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text-muted)',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '12px 0',
              }}
            >
              Go back
            </button>
            <style>{`
              @keyframes restPulseText {
                0%, 100% { text-shadow: 0 0 32px rgba(232,101,26,0.55); }
                50% { text-shadow: 0 0 48px rgba(232,101,26,0.85); }
              }
            `}</style>
          </div>
        );
      })()}

      {/* Readiness check-in (pre-workout) */}
      {showReadinessSheet && (
        <ReadinessSheet
          onDismiss={() => {
            setShowReadinessSheet(false);
            if (!workoutStarted) commitStartWorkout();
          }}
          onCancel={
            workoutStarted
              ? undefined
              : () => {
                  setShowReadinessSheet(false);
                  setShowSplash(true);
                }
          }
        />
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
      <SwapMenu
        open={swapTarget !== null || addingExercise}
        onClose={() => {
          setSwapTarget(null);
          setAddingExercise(false);
        }}
        replacingName={
          addingExercise
            ? 'Add exercise'
            : swapTarget !== null
            ? exercises[swapTarget.exIdx]?.name || ''
            : ''
        }
        exerciseGroups={swapExGroups}
        autoExpandMuscle={addingExercise ? undefined : swapMuscle}
        userEquipment={userEquipment}
        onSelect={handleSwap}
        onCustomExercise={handleCustomExercise}
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
          profile={profile}
          stats={workoutStats}
          weekIdx={completionWeekIdx !== null ? completionWeekIdx : weekIdx}
          onOk={() => {
            setShowWorkoutModal(false);
            const pendingData = pendingCompletionRef.current;
            pendingCompletionRef.current = null;
            setShowCardioPrompt(true);
            // Workout fully done — drop the persistent session bar so the
            // user doesn't keep seeing "SET N/N" on Home.
            clearActiveSessionBar();
            // Fire onComplete with the saved completion data
            if (pendingData) {
              onComplete && onComplete(pendingData);
            }
          }}
          onStartCooldown={() => {
            // Mirror the onOk completion side-effects (mark day done, drop
            // the lifting session bar) but skip the cardio prompt and route
            // straight into the post-training downshift mobility protocol.
            setShowWorkoutModal(false);
            const pendingData = pendingCompletionRef.current;
            pendingCompletionRef.current = null;
            clearActiveSessionBar();
            if (pendingData) {
              onComplete && onComplete(pendingData);
            }
            const d = new Date();
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            onBack();
            // Defer the nav so onBack's route change commits first (mirrors
            // the cardio-prompt pattern a few lines down).
            setTimeout(
              () => emit('foundry:openMobility', { dateStr, protocolId: 'post_training_downshift' }),
              80,
            );
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

// ── ProgressStrip ────────────────────────────────────────────────────────────
// One segment per exercise. done = brand orange + glow, current = greyish-
// white static, upcoming = subtle grey. Taps jump focus to that exercise.
// Done used to use phase color but the user wanted "I finished this" to
// always read orange regardless of meso phase.
function ProgressStrip({
  exercises,
  doneExercises,
  focusedIdx,
  onJump,
}: {
  exercises: Exercise[];
  doneExercises: Set<number>;
  focusedIdx: number;
  onJump: (idx: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Session progress"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${exercises.length}, 1fr)`,
        gap: 4,
        marginBottom: 14,
      }}
    >
      {exercises.map((ex, i) => {
        const done = doneExercises.has(i);
        const isCurrent = !done && i === focusedIdx;
        const segStyle: React.CSSProperties = {
          height: 8,
          borderRadius: 2,
          background: 'var(--border-subtle, var(--border))',
          transition: 'background 200ms',
        };
        if (done) {
          // Done segments use the brand accent (orange) instead of the
          // phase color — keeps the "I finished this" signal consistent
          // regardless of where you are in the meso.
          segStyle.background = 'var(--accent)';
          segStyle.boxShadow = '0 0 6px rgba(232,101,26,0.55)';
        } else if (isCurrent) {
          segStyle.background = 'var(--text-secondary)';
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`${ex.name}: ${done ? 'done' : isCurrent ? 'current' : 'upcoming'} — jump`}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px 0',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <div style={segStyle} />
          </button>
        );
      })}
    </div>
  );
}

// ── UpNextCard ───────────────────────────────────────────────────────────────
// Compact peek at the next unfinished exercise. Tap to jump.
function UpNextCard({
  exercise,
  onJump,
}: {
  exercise: Exercise;
  onJump: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onJump}
      aria-label={`Up next: ${exercise.name} — jump`}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 14px',
        marginBottom: 12,
        background: 'var(--bg-card)',
        border: '1px dashed var(--border)',
        borderRadius: tokens.radius.lg,
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: 'var(--text-secondary)',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          Up next
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {exercise.name}
        </div>
      </div>
      <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 20 }}>›</span>
    </button>
  );
}

// ── FocusNav ─────────────────────────────────────────────────────────────────
// Bottom prev/next nav for Focus Mode. 40px tall, minimal chrome.
function FocusNav({
  canPrev,
  canNext,
  onPrev,
  onNext,
  onReorder,
  position,
  total,
}: {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onReorder: () => void;
  position: number;
  total: number;
}) {
  const sideBtn: React.CSSProperties = {
    height: 40,
    width: 40,
    padding: 0,
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: tokens.radius.md,
    color: 'var(--text-secondary)',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  };
  return (
    <div
      role="group"
      aria-label="Exercise navigation"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 10,
        margin: '4px 0 16px',
      }}
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous exercise"
        style={{
          ...sideBtn,
          opacity: canPrev ? 1 : 0.35,
          cursor: canPrev ? 'pointer' : 'default',
        }}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        onClick={onReorder}
        aria-label="Reorder or add exercises"
        style={{
          height: 40,
          padding: '0 18px',
          background: 'transparent',
          border: '1px solid var(--accent-border, rgba(232,101,26,0.3))',
          borderRadius: tokens.radius.md,
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        Reorder
        <span
          aria-hidden="true"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {position}/{total}
        </span>
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next exercise"
        style={{
          ...sideBtn,
          opacity: canNext ? 1 : 0.35,
          cursor: canNext ? 'pointer' : 'default',
        }}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
