/**
 * "You moved things around — how far should that stick?"
 *
 * Raised once when the reorder sheet closes, not on every drag. Asking after
 * each move would make reordering four exercises four decisions.
 *
 * The options are role-dependent because the data model makes them so. An
 * owner's training_day_exercises rows ARE the program their partner reads, so
 * saving genuinely changes someone else's training. A member's rows are an
 * overlay only they see, so saving cannot affect the owner. Saying "just you"
 * to an owner would be a lie, and saying "everyone" to a member would be too.
 */
import Modal from '../ui/Modal';
import { tokens } from '../../styles/tokens';
import type { ProgramRole } from '../../utils/reorderPersistence';

interface ReorderScopeSheetProps {
  role: ProgramRole;
  dayLabel: string;
  busy?: boolean;
  /** Keep the new order for this session only — nothing is written. */
  onSessionOnly: () => void;
  /** Write it to the program and push it. */
  onPersist: () => void;
}

const COPY: Record<
  ProgramRole,
  { persistLabel: string; persistHint: string }
> = {
  solo: {
    persistLabel: 'Keep this order',
    persistHint: 'Applies to this day in every week of the meso.',
  },
  owner: {
    // The only case where saving reaches another human. Name that plainly —
    // this is someone else's training session being rearranged.
    persistLabel: 'Keep it for everyone',
    persistHint:
      'You share this program. Everyone training it will see this order, in every week.',
  },
  member: {
    persistLabel: 'Keep it for me',
    persistHint:
      "Applies to this day in every week, for you only. It won't change the program for whoever shared it.",
  },
};

export default function ReorderScopeSheet({
  role,
  dayLabel,
  busy = false,
  onSessionOnly,
  onPersist,
}: ReorderScopeSheetProps) {
  const copy = COPY[role];

  return (
    <Modal open onClose={busy ? () => {} : onSessionOnly} maxWidth={420}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: 'var(--accent)',
          marginBottom: 4,
        }}
      >
        NEW ORDER
      </div>
      <div
        style={{
          fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
          fontSize: 26,
          fontWeight: 400,
          color: 'var(--text-primary)',
          letterSpacing: '0.02em',
          lineHeight: 1.05,
          marginBottom: 14,
        }}
      >
        {dayLabel}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={onPersist}
          disabled={busy}
          data-testid="reorder-persist"
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: tokens.radius.md,
            background: 'var(--accent)',
            border: 'none',
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.04em',
            cursor: busy ? 'wait' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            alignItems: 'center',
          }}
        >
          <span>{busy ? 'Saving…' : copy.persistLabel}</span>
          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.9 }}>
            {copy.persistHint}
          </span>
        </button>

        <button
          onClick={onSessionOnly}
          disabled={busy}
          data-testid="reorder-session-only"
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: tokens.radius.md,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: busy ? 'wait' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            alignItems: 'center',
          }}
        >
          <span>Just today</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
            Next time this day comes round, it goes back to normal.
          </span>
        </button>
      </div>
    </Modal>
  );
}
