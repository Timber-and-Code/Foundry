import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { MOBILITY_PROTOCOLS } from '../../data/constants';
import MobilityProtocolDetail from './MobilityProtocolDetail';

interface MobilityBrowserProps {
  onBack: () => void;
}

function MobilityBrowser({ onBack }: MobilityBrowserProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return <MobilityProtocolDetail protocolId={selectedId} onBack={() => setSelectedId(null)} />;
  }

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
          gap: 10,
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
          Structured routines for shoulders, hips, spine, and full-body recovery. Tap one to see
          the moves and start it now.
        </div>

        {MOBILITY_PROTOCOLS.map((proto) => (
          <button
            key={proto.id}
            onClick={() => setSelectedId(proto.id)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
              textAlign: 'left',
              cursor: 'pointer',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
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
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-inset)',
                    padding: '2px 7px',
                    borderRadius: tokens.radius.sm,
                  }}
                >
                  {proto.duration.toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-inset)',
                    padding: '2px 7px',
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
              }}
            >
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default MobilityBrowser;
