import Modal from '../ui/Modal';
import { tokens } from '../../styles/tokens';

interface CoachConsentSheetProps {
  open: boolean;
  /** Agreed: remember it and run the coach. */
  onAccept: () => void;
  /** Declined: build the standard program instead. Nothing is sent. */
  onDecline: () => void;
  /** Dismissed (backdrop / Escape): decide later. Nothing happens. */
  onCancel: () => void;
}

/**
 * Asked once, before the coach's first run. Says plainly that it is AI, who
 * runs it, and exactly what is sent — and offers the same program without it.
 */
export default function CoachConsentSheet({ open, onAccept, onDecline, onCancel }: CoachConsentSheetProps) {
  return (
    <Modal open={open} onClose={onCancel} maxWidth={380}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.12em',
          color: tokens.colors.accent,
          marginBottom: 6,
        }}
      >
        BEFORE THE COACH STARTS
      </div>
      <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
        The coach is AI
      </h2>
      <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
        It runs on Claude, made by Anthropic. To write your program, The Foundry sends it your goal,
        experience, split, schedule, equipment, any notes you typed for the coach, and the top weights of
        your recent main lifts.
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
        Your name, email and account are not sent.{' '}
        <a
          href="https://thefoundry.coach/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: tokens.colors.accent }}
        >
          Privacy Policy
        </a>
      </p>
      <button
        type="button"
        onClick={onAccept}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: tokens.radius.md,
          cursor: 'pointer',
          background: 'var(--btn-primary-bg)',
          border: '1px solid var(--btn-primary-border)',
          color: 'var(--btn-primary-text)',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.04em',
        }}
      >
        Use the coach
      </button>
      <button
        type="button"
        onClick={onDecline}
        style={{
          width: '100%',
          marginTop: 8,
          padding: '14px',
          borderRadius: tokens.radius.md,
          cursor: 'pointer',
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Build without the coach
      </button>
    </Modal>
  );
}
