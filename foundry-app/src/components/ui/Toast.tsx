import { tokens } from '../../styles/tokens';
import type { Toast, ToastType } from '../../contexts/ToastContext';

const TYPE_STYLES: Record<ToastType, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: {
    bg: '#1a2e1a',
    border: 'rgba(76, 175, 80, 0.5)',
    icon: '✓',
    iconColor: tokens.colors.success,
  },
  error: {
    bg: '#2e1a1a',
    border: 'rgba(220, 38, 38, 0.5)',
    icon: '✕',
    iconColor: tokens.colors.dangerText,
  },
  warning: {
    bg: '#2e2614',
    border: 'rgba(255, 152, 0, 0.5)',
    icon: '⚠',
    iconColor: tokens.colors.warning,
  },
  info: {
    bg: '#1e1810',
    border: 'rgba(232, 101, 26, 0.5)',
    icon: 'ℹ',
    iconColor: tokens.colors.accentDim,
  },
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const s = TYPE_STYLES[toast.type];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: tokens.radius.lg,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        animation: 'foundry-toast-in 0.25s ease-out',
      }}
    >
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={`Dismiss: ${toast.message}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          flex: 1,
          minWidth: 0,
          padding: `${tokens.spacing.sm + 2}px ${tokens.spacing.md}px`,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: 14,
            color: s.iconColor,
            flexShrink: 0,
            fontWeight: tokens.fontWeight.bold,
            lineHeight: 1,
          }}
        >
          {s.icon}
        </span>
        <span
          style={{
            fontSize: tokens.fontSize.md,
            color: tokens.colors.textPrimary,
            fontWeight: tokens.fontWeight.medium,
            lineHeight: 1.3,
            flex: 1,
          }}
        >
          {toast.message}
        </span>
      </button>
      {/* Inline action ("Share", "Undo") — the undo pattern: the fix for a
          mis-tap lives where the mis-tap happened. Tapping it also dismisses. */}
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            onDismiss(toast.id);
            toast.action?.onClick();
          }}
          style={{
            flexShrink: 0,
            padding: `0 ${tokens.spacing.md}px`,
            background: 'transparent',
            border: 'none',
            borderLeft: `1px solid ${s.border}`,
            color: tokens.colors.accent,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <>
      <style>{`
        @keyframes foundry-toast-in {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          bottom: 88,
          // Centered on the content area — clear of the side rail when it's
          // showing (--rail-w is 0 everywhere else).
          left: 'calc(50% + var(--rail-w) / 2)',
          transform: 'translateX(-50%)',
          width: 'min(calc(100vw - 32px - var(--rail-w)), 448px)',
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacing.xs,
          zIndex: tokens.zIndex.toast,
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onDismiss={onDismiss} />
          </div>
        ))}
      </div>
    </>
  );
}
