import { tokens } from '../../styles/tokens';

interface NoteReviewSheetProps {
  note: string;
  onChange: (val: string) => void;
  onFinish: () => void;
  onKeepGoing?: () => void;
}

const REFLECTION_PROMPTS = [
  'How did this workout feel?',
  'Did you hit your target volume?',
  'Any pain or discomfort?',
  'Notes for next session.',
];

function NoteReviewSheet({ note, onChange, onFinish, onKeepGoing }: NoteReviewSheetProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: tokens.colors.overlayHeavy,
        zIndex: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-review-title"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.xxl,
          width: '100%',
          maxWidth: 480,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          padding: '28px 22px 28px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: 'var(--text-muted)',
            }}
          >
            SESSION NOTES
          </div>
          {onKeepGoing && (
            <button
              onClick={onKeepGoing}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-accent)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              <span aria-hidden="true">←</span> Keep going
            </button>
          )}
        </div>
        <div
          id="note-review-title"
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: 6,
          }}
        >
          Reflect on today's session
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          A few prompts to guide you — write as much or as little as you like.
        </div>
        <ul
          style={{
            listStyle: 'none',
            padding: '14px 16px',
            margin: '0 0 16px 0',
            background: 'var(--bg-inset)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {REFLECTION_PROMPTS.map((prompt) => (
            <li
              key={prompt}
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  color: 'var(--text-accent)',
                  fontWeight: 800,
                  marginTop: 1,
                }}
              >
                ·
              </span>
              <span>{prompt}</span>
            </li>
          ))}
        </ul>
        <textarea
          value={note}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Session notes"
          placeholder="Today's reflection…"
          autoFocus
          rows={7}
          style={{
            width: '100%',
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-accent)',
            borderRadius: tokens.radius.lg,
            color: 'var(--text-primary)',
            fontSize: 14,
            padding: '14px 16px',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.6,
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            marginBottom: 16,
            minHeight: 150,
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
