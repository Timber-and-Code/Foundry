import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';
import { emit } from '../../utils/events';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Ambient reminder for anonymous users that their data lives on this
 * device only. Visible when:
 *   - !user (no Supabase account)
 *   - foundry:onboarded === '1' (past initial setup)
 *   - foundry:anon_banner_dismissed !== '1'
 *
 * Tapping opens SaveProgressSheet via foundry:save-sheet-request.
 * The × button hides it for this install.
 */
export default function AnonLocalBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(
    () => store.get('foundry:anon_banner_dismissed') === '1',
  );

  if (user) return null;
  if (store.get('foundry:onboarded') !== '1') return null;
  if (dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        marginBottom: 12,
        background: 'var(--bg-inset)',
        border: `1px solid ${tokens.colors.accentBorder}`,
        borderRadius: tokens.radius.md,
        fontSize: 12,
      }}
    >
      <button
        type="button"
        onClick={() => emit('foundry:save-sheet-request', { trigger: 'settings' })}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 8,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          color: tokens.colors.textSecondary,
          fontSize: 12,
          lineHeight: 1.4,
          fontWeight: 500,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 14 }}>·</span>
        <span>Saved on this device only</span>
        <span
          style={{
            color: tokens.colors.accent,
            fontWeight: 700,
            marginLeft: 'auto',
          }}
        >
          Sign in <span aria-hidden="true">→</span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Dismiss device-only reminder"
        onClick={() => {
          store.set('foundry:anon_banner_dismissed', '1');
          setDismissed(true);
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: tokens.colors.textMuted,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '2px 6px',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
