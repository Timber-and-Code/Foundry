import React from 'react';
import { loadMobilitySession, saveMobilitySession } from '../../utils/store';
import { MOBILITY_PROTOCOLS } from '../../data/constants';
import { haptic } from '../../utils/helpers';
import { tokens } from '../../styles/tokens';

interface MobilitySessionViewProps {
  dateStr: string;
  onBack: () => void;
  profile: any;
}

function MobilitySessionView({ dateStr, onBack, profile: _profile }: MobilitySessionViewProps) {
  const MOBILITY_COLOR = tokens.colors.gold; // warm gold — forge palette

  const displayDate = (() => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  })();

  // ── Session state ─────────────────────────────────────────────────────────
  const [session, setSession] = React.useState(
    () =>
      loadMobilitySession(dateStr) || {
        protocolId: null,
        completedAt: null,
        completed: false,
      }
  );

  const save = (updates: Record<string, unknown>) => {
    const next = { ...session, ...updates };
    setSession(next);
    saveMobilitySession(dateStr, next);
  };

  // ── Timer state ───────────────────────────────────────────────────────────
  // exerciseIdx = which exercise in the sequence (null = protocol selection screen)
  // sidePhase: "left" | "right" | "both" (for sides: true exercises)
  // holdPhase: "intro" = ready-up screen | "holding" = countdown running
  // timerActive = countdown running
  const [exerciseIdx, setExerciseIdx] = React.useState<number | null>(null);
  const [sidePhase, setSidePhase] = React.useState('left');
  const [holdPhase, setHoldPhase] = React.useState('intro');
  const [remaining, setRemaining] = React.useState(0);
  const [timerActive, setTimerActive] = React.useState(false);
  const [showComplete, setShowComplete] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const proto: any = session.protocolId
    ? MOBILITY_PROTOCOLS.find((p: any) => p.id === session.protocolId)
    : null;

  // ── Timer tick ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!timerActive) {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current !== null) clearInterval(intervalRef.current);
          setTimerActive(false);
          haptic('done');
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current !== null) clearInterval(intervalRef.current); };
  }, [timerActive]);

  // ── Start a hold (user tapped "I'm Ready") ────────────────────────────────
  const startHold = (ex: { hold: number }) => {
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    setRemaining(ex.hold);
    setTimerActive(true);
    setHoldPhase('holding');
    haptic('tap');
  };

  // ── Navigate to exercise — always lands on intro first ───────────────────
  const goToExercise = (idx: number) => {
    if (!proto || idx >= proto.exercises.length) return;
    const ex = proto.exercises[idx];
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    setTimerActive(false);
    setRemaining(0);
    setExerciseIdx(idx);
    setSidePhase(ex.sides ? 'left' : 'both');
    setHoldPhase('intro');
  };

  // ── Advance: next side or next exercise ──────────────────────────────────
  const handleNext = () => {
    if (!proto || exerciseIdx === null) return;
    const ex = proto.exercises[exerciseIdx];
    // If sides exercise and we just did the left side, go to right side intro
    if (ex.sides && sidePhase === 'left') {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      setTimerActive(false);
      setRemaining(0);
      setSidePhase('right');
      setHoldPhase('intro');
      return;
    }
    // Move to next exercise
    const nextIdx = exerciseIdx + 1;
    if (nextIdx >= proto.exercises.length) {
      // Session complete
      const now = Date.now();
      save({ completed: true, completedAt: now });
      haptic('victory');
      setShowComplete(true);
      return;
    }
    goToExercise(nextIdx);
  };

  // ── Ring math (mirrors rest timer) ───────────────────────────────────────
  const holdTotal = proto && exerciseIdx !== null ? proto.exercises[exerciseIdx].hold : 1;
  const R = 72;
  const CIRC = 2 * Math.PI * R;
  const pct = holdTotal > 0 ? remaining / holdTotal : 0;
  const dash = CIRC * pct;
  const gap = CIRC - dash;
  const ringColor = remaining === 0 ? MOBILITY_COLOR : pct > 0.25 ? MOBILITY_COLOR : '#a07733';

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr =
    mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${String(secs).padStart(2, '0')}`;

  // ── Completed session screen ──────────────────────────────────────────────
  if (showComplete || session.completed) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-root)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            onClick={onBack}
            aria-label="Go back"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 20,
              padding: 0,
              lineHeight: 1,
            }}
          >
            <span aria-hidden="true">←</span>
          </button>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Mobility
          </span>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            textAlign: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
            }}
          >
            Session Complete
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              maxWidth: 280,
            }}
          >
            {proto ? proto.name : 'Mobility'} — well done. Your body will thank you for this.
          </div>
          <button
            onClick={onBack}
            className="btn-primary"
            style={{
              marginTop: 8,
              padding: '14px 36px',
              borderRadius: tokens.radius.lg,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Active exercise screen (intro OR holding) ─────────────────────────────
  if (proto && exerciseIdx !== null) {
    const ex = proto.exercises[exerciseIdx];
    const sideLabel = ex.sides ? (sidePhase === 'left' ? 'LEFT SIDE' : 'RIGHT SIDE') : null;
    // Progress dots
    const totalSteps = proto.exercises.reduce((acc: any, e: any) => acc + (e.sides ? 2 : 1), 0);
    const doneSteps =
      proto.exercises.slice(0, exerciseIdx).reduce((acc: any, e: any) => acc + (e.sides ? 2 : 1), 0) +
      (ex.sides && sidePhase === 'right' ? 1 : 0);
    const progressLabel = `${exerciseIdx + 1} of ${proto.exercises.length}`;

    // ── INTRO SCREEN — get into position ────────────────────────────────────
    if (holdPhase === 'intro') {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: 'var(--bg-root)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderBottom: '1px solid var(--border)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <button
              onClick={() => {
                if (intervalRef.current !== null) clearInterval(intervalRef.current);
                setTimerActive(false);
                setExerciseIdx(null);
              }}
              aria-label="Back to protocols"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                padding: 0,
              }}
            >
              <span aria-hidden="true">←</span> Protocols
            </button>
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              {proto.emoji} {progressLabel.toUpperCase()}
            </span>
          </div>

          {/* Progress bar */}
          <div
            role="progressbar"
            aria-valuenow={Math.round((doneSteps / totalSteps) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Exercise ${exerciseIdx + 1} of ${proto.exercises.length}`}
            style={{ height: 3, background: 'var(--bg-inset)' }}
          >
            <div
              style={{
                height: '100%',
                background: MOBILITY_COLOR,
                width: `${(doneSteps / totalSteps) * 100}%`,
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '28px 20px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              maxWidth: 480,
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* Side label + exercise name */}
            <div style={{ textAlign: 'center' }}>
              {sideLabel && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    color: MOBILITY_COLOR,
                    marginBottom: 8,
                  }}
                >
                  {sideLabel}
                </div>
              )}
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: 'var(--text-primary)',
                  lineHeight: 1.15,
                  marginBottom: 4,
                }}
              >
                {ex.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                {ex.hold}s hold{ex.sides ? ' each side' : ''}
              </div>
            </div>

            {/* Cue */}
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.xl,
                padding: '16px 18px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: MOBILITY_COLOR,
                  marginBottom: 8,
                }}
              >
                HOW TO GET INTO POSITION
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.75,
                }}
              >
                {ex.cue}
              </div>
            </div>

            {/* Feel */}
            <div
              style={{
                background: 'var(--bg-inset)',
                borderRadius: tokens.radius.lg,
                padding: '12px 16px',
                borderLeft: `3px solid ${MOBILITY_COLOR}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: MOBILITY_COLOR,
                }}
              >
                FEEL{' '}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                }}
              >
                {ex.feel}
              </span>
            </div>

            {/* YouTube */}
            {ex.videoUrl && (
              <a
                href={ex.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '11px 16px',
                  borderRadius: tokens.radius.lg,
                  background: '#ff000018',
                  border: '1px solid #ff000044',
                  color: '#ff4444',
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff4444">
                  <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.8 15.5V8.5l6.3 3.5-6.3 3.5z" />
                </svg>
                Watch Technique
              </a>
            )}

            {/* What's coming next */}
            {exerciseIdx + 1 < proto.exercises.length && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                  letterSpacing: '0.04em',
                }}
              >
                NEXT UP: {proto.exercises[exerciseIdx + 1].name.toUpperCase()}
              </div>
            )}

            {/* I'm Ready button */}
            <button
              onClick={() => startHold(ex)}
              style={{
                width: '100%',
                padding: '18px',
                borderRadius: tokens.radius.xl,
                cursor: 'pointer',
                background: MOBILITY_COLOR,
                border: 'none',
                color: '#fff',
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: '0.04em',
                marginTop: 4,
                boxShadow: `0 4px 20px ${MOBILITY_COLOR}55`,
              }}
            >
              {sideLabel ? `I'm Ready — Start ${sideLabel}` : "I'm Ready — Start Hold"}
            </button>
          </div>
        </div>
      );
    }

    // ── HOLDING SCREEN — countdown running ──────────────────────────────────
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-root)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={() => {
              if (intervalRef.current !== null) clearInterval(intervalRef.current);
              setTimerActive(false);
              setHoldPhase('intro');
            }}
            aria-label="Go back"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              padding: 0,
            }}
          >
            <span aria-hidden="true">←</span> Back
          </button>
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
          >
            {proto.emoji} {progressLabel.toUpperCase()}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--bg-inset)' }}>
          <div
            style={{
              height: '100%',
              background: MOBILITY_COLOR,
              width: `${(doneSteps / totalSteps) * 100}%`,
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '32px 24px 24px',
            gap: 0,
          }}
        >
          {/* Exercise name + side label */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            {sideLabel && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: MOBILITY_COLOR,
                  marginBottom: 6,
                }}
              >
                {sideLabel}
              </div>
            )}
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
              }}
            >
              {ex.name}
            </div>
          </div>

          {/* Countdown ring */}
          <div
            style={{
              position: 'relative',
              width: 168,
              height: 168,
              marginBottom: 24,
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
                style={{
                  transition: 'stroke-dasharray 1s linear, stroke 0.5s',
                }}
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
              {remaining === 0 ? (
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color: MOBILITY_COLOR,
                    lineHeight: 1,
                  }}
                >
                  {ex.sides && sidePhase === 'left' ? 'SWITCH' : 'DONE'}
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

          {/* Cue reminder — compact */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.xl,
              padding: '14px 16px',
              marginBottom: 16,
              width: '100%',
              maxWidth: 360,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
              }}
            >
              {ex.cue}
            </div>
            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 10,
                marginTop: 10,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: MOBILITY_COLOR,
                }}
              >
                FEEL{' '}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                }}
              >
                {ex.feel}
              </span>
            </div>
          </div>

          {/* Next / Skip button */}
          <button
            onClick={handleNext}
            style={{
              width: '100%',
              maxWidth: 360,
              padding: '16px',
              borderRadius: tokens.radius.lg,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: '0.04em',
              boxSizing: 'border-box',
              background: remaining === 0 ? MOBILITY_COLOR : 'var(--btn-primary-bg)',
              border: remaining === 0 ? 'none' : '1px solid var(--btn-primary-border)',
              color: remaining === 0 ? '#fff' : 'var(--btn-primary-text)',
              transition: 'background 0.3s',
            }}
          >
            {remaining === 0
              ? exerciseIdx + 1 >= proto.exercises.length && !(ex.sides && sidePhase === 'left')
                ? 'Finish Session ✓'
                : ex.sides && sidePhase === 'left'
                  ? 'Switch Sides →'
                  : 'Next Exercise →'
              : 'Skip →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Protocol selection screen ─────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Go back"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 20,
            padding: 0,
            lineHeight: 1,
          }}
        >
          <span aria-hidden="true">←</span>
        </button>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Mobility
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{displayDate}</div>
        </div>
      </div>

      <div
        style={{
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 480,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          CHOOSE A PROTOCOL
        </div>
        {MOBILITY_PROTOCOLS.map((p: any) => (
          <button
            key={p.id}
            onClick={() => {
              save({ protocolId: p.id });
              goToExercise(0);
            }}
            style={{
              background: 'var(--bg-card)',
              border: `1px solid var(--border)`,
              borderRadius: tokens.radius.xl,
              padding: '16px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              boxShadow: 'var(--shadow-xs)',
              transition: 'border-color 0.15s, transform 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = MOBILITY_COLOR;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{p.emoji}</div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                  }}
                >
                  {p.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  ~{p.duration} min
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  color: MOBILITY_COLOR,
                  marginBottom: 6,
                }}
              >
                {p?.category?.toUpperCase()} · {p.exercises.length} EXERCISES
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                {p.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default MobilitySessionView;
