import Modal from '../ui/Modal';
import { tokens } from '../../styles/tokens';

const STANZAS: { h: string; b: string }[] = [
  {
    h: 'The idea',
    b: "The Foundry builds you a mesocycle, runs it alongside you, and makes sure every week gets harder than the last. You don't pick sets and reps. You don't guess when to deload. You show up, log your work, and come out the other side stronger.",
  },
  {
    h: 'Progressive overload, by the book',
    b: 'Volume and intensity ramp each week until you peak, then you deload and reset. Every meso is designed to leave you measurably stronger than the one before it.',
  },
  {
    h: 'Volume that actually means something',
    b: "MEV, MAV, MRV per muscle group. Real numbers, not hunches. You'll always know whether you're building, pushing, or holding on.",
  },
  {
    h: 'Every anchor lift, tracked',
    b: "Sparklines, trend arrows, peak-week detection. Your PRs live in one place, across every meso you've ever run.",
  },
  {
    h: 'The tools that do the heavy lifting',
    b: "Auto-firing rest timer. Phase-aware intensity targets. Meso-to-meso carryover. Profile-level progression rules. The stuff you'd otherwise track in a notebook.",
  },
  {
    h: 'Your training record, archived',
    b: "Every completed cycle saved with PRs, volume totals, and a snapshot of the profile that shaped it. The Foundry remembers so you don't have to.",
  },
];

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutModal({ open, onClose }: AboutModalProps) {
  return (
    <Modal open={open} onClose={onClose} maxWidth={460}>
      <div
        style={{
          maxHeight: '75vh',
          overflowY: 'auto',
          margin: '-28px -20px',
          padding: '24px 24px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: 'var(--accent)',
                marginBottom: 4,
              }}
            >
              THE FOUNDRY
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.15,
              }}
            >
              About
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
              fontSize: 22,
              lineHeight: 1,
              padding: '2px 6px',
              minWidth: 32,
              minHeight: 32,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {STANZAS.map((s) => (
            <div key={s.h}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: 5,
                  letterSpacing: '0.01em',
                }}
              >
                {s.h}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.65,
                }}
              >
                {s.b}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 20,
            paddingTop: 14,
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 12,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
            lineHeight: 1.55,
            textAlign: 'center',
          }}
        >
          Made for people who want to train well, not just train a lot.
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 18,
            width: '100%',
            padding: '12px',
            borderRadius: tokens.radius.md,
            background: 'var(--bg-inset)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
