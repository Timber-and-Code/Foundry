import { tokens } from '../../styles/tokens';
import Sheet from '../ui/Sheet';

export type SessionLength = 'short' | 'standard' | 'long';

interface SessionLengthSheetProps {
  open: boolean;
  current: SessionLength;
  onSelect: (length: SessionLength) => void;
  onClose: () => void;
}

interface LengthDef {
  value: SessionLength;
  label: string;
  duration: string;
  exerciseTarget: string;
  desc: string;
}

const OPTIONS: LengthDef[] = [
  {
    value: 'short',
    label: 'Short',
    duration: '~30–45 min',
    exerciseTarget: '3–4 exercises',
    desc: 'In, out, and on with your day. Focused on anchors and essentials.',
  },
  {
    value: 'standard',
    label: 'Standard',
    duration: '~45–60 min',
    exerciseTarget: '4–5 exercises',
    desc: 'The sweet spot for most lifters. Enough volume to drive growth without overflow.',
  },
  {
    value: 'long',
    label: 'Long',
    duration: '~60–75 min',
    exerciseTarget: '5–7 exercises',
    desc: 'Extra accessory volume and time for superset pairings.',
  },
];

/**
 * SessionLengthSheet — bottom sheet for choosing session duration.
 * Maps to an exercise-count target per day that feeds program generation.
 */
export default function SessionLengthSheet({
  open,
  current,
  onSelect,
  onClose,
}: SessionLengthSheetProps) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ padding: '4px 20px 28px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: tokens.colors.textSecondary,
            marginBottom: 14,
          }}
        >
          Session length
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OPTIONS.map((opt) => {
            const selected = opt.value === current;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onSelect(opt.value);
                  onClose();
                }}
                aria-pressed={selected}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${selected ? tokens.colors.accent : 'rgba(255,255,255,0.08)'}`,
                  background: selected ? tokens.colors.accentMuted : tokens.colors.bgCard,
                  color: tokens.colors.textPrimary,
                  cursor: 'pointer',
                  transition: 'all 180ms ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{opt.label}</div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: tokens.colors.textMuted,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {opt.duration} · {opt.exerciseTarget}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: tokens.colors.textMuted,
                    lineHeight: 1.5,
                  }}
                >
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
