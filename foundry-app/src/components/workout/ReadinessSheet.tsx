import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { getReadinessScore, getReadinessLabel } from '../../utils/store';
import { syncReadinessToSupabase } from '../../utils/sync';
import { store } from '../../utils/store';
import type { ReadinessEntry } from '../../types';

interface ReadinessSheetProps {
  onDismiss: () => void;
  onCancel?: () => void;
}

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

function todayKey(): string {
  const d = new Date();
  return `foundry:readiness:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ReadinessSheet({ onDismiss, onCancel }: ReadinessSheetProps) {
  const [readiness, setReadiness] = useState<ReadinessEntry | null>(() => {
    try {
      return JSON.parse(store.get(todayKey()) || 'null');
    } catch {
      return null;
    }
  });

  const score = getReadinessScore(readiness);
  const rl = getReadinessLabel(score);
  const allFilled = readiness?.sleep && readiness?.soreness && readiness?.energy;

  const update = (key: keyof ReadinessEntry, val: string) => {
    const next = { ...(readiness || {}), [key]: val };
    const key_ = todayKey();
    store.set(key_, JSON.stringify(next));
    setReadiness(next);
    if (getReadinessScore(next) !== null) {
      const dateStr = key_.replace('foundry:readiness:', '');
      syncReadinessToSupabase(dateStr, next);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: tokens.colors.overlayHeavy,
        zIndex: 230,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="readiness-sheet-title"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.xxl,
          width: '100%',
          maxWidth: 440,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          padding: '28px 22px 24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.25em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Readiness
        </div>
        <div
          id="readiness-sheet-title"
          style={{
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 32,
            fontWeight: 400,
            letterSpacing: '0.02em',
            color: 'var(--text-primary)',
            lineHeight: 1.05,
            marginBottom: 6,
          }}
        >
          How Are You Feeling Today?
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          A quick check-in before you start — tune intensity to how you actually feel.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {SIGNALS.map((sig) => (
            <div key={sig.key}>
              <div
                id={`rs-label-${sig.key}`}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                {sig.label}
              </div>
              <div role="group" aria-labelledby={`rs-label-${sig.key}`} style={{ display: 'flex', gap: 6 }}>
                {sig.opts.map((opt) => {
                  const sel = readiness?.[sig.key] === opt.val;
                  return (
                    <button
                      key={opt.val}
                      aria-pressed={sel}
                      onClick={() => update(sig.key, opt.val)}
                      style={{
                        flex: 1,
                        padding: '11px 6px',
                        borderRadius: tokens.radius.md,
                        cursor: 'pointer',
                        fontSize: 13,
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
        </div>
        {allFilled && rl && (
          <div
            style={{
              marginTop: 16,
              padding: '12px 14px',
              borderRadius: tokens.radius.md,
              background: rl.color + '18',
              border: `1px solid ${rl.color}44`,
              borderLeft: `3px solid ${rl.color}`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: rl.color, marginBottom: 2 }}>
              {rl.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {rl.advice}
            </div>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 20,
            alignItems: 'center',
          }}
        >
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-accent)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '10px 4px',
              }}
            >
              <span aria-hidden="true">←</span> Go back
            </button>
          )}
          <button
            onClick={onDismiss}
            disabled={!allFilled}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: tokens.radius.md,
              background: 'transparent',
              border: `1px solid ${allFilled ? 'var(--accent)' : 'var(--border)'}`,
              color: allFilled ? 'var(--accent)' : 'var(--text-muted)',
              cursor: allFilled ? 'pointer' : 'not-allowed',
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 400,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              boxShadow: allFilled ? '0 0 0 1px var(--accent)' : 'none',
            }}
          >
            Start Workout
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReadinessSheet;
