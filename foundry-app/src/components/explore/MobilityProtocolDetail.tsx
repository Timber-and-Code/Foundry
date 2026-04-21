import { useNavigate } from 'react-router-dom';
import { tokens } from '../../styles/tokens';
import { MOBILITY_PROTOCOLS } from '../../data/constants';
import { saveMobilitySession } from '../../utils/store';

interface MobilityProtocolDetailProps {
  protocolId: string;
  onBack: () => void;
}

function MobilityProtocolDetail({ protocolId, onBack }: MobilityProtocolDetailProps) {
  const navigate = useNavigate();
  const proto = MOBILITY_PROTOCOLS.find((p) => p.id === protocolId);

  if (!proto) {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={onBack} style={{ color: 'var(--accent)' }}>
          ← Back
        </button>
        <div style={{ marginTop: 20, color: 'var(--text-muted)' }}>Protocol not found.</div>
      </div>
    );
  }

  const handleStart = () => {
    const today = new Date().toISOString().slice(0, 10);
    saveMobilitySession(today, {
      protocolId: proto.id,
      completed: false,
      completedAt: null,
    });
    navigate(`/mobility/${today}`);
  };

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 120 }}>
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

      <div style={{ padding: '20px 16px 16px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: 'var(--accent)',
            marginBottom: 6,
          }}
        >
          MOBILITY ROUTINE
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
            marginBottom: 14,
          }}
        >
          {proto.name}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              background: 'var(--bg-inset)',
              padding: '4px 10px',
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
              padding: '4px 10px',
              borderRadius: tokens.radius.sm,
            }}
          >
            {proto.moves.length} MOVES
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            overflow: 'hidden',
          }}
        >
          {proto.moves.map((move, mi) => (
            <div
              key={mi}
              style={{
                padding: '14px 16px',
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
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
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
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                {move.cue}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px 18px',
          background: 'var(--bg-deep)',
          borderTop: '1px solid var(--border)',
          zIndex: 20,
        }}
      >
        <button
          onClick={handleStart}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: tokens.radius.lg,
            background: 'var(--btn-primary-bg)',
            border: '1px solid var(--btn-primary-border)',
            color: 'var(--btn-primary-text)',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          Start now
        </button>
      </div>
    </div>
  );
}

export default MobilityProtocolDetail;
