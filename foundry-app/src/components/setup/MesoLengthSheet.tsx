import { tokens } from '../../styles/tokens';
import Sheet from '../ui/Sheet';

export type MesoLength = 4 | 6 | 8;

interface MesoLengthSheetProps {
  open: boolean;
  current: MesoLength;
  onSelect: (length: MesoLength) => void;
  onClose: () => void;
}

interface LengthDef {
  value: MesoLength;
  label: string;
  desc: string;
}

const OPTIONS: LengthDef[] = [
  {
    value: 4,
    label: '4 weeks',
    desc: 'Short cycle. Three build weeks, one deload. Fast feedback.',
  },
  {
    value: 6,
    label: '6 weeks',
    desc: 'Balanced cycle. Five build weeks, one deload. The default for most lifters.',
  },
  {
    value: 8,
    label: '8 weeks',
    desc: 'Long cycle. Seven build weeks, one deload. Maximum volume accumulation.',
  },
];

/**
 * MesoLengthSheet — bottom sheet for choosing mesocycle length.
 * Three options: 4, 6, or 8 weeks.
 */
export default function MesoLengthSheet({
  open,
  current,
  onSelect,
  onClose,
}: MesoLengthSheetProps) {
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
          Mesocycle length
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
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  {opt.label}
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
