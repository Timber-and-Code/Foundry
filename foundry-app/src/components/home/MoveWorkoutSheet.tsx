import React, { useMemo, useState } from 'react';
import { tokens } from '../../styles/tokens';
import Sheet from '../ui/Sheet';
import { setScheduleOverride } from '../../utils/store';
import type { Profile } from '../../types';

interface MoveWorkoutSheetProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  /** Original (source) date the session currently renders on, YYYY-MM-DD. */
  sourceDateStr: string;
  /** Session being moved — "dayIdx:weekIdx" */
  sessionKey: string;
  /** Map of date → session(s) so we can flag conflict/completion/past targets. */
  sessionDateMap: Record<string, string | string[]>;
  /** Set of already-completed sessionKeys (e.g. "0:2"). */
  completedDays: Set<string>;
  onProfileUpdate: (updates: Partial<Profile>) => void;
  /** Optional label shown in the header. */
  sessionLabel?: string;
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * MoveWorkoutSheet — date picker for moving a single session ±7 days from
 * its current (source) date. Past dates are disabled. Days occupied by a
 * completed session are disabled. The current source is marked and not a
 * valid target. If the target is already occupied, we show a warning inline
 * but still allow the move (the calendar will double-book the day).
 */
function MoveWorkoutSheet({
  open,
  onClose,
  profile,
  sourceDateStr,
  sessionKey,
  sessionDateMap,
  completedDays,
  onProfileUpdate,
  sessionLabel,
}: MoveWorkoutSheetProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // Reset selection whenever the sheet re-opens for a different source.
  React.useEffect(() => {
    if (open) setSelected(null);
  }, [open, sourceDateStr]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayStr = toDateStr(today);

  const cells = useMemo(() => {
    const source = new Date(sourceDateStr + 'T00:00:00');
    const out: {
      dateStr: string;
      day: number;
      dow: number;
      label: string;
      disabled: boolean;
      disabledReason?: string;
      isSource: boolean;
      isToday: boolean;
      hasConflict: boolean;
    }[] = [];
    for (let offset = -7; offset <= 7; offset++) {
      const dt = new Date(source);
      dt.setDate(dt.getDate() + offset);
      const ds = toDateStr(dt);
      const isSource = ds === sourceDateStr;
      const isPast = ds < todayStr;
      // Disallow if past OR the target already has a completed session.
      const occupant = sessionDateMap[ds];
      const occupantKeys = occupant == null ? [] : Array.isArray(occupant) ? occupant : [occupant];
      const occupantCompleted = occupantKeys.some((k) => completedDays.has(k));
      const hasConflict = occupantKeys.some((k) => k !== sessionKey);

      let disabled = false;
      let disabledReason: string | undefined;
      if (isPast) {
        disabled = true;
        disabledReason = 'Past';
      } else if (isSource) {
        disabled = true;
        disabledReason = 'Current';
      } else if (occupantCompleted) {
        disabled = true;
        disabledReason = 'Completed';
      }

      out.push({
        dateStr: ds,
        day: dt.getDate(),
        dow: dt.getDay(),
        label: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        disabled,
        disabledReason,
        isSource,
        isToday: ds === todayStr,
        hasConflict,
      });
    }
    return out;
  }, [sourceDateStr, sessionKey, sessionDateMap, completedDays, todayStr]);

  const selectedCell = selected ? cells.find((c) => c.dateStr === selected) : null;
  const selectedHasConflict = selectedCell?.hasConflict === true;

  const confirm = () => {
    if (!selected) return;
    const next = setScheduleOverride(profile, sourceDateStr, selected, sessionKey);
    onProfileUpdate({ scheduleOverrides: next.scheduleOverrides });
    onClose();
  };

  const sourceLabel = useMemo(() => {
    const dt = new Date(sourceDateStr + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }, [sourceDateStr]);

  return (
    <Sheet open={open} onClose={onClose} zIndex={360}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="move-workout-title"
        style={{ padding: '8px 20px 24px' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
                marginBottom: 4,
              }}
            >
              MOVE WORKOUT
            </div>
            <div
              id="move-workout-title"
              style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}
            >
              {sessionLabel || 'Session'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Currently on {sourceLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 20,
              lineHeight: 1,
              padding: '2px 6px',
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* DOW headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4,
            marginBottom: 4,
          }}
        >
          {DOW.map((d, i) => (
            <div
              key={i}
              style={{
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 14-day grid (±7) laid out as two rows of 7, aligned on the source day */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4,
          }}
        >
          {cells.map((c) => {
            const isSelected = selected === c.dateStr;
            const bg = isSelected
              ? 'var(--accent)33'
              : c.isSource
                ? 'var(--bg-inset)'
                : c.disabled
                  ? 'var(--bg-deep)'
                  : 'var(--bg-surface)';
            const borderColor = isSelected
              ? 'var(--accent)'
              : c.hasConflict && !c.disabled
                ? 'var(--phase-peak)'
                : c.isToday
                  ? 'var(--accent)66'
                  : 'var(--border)';
            const textColor = c.disabled
              ? 'var(--text-dim)'
              : isSelected
                ? 'var(--accent)'
                : 'var(--text-primary)';
            return (
              <button
                key={c.dateStr}
                type="button"
                disabled={c.disabled}
                onClick={() => setSelected(c.dateStr)}
                aria-label={`${c.label}${c.disabledReason ? ` (${c.disabledReason})` : ''}${c.hasConflict ? ' — conflict' : ''}`}
                aria-pressed={isSelected}
                style={{
                  aspectRatio: '1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  borderRadius: tokens.radius.md,
                  background: bg,
                  border: `1.5px solid ${borderColor}`,
                  color: textColor,
                  cursor: c.disabled ? 'not-allowed' : 'pointer',
                  opacity: c.disabled ? 0.5 : 1,
                  padding: 0,
                  position: 'relative',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1 }}>{c.day}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 }}>
                  {c.label.split(' ')[0]}
                </span>
                {c.hasConflict && !c.disabled && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 4,
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'var(--phase-peak)',
                    }}
                  >
                    ×2
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedHasConflict && (
          <div
            role="status"
            style={{
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: tokens.radius.md,
              background: 'var(--phase-peak)14',
              border: '1px solid var(--phase-peak)55',
              color: 'var(--text-primary)',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: 'var(--phase-peak)' }}>Heads up:</strong> 2 workouts will be
            scheduled on this day. Both will show on Home and in the calendar.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: tokens.radius.lg,
              cursor: 'pointer',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!selected}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: tokens.radius.lg,
              cursor: selected ? 'pointer' : 'not-allowed',
              background: selected ? 'var(--accent)' : 'var(--bg-inset)',
              border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
              color: selected ? '#fff' : 'var(--text-muted)',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'inherit',
              opacity: selected ? 1 : 0.6,
            }}
          >
            Confirm Move
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export default MoveWorkoutSheet;
