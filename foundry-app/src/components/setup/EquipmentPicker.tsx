import { tokens } from '../../styles/tokens';

export const EQUIPMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbells' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'band', label: 'Bands' },
  { value: 'machine', label: 'Machines' },
  { value: 'cable', label: 'Cable' },
];

interface EquipmentPickerProps {
  selected: string[];
  onToggle: (value: string) => void;
  /** Replace the whole selection — backs the "All equipment" row. */
  onSetAll: (values: string[]) => void;
}

function Check({ on }: { on: boolean }) {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: tokens.radius.sm,
        flexShrink: 0,
        border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
        background: on ? 'var(--accent)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

const itemStyle = (on: boolean): React.CSSProperties => ({
  padding: '12px 14px',
  borderRadius: tokens.radius.md,
  cursor: 'pointer',
  textAlign: 'left',
  background: on ? 'rgba(var(--accent-rgb),0.14)' : 'var(--bg-card)',
  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
  transition: 'all 0.15s',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
});

const labelStyle = (on: boolean): React.CSSProperties => ({
  fontSize: 13,
  fontWeight: 700,
  color: on ? 'var(--accent)' : 'var(--text-primary)',
});

/**
 * Equipment checklist shared by the auto and manual builders, with an
 * "All equipment" row so a full-gym lifter taps once instead of seven times.
 * Tapping All when everything is already on clears the list.
 */
export default function EquipmentPicker({ selected, onToggle, onSetAll }: EquipmentPickerProps) {
  const all = EQUIPMENT_OPTIONS.every((o) => selected.includes(o.value));
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
      <button
        type="button"
        aria-pressed={all}
        onClick={() => onSetAll(all ? [] : EQUIPMENT_OPTIONS.map((o) => o.value))}
        className="btn-toggle"
        style={itemStyle(all)}
      >
        <Check on={all} />
        <span style={labelStyle(all)}>All equipment</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>Full gym</span>
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {EQUIPMENT_OPTIONS.map(({ value, label }) => {
          const on = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(value)}
              className="btn-toggle"
              style={itemStyle(on)}
            >
              <Check on={on} />
              <span style={labelStyle(on)}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
