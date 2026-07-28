import React from 'react';
import { tokens } from '../../styles/tokens';

/** Per-day signals the strip renders under each date. */
export interface WeekStripDayMeta {
  /** Phase color when a meso session is scheduled; null = rest day. */
  sessionColor: string | null;
  /** Every meso session on the day is completed. */
  allDone: boolean;
  /** Past day with an un-completed, un-skipped meso session. */
  missed: boolean;
  /** Two meso sessions share the day. */
  double: boolean;
  hasCardio: boolean;
  hasExtra: boolean;
}

interface WeekStripProps {
  /** The 7 dates (YYYY-MM-DD, Sun→Sat) of the visible week. */
  weekDates: string[];
  selectedDate: string;
  todayStr: string;
  meta: Record<string, WeekStripDayMeta>;
  /** e.g. "WK 3 · INTENSIFICATION" — phase identity lives in the header. */
  phaseLabel: string;
  phaseColor: string;
  canPrev: boolean;
  canNext: boolean;
  onShiftWeek: (dir: -1 | 1) => void;
  onSelectDate: (dateStr: string) => void;
  /** Jump strip + selection back to today. */
  onToday: () => void;
  /** Switch to the zoomed-out month grid. */
  onShowMonth: () => void;
}

const DOW_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Schedule v2 week strip — pinned 7-day pager with the meso phase as the
 * header identity. Swiping weeks is arrow-driven (matches the month nav);
 * each day carries dots for session / done / missed / cardio / extra.
 * Tapping a day drives the DayStack below. Month grid demoted to an icon.
 */
function WeekStrip({
  weekDates,
  selectedDate,
  todayStr,
  meta,
  phaseLabel,
  phaseColor,
  canPrev,
  canNext,
  onShiftWeek,
  onSelectDate,
  onToday,
  onShowMonth,
}: WeekStripProps) {
  const weekHasToday = weekDates.includes(todayStr);
  const navBtn = (enabled: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: tokens.radius.md,
    border: '1px solid var(--border)',
    background: 'var(--bg-inset)',
    cursor: enabled ? 'pointer' : 'default',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: enabled ? 'var(--text-secondary)' : 'var(--text-dim)',
    fontSize: 18,
    fontWeight: 700,
    opacity: enabled ? 1 : 0.3,
  });

  return (
    <div>
      {/* Header — phase identity + week nav */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 26,
            fontWeight: 400,
            letterSpacing: '0.05em',
            color: phaseColor,
            lineHeight: 1.0,
          }}
        >
          {phaseLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button aria-label="Previous week" onClick={() => canPrev && onShiftWeek(-1)} style={navBtn(canPrev)}>
            ‹
          </button>
          {!weekHasToday && (
            <button
              onClick={onToday}
              style={{
                padding: '4px 8px',
                borderRadius: tokens.radius.md,
                border: '1px solid var(--phase-intens)55',
                background: 'var(--phase-intens)11',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.05em',
                color: 'var(--phase-intens)',
              }}
            >
              TODAY
            </button>
          )}
          <button aria-label="Next week" onClick={() => canNext && onShiftWeek(1)} style={navBtn(canNext)}>
            ›
          </button>
          <button
            aria-label="Show month view"
            onClick={onShowMonth}
            style={{ ...navBtn(true), marginLeft: 4, fontSize: 14 }}
          >
            ▦
          </button>
        </div>
      </div>

      {/* 7-day strip */}
      <div
        role="tablist"
        aria-label="Days of the week"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}
      >
        {weekDates.map((ds, i) => {
          const m = meta[ds];
          const isSelected = ds === selectedDate;
          const isToday = ds === todayStr;
          const color = m?.sessionColor ?? null;
          return (
            <button
              key={ds}
              role="tab"
              aria-selected={isSelected}
              aria-label={`${ds}${m?.double ? ' (2 workouts)' : ''}${m?.missed ? ' — missed' : ''}`}
              onClick={() => onSelectDate(ds)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '8px 0 7px',
                borderRadius: tokens.radius.md,
                border: isSelected
                  ? `1.5px solid ${color ?? 'var(--phase-intens)'}`
                  : isToday
                    ? '1.5px solid var(--border)'
                    : '1.5px solid transparent',
                background: isSelected ? `${color ?? 'var(--phase-intens)'}1c` : 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  lineHeight: 1,
                }}
              >
                {DOW_SHORT[i]}
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: isToday || isSelected ? 800 : 600,
                  color: isToday ? (color ?? 'var(--phase-intens)') : 'var(--text-primary)',
                  lineHeight: 1,
                }}
              >
                {Number(ds.slice(8))}
              </span>
              {/* Signal row — session dot (or ✓ / ⚠) + cardio/extra pips */}
              <span
                aria-hidden="true"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  minHeight: 10,
                  lineHeight: 1,
                }}
              >
                {m?.allDone && color ? (
                  <span style={{ fontSize: 9, fontWeight: 800, color }}>✓</span>
                ) : m?.missed ? (
                  <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--stalling, #f87171)' }}>⚠</span>
                ) : color ? (
                  <>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: tokens.radius.full,
                        background: color,
                      }}
                    />
                    {m?.double && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: tokens.radius.full,
                          background: color,
                          opacity: 0.55,
                        }}
                      />
                    )}
                  </>
                ) : null}
                {m?.hasCardio && (
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: tokens.radius.full,
                      background: 'var(--accent)',
                      opacity: 0.8,
                    }}
                  />
                )}
                {m?.hasExtra && (
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: tokens.radius.full,
                      background: 'var(--text-muted)',
                      opacity: 0.8,
                    }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default WeekStrip;
