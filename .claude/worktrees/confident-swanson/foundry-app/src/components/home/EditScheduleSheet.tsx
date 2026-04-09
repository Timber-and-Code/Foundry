import React from 'react';
import { getWorkoutDaysForWeek, ensureWorkoutDaysHistory, saveProfile } from '../../utils/store';
import { tokens } from '../../styles/tokens';
import Sheet from '../ui/Sheet';

interface EditScheduleSheetProps {
  showEditSchedule: boolean;
  setShowEditSchedule: (v: boolean) => void;
  profile: any;
  currentWeek: number;
  onProfileUpdate: (profile: any) => void;
}

function EditScheduleSheet({
  showEditSchedule,
  setShowEditSchedule,
  profile,
  currentWeek,
  onProfileUpdate,
}: EditScheduleSheetProps) {
  if (!showEditSchedule) return null;

  const DOW_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDays = getWorkoutDaysForWeek(profile, currentWeek);
  const requiredCount = currentDays.length;

  const Inner = () => {
    const [selected, setSelected] = React.useState([...currentDays]);
    const [confirmScope, setConfirmScope] = React.useState(false);
    const [pendingDays, setPendingDays] = React.useState<number[] | null>(null);
    const countOk = selected.length === requiredCount;

    const toggleDay = (dow: any) => {
      setSelected((prev) =>
        prev.includes(dow)
          ? prev.filter((d) => d !== dow).sort((a, b) => a - b)
          : [...prev, dow].sort((a, b) => a - b)
      );
    };

    const applyRemap = (scope: any) => {
      const p = ensureWorkoutDaysHistory(profile);
      const history = [...(p.workoutDaysHistory || [])];
      const priorDays = getWorkoutDaysForWeek(p, currentWeek);
      const pruned = history.filter((e) => e.fromWeek < currentWeek);
      if (scope === 'week') {
        pruned.push({ fromWeek: currentWeek, days: pendingDays ?? [] });
        pruned.push({ fromWeek: currentWeek + 1, days: priorDays });
      } else {
        pruned.push({ fromWeek: currentWeek, days: pendingDays ?? [] });
      }
      pruned.sort((a, b) => a.fromWeek - b.fromWeek);
      const updated = {
        ...p,
        workoutDaysHistory: pruned,
        workoutDays: pendingDays ?? [],
      };
      saveProfile(updated);
      if (onProfileUpdate)
        onProfileUpdate({
          workoutDaysHistory: pruned,
          workoutDays: pendingDays,
        });
      setShowEditSchedule(false);
    };

    if (confirmScope) {
      return (
        <div style={{ padding: '8px 20px 36px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 20,
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
                EDIT SCHEDULE
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                }}
              >
                Apply to which weeks?
              </div>
            </div>
            <button
              onClick={() => setShowEditSchedule(false)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 22,
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
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            You're moving training to{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {pendingDays!.map((d) => DOW_FULL[d]).join(', ')}
            </strong>
            . Should this apply to just this week, or to all remaining weeks?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => applyRemap('week')}
              style={{
                padding: '16px',
                borderRadius: tokens.radius.lg,
                cursor: 'pointer',
                textAlign: 'left',
                background: 'var(--accent)11',
                border: '1px solid var(--accent)55',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--accent)',
                  marginBottom: 2,
                }}
              >
                This week only (W{currentWeek + 1})
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Reverts to current schedule next week.
              </div>
            </button>
            <button
              onClick={() => applyRemap('meso')}
              style={{
                padding: '16px',
                borderRadius: tokens.radius.lg,
                cursor: 'pointer',
                textAlign: 'left',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: 2,
                }}
              >
                Rest of meso
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Applies from W{currentWeek + 1} through the end of this cycle.
              </div>
            </button>
          </div>
          <button
            onClick={() => setConfirmScope(false)}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '12px',
              borderRadius: tokens.radius.lg,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
        </div>
      );
    }

    return (
      <div style={{ padding: '8px 20px 36px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 8,
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
              EDIT SCHEDULE
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--text-primary)',
              }}
            >
              Choose training days
            </div>
          </div>
          <button
            onClick={() => setShowEditSchedule(false)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 22,
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
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          Select {requiredCount} day{requiredCount !== 1 ? 's' : ''} per week. Currently:{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            {currentDays.map((d: any) => DOW_FULL[d]).join(', ')}
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
            marginBottom: 20,
          }}
        >
          {DOW_FULL.map((name, dow) => {
            const isSel = selected.includes(dow);
            return (
              <button
                key={dow}
                onClick={() => toggleDay(dow)}
                style={{
                  padding: '10px 4px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  background: isSel ? 'var(--accent)22' : 'var(--bg-deep)',
                  border: `1px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                  color: isSel ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  transition: 'all 0.12s',
                }}
              >
                {name.slice(0, 2)}
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: tokens.radius.lg,
            marginBottom: 20,
            background: countOk ? 'var(--phase-accum)11' : 'var(--danger)11',
            border: `1px solid ${countOk ? 'var(--phase-accum)44' : 'var(--danger)44'}`,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {selected.length} of {requiredCount} days selected
          </span>
          {countOk ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--phase-accum)',
              }}
            >
              ✓ Ready
            </span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>
              {selected.length < requiredCount
                ? `Need ${requiredCount - selected.length} more`
                : `Deselect ${selected.length - requiredCount}`}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            if (!countOk) return;
            setPendingDays([...selected]);
            setConfirmScope(true);
          }}
          disabled={!countOk}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: tokens.radius.lg,
            cursor: countOk ? 'pointer' : 'not-allowed',
            background: countOk ? 'var(--btn-primary-bg)' : 'var(--bg-deep)',
            border: `1px solid ${countOk ? 'var(--btn-primary-border)' : 'var(--border)'}`,
            color: countOk ? 'var(--btn-primary-text)' : 'var(--text-dim)',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.06em',
            opacity: countOk ? 1 : 0.5,
          }}
        >
          SAVE SCHEDULE
        </button>
      </div>
    );
  };

  return (
    <Sheet open={!!showEditSchedule} onClose={() => setShowEditSchedule(false)} zIndex={400}>
      <Inner />
    </Sheet>
  );
}

export default EditScheduleSheet;
