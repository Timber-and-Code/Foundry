import { useEffect, useMemo, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { MOBILITY_PROTOCOLS } from '../../data/constants';
import type { MobilityScheduleSlot, Profile } from '../../types';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function lookupProtocolLabel(id: string): string {
  return MOBILITY_PROTOCOLS.find((p) => p.id === id)?.name ?? id;
}

interface MobilityApplySheetProps {
  protocolId: string;
  protocolLabel: string;
  schedule: MobilityScheduleSlot[];
  onApply: (nextSchedule: MobilityScheduleSlot[], addedCount: number) => void;
  onClose: () => void;
}

export default function MobilityApplySheet({
  protocolId,
  protocolLabel,
  schedule,
  onApply,
  onClose,
}: MobilityApplySheetProps) {
  // Pre-select DOWs where this protocol is already scheduled
  const initiallySelected = useMemo(
    () => new Set(schedule.filter((s) => s.protocol === protocolId).map((s) => s.dayOfWeek)),
    [schedule, protocolId]
  );
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initiallySelected));

  // Conflict lookup: DOW → existing (different) mobility protocol id
  const conflicts = useMemo(() => {
    const map: Record<number, string> = {};
    for (const slot of schedule) {
      if (slot.protocol !== protocolId) map[slot.dayOfWeek] = slot.protocol;
    }
    return map;
  }, [schedule, protocolId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (dow: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dow)) next.delete(dow);
      else next.add(dow);
      return next;
    });
  };

  const apply = () => {
    // Build next schedule: remove entries for this protocol on unselected days,
    // overwrite conflicting other-protocol slots on selected days, add new entries.
    const filtered = schedule.filter((s) => {
      if (selected.has(s.dayOfWeek)) return false; // we own this DOW now
      if (s.protocol === protocolId) return false; // remove deselected entries of this protocol
      return true;
    });
    const added: MobilityScheduleSlot[] = Array.from(selected).map((dayOfWeek) => ({
      dayOfWeek,
      protocol: protocolId,
    }));
    const next = [...filtered, ...added].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    const addedCount = Array.from(selected).filter((d) => !initiallySelected.has(d)).length;
    onApply(next, addedCount);
  };

  const changed =
    selected.size !== initiallySelected.size ||
    Array.from(selected).some((d) => !initiallySelected.has(d));

  const conflictDays = Array.from(selected).filter((d) => conflicts[d]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobility-apply-heading"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: tokens.colors.overlay,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          borderRadius: `${tokens.radius.xl}px ${tokens.radius.xl}px 0 0`,
          padding: '18px 20px 24px',
          width: '100%',
          maxWidth: 520,
          boxShadow: 'var(--shadow-xl)',
          animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: 'var(--border)',
            margin: '0 auto 14px',
          }}
          aria-hidden="true"
        />
        <div
          id="mobility-apply-heading"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: 'var(--accent)',
            marginBottom: 4,
          }}
        >
          ADD TO SCHEDULE
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          {protocolLabel}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            marginBottom: 16,
          }}
        >
          Pick the days you want this on. You can apply to more than one day.
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
            marginBottom: 14,
          }}
          role="group"
          aria-label="Days of the week"
        >
          {DOW_LABELS.map((label, dow) => {
            const isSelected = selected.has(dow);
            const conflictProtoId = conflicts[dow];
            return (
              <button
                key={dow}
                onClick={() => toggle(dow)}
                aria-pressed={isSelected}
                style={{
                  padding: '10px 0',
                  borderRadius: tokens.radius.md,
                  border: isSelected
                    ? '1px solid var(--accent)'
                    : conflictProtoId
                      ? '1px solid rgba(var(--accent-rgb),0.35)'
                      : '1px solid var(--border)',
                  background: isSelected
                    ? 'rgba(var(--accent-rgb),0.14)'
                    : 'var(--bg-inset)',
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  textTransform: 'uppercase' as const,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {conflictDays.length > 0 && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1.55,
              background: 'rgba(var(--accent-rgb),0.07)',
              border: '1px solid rgba(var(--accent-rgb),0.2)',
              borderRadius: tokens.radius.md,
              padding: '10px 12px',
              marginBottom: 16,
            }}
            role="status"
          >
            {conflictDays.map((d) => (
              <div key={d} style={{ marginBottom: d === conflictDays[conflictDays.length - 1] ? 0 : 4 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{DOW_LABELS[d]}:</strong>{' '}
                replaces {lookupProtocolLabel(conflicts[d])}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: tokens.radius.lg,
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={!changed}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: tokens.radius.lg,
              background: changed ? 'var(--btn-primary-bg)' : 'var(--bg-inset)',
              border: `1px solid ${changed ? 'var(--btn-primary-border)' : 'var(--border)'}`,
              color: changed ? 'var(--btn-primary-text)' : 'var(--text-muted)',
              fontSize: 13,
              fontWeight: 700,
              cursor: changed ? 'pointer' : 'not-allowed',
              letterSpacing: '0.02em',
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to merge a mobility schedule update into a Profile immutably.
// Mirrors applyCardioScheduleUpdate in CardioApplySheet.
export function applyMobilityScheduleUpdate(
  profile: Profile,
  nextSchedule: MobilityScheduleSlot[]
): Profile {
  return { ...profile, mobilitySchedule: nextSchedule };
}
