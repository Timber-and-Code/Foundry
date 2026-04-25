import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FIXTURE_SESSION, PHASE_COLORS, type Exercise, type SetEntry } from '../forge-v2/fixtures';
import { ReorderSheetLite } from './ReorderSheetLite';

// Preview is kept behaviorally identical to FocusModePreview (single-exercise
// focus, progress strip, long-press reorder, auto-populated weight,
// progressive overload) but skinned with the *existing* Foundry theme —
// Inter body + Bebas display, warm-dark backgrounds, modest rounded corners,
// existing --accent / --phase-* tokens. No noise overlay, no heat haze.

const PROGRESSIVE_STEP = 5;

function targetWeightValue(target: string): number {
  const num = parseFloat(target.replace(/[^0-9.]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

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

// Lazy-initialized AudioContext for the alarm beep. Instantiated inside a
// user-gesture handler (logSet) so browser autoplay policy is satisfied.
let _audio: AudioContext | null = null;
function getAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_audio) return _audio;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    _audio = new Ctor();
    return _audio;
  } catch {
    return null;
  }
}

/** Fire a single alarm pulse: haptic + short beep. Loops externally. */
function fireAlarmPulse(heavy = false) {
  // Haptic — pattern mimics an iPhone alarm pulse. Works on Android/PWA;
  // iOS Safari ignores vibrate() but Capacitor haptics would fire in the
  // real native build.
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(heavy ? [180, 80, 180, 80, 260] : [140, 90, 140]);
    } catch {
      /* no-op */
    }
  }
  // Audio — two stacked sine beeps for that alarm character
  const ctx = getAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const beep = (offset: number, freq: number, dur: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(heavy ? 0.28 : 0.2, now + offset + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + offset + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + dur + 0.02);
  };
  beep(0, 880, 0.22);
  beep(0.28, 880, 0.22);
  if (heavy) beep(0.56, 1175, 0.24);
}

export default function FocusLitePreview() {
  const [session, setSession] = useState(FIXTURE_SESSION);
  const [currentIdx, setCurrentIdx] = useState(session.currentExerciseIdx);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  // Rest timer has two phases:
  //   'resting'  — countdown ticking toward zero, soft minimized UX
  //   'overtime' — countdown crossed zero, blocking ack sheet is shown and
  //                a counter ticks *upward* so the user sees how long
  //                they've been over. Haptic re-fires on entry + every 10s.
  const [restTimer, setRestTimer] = useState<
    | { phase: 'resting'; secondsLeft: number }
    | { phase: 'overtime'; secondsOver: number }
    | null
  >(null);
  const [now, setNow] = useState(Date.now());
  const [ringSetIdx, setRingSetIdx] = useState<number | null>(null);
  // When the lifter taps the check on a row with no reps entered, we hold
  // the set index here and surface a confirm sheet — "Record 0 reps?" —
  // instead of silently logging a placeholder. On confirm we log 0/0 and
  // jump to the next unfinished exercise (skip-this-exercise shortcut);
  // on cancel we drop the pending state and the row stays untouched.
  const [pendingZeroSet, setPendingZeroSet] = useState<number | null>(null);

  const phaseColor = PHASE_COLORS[session.phase];
  const currentExercise = session.exercises[currentIdx];

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Countdown tick — handles both resting and overtime phases, plus the
  // transition between them. Crossing zero auto-fires the alarm sequence.
  useEffect(() => {
    if (!restTimer) return;

    if (restTimer.phase === 'resting') {
      if (restTimer.secondsLeft <= 0) {
        // Hand off to overtime phase. Initial alarm pulse fires immediately.
        fireAlarmPulse();
        setRestTimer({ phase: 'overtime', secondsOver: 0 });
        return;
      }
      const id = window.setTimeout(
        () =>
          setRestTimer((r) =>
            r && r.phase === 'resting' ? { ...r, secondsLeft: r.secondsLeft - 1 } : r,
          ),
        1000,
      );
      return () => window.clearTimeout(id);
    }

    // overtime: tick the "seconds over" counter up and re-fire the alarm
    // pulse every ~1.4s to mimic an iPhone alarm cadence. Escalates after
    // 30s over with a heavier pulse pattern.
    const id = window.setTimeout(() => {
      setRestTimer((r) =>
        r && r.phase === 'overtime' ? { ...r, secondsOver: r.secondsOver + 1 } : r,
      );
    }, 1000);
    return () => window.clearTimeout(id);
  }, [restTimer]);

  // Alarm loop — separate from the 1s tick so pulse cadence is independent
  // of the counter display (pulse ~1.4s, escalates after 30s over).
  useEffect(() => {
    if (!restTimer || restTimer.phase !== 'overtime') return;
    const heavy = restTimer.secondsOver >= 30;
    const interval = heavy ? 900 : 1400;
    const id = window.setInterval(() => fireAlarmPulse(heavy), interval);
    return () => window.clearInterval(id);
  }, [restTimer]);

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

    const lockedWeight = s.weight || String(targetWeightValue(currentExercise.target));
    const lockedReps = s.reps || String(currentExercise.repHigh);
    const repsHitMax = parseInt(lockedReps, 10) >= currentExercise.repHigh;

    setSession((prev) => {
      const next = { ...prev, exercises: [...prev.exercises] };
      const ex = { ...next.exercises[currentIdx] };
      ex.sets = ex.sets.map((x, i) =>
        i === setIdx ? { ...x, done: true, weight: lockedWeight, reps: lockedReps } : x,
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
    // Sandbox-only: shortened to 15s so the alarm flow is quick to test.
    // Real app will pull the exercise's rest target (90–180s typical).
    setRestTimer({ phase: 'resting', secondsLeft: 15 });
    // First logSet also unlocks the AudioContext since this is the user
    // gesture that kicks off the rest timer whose alarm needs audio.
    const ctx = getAudio();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
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
    () =>
      session.exercises.map((ex, i) => {
        if (i === currentIdx) return 'current' as const;
        return exerciseStatus(ex) === 'done' ? ('done' as const) : ('upcoming' as const);
      }),
    [session.exercises, currentIdx],
  );

  const completedCount = session.exercises.filter((ex) => ex.sets.every((s) => s.done)).length;

  const firstActiveSetIdx = currentExercise.sets.findIndex((s) => !s.done);
  const activeSetIdx = firstActiveSetIdx === -1 ? null : firstActiveSetIdx;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--ff-body)',
        maxWidth: 480,
        margin: '0 auto',
        paddingBottom: 140,
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '16px 20px 14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-root)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          style={{
            justifySelf: 'start',
            fontSize: 13,
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ← Exit
        </button>
        <span
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 28,
            letterSpacing: '0.1em',
            color: 'var(--text-primary)',
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
            color: 'var(--accent)',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
              boxShadow: '0 0 6px var(--accent)',
              animation: 'hl-pulse 1.5s ease-in-out infinite',
            }}
          />
          {formatElapsed(session.startedAt, now)}
        </span>
      </div>

      {/* ── Session progress ── */}
      <div style={{ padding: '18px 20px 24px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 10,
            fontSize: 12,
            color: 'var(--text-secondary)',
            letterSpacing: '0.04em',
          }}
        >
          <span>Session Progress</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', fontWeight: 600 }}>
            {String(completedCount).padStart(2, '0')} / {String(session.exercises.length).padStart(2, '0')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, width: '100%' }}>
          {progressSegments.map((s, i) => {
            // Consistent segment convention across the app:
            //   done     → accent (orange) with soft glow
            //   current  → greyish-white, static (no animation)
            //   upcoming → darker grey
            const base: CSSProperties = {
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: 'var(--border-subtle)',
              cursor: 'pointer',
              transition: 'background 200ms',
            };
            if (s === 'done') {
              base.background = phaseColor;
              base.boxShadow = `0 0 6px ${phaseColor}80`;
            } else if (s === 'current') {
              base.background = 'var(--text-secondary)';
            }
            return (
              <div
                key={i}
                style={base}
                onClick={() => setCurrentIdx(i)}
                role="button"
                tabIndex={0}
                aria-label={`Jump to exercise ${i + 1}`}
              />
            );
          })}
        </div>
      </div>

      {/* ── Exercise focus block ── */}
      <div key={currentExercise.id} style={{ padding: '0 20px 24px 20px', animation: 'hl-rise 400ms ease-out both' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Exercise {currentIdx + 1} of {session.exercises.length}
        </div>
        <h2
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 36,
            lineHeight: 1,
            letterSpacing: '0.02em',
            color: 'var(--text-primary)',
            margin: 0,
            marginBottom: 10,
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
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1, minWidth: 0 }}>
            {currentExercise.setsTarget} sets · {currentExercise.repLow}–{currentExercise.repHigh} reps
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <ChipButton onClick={() => setInfoOpen(true)}>How to</ChipButton>
            <ChipButton onClick={() => setSwapOpen(true)}>Swap</ChipButton>
          </div>
        </div>

        {/* Target + last-week reference row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            background: 'var(--bg-card)',
            overflow: 'hidden',
          }}
        >
          <RefBlock label="Target" value={currentExercise.target} valueColor={phaseColor} />
          <RefBlock
            label="Last week"
            value={currentExercise.lastWeek}
            valueColor="var(--text-primary)"
            bordered
          />
        </div>
      </div>

      {/* ── Sets ledger ── */}
      <div style={{ padding: '0 20px 12px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 1fr 44px',
            gap: 10,
            padding: '6px 0',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            borderBottom: '1px solid var(--border-subtle)',
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
            ? 'linear-gradient(90deg, rgba(232,101,26,0.08) 0%, transparent 100%)'
            : isActive
            ? 'linear-gradient(90deg, rgba(232,101,26,0.12) 0%, transparent 100%)'
            : 'transparent';
          const numColor = isDone
            ? phaseColor
            : isActive
            ? 'var(--text-primary)'
            : 'var(--text-muted)';

          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 1fr 44px',
                gap: 10,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--border-subtle)',
                background: rowBg,
                position: 'relative',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--ff-display)',
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
                onClick={() => {
                  // Empty reps + transitioning to done → ask "Record 0?" first.
                  // Already done, or reps filled, fall through to the normal log path.
                  if (!isDone && (!set.reps || set.reps.trim() === '')) {
                    setPendingZeroSet(i);
                    return;
                  }
                  logSet(i);
                }}
                aria-label={isDone ? 'Unmark set' : 'Log set'}
                style={{
                  width: 36,
                  height: 36,
                  justifySelf: 'end',
                  border: isDone ? 'none' : '1px solid var(--border)',
                  borderRadius: 8,
                  background: isDone ? phaseColor : 'transparent',
                  color: isDone ? 'var(--bg-root)' : 'var(--text-muted)',
                  position: 'relative',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ✓
                {ringSetIdx === i && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: -2,
                      border: `2px solid ${phaseColor}`,
                      borderRadius: 10,
                      animation: 'hl-ring 0.6s ease-out both',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </button>
            </div>
          );
        })}

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
              fontSize: 13,
              color: 'var(--text-secondary)',
              gridColumn: '1 / span 3',
            }}
          >
            + Add set
          </span>
          <button
            onClick={addSet}
            aria-label="Add set"
            style={{
              width: 36,
              height: 36,
              justifySelf: 'end',
              border: '1px dashed var(--border)',
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 18,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* ── Notes strip ── */}
      <div style={{ padding: '12px 20px 20px 20px' }}>
        <button
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            fontSize: 13,
            color: 'var(--text-secondary)',
            fontFamily: 'inherit',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span aria-hidden style={{ fontSize: 14 }}>✎</span>
          Add note
        </button>
      </div>

      {/* ── Up Next card ── */}
      {upNextIdx !== null && (
        <div style={{ padding: '0 20px 20px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Up Next
          </div>
          <button
            onClick={() => setCurrentIdx(upNextIdx)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '14px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--ff-display)',
                  fontSize: 20,
                  letterSpacing: '0.02em',
                  color: 'var(--text-primary)',
                  lineHeight: 1.1,
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {session.exercises[upNextIdx].name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {session.exercises[upNextIdx].setsTarget} × {session.exercises[upNextIdx].repLow}–
                {session.exercises[upNextIdx].repHigh}
              </div>
            </div>
            <span aria-hidden style={{ color: 'var(--text-muted)', fontSize: 20 }}>›</span>
          </button>
        </div>
      )}

      {/* ── Rest panel (resting phase — soft minimized UX) ── */}
      {restTimer?.phase === 'resting' && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 96,
            left: 16,
            right: 16,
            maxWidth: 388,
            margin: '0 auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${phaseColor}`,
            borderRadius: 10,
            padding: '12px 16px',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            zIndex: 25,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'hl-slide-up 280ms ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rest</span>
            <span
              style={{
                fontFamily: 'var(--ff-display)',
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
              padding: '8px 14px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'transparent',
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 600,
            }}
          >
            Skip
          </button>
        </div>
      )}

      {/* ── Rest alarm (overtime — blocking acknowledgment) ── */}
      {restTimer?.phase === 'overtime' && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="hybrid-alarm-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              background: 'var(--bg-surface)',
              border: `2px solid ${phaseColor}`,
              borderRadius: 16,
              padding: '22px 20px 20px 20px',
              textAlign: 'center',
              fontFamily: 'var(--ff-body)',
              boxShadow: `0 18px 56px rgba(0,0,0,0.6), 0 0 0 8px ${phaseColor}22`,
              animation: 'hl-pulse-glow 1.4s ease-in-out infinite',
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.25em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Rest Complete
            </div>
            <h2
              id="hybrid-alarm-title"
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: 40,
                letterSpacing: '0.02em',
                color: 'var(--text-primary)',
                margin: '0 0 10px 0',
                lineHeight: 1,
              }}
            >
              Next Set
            </h2>
            <div
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: 22,
                color: phaseColor,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.04em',
                marginBottom: 18,
              }}
            >
              +{String(Math.floor(restTimer.secondsOver / 60)).padStart(2, '0')}:
              {String(restTimer.secondsOver % 60).padStart(2, '0')} over
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.4fr',
                gap: 10,
              }}
            >
              <button
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(0); } catch { /* no-op */ }
                  }
                  // Snooze = drop back into a 30s resting window. Alarm
                  // will re-fire when it hits zero again.
                  setRestTimer({ phase: 'resting', secondsLeft: 30 });
                }}
                style={{
                  height: 52,
                  borderRadius: 12,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--ff-body)',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                +30s
              </button>
              <button
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(0); } catch { /* no-op */ }
                  }
                  setRestTimer(null);
                }}
                style={{
                  height: 52,
                  borderRadius: 12,
                  background: phaseColor,
                  color: 'var(--bg-root)',
                  fontFamily: 'var(--ff-body)',
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: `0 6px 20px ${phaseColor}66`,
                }}
              >
                I'm Ready
              </button>
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                marginTop: 10,
                lineHeight: 1.4,
              }}
            >
              Alarm repeats until acknowledged
            </div>
          </div>
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
          background: 'linear-gradient(180deg, transparent 0%, var(--bg-root) 35%)',
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            margin: '0 auto',
            padding: '0 20px',
            display: 'grid',
            gridTemplateColumns: '40px 1fr 40px',
            gap: 10,
          }}
        >
          <NavSecondary onClick={goPrev} disabled={currentIdx === 0} label="Previous exercise">
            ‹
          </NavSecondary>
          <button
            onClick={() => setReorderOpen(true)}
            style={{
              height: 40,
              borderRadius: 10,
              background: 'var(--accent)',
              color: 'var(--bg-root)',
              fontFamily: 'var(--ff-body)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(232,101,26,0.3)',
            }}
          >
            Reorder
          </button>
          <NavSecondary onClick={goNext} disabled={currentIdx === session.exercises.length - 1} label="Next exercise">
            ›
          </NavSecondary>
        </div>
      </div>

      {reorderOpen && (
        <ReorderSheetLite
          exercises={session.exercises}
          currentIdx={currentIdx}
          dayTag={session.tag}
          onClose={() => setReorderOpen(false)}
          onApply={(next, nextIdx, scope) => {
            // Sandbox only applies to the current in-memory session either
            // way; real app will fan `scope === 'meso'` out to every
            // remaining occurrence of this day via generateProgram patch.
            setSession((s) => ({ ...s, exercises: next }));
            setCurrentIdx(nextIdx);
            setReorderOpen(false);
            // eslint-disable-next-line no-console
            console.info(`[forge-v2 preview] reorder applied, scope=${scope}`);
          }}
          onJump={(id) => {
            const idx = session.exercises.findIndex((x) => x.id === id);
            if (idx >= 0) setCurrentIdx(idx);
          }}
        />
      )}

      {infoOpen && (
        <MiniSheet title="How to" onClose={() => setInfoOpen(false)} accentColor={phaseColor}>
          <p style={{ margin: 0, marginBottom: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            Set up for {currentExercise.name.toLowerCase()} with a stable base and full range of motion.
            Drive through the target muscle, pause briefly at the peak, control the eccentric.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li>Brace before the first rep</li>
            <li>Match tempo across all sets</li>
            <li>Stop 1–2 reps short of failure on early sets</li>
          </ul>
          <div
            style={{
              marginTop: 16,
              padding: 14,
              border: '1px dashed var(--border)',
              borderRadius: 10,
              color: 'var(--text-muted)',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            Video cue placeholder
          </div>
        </MiniSheet>
      )}

      {swapOpen && (
        <MiniSheet title="Swap exercise" onClose={() => setSwapOpen(false)} accentColor={phaseColor}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Similar Movements
          </div>
          {[
            'Incline DB Press',
            'Machine Chest Press',
            'Pec Deck',
            'Low-to-High Cable Fly',
          ].map((name) => (
            <button
              key={name}
              onClick={() => {
                setSession((s) => {
                  const next = { ...s, exercises: [...s.exercises] };
                  next.exercises[currentIdx] = { ...next.exercises[currentIdx], name: name.toUpperCase() };
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
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--ff-display)',
                fontSize: 18,
                letterSpacing: '0.02em',
                cursor: 'pointer',
              }}
            >
              {name}
            </button>
          ))}
        </MiniSheet>
      )}

      {/* Empty-reps confirm — "Record 0 reps for this set?" Lifter chose to
          skip; we log 0/0, suppress the rest timer (no work, no recovery
          owed), and jump to the next unfinished exercise. */}
      {pendingZeroSet !== null && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="zero-reps-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setPendingZeroSet(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '22px 20px 18px',
              width: '100%',
              maxWidth: 320,
              fontFamily: 'var(--ff-body)',
            }}
          >
            <div
              id="zero-reps-title"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--text-primary)',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Record 0 reps for this set?
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                textAlign: 'center',
                marginBottom: 18,
              }}
            >
              We'll log it and jump to the next exercise. No rest timer.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setPendingZeroSet(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 10,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const setIdx = pendingZeroSet;
                  setPendingZeroSet(null);
                  // Log the set as 0/0 — empty weight implies skipped too.
                  setSession((prev) => {
                    const next = { ...prev, exercises: [...prev.exercises] };
                    const ex = { ...next.exercises[currentIdx] };
                    ex.sets = ex.sets.map((x, i) =>
                      i === setIdx ? { ...x, done: true, weight: '0', reps: '0' } : x,
                    );
                    next.exercises[currentIdx] = ex;
                    return next;
                  });
                  // No rest timer — they did no work.
                  setRestTimer(null);
                  // Auto-advance to the next unfinished exercise. If none
                  // remain, stay put — the session-complete UI takes over.
                  for (let j = currentIdx + 1; j < session.exercises.length; j++) {
                    if (!session.exercises[j].sets.every((s) => s.done)) {
                      setCurrentIdx(j);
                      return;
                    }
                  }
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 10,
                  background: phaseColor,
                  border: 'none',
                  color: 'var(--bg-root)',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Record 0
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RefBlock({
  label,
  value,
  valueColor,
  bordered,
}: {
  label: string;
  value: string;
  valueColor: string;
  bordered?: boolean;
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderLeft: bordered ? '1px solid var(--border-subtle)' : 'none',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 20,
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
    padding: '8px 0',
    color: done ? 'var(--text-secondary)' : 'var(--text-primary)',
    background: 'transparent',
    border: 'none',
    borderBottom: done
      ? '1px solid transparent'
      : focused
      ? '1px solid var(--accent)'
      : active
      ? '1px solid var(--border)'
      : '1px solid var(--border-subtle)',
    outline: 'none',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'var(--ff-body)',
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

function ChipButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 14px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--ff-body)',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        lineHeight: 1,
      }}
    >
      {children}
    </button>
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
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        height: 40,
        width: 40,
        borderRadius: 10,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)',
        color: disabled ? 'var(--border)' : 'var(--text-secondary)',
        fontSize: 20,
        lineHeight: 1,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function MiniSheet({
  title,
  onClose,
  accentColor,
  children,
}: {
  title: string;
  onClose: () => void;
  accentColor: string;
  children: ReactNode;
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
        background: 'var(--overlay)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
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
          maxWidth: 440,
          maxHeight: '75vh',
          background: 'var(--bg-surface)',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTop: `3px solid ${accentColor}`,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--ff-body)',
        }}
      >
        <div style={{ padding: '10px 0 14px 0' }}>
          <div
            aria-hidden
            style={{
              width: 36,
              height: 4,
              background: 'var(--border)',
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
              fontFamily: 'var(--ff-display)',
              fontSize: 22,
              letterSpacing: '0.02em',
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Close
          </button>
        </div>
        <div style={{ padding: '6px 20px 28px 20px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
