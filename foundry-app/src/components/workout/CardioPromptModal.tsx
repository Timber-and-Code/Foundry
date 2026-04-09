import { tokens } from '../../styles/tokens';

interface CardioPromptModalProps {
  onLogCardio: () => void;
  onDismiss: () => void;
}

function CardioPromptModal({ onLogCardio, onDismiss }: CardioPromptModalProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 210,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: tokens.radius.xl, padding: '32px 24px', maxWidth: 340, width: '100%',
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8 }}>
          Add Cardio?
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
          Your lifting session is complete. Want to log a cardio session?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onLogCardio} style={{
            padding: 16, borderRadius: tokens.radius.lg, cursor: 'pointer',
            background: 'var(--phase-accum)22', border: '1px solid var(--phase-accum)',
            color: 'var(--phase-accum)', fontSize: 14, fontWeight: 700,
          }}>Log Cardio →</button>
          <button onClick={onDismiss} style={{
            padding: 14, borderRadius: tokens.radius.lg, cursor: 'pointer',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
          }}>Done for Today</button>
        </div>
      </div>
    </div>
  );
}

export default CardioPromptModal;
