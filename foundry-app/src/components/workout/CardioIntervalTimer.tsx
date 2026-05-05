import React from 'react';
import { haptic } from '../../utils/helpers';
import { tokens } from '../../styles/tokens';

interface CardioIntervalTimerProps {
  protocol: { label: string; intervals?: { workSecs: number; restSecs: number; rounds: number } };
  onComplete: () => void;
  onDismiss: () => void;
}

/**
 * HIIT/Tabata interval timer. Renders an SVG progress ring + per-phase
 * digit display, alternating WORK / REST until rounds are exhausted.
 *
 * Visual chrome was restyled (Bundle E / 2.8.0) to match the minimal
 * aesthetic shared by MinimizedTimerBar and ActiveSessionBar:
 *   - Solid `var(--bg-root)` backgrounds (no blur / translucent layers
 *     that bleed underlying content — see ActiveSessionBar lesson).
 *   - Bebas Neue display font on the digit string.
 *   - tokens.fontFamily.mono for the small "Round N of M" count.
 *   - Tokens drive every color (var(--accent), var(--text-primary),
 *     etc.) — no hardcoded hex.
 *
 * The ring/state-machine logic is preserved verbatim: same R=72, same
 * dash math, same haptic('tap')/haptic('complete') triggers.
 */
function CardioIntervalTimer({ protocol, onComplete, onDismiss }: CardioIntervalTimerProps) {
  const { intervals, label } = protocol;
  const { workSecs, restSecs, rounds } = intervals!;

  const [phase, setPhase] = React.useState('work'); // "work" | "rest" | "done"
  const [round, setRound] = React.useState(1);
  const [remaining, setRemaining] = React.useState(workSecs);
  const [minimized, setMinimized] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Phase ring color: WORK uses the brand accent (orange), REST uses
  // gold (mobility/cardio-rest token), DONE settles on text-primary.
  // These are the only color values that vary by state — everything
  // else is solid token chrome.
  const WORK_COLOR = 'var(--accent)';
  const REST_COLOR = tokens.colors.gold;
  const DONE_COLOR = 'var(--text-primary)';

  const ringColor = phase === 'done' ? DONE_COLOR : phase === 'work' ? WORK_COLOR : REST_COLOR;
  const total = phase === 'work' ? workSecs : phase === 'rest' ? restSecs : 1;
  const pct = phase === 'done' ? 1 : remaining / total;
  const R = 72;
  const CIRC = 2 * Math.PI * R;
  const dash = CIRC * pct;
  const gap = CIRC - dash;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr =
    mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${String(secs).padStart(2, '0')}`;

  // ── Tick ──
  React.useEffect(() => {
    if (phase === 'done') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((prev: number) => {
        if (prev <= 1) {
          if (phase === 'work') {
            haptic('tap');
            setPhase('rest');
            return restSecs;
          } else {
            if (round >= rounds) {
              haptic('complete');
              setPhase('done');
              return 0;
            } else {
              haptic('tap');
              setRound((r) => r + 1);
              setPhase('work');
              return workSecs;
            }
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, round]);

  const handleSkip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (phase === 'work') {
      if (round >= rounds) {
        setPhase('done');
        setRemaining(0);
      } else {
        setPhase('rest');
        setRemaining(restSecs);
      }
    } else {
      setRound((r) => r + 1);
      setPhase('work');
      setRemaining(workSecs);
    }
  };

  const handleDone = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onComplete();
  };

  // ── MINIMIZED BAR ──
  if (minimized) {
    const barPct = phase === 'done' ? 1 : 1 - remaining / total;
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Interval timer minimized · ${phase === 'done' ? 'Complete' : timeStr}. Tap to expand.`}
        onClick={() => setMinimized(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setMinimized(false);
          }
        }}
        style={{
          position: 'fixed',
          bottom: 80,
          left: 16,
          right: 16,
          maxWidth: 388,
          margin: '0 auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${ringColor}`,
          borderRadius: tokens.radius.md,
          padding: '12px 16px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          gap: 10,
          zIndex: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Subtle progress fill — solid bg, no translucent gradients */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${barPct * 100}%`,
            background: 'var(--bg-inset)',
            transition: 'width 1s linear',
            zIndex: 0,
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            textAlign: 'left',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {phase === 'done' ? 'Done' : phase === 'work' ? 'Work' : 'Rest'}
          </span>
          <span
            aria-live="polite"
            style={{
              fontFamily: tokens.fontFamily.display,
              fontSize: 28,
              color: ringColor,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.02em',
              fontWeight: 400,
              lineHeight: 1,
            }}
          >
            {phase === 'done' ? 'DONE' : timeStr}
          </span>
          <span
            style={{
              fontFamily: tokens.fontFamily.mono,
              fontSize: 11,
              color: 'var(--text-muted)',
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            {phase === 'done' ? label : `R${round}/${rounds}`}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {phase === 'done' ? 'Log ↑' : 'Expand ↑'}
        </span>
      </div>
    );
  }

  // ── FULL MODAL ──
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cardio-interval-phase"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 225,
        background: 'var(--bg-root)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--bg-root)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.xl,
          width: '100%',
          maxWidth: 360,
          padding: '32px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          position: 'relative',
        }}
      >
        {/* Minimize */}
        {phase !== 'done' && (
          <button
            onClick={() => setMinimized(true)}
            aria-label="Minimize interval timer"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.sm,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'inherit',
            }}
          >
            Minimize
          </button>
        )}

        {/* Phase label */}
        <div
          id="cardio-interval-phase"
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.18em',
            color: phase === 'done' ? DONE_COLOR : ringColor,
            marginBottom: 24,
            textTransform: 'uppercase',
            transition: 'color 0.3s',
          }}
        >
          {phase === 'done' ? 'All Rounds Complete' : phase === 'work' ? 'Work' : 'Rest'}
        </div>

        {/* Ring */}
        <div
          style={{
            position: 'relative',
            width: 168,
            height: 168,
            marginBottom: 16,
          }}
        >
          <svg width="168" height="168" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="84" cy="84" r={R} fill="none" stroke="var(--bg-inset)" strokeWidth="8" />
            <circle
              cx="84"
              cy="84"
              r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              style={{ transition: 'stroke-dasharray 1s linear, stroke 0.4s' }}
            />
          </svg>
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {phase === 'done' ? (
              <div
                style={{
                  fontFamily: tokens.fontFamily.display,
                  fontSize: 56,
                  color: DONE_COLOR,
                  lineHeight: 1,
                  fontWeight: 400,
                  letterSpacing: '0.02em',
                }}
              >
                &#10003;
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: tokens.fontFamily.display,
                    fontSize: 56,
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                    letterSpacing: '0.02em',
                    fontWeight: 400,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {timeStr}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    marginTop: 4,
                  }}
                >
                  {mins > 0 ? 'min' : 'sec'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Round counter — JetBrains-mono-style monospace for readability */}
        <div
          style={{
            fontFamily: tokens.fontFamily.mono,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 8,
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {phase === 'done' ? label : `Round ${round} of ${rounds}`}
        </div>

        {/* Round pips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }} aria-hidden="true">
          {Array.from({ length: rounds }, (_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: tokens.radius.full,
                background:
                  i < round - 1
                    ? DONE_COLOR
                    : i === round - 1 && phase !== 'done'
                      ? ringColor
                      : i < round
                        ? DONE_COLOR
                        : 'var(--bg-inset)',
                border: `1px solid ${i === round - 1 && phase !== 'done' ? ringColor : 'transparent'}`,
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* Actions */}
        {phase === 'done' ? (
          <button
            onClick={handleDone}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: 13,
              fontWeight: 800,
              borderRadius: tokens.radius.md,
              cursor: 'pointer',
              letterSpacing: '0.08em',
              background: 'var(--accent)',
              border: '1px solid var(--accent)',
              color: 'var(--bg-root)',
              fontFamily: 'inherit',
              textTransform: 'uppercase',
            }}
          >
            Log Session &#10003;
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              onClick={onDismiss}
              style={{
                flex: 1,
                padding: '14px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: tokens.radius.md,
                cursor: 'pointer',
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                fontFamily: 'inherit',
                textTransform: 'uppercase',
              }}
            >
              Stop
            </button>
            <button
              onClick={handleSkip}
              style={{
                flex: 2,
                padding: '14px',
                fontSize: 12,
                fontWeight: 800,
                borderRadius: tokens.radius.md,
                cursor: 'pointer',
                background: 'transparent',
                border: `1px solid ${ringColor}`,
                color: ringColor,
                letterSpacing: '0.08em',
                fontFamily: 'inherit',
                textTransform: 'uppercase',
              }}
            >
              Skip {phase === 'work' ? 'to Rest →' : 'to Work →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CardioIntervalTimer;
