/**
 * One bar per week of a meso — the chart shared by the exercise history
 * sheet and the meso-complete summary, so both read the same way.
 *
 * Bars rise from a floor below the smallest value instead of from zero:
 * week-to-week progress on a lift is a few percent, and zero-based bars
 * would draw five near-identical columns. The floor is a display choice;
 * every bar is labelled with its real value.
 */
import type React from 'react';

export interface WeekBar {
  key: string | number;
  /** Axis label under the bar — "W3", "DL". */
  label: string;
  /** 0 / missing = not logged: drawn as a dashed placeholder, no value. */
  value: number;
  /** The standout week (a PR): glows in ember. */
  highlight?: boolean;
  /** De-emphasised (the deload). */
  muted?: boolean;
  /** Emphasised axis label (the current week). */
  current?: boolean;
}

interface WeekBarsProps {
  bars: WeekBar[];
  /** Tallest bar, px. */
  height?: number;
  /** Value label above each bar. */
  format?: (v: number) => string;
  /** Hide the value labels (compact inline use). */
  hideValues?: boolean;
  ariaLabel: string;
}

const bebas = "'Bebas Neue', 'Inter', system-ui, sans-serif";

export default function WeekBars({ bars, height = 70, format = String, hideValues, ariaLabel }: WeekBarsProps) {
  const logged = bars.filter((b) => b.value > 0);
  const max = Math.max(0, ...logged.map((b) => b.value));
  const min = Math.min(max, ...logged.map((b) => b.value));
  const floor = Math.max(0, min - Math.max((max - min) * 0.6, max * 0.08));
  const labelRow = hideValues ? 0 : 16;

  const cell: React.CSSProperties = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' };

  return (
    <div>
      <div role="img" aria-label={ariaLabel} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: height + labelRow + 4 }}>
        {bars.map((b) => {
          const pct = b.value > 0 && max > floor ? Math.max(0.12, (b.value - floor) / (max - floor)) : 0;
          return (
            <div key={b.key} style={{ ...cell, gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              {!hideValues && b.value > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: b.highlight ? 'var(--accent)' : 'var(--text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {format(b.value)}
                </span>
              )}
              <div
                style={{
                  width: '100%',
                  maxWidth: 34,
                  height: b.value > 0 ? `${pct * height}px` : 4,
                  borderRadius: '4px 4px 1px 1px',
                  background:
                    b.value <= 0
                      ? 'transparent'
                      : b.highlight
                        ? 'linear-gradient(180deg, #F08A3E, var(--accent))'
                        : b.muted
                          ? 'var(--bg-inset, var(--bg-surface))'
                          : 'rgba(var(--accent-rgb),0.35)',
                  border: b.value <= 0 ? '1px dashed var(--border)' : b.muted ? '1px solid var(--border)' : 'none',
                  boxShadow: b.highlight ? '0 0 14px rgba(var(--accent-rgb),0.45)' : 'none',
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {bars.map((b) => (
          <div
            key={b.key}
            style={{
              ...cell,
              fontFamily: bebas,
              fontSize: 13,
              letterSpacing: '0.06em',
              color: b.current ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
