import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { MOBILITY_PROTOCOLS } from '../../data/constants';

interface MobilityBrowserProps {
  onBack: () => void;
}

function MobilityBrowser({ onBack }: MobilityBrowserProps) {
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
          MOBILITY
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
          Structured routines for shoulders, hips, spine, and full-body recovery. Run one on a rest
          day, or after a heavy session.
        </div>

        {MOBILITY_PROTOCOLS.map((proto) => {
          const isOpen = expandedId === proto.id;
          return (
            <div
              key={proto.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setExpandedId(isOpen ? null : proto.id)}
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
                    {proto.name}
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
                      {proto.duration.toUpperCase()}
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
                      {proto.moves.length} MOVES
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
                  {proto.moves.map((move, mi) => (
                    <div
                      key={mi}
                      style={{
                        padding: '12px 16px',
                        borderBottom:
                          mi < proto.moves.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {move.name}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--accent)',
                            flexShrink: 0,
                          }}
                        >
                          {move.reps}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.55,
                        }}
                      >
                        {move.cue}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MobilityBrowser;
