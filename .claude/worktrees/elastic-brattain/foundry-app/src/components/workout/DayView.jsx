import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';

// Data
import { PHASE_COLOR, TAG_ACCENT, RECOVERY_TIPS, randomQuote, randomCongrats, getMeso, getWeekPhase, getProgTargets } from '../../data/constants';
import { EXERCISE_DB } from '../../data/exercises';

// Utils
import {
  store,
  loadDayWeek,
  loadDayWeekWithCarryover,
  saveDayWeek,
  loadNotes,
  saveNotes,
  loadExNotes,
  loadExOverride,
  saveExOverride,
  saveProfile,
  loadBwLog,
  bwPromptShownThisWeek,
  getWarmupDetail,
  generateWarmupSteps,
  loadArchive,
  detectStallingLifts,
  getWeekSets,
  loadExerciseHistory,
} from '../../utils/store';
import { haptic } from '../../utils/helpers';

// Components
import ExerciseCard from './ExerciseCard';
import HammerIcon from '../shared/HammerIcon';

function DayView({ dayIdx, weekIdx, onBack, onComplete, onNextDay, completedDays, profile, activeDays, onProfileUpdate,
  restTimer, restTimerMinimized, setRestTimerMinimized, startRestTimer, dismissRestTimer }) {
  const day = activeDays[dayIdx];

  // Guard: if the day slot doesn't exist (profile/MESO mismatch after restore), bail gracefully
  if (!day) {
    return (
      <div style={{ minHeight:"100vh", background:"var(--bg-root)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, gap:16 }}>
        <div style={{ fontSize:32 }}>⚠️</div>
        <div style={{ fontSize:16, fontWeight:700, color:"var(--text-primary)", textAlign:"center" }}>Session unavailable</div>
        <div style={{ fontSize:13, color:"var(--text-secondary)", textAlign:"center", lineHeight:1.6 }}>
          Day {dayIdx + 1} doesn't exist in the current program ({activeDays.length} days configured).
          This usually means a backup was restored with a different program structure.
        </div>
        <button onClick={onBack} className="btn-primary" style={{ padding:"12px 28px", borderRadius:6, fontSize:14, fontWeight:700, marginTop:8, background:"var(--btn-primary-bg)", border:"1px solid var(--btn-primary-border)", color:"var(--btn-primary-text)" }}>← Go Back</button>
      </div>
    );
  }

  const accent = TAG_ACCENT[day.tag];
  const pc = PHASE_COLOR[getWeekPhase()[weekIdx]] || PHASE_COLOR["Accumulation"];
  const isDone = completedDays.has(`${dayIdx}:${weekIdx}`);
  const isCardioDay = day.tag === "CARDIO";

  // Week-adjusted day: injects MEV→MAV→MRV set progression into every exercise.
  // Must be computed before useState initializers that consume ex.sets.
  const weekDay = {
    ...day,
    exercises: day.exercises.map(ex => ({
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
  const [bwModal, setBwModal] = React.useState(null); // { exIdx, exName, bwValue }
  const [bwInput, setBwInput] = React.useState("");

  const handleExpandToggle = (i) => {
    const ex = day.exercises[i];
    // If BW exercise, not yet confirmed this session, and not read-only
    if (ex.bw && !bwConfirmed.has(i) && !isDone && !isLocked) {
      setBwInput(String(profile?.weight || ""));
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
    setBwConfirmed(prev => new Set([...prev, bwModal.exIdx]));
    setBwModal(null);
  };

  // Future sessions: load raw (empty) data so inputs show blank, not suggestions
  const [weekData, setWeekData]           = useState(() =>
    isFutureSession ? loadDayWeek(dayIdx, weekIdx) : loadDayWeekWithCarryover(dayIdx, weekIdx, weekDay, profile)
  );
  const [notes, setNotes]                 = useState(() => loadNotes(dayIdx, weekIdx));
  const [expandedIdx, setExpandedIdx]     = useState(0);
  const [doneExercises, setDoneExercises] = useState(() => {
    if (isFutureSession) return new Set(); // future — nothing is done
    const saved = loadDayWeekWithCarryover(dayIdx, weekIdx, weekDay, profile);
    const restored = new Set();
    weekDay.exercises.forEach((ex, i) => {
      const exData = saved[i] || {};
      let allFilled = true;
      for (let s = 0; s < ex.sets; s++) {
        const sd = exData[s] || {};
        // Only count as done if user actually confirmed — not from suggestion engine
        if (!sd.reps || sd.reps === "" || sd.repsSuggested) { allFilled = false; break; }
      }
      if (allFilled) restored.add(i);
    });
    return restored;
  });
  const [dialog, setDialog]               = useState(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [workoutStats, setWorkoutStats]         = useState(null);
  const [completionWeekIdx, setCompletionWeekIdx] = useState(null); // snapshot weekIdx at completion time
  const [showReadyDialog, setShowReadyDialog]   = useState(false);
  const [showMesoOverlay, setShowMesoOverlay]   = useState(() => {
    const freshDone = store.get(`foundry:done:d${dayIdx}:w${weekIdx}`) === "1";
    const alreadyStarted = !!store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
    return !freshDone && !isLocked && !alreadyStarted;
  });
  const [warmupOpen, setWarmupOpen]             = useState(weekIdx === 0 && dayIdx === 0);
  const [readinessBannerDismissed, setReadinessBannerDismissed] = useState(false);

  // ── Readiness check-in (in workout flow) ──
  const _todayReadinessKey = (() => { const d = new Date(); return `foundry:readiness:${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const [dvReadiness, setDvReadiness] = useState(() => { try { return JSON.parse(store.get(_todayReadinessKey) || "null"); } catch { return null; } });
  const dvReadinessFilled = dvReadiness && dvReadiness.sleep && dvReadiness.soreness && dvReadiness.energy;
  const [showReadinessStep, setShowReadinessStep] = useState(() => !dvReadinessFilled);
  const updateDvReadiness = (key, val) => {
    const next = { ...(dvReadiness || {}), [key]: val };
    setDvReadiness(next);
    store.set(_todayReadinessKey, JSON.stringify(next));
    const filled = next.sleep && next.soreness && next.energy;
    if (filled) setTimeout(() => setShowReadinessStep(false), 400);
  };

  const [editMode, setEditMode]                 = useState(false);
  const [showLeavePrompt, setShowLeavePrompt]   = useState(false);
  const leaveQuoteRef = React.useRef(null);
  React.useEffect(() => {
    if (showLeavePrompt && !leaveQuoteRef.current) {
      leaveQuoteRef.current = randomQuote("neutral");
    }
    if (!showLeavePrompt) leaveQuoteRef.current = null;
  }, [showLeavePrompt]);

  // Session duration tracking — timer starts explicitly on "Begin Workout", not on mount
  const sessionStartRef = React.useRef(null);
  const strengthEndRef  = React.useRef(null);
  const [workoutStarted, setWorkoutStarted] = useState(() => {
    const saved = store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
    return !!saved && !isDone && !isLocked;
  });
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const elapsedIntervalRef = React.useRef(null);

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
    return () => clearInterval(elapsedIntervalRef.current);
  }, [workoutStarted, isDone]);

  // Format elapsed seconds as M:SS or H:MM:SS
  const formatElapsed = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
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

  const [showPostStrengthPrompt, setShowPostStrengthPrompt] = useState(false);
  const [showCardioPrompt, setShowCardioPrompt] = useState(false);
  // BW check-in — triggered from beginWorkout(), not at mount
  const [showBwCheckin, setShowBwCheckin] = useState(false);
  const [bwCheckinInput, setBwCheckinInput] = useState(() => {
    const log = loadBwLog(); return log.length > 0 ? String(log[0].weight) : (profile?.weight ? String(profile.weight) : "");
  });
  // Per-exercise notes
  const [exNotes, setExNotes] = useState(() => loadExNotes(dayIdx, weekIdx));
  // Previous week's notes for this same session — shown as a callout at session start
  const [prevNotesDismissed, setPrevNotesDismissed] = useState(false);

  // Build resolved exercises by applying any saved overrides
  // MUST be declared before prevWeekNotes useMemo — Babel hoists var to undefined otherwise
  const [exercises, setExercises] = useState(() => {
    return (weekDay.exercises || []).map((ex, i) => {
      const ovId = loadExOverride(dayIdx, weekIdx, i);
      if (!ovId) return ex;
      const dbEx = EXERCISE_DB.find(e => e.id === ovId);
      if (!dbEx) return ex;
      const wu = ex.anchor
        ? (profile?.sessionDuration <= 30 ? "2 ramp sets — time is tight, be thorough" : dbEx.warmup)
        : (dbEx.warmup || "1 feeler set");
      return {
        id: dbEx.id, name: dbEx.name, muscle: dbEx.muscle, equipment: dbEx.equipment,
        tag: dbEx.tag, anchor: ex.anchor, sets: getWeekSets(dbEx.sets, weekIdx, getMeso().weeks), reps: dbEx.reps,
        rest: dbEx.rest, warmup: wu,
        progression: dbEx.pattern === "isolation" ? "reps" : "weight",
        description: dbEx.description || "",
        videoUrl: dbEx.videoUrl || "",
      };
    });
  });

  const prevWeekNotes = useMemo(() => {
    if (weekIdx === 0) return null; // no prior week
    const prevW = weekIdx - 1;
    const sessionNote = loadNotes(dayIdx, prevW);
    const exN = loadExNotes(dayIdx, prevW);
    const exEntries = exercises
      .map((ex, i) => ({ name: ex.name, note: (exN[i] || "").trim() }))
      .filter(e => e.note);
    if (!sessionNote.trim() && exEntries.length === 0) return null;
    return { sessionNote: sessionNote.trim(), exEntries, week: prevW };
  }, [dayIdx, weekIdx, exercises]);

  // ── Stalling detection — runs once per session open on active, non-deload sessions ──
  const stallingData = React.useMemo(() => {
    if (isDone || isLocked || getWeekPhase()[weekIdx] === "Deload") return { stalls: [], regressions: [] };
    return detectStallingLifts(dayIdx, day, exercises, weekIdx, profile);
  }, [dayIdx, weekIdx, isDone, isLocked, exercises, day, profile]);
  const [stallCardDismissed, setStallCardDismissed] = useState(() => !!store.get(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`));

  const [showUnfinishedPrompt, setShowUnfinishedPrompt] = useState(false);
  const [swapTarget, setSwapTarget]             = useState(null); // {exIdx}
  const [showAddExercise, setShowAddExercise]   = useState(false);
  const dialogShownRef = React.useRef(new Set());

  // ── Rest timer (state lives in App, received as props) ──────────────────────
  const [pendingRest, setPendingRest] = useState(null); // { exIdx, setIdx, partnerIdx, restStr, exName }

  // Superset-aware set logger: defers rest until both exercises in pair have logged the same set
  const handleSetLogged = React.useCallback((restStr, exName, setIdx, isLastSet = false) => {
    // Find if this exercise is part of a superset pair
    const exIdx = exercises.findIndex(e => e.name === exName);

    // On the last set of an exercise, use the next exercise's rest period
    // so the timer guides the transition between exercises
    let effectiveRestStr = restStr;
    if (isLastSet && exIdx !== -1) {
      const nextEx = exercises[exIdx + 1];
      if (nextEx && nextEx.rest) {
        effectiveRestStr = nextEx.rest;
      } else if (!nextEx) {
        // Final exercise of the session — short rest, they're done
        effectiveRestStr = "90 sec";
      }
    }

    if (exIdx === -1) { startRestTimer(effectiveRestStr, exName, dayIdx, weekIdx); return; }

    const ex = exercises[exIdx];
    const isPrimary = ex.supersetWith != null;
    const isSecondary = !isPrimary && exercises.some(e => e.supersetWith === exIdx);

    if (!isPrimary && !isSecondary) {
      startRestTimer(effectiveRestStr, exName, dayIdx, weekIdx);
      return;
    }

    const partnerIdx = isPrimary ? ex.supersetWith : exercises.findIndex(e => e.supersetWith === exIdx);

    if (pendingRest && pendingRest.partnerIdx === exIdx && pendingRest.setIdx === setIdx) {
      startRestTimer(pendingRest.restStr || effectiveRestStr, exName, dayIdx, weekIdx);
      setPendingRest(null);
    } else {
      setPendingRest({ exIdx, setIdx, partnerIdx, restStr: effectiveRestStr, exName });
    }
  }, [exercises, pendingRest, startRestTimer, dayIdx, weekIdx]);

  // Timer lives in App — no local interval to clean up on unmount

  const handleSwap = (newDbEx, scope) => {
    const { exIdx } = swapTarget;
    const oldEx = exercises[exIdx];
    const wu = oldEx.anchor
      ? (profile?.sessionDuration <= 30 ? "2 ramp sets — time is tight, be thorough" : newDbEx.warmup)
      : (newDbEx.warmup || "1 feeler set");
    const newEx = {
      id: newDbEx.id, name: newDbEx.name, muscle: newDbEx.muscle, equipment: newDbEx.equipment,
      tag: newDbEx.tag, anchor: oldEx.anchor, sets: newDbEx.sets, reps: newDbEx.reps,
      rest: newDbEx.rest, warmup: wu,
      progression: newDbEx.pattern === "isolation" ? "reps" : "weight",
      description: newDbEx.description || "",
      videoUrl: newDbEx.videoUrl || "",
    };
    saveExOverride(dayIdx, weekIdx, exIdx, newDbEx.id, scope);
    setExercises(prev => prev.map((ex, i) => i === exIdx ? newEx : ex));
    // Clear previous exercise's suggested/logged data for this slot
    setWeekData(prev => {
      const next = { ...prev };
      delete next[exIdx];
      saveDayWeek(dayIdx, weekIdx, next);
      return next;
    });
    // Un-mark the slot as done so user can log fresh sets
    setDoneExercises(prev => {
      const next = new Set(prev);
      next.delete(exIdx);
      return next;
    });
    setSwapTarget(null);
  };

  const handleAddExercise = (dbEx, scope) => {
    const newEx = {
      id: dbEx.id, name: dbEx.name, muscle: dbEx.muscle, muscles: dbEx.muscles,
      equipment: dbEx.equipment, tag: dbEx.tag, anchor: false,
      sets: dbEx.sets, reps: dbEx.reps, rest: dbEx.rest, warmup: "1 feeler set",
      progression: dbEx.pattern === "isolation" ? "reps" : "weight",
      description: dbEx.description || "",
      videoUrl: dbEx.videoUrl || "",
      bw: !!dbEx.bw,
      addedMidMeso: true,
    };
    if (scope === "meso") {
      // Persist to profile — propagates to all remaining weeks via activeDays useMemo
      const updated = { ...profile };
      const prev = (updated.addedDayExercises || {});
      const dayList = [...(prev[dayIdx] || [])];
      if (!dayList.includes(dbEx.id)) dayList.push(dbEx.id);
      updated.addedDayExercises = { ...prev, [dayIdx]: dayList };
      saveProfile(updated);
      onProfileUpdate && onProfileUpdate({ addedDayExercises: updated.addedDayExercises });
    }
    // Always update local state so it appears immediately this session regardless of scope
    setExercises(prev => [...prev, newEx]);
    setShowAddExercise(false);
  };

  const handleUpdateSet = useCallback((exIdx, setIdx, field, value) => {
    // If user edits actual data for a done exercise, un-done it so they can re-complete
    // Don't un-done on confirmed flag writes — those are checkmark actions, not edits
    if (field !== "confirmed") {
      setDoneExercises(prev => {
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

    setWeekData(prev => {
      const next = {
        ...prev,
        [exIdx]: {
          ...(prev[exIdx] || {}),
          [setIdx]: {...((prev[exIdx] || {})[setIdx] || {}), [field]: value}
        }
      };
      saveDayWeek(dayIdx, weekIdx, next);
      return next;
    });
  }, [dayIdx, weekIdx]);

  const handleWeightAutoFill = useCallback((exIdx, weight, numSets) => {
    setWeekData(prev => {
      const exData = prev[exIdx] || {};
      const next = { ...prev, [exIdx]: { ...exData } };
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
  }, [dayIdx, weekIdx]);

  const handleLastSetFilled = useCallback((exIdx, exName, restStr) => {
    // Don't fire if already done or already shown since last edit
    if (doneExercises.has(exIdx) || dialogShownRef.current.has(exIdx)) return;
    dialogShownRef.current.add(exIdx);
    setDialog({ exIdx, exName, restStr, isLastSet: true });
  }, [doneExercises]);

  const handleDialogYes = (rpe) => {
    const { exIdx, restStr, isLastSet } = dialog;
    // Save RPE to the last set of this exercise
    if (rpe) {
      const ex = exercises[exIdx];
      const lastSet = ex.sets - 1;
      setWeekData(prev => {
        const next = {
          ...prev,
          [exIdx]: {
            ...(prev[exIdx] || {}),
            [lastSet]: { ...((prev[exIdx] || {})[lastSet] || {}), rpe }
          }
        };
        saveDayWeek(dayIdx, weekIdx, next);
        return next;
      });
    }
    setDialog(null);
    haptic("done");
    const newDone = new Set([...doneExercises, exIdx]);
    setDoneExercises(newDone);
    const nextIdx = exIdx + 1;
    if (nextIdx < exercises.length && !newDone.has(nextIdx)) {
      setExpandedIdx(nextIdx);
      setTimeout(() => {
        const el = document.getElementById(`ex-${nextIdx}`);
        if (el) el.scrollIntoView({ behavior:"smooth", block:"start" });
      }, 120);
    }
    // Fire the rest timer now — deferred from last-set checkmark
    // Never fire after the last set of an exercise is confirmed done
    // (transitioning between exercises doesn't warrant a rest prompt)
    // Only fire the strength-done flow when every exercise is confirmed
    if (newDone.size === exercises.length) {
      strengthEndRef.current = Date.now();
      store.set(`foundry:strengthEnd:d${dayIdx}:w${weekIdx}`, String(strengthEndRef.current));
      setExpandedIdx(null);
      openNoteReview();
    }
  };

  const handleDialogNo = () => {
    const { exIdx } = dialog;
    const ex = exercises[exIdx];
    const lastSetIdx = ex.sets - 1;
    // Clear the last set's reps so the user can re-log it — and allow the dialog to re-fire
    setWeekData(prev => {
      const exData = prev[exIdx] || {};
      const lastSet = exData[lastSetIdx] || {};
      const next = {
        ...prev,
        [exIdx]: {
          ...exData,
          [lastSetIdx]: { ...lastSet, reps: "" },
        }
      };
      saveDayWeek(dayIdx, weekIdx, next);
      return next;
    });
    dialogShownRef.current.delete(exIdx);
    setDialog(null);
  };

  const handleAddSet = () => {
    const { exIdx } = dialog;
    const ex = exercises[exIdx];
    const currentSets = ex.sets;
    const newSetIdx = currentSets; // 0-indexed, so next slot = current count
    // Copy weight from the last logged set
    const lastSetData = (weekData[exIdx] || {})[currentSets - 1] || {};
    const copiedWeight = lastSetData.weight || "";
    // Add the new set slot to weekData with copied weight, blank reps
    setWeekData(prev => {
      const next = {
        ...prev,
        [exIdx]: {
          ...(prev[exIdx] || {}),
          [newSetIdx]: { weight: copiedWeight, reps: "" },
        }
      };
      saveDayWeek(dayIdx, weekIdx, next);
      return next;
    });
    // Increment the sets count on the exercise object
    setExercises(prev => prev.map((e, i) =>
      i === exIdx ? { ...e, sets: e.sets + 1 } : e
    ));
    // Allow the dialog to re-fire when the new set is filled
    dialogShownRef.current.delete(exIdx);
    setDialog(null);
  };

  const handleNoteChange = (val) => {
    setNotes(val);
    saveNotes(dayIdx, weekIdx, val);
  };

  // Compile per-exercise notes + existing session note into a single string.
  // Used to pre-populate the end-of-session note textarea.
  const compileSessionNote = () => {
    const parts = [];
    exercises.forEach((ex, i) => {
      const exNote = exNotes[i];
      if (exNote && exNote.trim()) {
        parts.push(`${ex.name}: ${exNote}`);
      }
    });
    if (notes && notes.trim()) {
      parts.push(notes);
    }
    return parts.join("\n\n");
  };

  const [showNoteReview, setShowNoteReview] = useState(false);
  const [sessionNote, setSessionNote] = useState(() => compileSessionNote());

  const openNoteReview = () => {
    setSessionNote(compileSessionNote());
    setShowNoteReview(true);
  };

  const doComplete = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const completionData = {
      date: dateStr,
      dayIdx: dayIdx,
      weekIdx: weekIdx,
      exercises: exercises.map((ex, i) => ({
        name: ex.name,
        sets: ex.sets,
        data: weekData[i] || {},
      })),
      sessionNote: sessionNote,
      duration: elapsedSecs,
      completedAt: Date.now(),
    };
    store.set(`foundry:done:d${dayIdx}:w${weekIdx}`, "1");
    store.set(`foundry:sessionNote:d${dayIdx}:w${weekIdx}`, sessionNote);
    onComplete && onComplete(completionData);
  };

  const dateStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  })();

  if (!workoutStarted) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-root)", padding: "20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <button onClick={onBack} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-accent)" }}>
            ← Back
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", textAlign: "center", flex: 1, margin: 0 }}>
            {day.name} - Week {weekIdx + 1}
          </h1>
          <div style={{ width: 32 }} />
        </div>

        {/* Meso Overlay */}
        {showMesoOverlay && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Ready to train?</div>
            <button
              onClick={beginWorkout}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 8,
                background: "var(--btn-primary-bg)",
                border: "1px solid var(--btn-primary-border)",
                color: "var(--btn-primary-text)",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Begin Workout
            </button>
          </div>
        )}

        {/* Exercise Cards */}
        {exercises.map((ex, i) => (
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
              note={exNotes[i] || ""}
              onNoteChange={(idx, val) => {
                const next = [...exNotes];
                next[idx] = val;
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
                width: "100%",
                padding: "16px",
                borderRadius: 8,
                background: "var(--bg-card)",
                border: "2px dashed var(--border)",
                color: "var(--text-accent)",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer"
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
                width: "100%",
                padding: "16px",
                borderRadius: 8,
                background: "var(--btn-primary-bg)",
                border: "1px solid var(--btn-primary-border)",
                color: "var(--btn-primary-text)",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer"
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
    <div style={{ minHeight: "100vh", background: "var(--bg-root)", padding: "20px" }}>
      {/* Header with Timer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <button onClick={onBack} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-accent)" }}>
          ← Back
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-accent)" }}>
          {formatElapsed(elapsedSecs)}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }} />
      </div>

      {/* Exercise Cards */}
      {exercises.map((ex, i) => (
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
            note={exNotes[i] || ""}
            onNoteChange={(idx, val) => {
              const next = [...exNotes];
              next[idx] = val;
              setExNotes(next);
            }}
          />
        </div>
      ))}

      {/* Bodyweight Modal */}
      {bwModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setBwModal(null)}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, maxWidth: 300 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Bodyweight Check</div>
            <input
              type="number"
              value={bwInput}
              onChange={(e) => setBwInput(e.target.value)}
              placeholder="Enter weight (lbs)"
              autoFocus
              style={{ width: "100%", padding: "10px", borderRadius: 4, border: "1px solid var(--border)", marginBottom: 16, background: "var(--bg-inset)", color: "var(--text-primary)" }}
            />
            <button onClick={handleBwConfirm} style={{ width: "100%", padding: "10px", borderRadius: 4, background: "var(--btn-primary-bg)", border: "1px solid var(--btn-primary-border)", color: "var(--btn-primary-text)", cursor: "pointer", fontWeight: 700 }}>
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Rest Timer (if active) */}
      {restTimer && !restTimerMinimized && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, zIndex: 150 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Rest time</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-accent)" }}>{restTimer}</div>
          <button onClick={() => setRestTimerMinimized(true)} style={{ marginTop: 8, width: "100%", padding: "6px", borderRadius: 4, background: "var(--bg-inset)", border: "1px solid var(--border)", cursor: "pointer" }}>
            Minimize
          </button>
        </div>
      )}

      {/* Note Review Step */}
      {showNoteReview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 220, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px 14px 0 0", width: "100%", maxWidth: 480, padding: "24px 20px 36px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 10 }}>SESSION NOTES</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 18 }}>Anything to add before you go?</div>
            <textarea
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              autoFocus
              rows={5}
              style={{ width: "100%", background: "var(--bg-inset)", border: "1px solid var(--border-accent)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, padding: "12px 14px", resize: "none", outline: "none", lineHeight: 1.6, boxSizing: "border-box", fontFamily: "inherit", marginBottom: 16 }}
            />
            <button
              onClick={() => { setShowNoteReview(false); doComplete(); }}
              style={{ width: "100%", padding: "16px", borderRadius: 8, background: "var(--btn-primary-bg)", border: "1px solid var(--btn-primary-border)", color: "var(--btn-primary-text)", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
            >
              Finish Session ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DayView;
