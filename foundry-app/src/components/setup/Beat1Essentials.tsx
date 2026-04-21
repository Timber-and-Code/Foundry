import React, { useEffect, useState } from 'react';
import { tokens } from '../../styles/tokens';

/**
 * Beat 1 — "Four essentials" screen.
 *
 * Smart defaults keep this a 30-second pass. Days-per-week auto-fills a
 * sensible weekday pattern; the user can adjust. Start date defaults to
 * today.
 */
export interface Beat1Values {
  daysPerWeek: number;
  /** Weekday indices 0..6 (Sunday..Saturday). length === daysPerWeek. */
  workoutDays: number[];
  equipment: 'full_gym' | 'home_gym' | 'minimal';
  startDate: string; // yyyy-mm-dd
}

interface Beat1Props {
  initial?: Partial<Beat1Values>;
  onContinue: (values: Beat1Values) => void;
}

// Weekday 0..6 (Sun..Sat). Defaults favour Mon/Wed/Fri style patterns.
const DEFAULT_WORKOUT_DAYS: Record<number, number[]> = {
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_ARIA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Beat1Essentials({ initial, onContinue }: Beat1Props) {
  const [days, setDays] = useState<number>(initial?.daysPerWeek ?? 4);
  const [workoutDays, setWorkoutDays] = useState<number[]>(
    () => initial?.workoutDays ?? DEFAULT_WORKOUT_DAYS[initial?.daysPerWeek ?? 4] ?? [1, 2, 4, 5],
  );
  const [equipment, setEquipment] = useState<Beat1Values['equipment']>(
    initial?.equipment ?? 'full_gym',
  );
  const [startDate, setStartDate] = useState<string>(() => {
    if (initial?.startDate) return initial.startDate;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Auto-adjust workoutDays when daysPerWeek changes — either use the
  // stored default pattern or trim/extend the user's current selection.
  useEffect(() => {
    setWorkoutDays((prev) => {
      if (prev.length === days) return prev;
      if (prev.length > days) return [...prev].slice(0, days).sort((a, b) => a - b);
      const fill = DEFAULT_WORKOUT_DAYS[days] ?? prev;
      return [...fill].sort((a, b) => a - b);
    });
  }, [days]);

  const toggleWorkoutDay = (dow: number) => {
    setWorkoutDays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort((a, b) => a - b),
    );
  };

  const workoutDaysValid = workoutDays.length === days;
  const ready = !!days && workoutDaysValid && !!equipment && !!startDate;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.bgRoot,
        color: tokens.colors.textPrimary,
        fontFamily: "'Inter', system-ui, sans-serif",
        maxWidth: 480,
        margin: '0 auto',
        padding: '28px 24px 32px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontFamily: "'Bebas Neue', 'Inter', sans-serif",
          fontSize: 32,
          letterSpacing: '0.12em',
          marginBottom: 8,
        }}
      >
        ESSENTIALS
      </div>
      <div
        style={{
          fontSize: 13,
          color: tokens.colors.textMuted,
          marginBottom: 28,
        }}
      >
        Four quick answers. Everything else has a smart default.
      </div>

      <FieldLabel>How many days per week?</FieldLabel>
      <PillRow
        ariaLabel="Days per week"
        options={[3, 4, 5, 6]}
        selected={days}
        onSelect={setDays}
        renderLabel={(n) => String(n)}
      />

      <FieldLabel>Which days?</FieldLabel>
      <div
        role="group"
        aria-label="Workout days"
        style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}
      >
        {WEEKDAY_LABELS.map((label, dow) => {
          const on = workoutDays.includes(dow);
          return (
            <button
              key={dow}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={WEEKDAY_ARIA[dow]}
              onClick={() => toggleWorkoutDay(dow)}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: tokens.radius.md,
                border: `1px solid ${on ? tokens.colors.accent : 'rgba(255,255,255,0.12)'}`,
                background: on ? tokens.colors.accentMuted : 'transparent',
                color: on ? tokens.colors.textPrimary : tokens.colors.textSecondary,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 160ms ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div
        aria-live="polite"
        style={{
          fontSize: 12,
          marginTop: 6,
          color: workoutDaysValid ? tokens.colors.textMuted : tokens.colors.danger,
          fontWeight: 600,
        }}
      >
        {workoutDaysValid
          ? `${workoutDays.length} of 7 selected`
          : `Pick exactly ${days} day${days === 1 ? '' : 's'} (${workoutDays.length} selected)`}
      </div>

      <FieldLabel>Where do you train?</FieldLabel>
      <PillRow<Beat1Values['equipment']>
        ariaLabel="Equipment"
        options={['full_gym', 'home_gym', 'minimal']}
        selected={equipment}
        onSelect={setEquipment}
        renderLabel={(k) =>
          k === 'full_gym' ? 'Full gym' : k === 'home_gym' ? 'Home gym' : 'Minimal'
        }
      />

      <FieldLabel>Start date</FieldLabel>
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        style={{
          width: '100%',
          padding: '14px 16px',
          borderRadius: tokens.radius.md,
          border: `1px solid ${tokens.colors.accentBorder}`,
          background: tokens.colors.bgInput,
          color: tokens.colors.textPrimary,
          fontSize: 15,
          outline: 'none',
          marginBottom: 32,
          boxSizing: 'border-box',
        }}
      />

      <button
        type="button"
        disabled={!ready}
        onClick={() => ready && onContinue({ daysPerWeek: days, workoutDays, equipment, startDate })}
        style={{
          width: '100%',
          padding: '16px',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          borderRadius: tokens.radius.xl,
          background: ready ? tokens.colors.btnPrimaryBg : 'rgba(192,57,43,0.3)',
          border: `1px solid ${ready ? tokens.colors.btnPrimaryBorder : 'rgba(232,101,26,0.2)'}`,
          color: ready ? tokens.colors.btnPrimaryText : tokens.colors.textDim,
          cursor: ready ? 'pointer' : 'not-allowed',
          boxShadow: ready ? '0 4px 24px rgba(232,101,26,0.35)' : 'none',
        }}
      >
        See my program
      </button>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: tokens.colors.textSecondary,
        margin: '18px 0 10px',
      }}
    >
      {children}
    </div>
  );
}

function PillRow<T extends string | number>({
  options,
  selected,
  onSelect,
  renderLabel,
  ariaLabel,
}: {
  options: T[];
  selected: T;
  onSelect: (v: T) => void;
  renderLabel: (v: T) => string;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
    >
      {options.map((o) => {
        const on = selected === o;
        return (
          <button
            key={String(o)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(o)}
            style={{
              padding: '10px 16px',
              borderRadius: tokens.radius.pill,
              border: `1px solid ${on ? tokens.colors.accent : 'rgba(255,255,255,0.12)'}`,
              background: on ? tokens.colors.accentMuted : 'transparent',
              color: on ? tokens.colors.textPrimary : tokens.colors.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {renderLabel(o)}
          </button>
        );
      })}
    </div>
  );
}
