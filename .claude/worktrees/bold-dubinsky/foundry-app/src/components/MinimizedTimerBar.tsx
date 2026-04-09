import React from 'react';

interface RestTimer {
  remaining: number;
  total: number;
  exName: string;
}

interface MinimizedTimerBarProps {
  restTimer: RestTimer;
  onTap: (done: boolean) => void;
}

export default function MinimizedTimerBar({ restTimer, onTap }: MinimizedTimerBarProps) {
  const { remaining, total, exName } = restTimer;
  const pct = total > 0 ? remaining / total : 0;
  const done = remaining === 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr =
    mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${String(secs).padStart(2, '0')}`;
  const barColor = done ? 'var(--phase-accum)' : pct > 0.15 ? '#D4A03C' : '#a03333';
  const barPct = total > 0 ? 1 - pct : 1;

  return (
    <div
      onClick={() => onTap(done)}
      style={{
        position: 'fixed',
        bottom: 64,
        left: 0,
        right: 0,
        zIndex: 500,
        background: barColor,
        borderTop: `3px solid ${barColor}`,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
        cursor: 'pointer',
        userSelect: 'none',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${barPct * 100}%`,
          background: 'rgba(0,0,0,0.22)',
          transition: 'width 1s linear',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: 'rgba(0,0,0,0.8)',
              fontVariantNumeric: 'tabular-nums',
              minWidth: 54,
              lineHeight: 1,
            }}
          >
            {done ? 'GO!' : timeStr}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'rgba(0,0,0,0.75)',
                lineHeight: 1,
              }}
            >
              {done ? 'Rest complete' : 'Resting'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)', lineHeight: 1 }}>{exName}</div>
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: 'rgba(0,0,0,0.7)',
            background: 'rgba(0,0,0,0.15)',
            border: '1px solid rgba(0,0,0,0.2)',
            borderRadius: 6,
            padding: '7px 12px',
            whiteSpace: 'nowrap',
          }}
        >
          {done ? 'DISMISS ✓' : 'RETURN ↑'}
        </div>
      </div>
    </div>
  );
}
