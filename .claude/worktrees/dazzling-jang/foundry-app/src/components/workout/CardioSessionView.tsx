import React from 'react';
import { loadCardioSession, saveCardioSession } from '../../utils/store';
import { haptic } from '../../utils/helpers';
import { TAG_ACCENT, CARDIO_WORKOUTS } from '../../data/constants';
import CardioIntervalTimer from './CardioIntervalTimer';
import { tokens } from '../../styles/tokens';

interface CardioSessionViewProps {
  dateStr: string;
  plannedProtocolId: any;
  onBack: () => void;
  profile: any;
}

function CardioSessionView({ dateStr, plannedProtocolId, onBack, profile }: CardioSessionViewProps) {
  const CARDIO_COLOR = TAG_ACCENT['CARDIO'];

  // ── Derived helpers ─────────────────────────────────────────────────────────
  // todayStr helper — reserved for date comparison

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

  // ── Session state ────────────────────────────────────────────────────────────
  const [session, setSession] = React.useState(() => {
    const saved = loadCardioSession(dateStr);
    if (saved) return saved;
    // Initialize from planned protocol if provided
    const proto = plannedProtocolId
      ? CARDIO_WORKOUTS.find((w) => w.id === plannedProtocolId)
      : null;
    return {
      protocolId: proto ? proto.id : null,
      type: proto ? proto.defaultType : '',
      duration: proto ? String(proto.defaultDuration) : '',
      intensity: proto ? proto.defaultIntensity : '',
      completed: false,
      startedAt: null,
      completedAt: null,
    };
  });

  const [showTimer, setShowTimer] = React.useState(false);
  const [started, setStarted] = React.useState(() => !!loadCardioSession(dateStr)?.startedAt);
  const [elapsedSecs, setElapsedSecs] = React.useState(0);
  const [showComplete, setShowComplete] = React.useState(false);
  const [openCat, setOpenCat] = React.useState<string | null>(null); // which category accordion is expanded
  const startRef = React.useRef<number | null>(null);
  const elapsedRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Restore start time ───────────────────────────────────────────────────────
  React.useEffect(() => {
    const saved = loadCardioSession(dateStr);
    if (saved?.startedAt) startRef.current = Number(saved.startedAt);
  }, []);

  // ── Elapsed timer ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!started || session.completed) return;
    const tick = () => {
      if (startRef.current) setElapsedSecs(Math.floor((Date.now() - startRef.current) / 1000));
    };
    tick();
    elapsedRef.current = setInterval(tick, 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [started, session.completed]);

  const formatElapsed = (s: any) => {
    const m = Math.floor(s / 60),
      sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // ── Persist session ──────────────────────────────────────────────────────────
  const save = (updates: any) => {
    const next = { ...session, ...updates };
    setSession(next);
    saveCardioSession(dateStr, next);
  };

  // ── Protocol selection ───────────────────────────────────────────────────────
  const handleSelectProtocol = (proto: any) => {
    if (session.protocolId === proto.id) {
      save({ protocolId: null, type: '', duration: '', intensity: '' });
    } else {
      save({
        protocolId: proto.id,
        type: proto.defaultType,
        duration: String(proto.defaultDuration),
        intensity: proto.defaultIntensity,
      });
    }
  };

  // ── Begin session ────────────────────────────────────────────────────────────
  const handleStart = () => {
    const now = Date.now();
    startRef.current = now;
    haptic('tap');
    save({ startedAt: now });
    setStarted(true);
  };

  // ── Timer complete ────────────────────────────────────────────────────────────
  const handleTimerComplete = () => {
    setShowTimer(false);
    haptic('tap');
    setShowComplete(true);
  };

  // ── Complete session ─────────────────────────────────────────────────────────
  const handleComplete = () => {
    const now = Date.now();
    haptic('tap');
    // Auto-fill duration from elapsed timer if user didn't manually set it
    const updates: { completed: boolean; completedAt: number; duration?: string } = { completed: true, completedAt: now };
    if (startRef.current) {
      const elapsedMins = Math.round((now - startRef.current) / 60000);
      if (elapsedMins > 0 && elapsedMins < 300) {
        updates.duration = String(elapsedMins);
      }
    }
    save(updates);
    setShowComplete(false);
    // Navigate home automatically
    setTimeout(() => onBack(), 400);
  };

  const selectedProto = session.protocolId
    ? CARDIO_WORKOUTS.find((w) => w.id === session.protocolId)
    : null;
  // logged flag — reserved for completion detection

  const CATEGORIES = ['Quick & Intense', 'Endurance', 'Performance', 'Conditioning'];
  const TYPES = [
    'Run',
    'Bike',
    'Row',
    'Swim',
    'Walk',
    'Stairs',
    'Elliptical',
    'Jump Rope',
    'Other',
  ];
  const INTENSITIES = [
    { label: 'Easy', color: tokens.colors.textPrimary, sub: 'Conversational' },
    { label: 'Moderate', color: tokens.colors.gold, sub: 'Challenging' },
    { label: 'Hard', color: tokens.colors.cardioHard, sub: 'Near max' },
  ];

  const chipStyle = (active: any, color: any) => ({
    padding: '5px 12px',
    borderRadius: tokens.radius.round,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    border: 'none',
    background: active ? color + '28' : 'var(--bg-deep)',
    color: active ? color : 'var(--text-muted)',
    outline: active ? `1px solid ${color}55` : '1px solid transparent',
    transition: 'all 0.14s',
    whiteSpace: 'nowrap',
  });

  // Recommended protocols based on user goal
  const userGoal = profile?.goal || '';
  const recommended = CARDIO_WORKOUTS.filter(
    (w) => w.recommendedFor && w.recommendedFor.includes(userGoal)
  ).slice(0, 3);

  // Protocol card renderer — shared between recommended and category sections
  const ProtoCard = ({ proto, active, useCardioAccent }: { proto: any; active: any; useCardioAccent: any }) => {
    const leftColor = useCardioAccent ? CARDIO_COLOR : 'var(--accent)';
    return (
      <button
        onClick={() => !session.completed && handleSelectProtocol(proto)}
        style={{
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          padding: '12px 14px',
          borderRadius: tokens.radius.lg,
          background: active ? `${CARDIO_COLOR}0d` : 'var(--bg-deep)',
          border: active ? `1px solid ${CARDIO_COLOR}` : '1px solid var(--border-subtle)',
          borderLeft: active ? `3px solid ${CARDIO_COLOR}` : `3px solid ${leftColor}`,
          transition: 'all 0.15s',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: active ? 4 : 0,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: active ? CARDIO_COLOR : 'var(--text-primary)',
            }}
          >
            {proto.label}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
              }}
            >
              {proto.defaultDuration} min
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.04em',
                padding: '2px 7px',
                borderRadius: tokens.radius.sm,
                color:
                  proto.defaultIntensity === 'Hard'
                    ? tokens.colors.cardioHard
                    : proto.defaultIntensity === 'Moderate'
                      ? tokens.colors.gold
                      : tokens.colors.textPrimary,
                background:
                  (proto.defaultIntensity === 'Hard'
                    ? tokens.colors.cardioHard
                    : proto.defaultIntensity === 'Moderate'
                      ? tokens.colors.gold
                      : tokens.colors.textPrimary) + '18',
              }}
            >
              {proto.defaultIntensity?.toUpperCase()}
            </span>
          </div>
        </div>
        {active && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {proto.description}
          </div>
        )}
        {active && proto.intervals && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              {
                label: 'WORK',
                value: `${proto.intervals.workSecs}s`,
                color: tokens.colors.cardioHard,
              },
              {
                label: 'REST',
                value: `${proto.intervals.restSecs}s`,
                color: tokens.colors.gold,
              },
              {
                label: 'ROUNDS',
                value: String(proto.intervals.rounds),
                color: CARDIO_COLOR,
              },
            ].map(({ label, value, color }) => (
              <span
                key={label}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color,
                  background: `${color}18`,
                  border: `1px solid ${color}44`,
                  borderRadius: tokens.radius.sm,
                  padding: '2px 7px',
                }}
              >
                {label} {value}
              </span>
            ))}
          </div>
        )}
      </button>
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root)',
        color: 'var(--text-primary)',
        fontFamily: "'Inter',system-ui,sans-serif",
        paddingBottom: 80,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--bg-root)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 16px',
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
            border: '1px solid var(--accent)',
            borderRadius: tokens.radius.lg,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--accent)',
          }}
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            {selectedProto ? selectedProto.label : 'Cardio Session'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {displayDate}
          </div>
        </div>
        {/* Elapsed timer — visible once started */}
        {started && !session.completed && (
          <div
            aria-live="polite"
            aria-label={`Elapsed time: ${formatElapsed(elapsedSecs)}`}
            style={{
              fontSize: 13,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: CARDIO_COLOR,
              background: `${CARDIO_COLOR}15`,
              border: `1px solid ${CARDIO_COLOR}44`,
              borderRadius: tokens.radius.md,
              padding: '4px 10px',
            }}
          >
            {formatElapsed(elapsedSecs)}
          </div>
        )}
        {session.completed && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: tokens.colors.gold,
              background: tokens.colors.goldDim,
              border: `1px solid ${tokens.colors.goldBorder}`,
              borderRadius: tokens.radius.md,
              padding: '4px 10px',
            }}
          >
            DONE ✓
          </div>
        )}
      </div>

      {/* ── Workout Selector ────────────────────────────────────────────────── */}
      {!session.completed && (
        <div
          style={{
            padding: '16px 16px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Recommended for your goal — featured zone */}
          {recommended.length > 0 && (
            <div
              style={{
                background: `${CARDIO_COLOR}08`,
                border: `1px solid ${CARDIO_COLOR}33`,
                borderRadius: tokens.radius.xl,
                padding: '14px 14px 16px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: CARDIO_COLOR,
                  marginBottom: 10,
                }}
              >
                RECOMMENDED FOR YOUR GOAL
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recommended.map((proto) => (
                  <ProtoCard
                    key={proto.id}
                    proto={proto}
                    active={session.protocolId === proto.id}
                    useCardioAccent
                  />
                ))}
              </div>
            </div>
          )}

          {/* Divider + Browse — hidden when a recommended protocol is already selected */}
          {recommended.length > 0 && !recommended.some((p) => p.id === session.protocolId) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.round,
                  padding: '5px 14px',
                }}
              >
                OR BROWSE ALL
              </div>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          )}

          {/* All protocols by category — hidden when recommended protocol selected */}
          {!recommended.some((p) => p.id === session.protocolId) &&
            CATEGORIES.map((cat) => {
              const protos = CARDIO_WORKOUTS.filter((w) => w.category === cat);
              if (protos.length === 0) return null;
              const isOpen = openCat === cat || protos.some((p) => p.id === session.protocolId);
              return (
                <div key={cat}>
                  <button
                    onClick={() => setOpenCat(openCat === cat ? null : cat)}
                    aria-expanded={isOpen}
                    aria-label={`${cat} — ${isOpen ? 'collapse' : 'expand'}`}
                    style={{
                      width: '100%',
                      background: 'var(--bg-deep)',
                      border: '1px solid var(--border-subtle)',
                      borderLeft: '3px solid var(--accent)',
                      borderRadius: tokens.radius.md,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      textAlign: 'left',
                      marginBottom: isOpen ? 8 : 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {cat.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{protos.length}</div>
                    </div>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        marginLeft: 10,
                        paddingLeft: 14,
                        borderLeft: '2px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {protos.map((proto) => (
                        <ProtoCard
                          key={proto.id}
                          proto={proto}
                          active={session.protocolId === proto.id}
                          useCardioAccent={false}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ── Log: Type / Duration / Intensity ─────────────────────────────────── */}
      <div style={{ padding: '12px 16px 0' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            border: `1px solid ${session.completed ? tokens.colors.goldMedium : 'var(--border)'}`,
            borderRadius: tokens.radius.xl,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              background: session.completed ? '#D4983C10' : 'var(--bg-inset)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: session.completed ? tokens.colors.gold : 'var(--text-secondary)',
              }}
            >
              {session.completed ? 'SESSION LOGGED' : 'LOG'}
            </span>
          </div>
          <div
            style={{
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* Type */}
            <div>
              <div
                id="type-label"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                TYPE
              </div>
              <div role="group" aria-labelledby="type-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TYPES.map((t) => (
                  <button
                    key={t}
                    disabled={session.completed}
                    aria-pressed={session.type === t}
                    onClick={() => save({ type: session.type === t ? '' : t })}
                    style={chipStyle(session.type === t, CARDIO_COLOR)}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {/* Duration */}
            <div>
              <div
                id="duration-label"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                DURATION
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={session.duration}
                  disabled={session.completed}
                  onChange={(e) => save({ duration: e.target.value })}
                  placeholder="—"
                  aria-labelledby="duration-label"
                  style={{
                    width: 80,
                    padding: '8px 12px',
                    borderRadius: tokens.radius.md,
                    fontSize: 20,
                    fontWeight: 700,
                    textAlign: 'center',
                    background: 'var(--bg-deep)',
                    border: `1px solid ${session.duration ? CARDIO_COLOR + '55' : 'var(--border)'}`,
                    color: 'var(--text-primary)',
                    outline: 'none',
                    opacity: session.completed ? 0.6 : 1,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  minutes
                </span>
              </div>
            </div>
            {/* Intensity */}
            <div>
              <div
                id="intensity-label"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                INTENSITY
              </div>
              <div role="group" aria-labelledby="intensity-label" style={{ display: 'flex', gap: 8 }}>
                {INTENSITIES.map(({ label, color, sub }) => {
                  const sel = session.intensity === label;
                  return (
                    <button
                      key={label}
                      disabled={session.completed}
                      aria-pressed={sel}
                      onClick={() =>
                        save({
                          intensity: session.intensity === label ? '' : label,
                        })
                      }
                      style={{
                        flex: 1,
                        padding: '10px 6px',
                        borderRadius: tokens.radius.md,
                        cursor: session.completed ? 'default' : 'pointer',
                        textAlign: 'center',
                        border: 'none',
                        background: sel ? color + '22' : 'var(--bg-deep)',
                        outline: sel ? `1px solid ${color}55` : '1px solid var(--border)',
                        transition: 'all 0.14s',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: sel ? color : 'var(--text-secondary)',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {label.toUpperCase()}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: sel ? color : 'var(--text-muted)',
                          marginTop: 3,
                          lineHeight: 1.3,
                        }}
                      >
                        {sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ───────────────────────────────────────────────────── */}
      {!session.completed && (
        <div style={{ padding: '16px' }}>
          {!started ? (
            /* Start session */
            <button
              onClick={handleStart}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '18px',
                fontSize: 15,
                fontWeight: 800,
                borderRadius: tokens.radius.xl,
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {selectedProto?.intervals ? `▶ Start ${selectedProto.label}` : '▶ Start Session'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Guided timer button — only for HIIT protocols */}
              {selectedProto?.intervals && (
                <button
                  onClick={() => setShowTimer(true)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: 14,
                    fontWeight: 800,
                    borderRadius: tokens.radius.xl,
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                    background: `${CARDIO_COLOR}18`,
                    border: `1px solid ${CARDIO_COLOR}55`,
                    color: CARDIO_COLOR,
                  }}
                >
                  ▶ Open Interval Timer
                </button>
              )}
              {/* Complete */}
              <button
                onClick={() => setShowComplete(true)}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: 14,
                  fontWeight: 800,
                  borderRadius: tokens.radius.xl,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  background: tokens.colors.goldDim,
                  border: `1px solid ${tokens.colors.goldBorder}`,
                  color: tokens.colors.gold,
                }}
              >
                Complete Session ✓
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Complete confirmation ────────────────────────────────────────────── */}
      {showComplete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="complete-dialog-title"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid #D4983C55',
              borderRadius: tokens.radius.xxl,
              padding: '28px 24px',
              width: '100%',
              maxWidth: 340,
            }}
          >
            <div
              id="complete-dialog-title"
              style={{
                fontSize: 17,
                fontWeight: 800,
                textAlign: 'center',
                marginBottom: 6,
              }}
            >
              Session complete?
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                textAlign: 'center',
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              {[
                session.type,
                session.duration ? session.duration + ' min' : null,
                session.intensity,
              ]
                .filter(Boolean)
                .join(' · ') || 'No details logged yet'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowComplete(false)}
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
                }}
              >
                Not yet
              </button>
              <button
                onClick={handleComplete}
                style={{
                  flex: 2,
                  padding: '14px',
                  fontSize: 13,
                  fontWeight: 800,
                  borderRadius: tokens.radius.xl,
                  cursor: 'pointer',
                  background: tokens.colors.gold,
                  border: `1px solid ${tokens.colors.gold}`,
                  color: '#000',
                }}
              >
                Done ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Interval Timer overlay ────────────────────────────────────────────── */}
      {showTimer && selectedProto?.intervals && (
        <CardioIntervalTimer
          protocol={selectedProto}
          onComplete={handleTimerComplete}
          onDismiss={() => setShowTimer(false)}
        />
      )}
    </div>
  );
}

export default CardioSessionView;
