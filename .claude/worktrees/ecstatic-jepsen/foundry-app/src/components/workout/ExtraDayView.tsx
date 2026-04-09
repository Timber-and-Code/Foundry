import React from 'react';
import { tokens } from '../../styles/tokens';
import {
  store,
  loadBwLog,
  addBwEntry,
  saveExtraExNotes,
  loadExtraExNotes,
  detectSessionPRs,
  loadCompleted,
  bwPromptShownThisWeek,
  markBwPromptShown,
} from '../../utils/store';
import { haptic } from '../../utils/helpers';
import { TAG_ACCENT, getMeso } from '../../data/constants';
import ExerciseCard from './ExerciseCard';
import type { Profile, TrainingDay, Exercise } from '../../types';

interface SwapModalProps {
  exercise: Exercise;
  dayTag: string;
  profile: Profile;
  onSwap: (ex: Exercise) => void;
  onClose: () => void;
}

interface AddExerciseModalProps {
  dayTag: string;
  profile: Profile;
  currentExerciseIds?: (string | number | undefined)[];
  onAdd: (ex: Exercise) => void;
  onClose: () => void;
}

interface WorkoutCompleteModalProps {
  dayLabel: string;
  dayTag: string;
  gender: string;
  stats: { totalSets: number; duration?: string | null } | null;
  weekIdx: number;
  onDone: () => void;
  onClose: () => void;
}

// Stub modal components (to be fully built out later)
const SwapModal = ({ exercise: _exercise, dayTag: _dayTag, profile: _profile, onSwap: _onSwap, onClose }: SwapModalProps) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: tokens.colors.overlayLight,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onClick={onClose}
  >
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.xl,
        padding: 24,
        maxWidth: 360,
        width: '90%',
        textAlign: 'center',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 12,
        }}
      >
        Swap Exercise
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Exercise swap coming soon
      </div>
      <button
        onClick={onClose}
        style={{
          padding: '10px 24px',
          borderRadius: tokens.radius.md,
          background: 'var(--bg-inset)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Close
      </button>
    </div>
  </div>
);

const AddExerciseModal = ({ dayTag: _dayTag, profile: _profile, currentExerciseIds: _currentExerciseIds, onAdd: _onAdd, onClose }: AddExerciseModalProps) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: tokens.colors.overlayLight,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onClick={onClose}
  >
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.xl,
        padding: 24,
        maxWidth: 360,
        width: '90%',
        textAlign: 'center',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 12,
        }}
      >
        Add Exercise
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Add exercise coming soon
      </div>
      <button
        onClick={onClose}
        style={{
          padding: '10px 24px',
          borderRadius: tokens.radius.md,
          background: 'var(--bg-inset)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Close
      </button>
    </div>
  </div>
);

const WorkoutCompleteModal = ({ dayLabel, dayTag: _dayTag, gender: _gender, stats, weekIdx: _weekIdx, onDone, onClose }: WorkoutCompleteModalProps) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: tokens.colors.overlayLight,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onClick={onClose}
  >
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.xl,
        padding: 24,
        maxWidth: 360,
        width: '90%',
        textAlign: 'center',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: 8,
        }}
      >
        Session Complete!
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginBottom: 8,
        }}
      >
        {dayLabel}
      </div>
      {stats && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          {stats.totalSets} sets · {stats.duration || '—'}
        </div>
      )}
      <button
        onClick={onDone || onClose}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: tokens.radius.lg,
          background: 'var(--btn-primary-bg)',
          border: '1px solid var(--btn-primary-border)',
          color: 'var(--btn-primary-text)',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        Done
      </button>
    </div>
  </div>
);

interface ExtraDayViewProps {
  dateStr: string;
  onBack: () => void;
  profile: Profile;
  onProfileUpdate: (profile: Partial<Profile>) => void;
  activeDays: TrainingDay[];
}

function ExtraDayView({ dateStr, onBack, profile, onProfileUpdate, activeDays }: ExtraDayViewProps) {
  const extraKey = `foundry:extra:${dateStr}`;
  const doneKey = `foundry:extra:done:${dateStr}`;
  const startKey = `foundry:extra:start:${dateStr}`;
  const strengthKey = `foundry:extra:end:${dateStr}`;
  const dataKey = `foundry:extra:data:${dateStr}`;

  // ── State ────────────────────────────────────────────────────────────────────
  const [exercises, setExercises] = React.useState(() => {
    try {
      return JSON.parse(store.get(extraKey) || 'null')?.exercises || [];
    } catch {
      return [];
    }
  });
  const [day, _setDay] = React.useState(() => {
    try {
      return JSON.parse(store.get(extraKey) || 'null');
    } catch {
      return null;
    }
  });
  const [completedDone, setCompletedDone] = React.useState(() => !!store.get(doneKey));
  const [weekData, setWeekData] = React.useState(() => {
    try {
      return JSON.parse(store.get(dataKey) || '{}');
    } catch {
      return {};
    }
  });
  const [doneExercises, setDoneExercises] = React.useState(new Set());
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null);
  const [editMode, setEditMode] = React.useState(false);
  const [showLeavePrompt, setShowLeavePrompt] = React.useState(false);
  const [showPostStrengthPrompt, setShowPostStrengthPrompt] = React.useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = React.useState(false);
  const [workoutStats, setWorkoutStats] = React.useState<{ totalSets: number; totalReps: number; totalVolume: number; duration: string | null; prs: { name: string; weight: number; reps: number }[] } | null>(null);
  const [swapTarget, setSwapTarget] = React.useState<{ exIdx: number } | null>(null);
  const [showAddExercise, setShowAddExercise] = React.useState(false);
  const [workoutStarted, setWorkoutStarted] = React.useState(
    () => !!store.get(startKey) && !store.get(doneKey)
  );
  const [elapsedSecs, setElapsedSecs] = React.useState(0);
  const [showBwCheckin, setShowBwCheckin] = React.useState(false);
  const [bwCheckinInput, setBwCheckinInput] = React.useState(() => {
    const log = loadBwLog();
    return log.length > 0 ? String(log[0].weight) : profile?.weight ? String(profile.weight) : '';
  });
  const [exNotes, setExNotes] = React.useState(() => loadExtraExNotes(dateStr));
  const [notes, setNotes] = React.useState(() => store.get(`foundry:extra:notes:${dateStr}`) || '');
  const [showNoteReview, setShowNoteReview] = React.useState(false);

  const handleNoteChange = (val: string) => {
    setNotes(val);
    store.set(`foundry:extra:notes:${dateStr}`, val);
  };

  const compileSessionNote = () => {
    const parts: string[] = [];
    exercises.forEach((ex: Exercise, i: number) => {
      const n = (exNotes[i] || '').trim();
      if (n) parts.push(`${ex.name}: ${n}`);
    });
    if (notes.trim()) parts.push(notes.trim());
    return parts.join('\n');
  };

  const hasAnySessionNotes = () =>
    exercises.some((_: Exercise, i: number) => (exNotes[i] || '').trim()) || !!notes.trim();

  const openNoteReview = () => {
    if (!hasAnySessionNotes()) {
      doComplete();
      return;
    }
    const compiled = compileSessionNote();
    handleNoteChange(compiled);
    setShowNoteReview(true);
  };

  const sessionStartRef = React.useRef<number | null>(null);
  const strengthEndRef = React.useRef<number | null>(null);
  const elapsedRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Restore timestamps from localStorage ────────────────────────────────────
  React.useEffect(() => {
    const s = store.get(startKey);
    if (s) sessionStartRef.current = parseInt(s, 10);
    const e = store.get(strengthKey);
    if (e) strengthEndRef.current = parseInt(e, 10);
  }, []);

  // ── Pre-populate carryover weights for new sessions ──────────────────────────
  React.useEffect(() => {
    if (completedDone) return; // don't overwrite logged data
    const existing = JSON.parse(store.get(dataKey) || '{}');
    let changed = false;
    const next = { ...existing };
    exercises.forEach((ex: Exercise, i: number) => {
      if (!next[i]) {
        const cw = getCarryoverWeight(ex.id);
        if (cw) {
          next[i] = { 0: { weight: cw, reps: '' } };
          changed = true;
        }
      }
    });
    if (changed) {
      store.set(dataKey, JSON.stringify(next));
      setWeekData(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live elapsed timer ───────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!workoutStarted || completedDone) return;
    const tick = () => {
      if (sessionStartRef.current)
        setElapsedSecs(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    };
    tick();
    elapsedRef.current = setInterval(tick, 1000);
    return () => { if (elapsedRef.current !== null) clearInterval(elapsedRef.current); };
  }, [workoutStarted, completedDone]);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  // ── Persist exercise list changes back to localStorage ──────────────────────
  const persistExercises = (exList: Exercise[]) => {
    const current = JSON.parse(store.get(extraKey) || '{}');
    store.set(extraKey, JSON.stringify({ ...current, exercises: exList }));
  };

  // ── Find last logged weight for an exercise by ID across all meso data ──────
  const getCarryoverWeight = (exId: string | number | undefined) => {
    if (!activeDays) return '';
    const weeks = getMeso().weeks;
    for (let w = weeks; w >= 0; w--) {
      for (let d = 0; d < activeDays.length; d++) {
        const idx = activeDays[d].exercises.findIndex((e) => e.id === exId);
        if (idx < 0) continue;
        try {
          const raw = store.get(`foundry:day${d}:week${w}`);
          if (!raw) continue;
          const dayData = JSON.parse(raw);
          const w0 = (dayData[idx] || {})[0]?.weight;
          if (w0) return w0;
        } catch {}
      }
    }
    return '';
  };

  // ── Begin workout ────────────────────────────────────────────────────────────
  const beginWorkout = () => {
    const now = Date.now();
    sessionStartRef.current = now;
    store.set(startKey, String(now));
    setWorkoutStarted(true);
    if (!bwPromptShownThisWeek()) setShowBwCheckin(true);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleUpdateSet = (exIdx: number, setIdx: number, field: string, value: string | number | boolean) => {
    setWeekData((prev: Record<string, Record<string, Record<string, string | number | boolean>>>) => {
      const next = {
        ...prev,
        [exIdx]: {
          ...(prev[exIdx] || {}),
          [setIdx]: { ...((prev[exIdx] || {})[setIdx] || {}), [field]: value },
        },
      };
      store.set(dataKey, JSON.stringify(next));
      return next;
    });
    // Un-done the exercise if user edits it
    setDoneExercises((prev) => {
      if (prev.has(exIdx)) {
        const n = new Set(prev);
        n.delete(exIdx);
        return n;
      }
      return prev;
    });
  };

  const handleWeightAutoFill = (exIdx: number, weight: string) => {
    handleUpdateSet(exIdx, 0, 'weight', weight);
  };

  const handleLastSetFilled = (exIdx: number) => {
    setDoneExercises((prev) => {
      const next = new Set([...prev, exIdx]);
      if (next.size === exercises.length) {
        strengthEndRef.current = Date.now();
        store.set(strengthKey, String(strengthEndRef.current));
        setShowPostStrengthPrompt(true);
      }
      return next;
    });
  };

  const handleSetLogged = () => {};

  const handleSwap = (newDbEx: Record<string, unknown>) => {
    if (swapTarget === null) return;
    const { exIdx } = swapTarget;
    const oldEx = exercises[exIdx];
    const newEx = {
      id: newDbEx.id,
      name: newDbEx.name,
      muscle: newDbEx.muscle,
      muscles: newDbEx.muscles,
      equipment: newDbEx.equipment,
      tag: newDbEx.tag,
      anchor: oldEx.anchor,
      sets: newDbEx.sets,
      reps: newDbEx.reps,
      rest: newDbEx.rest,
      warmup: oldEx.anchor ? newDbEx.warmup : newDbEx.warmup || '1 feeler set',
      progression: newDbEx.pattern === 'isolation' ? 'reps' : 'weight',
      description: newDbEx.description || '',
      videoUrl: newDbEx.videoUrl || '',
      bw: !!newDbEx.bw,
    };
    setExercises((prev: Exercise[]) => {
      const n = prev.map((ex: Exercise, i: number) => (i === exIdx ? newEx : ex));
      persistExercises(n);
      return n;
    });
    // Clear previous exercise's data for this slot
    setWeekData((prev: Record<string, Record<string, Record<string, string | number | boolean>>>) => {
      const next = { ...prev };
      delete next[exIdx];
      try {
        store.set(dataKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    setDoneExercises((prev) => {
      const next = new Set(prev);
      next.delete(exIdx);
      return next;
    });
    setSwapTarget(null);
  };

  const handleAddExercise = (dbEx: Record<string, unknown>) => {
    const newEx = {
      id: dbEx.id,
      name: dbEx.name,
      muscle: dbEx.muscle,
      muscles: dbEx.muscles,
      equipment: dbEx.equipment,
      tag: dbEx.tag,
      anchor: false,
      sets: dbEx.sets,
      reps: dbEx.reps,
      rest: dbEx.rest,
      warmup: '1 feeler set',
      progression: dbEx.pattern === 'isolation' ? 'reps' : 'weight',
      description: dbEx.description || '',
      videoUrl: dbEx.videoUrl || '',
      bw: !!dbEx.bw,
    };
    setExercises((prev: Exercise[]) => {
      const n = [...prev, newEx];
      persistExercises(n as Exercise[]);
      return n;
    });
    setShowAddExercise(false);
  };

  // ── Complete ─────────────────────────────────────────────────────────────────
  const doComplete = () => {
    setShowPostStrengthPrompt(false);
    if (elapsedRef.current !== null) clearInterval(elapsedRef.current);
    store.set(doneKey, '1');
    setCompletedDone(true);

    let durationMins: number | null = null;
    if (sessionStartRef.current) {
      const endTime = strengthEndRef.current || Date.now();
      durationMins = Math.round((endTime - sessionStartRef.current) / 60000);
      if (durationMins <= 0 || durationMins >= 300) durationMins = null;
      store.set(startKey, '');
      store.set(strengthKey, '');
    }

    let totalSets = 0,
      totalReps = 0,
      totalVolume = 0;
    exercises.forEach((ex: Exercise, exIdx: number) => {
      const exData = (weekData as Record<string, Record<string, Record<string, string | number | boolean>>>)[exIdx] || {};
      for (let s = 0; s < ex.sets; s++) {
        const sd = exData[s] || {};
        if (!sd.reps || sd.reps === '') continue;
        totalSets++;
        const reps = parseInt(sd.reps) || 0;
        totalReps += reps;
        const weight = parseFloat(sd.weight) || 0;
        if (weight > 0) totalVolume += weight * reps;
        else if (ex.bw) {
          const bw = parseFloat(profile?.weight) || 0;
          if (bw > 0) totalVolume += bw * reps;
        }
      }
    });

    const sessionPRs = detectSessionPRs(exercises, weekData, 'extra', {
      activeDays,
      currentDateStr: dateStr,
    });
    haptic(sessionPRs.length > 0 ? 'victory' : 'complete');
    setWorkoutStats({
      sets: totalSets,
      reps: totalReps,
      volume: Math.round(totalVolume),
      exercises: exercises.length,
      duration: durationMins,
      prs: sessionPRs,
    });
    setShowWorkoutModal(true);
  };

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (!day)
    return (
      <div style={{ padding: 24, color: 'var(--text-secondary)' }}>
        Session not found.{' '}
        <button
          onClick={onBack}
          style={{
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Go back
        </button>
      </div>
    );

  const accent = (TAG_ACCENT as Record<string, string>)[day.tag] || 'var(--accent)';
  const readOnly = (completedDone && !editMode) || (!workoutStarted && !completedDone);

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* ── REST TIMER (reuse same state-free pattern — ExtraDayView doesn't use it yet) */}

      {/* ── SWAP MODAL ── */}
      {swapTarget !== null && (
        <SwapModal
          exercise={exercises[swapTarget.exIdx]}
          dayTag={day.tag}
          profile={profile}
          onSwap={handleSwap}
          onClose={() => setSwapTarget(null)}
        />
      )}

      {/* ── ADD EXERCISE MODAL ── */}
      {showAddExercise && (
        <AddExerciseModal
          dayTag={day.tag}
          profile={profile}
          currentExerciseIds={exercises.map((e: Exercise) => e.id)}
          onAdd={handleAddExercise}
          onClose={() => setShowAddExercise(false)}
        />
      )}

      {/* ── BW WEEKLY CHECK-IN ── */}
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
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
                marginBottom: 10,
              }}
            >
              WEEKLY CHECK-IN
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}
            >
              Log your bodyweight
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              Tracking weekly bodyweight alongside your lifts gives you the full picture of how your
              training is working.
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              <button
                onClick={() => {
                  markBwPromptShown();
                  setShowBwCheckin(false);
                }}
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
                onClick={() => {
                  const val = parseFloat(bwCheckinInput);
                  if (!isNaN(val) && val > 0) {
                    addBwEntry(val);
                    onProfileUpdate && onProfileUpdate({ weight: String(val) });
                  }
                  markBwPromptShown();
                  setShowBwCheckin(false);
                }}
                className="btn-primary"
                style={{
                  padding: '14px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 800,
                  background: 'var(--btn-primary-bg)',
                  border: '1px solid var(--btn-primary-border)',
                  color: 'var(--btn-primary-text)',
                }}
              >
                Log It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LEAVE PROMPT ── */}
      {showLeavePrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: tokens.colors.overlayHeavy,
            zIndex: 300,
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.xl,
              padding: '32px 24px',
              maxWidth: 340,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              Your session is saved. Come back and finish — your timer picks up where you left off.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => setShowLeavePrompt(false)}
                style={{
                  padding: '15px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  background: 'var(--btn-primary-bg)',
                  border: '1px solid var(--btn-primary-border)',
                  color: 'var(--btn-primary-text)',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Keep Going
              </button>
              <button
                onClick={() => {
                  setShowLeavePrompt(false);
                  onBack();
                }}
                style={{
                  padding: '13px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                }}
              >
                Leave Workout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ALL SETS DONE PROMPT ── */}
      {showPostStrengthPrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: tokens.colors.overlay,
            zIndex: 210,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--phase-accum)',
              borderRadius: tokens.radius.xl,
              padding: '32px 24px',
              maxWidth: 340,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: 8,
              }}
            >
              All Sets Done
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                marginBottom: 28,
              }}
            >
              Ready to wrap this session?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => {
                  setShowPostStrengthPrompt(false);
                  openNoteReview();
                }}
                style={{
                  padding: '16px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  background: 'var(--btn-primary-bg)',
                  border: '1px solid var(--btn-primary-border)',
                  color: 'var(--btn-primary-text)',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Finish Session
              </button>
              <button
                onClick={() => setShowPostStrengthPrompt(false)}
                style={{
                  padding: '14px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                }}
              >
                Keep Going
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BEGIN WORKOUT OVERLAY ── */}
      {!workoutStarted && !completedDone && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 260,
            background: tokens.colors.overlayHeavy,
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${accent}55`,
              borderRadius: tokens.radius.lg,
              padding: '32px 24px',
              maxWidth: 340,
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
              textAlign: 'center',
              animation: 'dialogIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                marginBottom: 20,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.07em',
                color: accent,
                background: accent + '18',
                padding: '5px 12px',
                borderRadius: tokens.radius.sm,
              }}
            >
              EXTRA SESSION
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}
            >
              {new Date(dateStr + 'T00:00:00')
                .toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })
                .toUpperCase()}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: 'var(--text-primary)',
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {day.label}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-dim)',
                marginBottom: 24,
              }}
            >
              {day.muscles}
            </div>
            <div
              style={{
                background: 'var(--bg-inset)',
                borderRadius: tokens.radius.md,
                padding: '12px 14px',
                marginBottom: 24,
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  marginBottom: 8,
                }}
              >
                {exercises.length} EXERCISES
              </div>
              {exercises.slice(0, 4).map((ex: Exercise, i: number) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    paddingBottom: 4,
                    borderBottom:
                      i < Math.min(exercises.length, 4) - 1 ? '1px solid var(--border)' : 'none',
                    marginBottom: i < Math.min(exercises.length, 4) - 1 ? 4 : 0,
                  }}
                >
                  {ex.name}{' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    · {ex.sets}×{ex.reps}
                  </span>
                </div>
              ))}
              {exercises.length > 4 && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginTop: 4,
                  }}
                >
                  +{exercises.length - 4} more
                </div>
              )}
            </div>
            <button
              onClick={beginWorkout}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: tokens.radius.md,
                cursor: 'pointer',
                background: 'var(--btn-primary-bg)',
                border: '1px solid var(--btn-primary-border)',
                color: 'var(--btn-primary-text)',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.04em',
                marginBottom: 10,
              }}
            >
              Begin Workout
            </button>
            <button
              onClick={onBack}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: tokens.radius.md,
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* ── COMPLETION MODAL ── */}
      {showWorkoutModal && workoutStats && (
        <WorkoutCompleteModal
          dayLabel={day.label}
          dayTag={day.tag}
          gender={profile?.gender}
          stats={workoutStats}
          weekIdx={(() => {
            const cd = loadCompleted(getMeso());
            const ad = activeDays;
            for (let w = 0; w < getMeso().weeks; w++) {
              if (!ad.every((_, i) => cd.has(`${i}:${w}`))) return w;
            }
            return getMeso().weeks;
          })()}
          onDone={() => {
            setShowWorkoutModal(false);
            onBack();
          }}
          onClose={() => {
            setShowWorkoutModal(false);
            onBack();
          }}
        />
      )}

      {/* ── HEADER ── */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          padding: '16px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <button
            onClick={() => (workoutStarted && !completedDone ? setShowLeavePrompt(true) : onBack())}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--phase-intens)44',
              borderRadius: tokens.radius.md,
              color: 'var(--phase-intens)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              padding: '7px 14px 7px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              letterSpacing: '0.02em',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, marginTop: -1 }}>‹</span>
            <span>Back</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {workoutStarted && !completedDone && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.md,
                  padding: '5px 10px',
                  fontSize: 13,
                  fontWeight: 800,
                  color: 'var(--accent)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.04em',
                }}
              >
                <span style={{ fontSize: 12 }}>⏱</span>
                {formatElapsed(elapsedSecs)}
              </div>
            )}
            {completedDone && (
              <button
                onClick={() => setEditMode((e) => !e)}
                style={{
                  background: editMode ? 'var(--accent)22' : 'var(--bg-card)',
                  border: `1px solid ${editMode ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: tokens.radius.md,
                  color: editMode ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '6px 12px',
                  letterSpacing: '0.03em',
                }}
              >
                {editMode ? '✓ Done Editing' : '✎ Edit Workout'}
              </button>
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.06em',
              padding: '3px 10px',
              borderRadius: tokens.radius.sm,
              background: accent + '22',
              color: accent,
              border: `1px solid ${accent}55`,
            }}
          >
            {day.tag}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
            }}
          >
            EXTRA SESSION
          </span>
          {completedDone && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: tokens.radius.sm,
                background: 'var(--phase-accum)22',
                color: 'var(--phase-accum)',
                border: '1px solid var(--phase-accum)55',
              }}
            >
              ✓ Done
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 21,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          {day.label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          {day.muscles}
        </div>
      </div>

      {/* ── EXERCISE CARDS ── */}
      <div style={{ padding: '12px 0 0' }}>
        {exercises.map((ex: Exercise, i: number) => (
          <div
            key={ex.id ? `${ex.id}-${i}` : i}
            style={{ borderBottom: '1px solid rgba(232,101,26,0.1)' }}
          >
            <ExerciseCard
              exercise={ex}
              exIdx={i}
              dayIdx={0}
              weekIdx={0}
              weekData={weekData}
              onUpdateSet={handleUpdateSet}
              onWeightAutoFill={handleWeightAutoFill}
              onLastSetFilled={handleLastSetFilled}
              expanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
              done={doneExercises.has(i)}
              readOnly={readOnly}
              onSwapClick={!readOnly ? () => setSwapTarget({ exIdx: i }) : () => {}}
              onSetLogged={handleSetLogged}
              bodyweight={parseFloat(profile?.weight || 0)}
              note={exNotes[i] || ''}
              onNoteChange={(val) => {
                const next = { ...exNotes, [i]: val };
                setExNotes(next);
                saveExtraExNotes(dateStr, next);
              }}
            />
          </div>
        ))}
      </div>

      {/* ── ADD EXERCISE ── */}
      {workoutStarted && !completedDone && (
        <div style={{ padding: '12px 16px' }}>
          <button
            onClick={() => setShowAddExercise(true)}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: tokens.radius.lg,
              cursor: 'pointer',
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border)',
              color: 'var(--text-muted)',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Exercise
          </button>
        </div>
      )}

      {/* ── COMPLETE BUTTON ── */}
      {workoutStarted && !completedDone && (
        <div style={{ padding: '8px 16px 16px' }}>
          <button
            onClick={() => openNoteReview()}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: tokens.radius.lg,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.04em',
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
            }}
          >
            Complete Workout
          </button>
        </div>
      )}

      {/* ── NOTE REVIEW STEP ── */}
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
              value={notes}
              onChange={(e) => handleNoteChange(e.target.value)}
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
              className="btn-primary"
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: tokens.radius.lg,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              Finish Session ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExtraDayView;
