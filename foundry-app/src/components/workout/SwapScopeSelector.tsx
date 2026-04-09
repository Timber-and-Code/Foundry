import { tokens } from '../../styles/tokens';

interface SwapScopeSelectorProps {
  exerciseName: string;
  onMeso: () => void;
  onWeek: () => void;
  onCancel: () => void;
}

function SwapScopeSelector({ exerciseName, onMeso, onWeek, onCancel }: SwapScopeSelectorProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 310,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.xl,
          padding: 24,
          maxWidth: 320,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Swap {exerciseName}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          Apply this swap to...
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onMeso}
            style={{
              padding: '14px 20px',
              borderRadius: tokens.radius.lg,
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Entire Meso
          </button>
          <button
            onClick={onWeek}
            style={{
              padding: '14px 20px',
              borderRadius: tokens.radius.lg,
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            This Session Only
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '10px',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default SwapScopeSelector;
