import { tokens } from '../../styles/tokens';

interface UnfinishedPromptModalProps {
  onKeepGoing: () => void;
  onMarkComplete: () => void;
}

function UnfinishedPromptModal({ onKeepGoing, onMarkComplete }: UnfinishedPromptModalProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg, padding: '28px 24px', maxWidth: 340, width: '100%',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8 }}>
          Not quite done
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
          Looks like this workout isn&apos;t finished yet. Do you still want to mark it complete?
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={onKeepGoing} style={{
            padding: 16, borderRadius: tokens.radius.md, cursor: 'pointer',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700,
          }}>Keep Going</button>
          <button onClick={onMarkComplete} style={{
            padding: 16, borderRadius: tokens.radius.md, cursor: 'pointer',
            background: 'var(--btn-primary-bg)', border: '1px solid var(--btn-primary-border)',
            color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 700,
          }}>Mark Complete</button>
        </div>
      </div>
    </div>
  );
}

export default UnfinishedPromptModal;
