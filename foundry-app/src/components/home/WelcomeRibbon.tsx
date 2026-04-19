import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';

interface WelcomeRibbonProps {
  name?: string | null;
}

/**
 * First-session welcome ribbon on Home. Shows only while:
 *   - foundry:onboarded === '1'
 *   - foundry:first_set_emitted !== '1' (no real set logged yet)
 *   - foundry:welcome_ribbon_dismissed !== '1'
 */
export default function WelcomeRibbon({ name }: WelcomeRibbonProps) {
  const [dismissed, setDismissed] = useState(
    () =>
      store.get('foundry:welcome_ribbon_dismissed') === '1' ||
      store.get('foundry:first_set_emitted') === '1',
  );

  if (dismissed) return null;

  const firstName = name ? name.split(/\s+/)[0] : null;
  const greeting = firstName
    ? `You're ready, ${firstName}. Tap today's workout to start.`
    : "You're ready. Tap today's workout to start.";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: tokens.colors.accentMuted,
        border: `1px solid ${tokens.colors.accentBorder}`,
        borderRadius: tokens.radius.md,
        fontSize: 13,
        color: tokens.colors.textPrimary,
        lineHeight: 1.4,
      }}
    >
      <div style={{ flex: 1 }}>{greeting}</div>
      <button
        type="button"
        aria-label="Dismiss welcome message"
        onClick={() => {
          store.set('foundry:welcome_ribbon_dismissed', '1');
          setDismissed(true);
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: tokens.colors.textMuted,
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '4px 8px',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
