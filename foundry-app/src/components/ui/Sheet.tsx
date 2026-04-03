import React from 'react';
import { tokens } from '../../styles/tokens';

interface SheetProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  zIndex?: number;
}

/**
 * Sheet — bottom sheet that slides up from the bottom of the screen.
 */
export default function Sheet({ open, onClose, children, maxWidth = 480, zIndex = 300 }: SheetProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: tokens.colors.overlay,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: `${tokens.radius.xxl}px ${tokens.radius.xxl}px 0 0`,
          width: '100%',
          maxWidth,
          maxHeight: '85vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          animation: 'slideUp 0.25s cubic-bezier(0.34,1.1,0.64,1)',
        }}
      >
        {/* drag handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 4px',
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'var(--border)',
            }}
          />
        </div>
        {children}
      </div>
    </div>
  );
}
