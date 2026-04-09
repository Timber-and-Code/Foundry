import { getReadinessScore, getReadinessLabel } from '../../utils/store';
import { tokens } from '../../styles/tokens';
import type { ReadinessEntry } from '../../types';

interface ReadinessCardProps {
  readiness: ReadinessEntry | null;
  readinessOpen: boolean;
  setReadinessOpen: (v: boolean) => void;
  updateReadiness: (key: keyof ReadinessEntry, val: string) => void;
}

function ReadinessCard({ readiness, readinessOpen, setReadinessOpen, updateReadiness }: ReadinessCardProps) {
  const score = getReadinessScore(readiness);
  const rl = getReadinessLabel(score);
  const SIGNALS: { key: keyof ReadinessEntry; label: string; opts: { val: string; label: string }[] }[] = [
    {
      key: 'sleep',
      label: 'Sleep',
      opts: [
        { val: 'poor', label: 'Poor' },
        { val: 'ok', label: 'OK' },
        { val: 'good', label: 'Good' },
      ],
    },
    {
      key: 'soreness',
      label: 'Soreness',
      opts: [
        { val: 'high', label: 'High' },
        { val: 'moderate', label: 'Moderate' },
        { val: 'low', label: 'Low' },
      ],
    },
    {
      key: 'energy',
      label: 'Energy',
      opts: [
        { val: 'low', label: 'Low' },
        { val: 'moderate', label: 'Moderate' },
        { val: 'high', label: 'High' },
      ],
    },
  ];
  const allFilled = readiness?.sleep && readiness?.soreness && readiness?.energy;
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <button
        onClick={() => setReadinessOpen(!readinessOpen)}
        aria-expanded={readinessOpen}
        aria-controls="readiness-panel"
        style={{
          width: '100%',
          background: 'var(--bg-inset)',
          border: 'none',
          borderBottom: readinessOpen ? '1px solid var(--border)' : 'none',
          padding: '10px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: 'var(--phase-accum)',
            }}
          >
            READINESS
          </span>
          {allFilled && rl && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: rl.color,
                background: rl.color + '22',
                border: `1px solid ${rl.color}44`,
                borderRadius: tokens.radius.sm,
                padding: '2px 7px',
              }}
            >
              {rl.label}
            </span>
          )}
        </div>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: readinessOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {readinessOpen && (
        <div
          id="readiness-panel"
          style={{
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {SIGNALS.map((sig) => (
            <div key={sig.key}>
              <div
                id={`readiness-label-${sig.key}`}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  color: '#F29A52',
                  marginBottom: 6,
                }}
              >
                {sig.label.toUpperCase()}
              </div>
              <div role="group" aria-labelledby={`readiness-label-${sig.key}`} style={{ display: 'flex', gap: 6 }}>
                {sig.opts.map((opt) => {
                  const sel = readiness?.[sig.key] === opt.val;
                  return (
                    <button
                      key={opt.val}
                      aria-pressed={sel}
                      onClick={() => updateReadiness(sig.key, opt.val)}
                      style={{
                        flex: 1,
                        padding: '9px 6px',
                        borderRadius: tokens.radius.md,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        background: sel ? 'rgba(var(--accent-rgb),0.18)' : 'var(--bg-deep,#0e0c0a)',
                        border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-accent)'}`,
                        color: sel ? 'var(--accent)' : 'var(--text-primary)',
                        transition: 'all 0.12s',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {allFilled && rl && (
            <div
              style={{
                marginTop: 4,
                padding: '10px 12px',
                borderRadius: tokens.radius.md,
                background: rl.color + '18',
                border: `1px solid ${rl.color}44`,
                borderLeft: `3px solid ${rl.color}`,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: rl.color,
                  marginBottom: 2,
                }}
              >
                {rl.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                {rl.advice}
              </div>
            </div>
          )}
        </div>
      )}
      {!readinessOpen && allFilled && rl && (
        <div style={{ padding: '8px 16px' }}>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {rl.advice}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReadinessCard;
