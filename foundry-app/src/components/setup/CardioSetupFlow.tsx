import { useState } from 'react';
import { store } from '../../utils/store';
import { GOAL_OPTIONS, CARDIO_WORKOUTS, TAG_ACCENT } from '../../data/constants';
import { tokens } from '../../styles/tokens';
import type { Profile } from '../../types';

export interface CardioSetupFlowProps {
  pendingProfile: Profile | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onComplete: (profile: any) => void;
}

export default function CardioSetupFlow({
  pendingProfile,
  onComplete,
}: CardioSetupFlowProps) {
  const [cardioSchedule, setCardioSchedule] = useState<{ dayOfWeek: number; protocol: string }[]>([]);
  const [expandedCardioDow, setExpandedCardioDow] = useState<number | null>(null);

  const CARDIO_COLOR = TAG_ACCENT['CARDIO'];
  const DAY_FULL = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  const liftingDows = new Set(
    (pendingProfile?.workoutDays || []).map((d: number) => (d - 1 + 7) % 7)
  );

  const profileGoal = pendingProfile?.goal || '';
  const liftDayCount = (pendingProfile?.workoutDays || []).length;
  const recommendedProtos = CARDIO_WORKOUTS.filter(
    (w) => w.recommendedFor && w.recommendedFor.includes(profileGoal)
  ).slice(0, 3);

  const toggleCardioDow = (dow: number) => {
    setCardioSchedule((prev) => {
      const exists = prev.find((s) => s.dayOfWeek === dow);
      if (exists) {
        setExpandedCardioDow(null);
        return prev.filter((s) => s.dayOfWeek !== dow);
      }
      setExpandedCardioDow(dow);
      return [...prev, { dayOfWeek: dow, protocol: 'zone2_run' }];
    });
  };

  const setCardioProtocol = (dow: number, protocol: string) => {
    setCardioSchedule((prev) => prev.map((s) => (s.dayOfWeek === dow ? { ...s, protocol } : s)));
  };

  const applyRecommendation = (proto: { id: string }) => {
    const allDows = [1, 2, 3, 4, 5, 6, 0];
    const available = allDows.filter((d) => !liftingDows.has(d));
    const candidates =
      available.length > 0 ? available : allDows.filter((d) => liftingDows.has(d));
    const target = candidates.find((d) => !cardioSchedule.find((s) => s.dayOfWeek === d));
    if (target === undefined) return;
    setCardioSchedule((prev) => {
      if (prev.find((s) => s.protocol === proto.id)) return prev;
      const dow = candidates.find((d) => !prev.find((s) => s.dayOfWeek === d));
      if (dow === undefined) return prev;
      return [...prev, { dayOfWeek: dow, protocol: proto.id }];
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg-root)',
        overflowY: 'auto',
        fontFamily: "'Inter',system-ui,sans-serif",
        color: 'var(--text-primary)',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '24px 16px 80px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              marginBottom: 6,
            }}
          >
            Add a cardio plan?
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            Optional. Pick which days you'll do cardio and assign a protocol. You can change
            this any time.
          </div>
        </div>

        {/* Recommendations — shown when we have a goal */}
        {recommendedProtos.length > 0 && (
          <div
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${CARDIO_COLOR}44`,
              borderRadius: tokens.radius.xl,
              overflow: 'hidden',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(232,101,26,0.06)',
                borderBottom: '1px solid rgba(232,101,26,0.14)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke={CARDIO_COLOR}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#E8651A',
                }}
              >
                RECOMMENDED FOR{' '}
                {(
                  GOAL_OPTIONS.find((g) => g.id === profileGoal)?.label || 'your goal'
                ).toUpperCase()}
              </span>
            </div>
            <div
              style={{
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {recommendedProtos.map((proto) => {
                const alreadyAdded = !!cardioSchedule.find((s) => s.protocol === proto.id);
                return (
                  <div
                    key={proto.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {proto.label}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-inset)',
                            border: '1px solid var(--border)',
                            borderRadius: tokens.radius.sm,
                            padding: '1px 6px',
                          }}
                        >
                          {proto.category}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.4,
                        }}
                      >
                        {proto.description.split('.')[0]}.
                      </div>
                    </div>
                    <button
                      onClick={() => (alreadyAdded ? null : applyRecommendation(proto))}
                      style={{
                        flexShrink: 0,
                        padding: '6px 12px',
                        borderRadius: tokens.radius.md,
                        cursor: alreadyAdded ? 'default' : 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        background: alreadyAdded
                          ? `${CARDIO_COLOR}18`
                          : `${CARDIO_COLOR}22`,
                        border: `1px solid ${alreadyAdded ? CARDIO_COLOR + '55' : CARDIO_COLOR + '44'}`,
                        color: alreadyAdded ? CARDIO_COLOR : CARDIO_COLOR,
                      }}
                    >
                      {alreadyAdded ? 'Added ✓' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
            {liftDayCount >= 5 && (
              <div
                style={{
                  padding: '8px 14px 12px',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                  borderTop: '1px solid var(--border)',
                }}
              >
                You're lifting {liftDayCount}x/week — keep cardio sessions short and
                low-intensity to manage recovery.
              </div>
            )}
          </div>
        )}

        {/* Day grid */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            marginBottom: 10,
          }}
        >
          ALL DAYS
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 24,
          }}
        >
          {DAY_FULL.map((name, dow) => {
            const slot = cardioSchedule.find((s) => s.dayOfWeek === dow);
            const active = !!slot;
            const isLift = liftingDows.has(dow);
            const proto = active
              ? CARDIO_WORKOUTS.find((w) => w.id === slot.protocol)
              : null;

            return (
              <div
                key={dow}
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${active ? CARDIO_COLOR + '55' : 'var(--border)'}`,
                  borderRadius: tokens.radius.xl,
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Row header */}
                <div
                  style={{
                    width: '100%',
                    background: active ? `${CARDIO_COLOR}0d` : 'transparent',
                    padding: '13px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background 0.15s',
                  }}
                >
                  <button
                    onClick={() => toggleCardioDow(dow)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: tokens.radius.sm,
                        background: active ? CARDIO_COLOR : 'var(--bg-inset)',
                        border: `2px solid ${active ? CARDIO_COLOR : 'var(--border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.15s',
                      }}
                    >
                      {active && (
                        <span
                          style={{
                            fontSize: 12,
                            color: '#000',
                            fontWeight: 900,
                            lineHeight: 1,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {name}
                      </div>
                      {isLift && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-muted)',
                            marginTop: 1,
                          }}
                        >
                          Lifting day
                        </div>
                      )}
                    </div>
                  </button>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {active && proto && (
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          color: CARDIO_COLOR,
                          background: `${CARDIO_COLOR}18`,
                          border: `1px solid ${CARDIO_COLOR}44`,
                          borderRadius: tokens.radius.sm,
                          padding: '3px 8px',
                          flexShrink: 0,
                        }}
                      >
                        {proto.label}
                      </div>
                    )}
                    {active && (
                      <button
                        onClick={() =>
                          setExpandedCardioDow(expandedCardioDow === dow ? null : dow)
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={CARDIO_COLOR}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            transform:
                              expandedCardioDow === dow ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                          }}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Protocol picker */}
                {active && expandedCardioDow === dow && (
                  <div
                    style={{
                      padding: '0 16px 14px',
                      borderTop: `1px solid ${CARDIO_COLOR}22`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: 'var(--text-muted)',
                        marginTop: 10,
                      }}
                    >
                      PROTOCOL
                    </div>
                    {['Quick & Intense', 'Endurance', 'Performance', 'Conditioning'].map(
                      (cat) => (
                        <div key={cat}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: '0.08em',
                              color: 'var(--text-muted)',
                              marginBottom: 6,
                            }}
                          >
                            {cat.toUpperCase()}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              gap: 6,
                              flexWrap: 'wrap',
                            }}
                          >
                            {CARDIO_WORKOUTS.filter((w) => w.category === cat).map((w) => {
                              const sel = slot!.protocol === w.id;
                              return (
                                <button
                                  key={w.id}
                                  onClick={() => setCardioProtocol(dow, w.id)}
                                  style={{
                                    padding: '5px 12px',
                                    borderRadius: tokens.radius.round,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    letterSpacing: '0.04em',
                                    cursor: 'pointer',
                                    border: 'none',
                                    background: sel
                                      ? CARDIO_COLOR + '28'
                                      : 'var(--bg-deep)',
                                    color: sel ? CARDIO_COLOR : 'var(--text-muted)',
                                    outline: sel
                                      ? `1px solid ${CARDIO_COLOR}55`
                                      : '1px solid transparent',
                                    transition: 'all 0.14s',
                                  }}
                                >
                                  {w.label} · {w.defaultDuration}m
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}
                    {/* Protocol description */}
                    {proto && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          background: 'var(--bg-inset)',
                          borderRadius: tokens.radius.md,
                          padding: '8px 10px',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {proto.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr',
            gap: 10,
          }}
        >
          <button
            onClick={() => {
              store.set('foundry:meso_transition', '');
              onComplete(pendingProfile);
            }}
            style={{
              padding: '18px',
              borderRadius: tokens.radius.lg,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            Skip
          </button>
          <button
            onClick={() => {
              store.set('foundry:meso_transition', '');
              onComplete({ ...pendingProfile, cardioSchedule });
            }}
            className="btn-primary"
            style={{
              padding: '18px',
              borderRadius: tokens.radius.lg,
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '0.04em',
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
              boxShadow:
                cardioSchedule.length > 0
                  ? '0 4px 24px rgba(var(--accent-rgb),0.3)'
                  : 'none',
            }}
          >
            {cardioSchedule.length > 0
              ? `Add Plan (${cardioSchedule.length} day${cardioSchedule.length > 1 ? 's' : ''}) →`
              : 'Start Training →'}
          </button>
        </div>
      </div>
    </div>
  );
}
