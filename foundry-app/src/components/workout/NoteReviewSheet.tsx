import { tokens } from '../../styles/tokens';

interface NoteReviewSheetProps {
  note: string;
  onChange: (val: string) => void;
  onFinish: () => void;
}

function NoteReviewSheet({ note, onChange, onFinish }: NoteReviewSheetProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: tokens.colors.overlayHeavy,
        zIndex: 220,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-review-title"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: `${tokens.radius.xxl}px ${tokens.radius.xxl}px 0 0`,
          width: '100%',
          maxWidth: 480,
          padding: '24px 20px 36px',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
            marginBottom: 10,
          }}
        >
          SESSION NOTES
        </div>
        <div
          id="note-review-title"
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: 18,
          }}
        >
          Anything to add before you go?
        </div>
        <textarea
          value={note}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Session notes"
          autoFocus
          rows={5}
          style={{
            width: '100%',
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-accent)',
            borderRadius: tokens.radius.lg,
            color: 'var(--text-primary)',
            fontSize: 13,
            padding: '12px 14px',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.6,
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            marginBottom: 16,
          }}
        />
        <button
          onClick={onFinish}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: tokens.radius.lg,
            background: 'var(--btn-primary-bg)',
            border: '1px solid var(--btn-primary-border)',
            color: 'var(--btn-primary-text)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          Finish Session ✓
        </button>
      </div>
    </div>
  );
}

export default NoteReviewSheet;
