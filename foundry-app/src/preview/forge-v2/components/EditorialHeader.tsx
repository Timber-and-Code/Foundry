import type { ReactNode } from 'react';

interface EditorialHeaderProps {
  metaLeft: string;
  metaRight: string;
  title: ReactNode;
  status?: ReactNode;
}

export function EditorialHeader({ metaLeft, metaRight, title, status }: EditorialHeaderProps) {
  return (
    <header style={{ marginBottom: 40 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.3em',
            color: 'var(--fv-text-4)',
            textTransform: 'uppercase',
          }}
        >
          {metaLeft}
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.3em',
            color: 'var(--fv-text-4)',
            textTransform: 'uppercase',
          }}
        >
          {metaRight}
        </span>
      </div>

      <div
        style={{
          height: 1,
          background: 'linear-gradient(90deg, #404040, #525252, transparent)',
          marginBottom: 20,
        }}
      />

      <h1
        style={{
          fontFamily: 'var(--fv-font-display)',
          fontSize: 56,
          lineHeight: 0.88,
          letterSpacing: '0.01em',
          color: 'var(--fv-text-hi)',
          margin: 0,
          marginBottom: 12,
        }}
      >
        {title}
      </h1>

      {status && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 11,
            color: 'var(--fv-text-3)',
            letterSpacing: '0.05em',
          }}
        >
          {status}
        </div>
      )}
    </header>
  );
}
