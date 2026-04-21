import { tokens } from '../../styles/tokens';
import Sheet from '../ui/Sheet';

export type SplitType =
  | 'ppl'
  | 'upper_lower'
  | 'push_pull'
  | 'full_body'
  | 'traditional'
  | 'custom';

interface SplitSheetProps {
  open: boolean;
  current: SplitType;
  daysPerWeek: number;
  onSelect: (split: SplitType) => void;
  onClose: () => void;
}

interface SplitBodyProps {
  current: SplitType;
  daysPerWeek: number;
  onSelect: (split: SplitType) => void;
}

interface SplitDef {
  key: SplitType;
  label: string;
  desc: string;
  validDays: number[] | 'any';
}

const SPLITS: SplitDef[] = [
  {
    key: 'ppl',
    label: 'Push · Pull · Legs',
    desc: 'Each muscle group hit 1–2×/week. The gold standard for hypertrophy and strength.',
    validDays: [3, 5, 6],
  },
  {
    key: 'upper_lower',
    label: 'Upper / Lower',
    desc: 'Upper body + lower body rotation. 2 sessions per muscle group. Strong recovery balance.',
    validDays: [2, 3, 4, 5, 6],
  },
  {
    key: 'push_pull',
    label: 'Push / Pull',
    desc: 'Push / pull rotation with legs folded in. No dedicated leg day.',
    validDays: [2, 3, 4, 5, 6],
  },
  {
    key: 'full_body',
    label: 'Full Body',
    desc: 'Push, pull, and legs every session. High frequency — great for beginners and busy weeks.',
    validDays: [2, 3, 4, 5],
  },
  {
    key: 'traditional',
    label: 'Traditional',
    desc: 'One body part per day. Classic aesthetics-focused split.',
    validDays: [4, 5],
  },
  {
    key: 'custom',
    label: 'Custom',
    desc: 'Design your own split — pick exercises per day yourself.',
    validDays: 'any',
  },
];

const isRecommended = (s: SplitDef, days: number): boolean =>
  s.validDays === 'any' || s.validDays.includes(days);

/**
 * SplitBody — the reusable body of the split picker.
 *
 * Six cards. The "Recommended" flag appears on splits whose validDays
 * list includes the user's current daysPerWeek. Custom is always valid.
 * Rendered inline inside the Beat 2 AccordionBar and inside the legacy
 * SplitSheet bottom-sheet wrapper below.
 */
export function SplitBody({ current, daysPerWeek, onSelect }: SplitBodyProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {SPLITS.map((s) => {
        const selected = s.key === current;
        const recommended = isRecommended(s, daysPerWeek);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
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
                alignItems: 'center',
                gap: 10,
                marginBottom: 4,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700 }}>{s.label}</div>
              {recommended && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: tokens.colors.accent,
                    border: `1px solid ${tokens.colors.accentBorder}`,
                    borderRadius: tokens.radius.pill,
                    padding: '2px 8px',
                  }}
                >
                  Recommended
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 12,
                color: tokens.colors.textMuted,
                lineHeight: 1.5,
              }}
            >
              {s.desc}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * SplitSheet — legacy bottom-sheet wrapper for choosing a training split.
 *
 * Beat 2 now uses `SplitBody` directly inside an AccordionBar. This
 * wrapper is retained for any standalone callers (and for the existing
 * test suite).
 */
export default function SplitSheet({
  open,
  current,
  daysPerWeek,
  onSelect,
  onClose,
}: SplitSheetProps) {
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
          Choose your split
        </div>
        <SplitBody
          current={current}
          daysPerWeek={daysPerWeek}
          onSelect={(k) => {
            onSelect(k);
            onClose();
          }}
        />
      </div>
    </Sheet>
  );
}
