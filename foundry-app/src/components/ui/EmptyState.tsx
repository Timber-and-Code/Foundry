import { tokens } from '../../styles/tokens';

interface EmptyStateProps {
  title: string;
  body?: string;
  cta?: { label: string; onClick: () => void };
  compact?: boolean;
}

export default function EmptyState({ title, body, cta, compact }: EmptyStateProps) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px dashed var(--border)',
        borderRadius: tokens.radius.lg,
        padding: compact ? '16px' : '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: compact ? 13 : 14,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '0.01em',
        }}
      >
        {title}
      </div>
      {body && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            maxWidth: 280,
          }}
        >
          {body}
        </div>
      )}
      {cta && (
        <button
          onClick={cta.onClick}
          style={{
            marginTop: 4,
            background: 'var(--accent)',
            color: 'var(--btn-primary-text)',
            border: 'none',
            borderRadius: tokens.radius.md,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.02em',
            cursor: 'pointer',
          }}
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}
