import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { CARDIO_WORKOUTS } from '../../data/constants';

const INTENSITY_COLOR: Record<string, string> = {
  Easy: '#6BCB77',
  Moderate: '#4EA8DE',
  Hard: '#E8651A',
};

interface CardioBrowserProps {
  onBack: () => void;
}

function CardioBrowser({ onBack }: CardioBrowserProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 90 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px 12px',
          background: 'var(--bg-deep)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--accent)',
            fontSize: 20,
            lineHeight: 1,
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            minWidth: 44,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          ‹
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--text-secondary)',
          }}
        >
          CARDIO
        </span>
      </div>

      <div
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            padding: '0 4px 4px',
          }}
        >
          Protocols from Zone 2 to Tabata. Pair them with your lifting week — easy work between
          hard sessions, intervals on off days.
        </div>

        {CARDIO_WORKOUTS.map((w) => {
          const isOpen = expandedId === w.id;
          const intensityColor = INTENSITY_COLOR[w.defaultIntensity] || 'var(--accent)';
          return (
            <div
              key={w.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setExpandedId(isOpen ? null : w.id)}
                aria-expanded={isOpen}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      marginBottom: 6,
                    }}
                  >
                    {w.label}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-inset)',
                        padding: '2px 8px',
                        borderRadius: tokens.radius.sm,
                      }}
                    >
                      {w.category.toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-inset)',
                        padding: '2px 8px',
                        borderRadius: tokens.radius.sm,
                      }}
                    >
                      {w.defaultDuration} MIN
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: intensityColor,
                        background: intensityColor + '1a',
                        padding: '2px 8px',
                        borderRadius: tokens.radius.sm,
                      }}
                    >
                      {w.defaultIntensity.toUpperCase()}
                    </span>
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  style={{
                    color: 'var(--text-dim)',
                    fontSize: 20,
                    flexShrink: 0,
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                    marginTop: 2,
                  }}
                >
                  ›
                </span>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <div
                    style={{
                      padding: '14px 16px',
                      background: 'var(--bg-inset)',
                      borderBottom: w.intervals ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.65,
                        margin: 0,
                      }}
                    >
                      {w.description}
                    </p>
                  </div>
                  {w.intervals && (
                    <div
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        gap: 16,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                          WORK
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {w.intervals.workSecs}s
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                          REST
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {w.intervals.restSecs}s
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                          ROUNDS
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {w.intervals.rounds}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CardioBrowser;
