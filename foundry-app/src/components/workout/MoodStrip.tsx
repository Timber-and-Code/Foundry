import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';
import { syncReadinessToSupabase } from '../../utils/sync';
import type { ReadinessEntry } from '../../types';

type Mood = 'off' | 'ok' | 'strong';

interface MoodStripProps {
  /** Optional callback when readiness is set (for analytics or UI updates). */
  onSet?: (mood: Mood) => void;
}

const SIGNALS = [
  {
    key: 'sleep' as const,
    label: 'Sleep',
    opts: [
      { val: 'poor', label: 'Poor' },
      { val: 'ok', label: 'OK' },
      { val: 'good', label: 'Good' },
    ],
  },
  {
    key: 'soreness' as const,
    label: 'Soreness',
    opts: [
      { val: 'high', label: 'High' },
      { val: 'moderate', label: 'Moderate' },
      { val: 'low', label: 'Low' },
    ],
  },
  {
    key: 'energy' as const,
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

const MOOD_TO_READINESS: Record<Mood, ReadinessEntry> = {
  off:    { sleep: 'poor', soreness: 'high',     energy: 'low' },
  ok:     { sleep: 'ok',   soreness: 'moderate', energy: 'moderate' },
  strong: { sleep: 'good', soreness: 'low',      energy: 'high' },
};

function readinessToMood(r: ReadinessEntry | null): Mood | null {
  if (!r || !r.sleep || !r.soreness || !r.energy) return null;
  const score =
    (r.sleep === 'good' ? 2 : r.sleep === 'ok' ? 1 : 0) +
    (r.soreness === 'low' ? 2 : r.soreness === 'moderate' ? 1 : 0) +
    (r.energy === 'high' ? 2 : r.energy === 'moderate' ? 1 : 0);
  return score >= 5 ? 'strong' : score >= 3 ? 'ok' : 'off';
}

function loadStored(): ReadinessEntry | null {
  try {
    return JSON.parse(store.get(todayKey()) || 'null') as ReadinessEntry | null;
  } catch {
    return null;
  }
}

function persist(entry: ReadinessEntry): void {
  const key = todayKey();
  store.set(key, JSON.stringify(entry));
  const dateStr = key.replace('foundry:readiness:', '');
  syncReadinessToSupabase(dateStr, entry);
}

export default function MoodStrip({ onSet }: MoodStripProps) {
  const [stored, setStored] = useState<ReadinessEntry | null>(loadStored);
  const [detailOpen, setDetailOpen] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const mood = readinessToMood(stored);

  // Skip path: hide the strip without persisting.
  if (skipped && !mood) {
    return null;
  }

  // Logged: collapsed status row.
  if (mood && !detailOpen) {
    return (
      <button
        onClick={() => setDetailOpen(true)}
        aria-label="Change today's readiness"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: tokens.radius.md,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: 11,
          letterSpacing: '0.08em',
          fontWeight: 700,
          width: '100%',
        }}
      >
        <span>READINESS · {mood.toUpperCase()} ✓</span>
        <span style={{ color: 'var(--text-muted)' }}>change</span>
      </button>
    );
  }

  // Detailed mode: show the existing 3-question form inline.
  if (detailOpen) {
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          padding: '14px 14px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: 'var(--text-muted)',
            }}
          >
            READINESS DETAIL
          </div>
          <button
            onClick={() => setDetailOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 11,
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            ‹ back
          </button>
        </div>

        {SIGNALS.map((sig) => (
          <div key={sig.key}>
            <div
              id={`ms-label-${sig.key}`}
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.16em',
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}
            >
              {sig.label.toUpperCase()}
            </div>
            <div
              role="group"
              aria-labelledby={`ms-label-${sig.key}`}
              style={{ display: 'flex', gap: 6 }}
            >
              {sig.opts.map((opt) => {
                const sel = stored?.[sig.key] === opt.val;
                return (
                  <button
                    key={opt.val}
                    aria-pressed={sel}
                    onClick={() => {
                      const next = { ...(stored || {}), [sig.key]: opt.val } as ReadinessEntry;
                      persist(next);
                      setStored(next);
                      // If all three are now filled, collapse + notify.
                      if (next.sleep && next.soreness && next.energy) {
                        const derived = readinessToMood(next);
                        if (derived && onSet) onSet(derived);
                        setDetailOpen(false);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '11px 6px',
                      borderRadius: tokens.radius.md,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      background: sel ? 'rgba(var(--accent-rgb),0.18)' : 'var(--bg-deep, #0e0c0a)',
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
    );
  }

  // Default: 1-tap mood row.
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
          }}
        >
          HOW ARE YOU FEELING?
        </div>
        <button
          onClick={() => setSkipped(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 11,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          skip ›
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['off', 'ok', 'strong'] as Mood[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              const entry = MOOD_TO_READINESS[m];
              persist(entry);
              setStored(entry);
              if (onSet) onSet(m);
            }}
            style={{
              flex: 1,
              padding: '12px 8px',
              background: 'var(--bg-root)',
              border: 'none',
              borderRadius: tokens.radius.md,
              color: 'var(--accent)',
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
              fontSize: 16,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        onClick={() => setDetailOpen(true)}
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          textAlign: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          letterSpacing: '0.06em',
        }}
      >
        more detail ›
      </button>
    </div>
  );
}
