import React from 'react';
import { haptic } from '../../utils/helpers';
import { tokens } from '../../styles/tokens';

interface CardioIntervalTimerProps {
  protocol: any;
  onComplete: () => void;
  onDismiss: () => void;
}

function CardioIntervalTimer({ protocol, onComplete, onDismiss }: CardioIntervalTimerProps) {
  const { intervals, label } = protocol;
  const { workSecs, restSecs, rounds } = intervals;

  const [phase, setPhase] = React.useState('work'); // "work" | "rest" | "done"
  const [round, setRound] = React.useState(1);
  const [remaining, setRemaining] = React.useState(workSecs);
  const [minimized, setMinimized] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const WORK_COLOR = tokens.colors.cardioHard;
  const REST_COLOR = tokens.colors.gold;
  const DONE_COLOR = tokens.colors.textPrimary;

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
      setRemaining((prev: any) => {
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
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed',
          bottom: 64,
          left: 0,
          right: 0,
          zIndex: 225,
          background: ringColor,
          borderTop: `3px solid ${ringColor}`,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: `${barPct * 100}%`,
            background: 'rgba(0,0,0,0.28)',
            transition: 'width 1s linear',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: tokens.colors.overlayMed,
                fontVariantNumeric: 'tabular-nums',
                minWidth: 54,
                lineHeight: 1,
              }}
            >
              {phase === 'done' ? 'DONE!' : timeStr}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: tokens.colors.overlayMed,
                  lineHeight: 1,
                }}
              >
                {phase === 'done' ? 'All rounds complete' : phase === 'work' ? 'WORK' : 'REST'}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: tokens.colors.overlayMed,
                  lineHeight: 1,
                }}
              >
                {phase === 'done' ? label : `Round ${round} of ${rounds}`}
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: 'rgba(0,0,0,0.65)',
              background: 'rgba(0,0,0,0.15)',
              border: '1px solid rgba(0,0,0,0.2)',
              borderRadius: tokens.radius.md,
              padding: '7px 12px',
              whiteSpace: 'nowrap',
            }}
          >
            {phase === 'done' ? 'LOG IT \u2191' : 'EXPAND \u2191'}
          </div>
        </div>
      </div>
    );
  }

  // ── FULL MODAL ──
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 225,
        background: tokens.colors.overlayHeavy,
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: `1px solid ${ringColor}44`,
          borderRadius: tokens.radius.xxl,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          width: '100%',
          maxWidth: 340,
          padding: '36px 28px 28px',
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
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.md,
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
            }}
          >
            MINIMIZE &darr;
          </button>
        )}

        {/* Phase label */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: phase === 'done' ? DONE_COLOR : ringColor,
            marginBottom: 20,
            transition: 'color 0.3s',
          }}
        >
          {phase === 'done' ? 'ALL ROUNDS COMPLETE' : phase === 'work' ? 'WORK' : 'REST'}
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
                  fontSize: 48,
                  fontWeight: 900,
                  color: DONE_COLOR,
                  lineHeight: 1,
                }}
              >
                &#10003;
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 54,
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {timeStr}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  {mins > 0 ? 'min' : 'sec'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Round counter */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            marginBottom: 6,
          }}
        >
          {phase === 'done' ? label : `Round ${round} of ${rounds}`}
        </div>

        {/* Round pips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {Array.from({ length: rounds }, (_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
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
            className="btn-primary"
            style={{
              width: '100%',
              padding: '16px',
              fontSize: 14,
              fontWeight: 800,
              borderRadius: tokens.radius.xl,
              cursor: 'pointer',
              letterSpacing: '0.04em',
              background: DONE_COLOR,
              border: `1px solid ${DONE_COLOR}`,
              color: '#000',
            }}
          >
            LOG SESSION &#10003;
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              onClick={onDismiss}
              style={{
                flex: 1,
                padding: '14px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: tokens.radius.xl,
                cursor: 'pointer',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
              }}
            >
              STOP
            </button>
            <button
              onClick={handleSkip}
              style={{
                flex: 2,
                padding: '14px',
                fontSize: 13,
                fontWeight: 800,
                borderRadius: tokens.radius.xl,
                cursor: 'pointer',
                background: `${ringColor}22`,
                border: `1px solid ${ringColor}55`,
                color: ringColor,
                letterSpacing: '0.04em',
              }}
            >
              SKIP {phase === 'work' ? 'TO REST \u2192' : 'TO WORK \u2192'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CardioIntervalTimer;
