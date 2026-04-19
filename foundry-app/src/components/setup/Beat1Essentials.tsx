import React, { useState } from 'react';
import { tokens } from '../../styles/tokens';

/**
 * PHASE 2 SCAFFOLD — Beat 1 "three essentials" screen.
 *
 * TODO(phase-2): wire values into Beat2Preview. Smart defaults from
 * foundry:onboarding_data (experience): Just starting → 3 days, Under
 * 2 years → 4, 2+ years → 5. Equipment branches Auto/Manual exercise
 * selection in program.ts. Start date defaults to next Monday unless
 * the user overrides.
 */
export interface Beat1Values {
  daysPerWeek: number;
  equipment: 'full_gym' | 'home_gym' | 'minimal';
  startDate: string; // yyyy-mm-dd
}

interface Beat1Props {
  initial?: Partial<Beat1Values>;
  onContinue: (values: Beat1Values) => void;
}

export default function Beat1Essentials({ initial, onContinue }: Beat1Props) {
  const [days, setDays] = useState<number>(initial?.daysPerWeek ?? 4);
  const [equipment, setEquipment] = useState<Beat1Values['equipment']>(
    initial?.equipment ?? 'full_gym',
  );
  const [startDate, setStartDate] = useState<string>(() => {
    if (initial?.startDate) return initial.startDate;
    // Default to today
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const ready = !!days && !!equipment && !!startDate;

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
        Three quick answers. Everything else has a smart default.
      </div>

      <FieldLabel>How many days per week?</FieldLabel>
      <PillRow
        ariaLabel="Days per week"
        options={[3, 4, 5, 6]}
        selected={days}
        onSelect={setDays}
        renderLabel={(n) => String(n)}
      />

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
        onClick={() => ready && onContinue({ daysPerWeek: days, equipment, startDate })}
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
