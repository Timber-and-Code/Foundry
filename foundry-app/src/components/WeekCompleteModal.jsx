import React from 'react';
import { getMeso } from '../data/constants';

export default function WeekCompleteModal({ modal, profile, onDismiss, onViewSummary, onReset }) {
  if (modal.isFinal) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(212,152,60,0.33)',
            borderRadius: 12,
            padding: '28px 24px 24px',
            width: '100%',
            maxWidth: 400,
            boxShadow: '0 32px 80px rgba(0,0,0,0.85)',
            margin: 'auto',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}
            >
              MESO COMPLETE
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                marginBottom: 6,
              }}
            >
              {profile?.name ? `${profile.name} — ` : ''}
              {getMeso().weeks} Weeks. Done.
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {modal.mesoCompletedSessions}/{modal.mesoTotalSessions} sessions completed
            </div>
          </div>

          {modal.anchorGains?.length > 0 && (
            <div
              style={{
                background: 'var(--bg-deep)',
                borderRadius: 10,
                border: '1px solid var(--border)',
                marginBottom: 10,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'rgba(212,152,60,0.05)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: 'var(--phase-peak)',
                  }}
                >
                  STRENGTH GAINED
                </div>
              </div>
              <div style={{ padding: '6px 0' }}>
                {modal.anchorGains.map((g, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom:
                        i < modal.anchorGains.length - 1
                          ? '1px solid var(--border-subtle)'
                          : 'none',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {g.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          marginTop: 2,
                        }}
                      >
                        {g.start} lbs → {g.peak} lbs
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        flexShrink: 0,
                        marginLeft: 12,
                        color: g.delta > 0 ? 'var(--phase-accum)' : 'var(--text-muted)',
                      }}
                    >
                      {g.delta > 0 ? `+${g.delta}` : g.delta === 0 ? '—' : g.delta} lbs
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              marginBottom: 18,
            }}
          >
            {[
              {
                label: 'SESSIONS',
                value: `${modal.mesoCompletedSessions}/${modal.mesoTotalSessions}`,
              },
              { label: 'TOTAL PRs', value: modal.mesoTotalPRs },
              {
                label: 'VOLUME',
                value:
                  modal.mesoTotalVolume >= 1000
                    ? `${(modal.mesoTotalVolume / 1000).toFixed(0)}k`
                    : modal.mesoTotalVolume,
                unit: 'lbs',
              },
            ].map(({ label, value, unit }) => (
              <div
                key={label}
                style={{
                  background: 'var(--bg-deep)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  padding: '10px 6px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: 'var(--text-muted)',
                    marginBottom: 5,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: 'var(--phase-peak)',
                    lineHeight: 1,
                  }}
                >
                  {value}
                </div>
                {unit && (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginTop: 3,
                    }}
                  >
                    {unit}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: 'var(--bg-deep)',
                border: '1px solid var(--border)',
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  color: 'var(--phase-accum)',
                  marginBottom: 5,
                }}
              >
                WHAT HAPPENS NEXT
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                Fatigue from this block clears in 3–5 days. Your first session of meso 2 will feel
                stronger than your last peak week — that's supercompensation. Start Week 1
                conservatively at ~85% of your peak weights.
              </div>
            </div>
            <button
              onClick={onReset}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '15px',
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 8,
                letterSpacing: '0.04em',
                background: 'var(--phase-peak)',
                border: '1px solid var(--phase-peak)',
                color: '#000',
              }}
            >
              Build Meso 2 →
            </button>
            <button
              onClick={onDismiss}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Non-final week complete
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '28px 24px',
          width: '100%',
          maxWidth: 380,
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🗓️</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {profile?.name ? `Strong week, ${profile.name}.` : `Week ${modal.weekIdx + 1} Done`}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            {`Week ${modal.weekIdx + 1} · ${modal.sessions} sessions completed`}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
            marginBottom: 22,
          }}
        >
          {[
            { label: 'SETS', value: modal.sets },
            {
              label: 'VOLUME',
              value: modal.volume >= 1000 ? `${(modal.volume / 1000).toFixed(1)}k` : modal.volume,
              unit: 'lbs',
            },
            { label: 'PRs', value: modal.prs || 0 },
          ].map(({ label, value, unit }) => (
            <div
              key={label}
              style={{
                background: 'var(--bg-inset)',
                borderRadius: 8,
                padding: '12px 8px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--phase-intens)',
                  lineHeight: 1,
                }}
              >
                {value}
              </div>
              {unit && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-dim)',
                    marginTop: 1,
                  }}
                >
                  {unit}
                </div>
              )}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  marginTop: 4,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onViewSummary}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 8,
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
            }}
          >
            View Week Summary →
          </button>
          <button
            onClick={onDismiss}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
            }}
          >
            Continue Training
          </button>
        </div>
      </div>
    </div>
  );
}
