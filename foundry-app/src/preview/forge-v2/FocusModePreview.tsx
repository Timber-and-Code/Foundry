import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FIXTURE_SESSION, PHASE_COLORS, type Exercise, type SetEntry } from './fixtures';
import { StrikeTick } from './components/PhaseIndicator';
import { ReorderSheet } from './ReorderSheet';

function formatElapsed(startedAt: number, now: number) {
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function exerciseStatus(ex: Exercise): 'done' | 'current' | 'upcoming' {
  const allDone = ex.sets.every((s) => s.done);
  const someDone = ex.sets.some((s) => s.done);
  if (allDone) return 'done';
  if (someDone) return 'current';
  return 'upcoming';
}

/** Per-exercise progressive-overload step in lbs. Preview keeps this simple
 *  — real app derives it from equipment type (barbell 5lb, DB 2.5lb, etc). */
const PROGRESSIVE_STEP = 5;

/** Strip unit and coerce to number so we can auto-populate and increment. */
function targetWeightValue(target: string): number {
  const num = parseFloat(target.replace(/[^0-9.]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

export default function FocusModePreview() {
  const [session, setSession] = useState(FIXTURE_SESSION);
  const [currentIdx, setCurrentIdx] = useState(session.currentExerciseIdx);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [restTimer, setRestTimer] = useState<{ secondsLeft: number; totalSeconds: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [ringSetIdx, setRingSetIdx] = useState<number | null>(null);

  const phaseColor = PHASE_COLORS[session.phase];
  const currentExercise = session.exercises[currentIdx];

  // Auto-populate empty weights from the exercise target whenever the user
  // lands on a new exercise. Non-empty weights are left alone so in-flight
  // edits are never clobbered.
  useEffect(() => {
    setSession((s) => {
      const ex = s.exercises[currentIdx];
      if (!ex) return s;
      const base = targetWeightValue(ex.target);
      if (base === 0) return s;
      const needsFill = ex.sets.some((x) => !x.done && x.weight.trim() === '');
      if (!needsFill) return s;
      const next = { ...s, exercises: [...s.exercises] };
      next.exercises[currentIdx] = {
        ...ex,
        sets: ex.sets.map((x) =>
          !x.done && x.weight.trim() === '' ? { ...x, weight: String(base) } : x,
        ),
      };
      return next;
    });
  }, [currentIdx]);

  // Session timer tick
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Rest timer countdown
  useEffect(() => {
    if (!restTimer) return;
    if (restTimer.secondsLeft <= 0) {
      const t = window.setTimeout(() => setRestTimer(null), 400);
      return () => window.clearTimeout(t);
    }
    const id = window.setTimeout(
      () => setRestTimer((r) => (r ? { ...r, secondsLeft: r.secondsLeft - 1 } : null)),
      1000,
    );
    return () => window.clearTimeout(id);
  }, [restTimer]);

  const updateSet = (setIdx: number, patch: Partial<SetEntry>) => {
    setSession((s) => {
      const next = { ...s, exercises: [...s.exercises] };
      const ex = { ...next.exercises[currentIdx] };
      ex.sets = ex.sets.map((x, i) => (i === setIdx ? { ...x, ...patch } : x));
      next.exercises[currentIdx] = ex;
      return next;
    });
  };

  const logSet = (setIdx: number) => {
    const s = currentExercise.sets[setIdx];
    const willBeDone = !s.done;

    if (!willBeDone) {
      updateSet(setIdx, { done: false });
      setRestTimer(null);
      return;
    }

    // Locked-in values for the row being completed. Weight was already
    // auto-populated on mount; reps defaults to the high end of the range.
    const lockedWeight = s.weight || String(targetWeightValue(currentExercise.target));
    const lockedReps = s.reps || String(currentExercise.repHigh);
    const repsHitMax = parseInt(lockedReps, 10) >= currentExercise.repHigh;

    // Progressive overload: if the user hit max reps on this set, bump the
    // next *pending* set's weight up by one step so they train heavier next.
    setSession((prev) => {
      const next = { ...prev, exercises: [...prev.exercises] };
      const ex = { ...next.exercises[currentIdx] };
      ex.sets = ex.sets.map((x, i) =>
        i === setIdx
          ? { ...x, done: true, weight: lockedWeight, reps: lockedReps }
          : x,
      );
      if (repsHitMax) {
        const nextPendingIdx = ex.sets.findIndex((x, i) => i > setIdx && !x.done);
        if (nextPendingIdx >= 0) {
          const base = parseFloat(ex.sets[nextPendingIdx].weight || lockedWeight);
          if (Number.isFinite(base)) {
            ex.sets[nextPendingIdx] = {
              ...ex.sets[nextPendingIdx],
              weight: String(base + PROGRESSIVE_STEP),
            };
          }
        }
      }
      next.exercises[currentIdx] = ex;
      return next;
    });

    setRingSetIdx(setIdx);
    window.setTimeout(() => setRingSetIdx(null), 700);
    setRestTimer({ secondsLeft: 120, totalSeconds: 120 });
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        /* no-op */
      }
    }
  };

  const addSet = () => {
    setSession((s) => {
      const next = { ...s, exercises: [...s.exercises] };
      const ex = { ...next.exercises[currentIdx] };
      ex.sets = [...ex.sets, { weight: '', reps: '', rpe: '', done: false }];
      next.exercises[currentIdx] = ex;
      return next;
    });
  };

  const goPrev = () => setCurrentIdx((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIdx((i) => Math.min(session.exercises.length - 1, i + 1));

  const upNextIdx = useMemo(() => {
    for (let i = currentIdx + 1; i < session.exercises.length; i++) {
      if (!session.exercises[i].sets.every((s) => s.done)) return i;
    }
    return null;
  }, [currentIdx, session.exercises]);

  const progressSegments = useMemo(
    () => session.exercises.map((ex, i) => {
      if (i === currentIdx) return 'current' as const;
      return exerciseStatus(ex) === 'done' ? ('done' as const) : ('upcoming' as const);
    }),
    [session.exercises, currentIdx],
  );

  const completedCount = session.exercises.filter((ex) => ex.sets.every((s) => s.done)).length;

  const firstActiveSetIdx = currentExercise.sets.findIndex((s) => !s.done);
  const activeSetIdx = firstActiveSetIdx === -1 ? null : firstActiveSetIdx;

  return (
    <div style={{ position: 'relative', zIndex: 2, maxWidth: 480, margin: '0 auto', minHeight: '100vh' }}>
      {/* ── Top bar ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '18px 20px 16px 20px',
          borderBottom: '1px solid var(--fv-border-1)',
        }}
      >
        <button
          style={{
            justifySelf: 'start',
            fontSize: 10,
            letterSpacing: '0.3em',
            color: 'var(--fv-text-4)',
            textTransform: 'uppercase',
          }}
        >
          ← EXIT
        </button>
        <span
          style={{
            fontFamily: 'var(--fv-font-display)',
            fontSize: 26,
            letterSpacing: '0.12em',
            color: 'var(--fv-text-hi)',
            lineHeight: 1,
          }}
        >
          {session.name}
        </span>
        <span
          style={{
            justifySelf: 'end',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: 'var(--fv-accent)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.05em',
          }}
        >
          <span
            aria-hidden
            className="fv-pulse"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--fv-accent)',
              boxShadow: '0 0 6px var(--fv-accent)',
            }}
          />
          {formatElapsed(session.startedAt, now)}
        </span>
      </div>

      {/* ── Session progress ── */}
      <div style={{ padding: '18px 20px 28px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 10,
            fontSize: 10,
            letterSpacing: '0.3em',
            color: 'var(--fv-text-4)',
            textTransform: 'uppercase',
          }}
        >
          <span>Session Progress</span>
          <span style={{ color: 'var(--fv-text-3)', fontVariantNumeric: 'tabular-nums' }}>
            {String(completedCount).padStart(2, '0')} / {String(session.exercises.length).padStart(2, '0')}
          </span>
        </div>
        <StrikeTick
          segments={progressSegments}
          phaseColor={phaseColor}
          onSegmentTap={(i) => setCurrentIdx(i)}
        />
      </div>

      {/* ── Exercise focus block ── */}
      <div className="fv-rise" key={currentExercise.id} style={{ padding: '0 20px 28px 20px' }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.3em',
            color: 'var(--fv-text-5)',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Exercise {String(currentIdx + 1).padStart(2, '0')} of {String(session.exercises.length).padStart(2, '0')}
        </div>
        <h2
          style={{
            fontFamily: 'var(--fv-font-display)',
            fontSize: 44,
            lineHeight: 0.92,
            letterSpacing: '0.01em',
            color: 'var(--fv-text-hi)',
            margin: 0,
            marginBottom: 14,
          }}
        >
          {currentExercise.name}
        </h2>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'var(--fv-text-3)',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flex: 1,
              minWidth: 0,
            }}
          >
            <span>{currentExercise.setsTarget} Sets</span>
            <span style={{ color: 'var(--fv-border-3)' }}>/</span>
            <span>
              {currentExercise.repLow}–{currentExercise.repHigh} Reps
            </span>
            <span style={{ color: 'var(--fv-border-3)' }}>/</span>
            <span>RPE {String(currentExercise.rpeTarget).padStart(2, '0')}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <IconChip onClick={() => setInfoOpen(true)} label="How to perform exercise">
              HOW TO
            </IconChip>
            <IconChip onClick={() => setSwapOpen(true)} label="Swap exercise">
              SWAP
            </IconChip>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1px 1fr',
            border: '1px solid var(--fv-border-1)',
            background: 'var(--fv-surface-1)',
          }}
        >
          <ReferenceBlock label="Target" value={currentExercise.target} valueColor={phaseColor} />
          <div style={{ background: 'var(--fv-border-1)' }} />
          <ReferenceBlock label="Last Week" value={currentExercise.lastWeek} valueColor="var(--fv-text-2)" />
        </div>
      </div>

      {/* ── Sets ledger ── */}
      <div style={{ padding: '0 20px 18px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 1fr 44px',
            gap: 10,
            padding: '8px 0',
            fontSize: 9,
            letterSpacing: '0.3em',
            color: 'var(--fv-text-5)',
            textTransform: 'uppercase',
            borderBottom: '1px solid var(--fv-border-dim)',
          }}
        >
          <span>#</span>
          <span style={{ textAlign: 'center' }}>Lbs</span>
          <span style={{ textAlign: 'center' }}>Reps</span>
          <span />
        </div>

        {currentExercise.sets.map((set, i) => {
          const isActive = i === activeSetIdx;
          const isDone = set.done;
          const rowBg = isDone
            ? 'linear-gradient(90deg, rgba(232,101,26,0.05) 0%, transparent 100%)'
            : isActive
            ? 'linear-gradient(90deg, rgba(232,101,26,0.09) 0%, transparent 100%)'
            : 'transparent';
          const numColor = isDone ? phaseColor : isActive ? 'var(--fv-text-hi)' : 'var(--fv-text-5)';

          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 1fr 44px',
                gap: 10,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--fv-border-dim)',
                background: rowBg,
                position: 'relative',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--fv-font-display)',
                  fontSize: 20,
                  color: numColor,
                  letterSpacing: '0.02em',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <LedgerInput
                value={set.weight}
                onChange={(v) => updateSet(i, { weight: v })}
                done={isDone}
                active={isActive}
              />
              <LedgerInput
                value={set.reps}
                onChange={(v) => updateSet(i, { reps: v })}
                done={isDone}
                active={isActive}
              />
              <button
                onClick={() => logSet(i)}
                aria-label={isDone ? 'Unmark set' : 'Log set'}
                style={{
                  width: 36,
                  height: 36,
                  justifySelf: 'end',
                  border: `1px solid ${isDone ? phaseColor : 'var(--fv-border-3)'}`,
                  background: isDone ? phaseColor : 'transparent',
                  color: isDone ? 'var(--fv-bg-deep)' : 'var(--fv-text-6)',
                  position: 'relative',
                  fontSize: 14,
                }}
              >
                {isDone ? '✓' : '✓'}
                {ringSetIdx === i && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: -2,
                      border: `2px solid ${phaseColor}`,
                      animation: 'fv-ring 0.6s ease-out both',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </button>
            </div>
          );
        })}

        {/* Add set */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 1fr 44px',
            gap: 10,
            alignItems: 'center',
            padding: '14px 0 6px 0',
          }}
        >
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.3em',
              color: 'var(--fv-text-4)',
              textTransform: 'uppercase',
              gridColumn: '1 / span 3',
            }}
          >
            + Add Set
          </span>
          <button
            onClick={addSet}
            aria-label="Add set"
            style={{
              width: 36,
              height: 36,
              justifySelf: 'end',
              border: '1px dashed var(--fv-border-3)',
              color: 'var(--fv-text-4)',
              fontSize: 16,
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* ── Notes strip ── */}
      <div style={{ padding: '0 20px 24px 20px' }}>
        <button
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 14px',
            background: 'var(--fv-surface-1)',
            border: '1px solid var(--fv-border-1)',
            fontSize: 10,
            letterSpacing: '0.3em',
            color: 'var(--fv-text-4)',
            textTransform: 'uppercase',
          }}
        >
          <span aria-hidden style={{ fontSize: 12 }}>✎</span>
          Add Note
        </button>
      </div>

      {/* ── Up Next card ── */}
      {upNextIdx !== null && (
        <div style={{ padding: '0 20px 140px 20px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: 'var(--fv-text-5)', textTransform: 'uppercase', marginBottom: 8 }}>
            Up Next
          </div>
          <button
            onClick={() => setCurrentIdx(upNextIdx)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '14px 16px',
              background: 'var(--fv-surface-2)',
              border: '1px solid var(--fv-border-1)',
              borderLeft: '2px solid var(--fv-border-3)',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--fv-font-display)',
                  fontSize: 20,
                  letterSpacing: '0.02em',
                  color: 'var(--fv-text-2)',
                  lineHeight: 1,
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {session.exercises[upNextIdx].name}
              </div>
              <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'var(--fv-text-5)', textTransform: 'uppercase' }}>
                {session.exercises[upNextIdx].setsTarget} × {session.exercises[upNextIdx].repLow}–
                {session.exercises[upNextIdx].repHigh} · RPE{' '}
                {String(session.exercises[upNextIdx].rpeTarget).padStart(2, '0')}
              </div>
            </div>
            <span aria-hidden style={{ color: 'var(--fv-text-5)', fontSize: 20 }}>›</span>
          </button>
        </div>
      )}

      {/* ── Rest panel ── */}
      {restTimer && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 92,
            left: 16,
            right: 16,
            maxWidth: 388,
            margin: '0 auto',
            background: 'linear-gradient(180deg, #1a1412 0%, #0f0c0b 100%)',
            border: '1px solid var(--fv-border-1)',
            borderLeft: `2px solid ${phaseColor}`,
            padding: '14px 16px',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            zIndex: 25,
            animation: 'fv-slide-up 300ms ease-out',
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), -12px 0 16px -8px ${phaseColor}66`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.3em',
                color: 'var(--fv-text-4)',
                textTransform: 'uppercase',
              }}
            >
              Rest
            </span>
            <span
              style={{
                fontFamily: 'var(--fv-font-display)',
                fontSize: 28,
                color: phaseColor,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
              }}
            >
              {String(Math.floor(restTimer.secondsLeft / 60)).padStart(2, '0')}:
              {String(restTimer.secondsLeft % 60).padStart(2, '0')}
            </span>
          </div>
          <button
            onClick={() => setRestTimer(null)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--fv-border-3)',
              fontSize: 10,
              letterSpacing: '0.3em',
              color: 'var(--fv-text-3)',
              textTransform: 'uppercase',
            }}
          >
            Skip
          </button>
        </div>
      )}

      {/* ── Bottom nav ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          paddingTop: 40,
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0))',
          background: 'linear-gradient(180deg, transparent 0%, var(--fv-bg-deep) 35%)',
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            margin: '0 auto',
            padding: '0 20px',
            display: 'grid',
            gridTemplateColumns: '48px 1fr 48px',
            gap: 10,
          }}
        >
          <NavSecondary onClick={goPrev} disabled={currentIdx === 0} label="Previous exercise">
            ‹
          </NavSecondary>
          <button
            onClick={() => setReorderOpen(true)}
            style={{
              height: 48,
              background: phaseColor,
              color: 'var(--fv-bg-deep)',
              fontFamily: 'var(--fv-font-display)',
              fontSize: 16,
              letterSpacing: '0.08em',
              boxShadow: `0 0 28px ${phaseColor}55`,
            }}
          >
            REORDER
          </button>
          <NavSecondary onClick={goNext} disabled={currentIdx === session.exercises.length - 1} label="Next exercise">
            ›
          </NavSecondary>
        </div>
      </div>

      {reorderOpen && (
        <ReorderSheet
          exercises={session.exercises}
          currentIdx={currentIdx}
          phaseColor={phaseColor}
          onClose={() => setReorderOpen(false)}
          onApply={(next, nextIdx) => {
            setSession((s) => ({ ...s, exercises: next }));
            setCurrentIdx(nextIdx);
            setReorderOpen(false);
          }}
          onJump={(id) => {
            const idx = session.exercises.findIndex((x) => x.id === id);
            if (idx >= 0) setCurrentIdx(idx);
          }}
        />
      )}

      {infoOpen && (
        <MiniSheet title="How to" onClose={() => setInfoOpen(false)} phaseColor={phaseColor}>
          <p style={{ margin: 0, marginBottom: 12, color: 'var(--fv-text-2)', lineHeight: 1.5 }}>
            Set up for {currentExercise.name.toLowerCase()} with a stable base and full range of motion.
            Drive through the target muscle, pause briefly at the peak contraction, and control the
            eccentric.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--fv-text-3)', lineHeight: 1.6 }}>
            <li>Brace before the first rep</li>
            <li>Match tempo across all sets</li>
            <li>Stop 1–2 reps short of failure on early sets</li>
          </ul>
          <div
            style={{
              marginTop: 16,
              padding: 12,
              border: '1px dashed var(--fv-border-2)',
              color: 'var(--fv-text-4)',
              fontSize: 10,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            Video cue placeholder
          </div>
        </MiniSheet>
      )}

      {swapOpen && (
        <MiniSheet title="Swap exercise" onClose={() => setSwapOpen(false)} phaseColor={phaseColor}>
          <div style={{ fontSize: 10, letterSpacing: '0.25em', color: 'var(--fv-text-4)', textTransform: 'uppercase', marginBottom: 10 }}>
            Similar Movements
          </div>
          {[
            'INCLINE DB PRESS',
            'MACHINE CHEST PRESS',
            'PEC DECK',
            'LOW-TO-HIGH CABLE FLY',
          ].map((name) => (
            <button
              key={name}
              onClick={() => {
                setSession((s) => {
                  const next = { ...s, exercises: [...s.exercises] };
                  next.exercises[currentIdx] = { ...next.exercises[currentIdx], name };
                  return next;
                });
                setSwapOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                marginBottom: 6,
                border: '1px solid var(--fv-border-1)',
                background: 'var(--fv-surface-1)',
                color: 'var(--fv-text-1)',
                fontFamily: 'var(--fv-font-display)',
                fontSize: 16,
                letterSpacing: '0.02em',
              }}
            >
              {name}
            </button>
          ))}
        </MiniSheet>
      )}
    </div>
  );
}

function ReferenceBlock({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div style={{ padding: '14px 16px' }}>
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.3em',
          color: 'var(--fv-text-5)',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--fv-font-display)',
          fontSize: 18,
          letterSpacing: '0.02em',
          color: valueColor,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LedgerInput({
  value,
  onChange,
  done,
  active,
}: {
  value: string;
  onChange: (v: string) => void;
  done: boolean;
  active: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const style: CSSProperties = {
    width: '100%',
    textAlign: 'center',
    fontSize: 15,
    padding: '6px 0',
    color: done ? 'var(--fv-text-3)' : 'var(--fv-text-1)',
    borderBottom: done
      ? '1px solid transparent'
      : focused
      ? `1px solid var(--fv-accent)`
      : active
      ? '1px solid var(--fv-border-3)'
      : '1px solid var(--fv-border-2)',
    fontVariantNumeric: 'tabular-nums',
  };
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      inputMode="decimal"
      placeholder="—"
      readOnly={done}
      style={style}
    />
  );
}

function IconChip({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        padding: '6px 10px',
        border: '1px solid var(--fv-border-2)',
        background: 'var(--fv-surface-1)',
        color: 'var(--fv-text-2)',
        fontFamily: 'var(--fv-font-ui)',
        fontSize: 10,
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

function MiniSheet({
  title,
  onClose,
  phaseColor,
  children,
}: {
  title: string;
  onClose: () => void;
  phaseColor: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'fv-rise 200ms ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          margin: '0 auto',
          maxWidth: 420,
          maxHeight: '75vh',
          background: 'linear-gradient(180deg, #1a1412 0%, #0f0c0b 100%)',
          borderTop: `2px solid ${phaseColor}`,
          display: 'flex',
          flexDirection: 'column',
          animation: 'fv-slide-up 300ms ease-out',
        }}
      >
        <div style={{ padding: '10px 0 14px 0' }}>
          <div
            aria-hidden
            style={{
              width: 36,
              height: 3,
              background: 'var(--fv-border-3)',
              margin: '0 auto',
              borderRadius: 2,
            }}
          />
        </div>
        <div
          style={{
            padding: '0 20px 10px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--fv-font-display)',
              fontSize: 22,
              letterSpacing: '0.02em',
              margin: 0,
              color: 'var(--fv-text-hi)',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              fontSize: 10,
              letterSpacing: '0.3em',
              color: 'var(--fv-text-3)',
              textTransform: 'uppercase',
            }}
          >
            CLOSE
          </button>
        </div>
        <div style={{ padding: '6px 20px 28px 20px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

function NavSecondary({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        height: 48,
        width: 48,
        border: '1px solid var(--fv-border-2)',
        background: 'var(--fv-surface-2)',
        color: disabled ? 'var(--fv-border-3)' : 'var(--fv-text-3)',
        fontSize: 24,
        lineHeight: 1,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
