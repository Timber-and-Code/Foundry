/**
 * Per-muscle expandable card used by the Meso History sub-tab.
 *
 * Layout (collapsed): muscle name + lift count + total +lb delta.
 * Layout (expanded): each lift shows `start → current lb · PR {pr}` with a
 * highlighted +lb delta on the right.
 *
 * Ported from the sandbox preview impl at
 *   archive/preview-experiments:foundry-app/src/preview/hybrid/ProgressPreview.tsx
 */
import React from 'react';
import { tokens } from '../../styles/tokens';
import type { MuscleLiftEntry } from '../../utils/progressAggregation';

interface MuscleLiftCardProps {
  muscle: string;
  lifts: MuscleLiftEntry[];
  open: boolean;
  onToggle: () => void;
  /** Accent colour used for borders + active deltas. Phase colour by default. */
  accent: string;
}

function MuscleLiftCardInner({ muscle, lifts, open, onToggle, accent }: MuscleLiftCardProps) {
  const totalDelta = lifts.reduce((sum, l) => sum + (l.current - l.start), 0);
  const totalDeltaRounded = Math.round(totalDelta);
  const cardLabelId = `muscle-card-${muscle.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${accent}44`,
        borderRadius: tokens.radius.lg,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={cardLabelId}
        style={{
          width: '100%',
          background: `${accent}11`,
          border: 'none',
          borderBottom: open ? '1px solid var(--border-subtle)' : 'none',
          padding: '12px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'inherit',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
              fontSize: 16,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {muscle}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {lifts.length} {lifts.length === 1 ? 'lift' : 'lifts'}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginRight: 8 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
              fontSize: 18,
              color: totalDeltaRounded > 0 ? accent : 'var(--text-secondary)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {totalDeltaRounded > 0 ? '+' : ''}
            {totalDeltaRounded}
          </div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            total lb
          </div>
        </div>
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 14,
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 150ms',
          }}
          aria-hidden="true"
        >
          ›
        </span>
      </button>
      {open && (
        <div id={cardLabelId} style={{ padding: '8px 14px 12px 14px' }}>
          {lifts.map((l, i) => {
            const d = Math.round(l.current - l.start);
            const isPRAhead = l.pr > Math.round(l.current);
            return (
              <div
                key={l.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '6px 0',
                  borderBottom: i < lifts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      lineHeight: 1.2,
                    }}
                  >
                    {l.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {l.start} → {l.current} lb
                    {isPRAhead ? ` · PR ${l.pr}` : ''}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                    fontSize: 18,
                    color: d > 0 ? accent : 'var(--text-secondary)',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {d > 0 ? '+' : ''}
                  {d}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default React.memo(MuscleLiftCardInner);
