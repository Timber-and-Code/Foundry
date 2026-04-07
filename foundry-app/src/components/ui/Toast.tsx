import { tokens } from '../../styles/tokens';
import type { Toast, ToastType } from '../../contexts/ToastContext';

const TYPE_STYLES: Record<ToastType, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: {
    bg: 'rgba(76, 175, 80, 0.12)',
    border: 'rgba(76, 175, 80, 0.35)',
    icon: '✓',
    iconColor: tokens.colors.success,
  },
  error: {
    bg: tokens.colors.dangerBg,
    border: tokens.colors.dangerBorder,
    icon: '✕',
    iconColor: tokens.colors.dangerText,
  },
  warning: {
    bg: 'rgba(255, 152, 0, 0.12)',
    border: 'rgba(255, 152, 0, 0.35)',
    icon: '⚠',
    iconColor: tokens.colors.warning,
  },
  info: {
    bg: tokens.colors.accentSubtle,
    border: tokens.colors.accentBorder,
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
    <button
      onClick={() => onDismiss(toast.id)}
      aria-label={`Dismiss: ${toast.message}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        width: '100%',
        padding: `${tokens.spacing.sm + 2}px ${tokens.spacing.md}px`,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: tokens.radius.lg,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        textAlign: 'left',
        animation: 'foundry-toast-in 0.25s ease-out',
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
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(calc(100vw - 32px), 448px)',
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
