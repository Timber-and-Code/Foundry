import React from 'react';
import { tokens } from '../../styles/tokens';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  zIndex?: number;
  blur?: boolean;
}

/**
 * Modal — centered full-screen overlay dialog.
 */
export default function Modal({
  open,
  onClose,
  children,
  maxWidth = 380,
  zIndex = 300,
  blur = false,
}: ModalProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: tokens.colors.overlay,
        backdropFilter: blur ? 'blur(6px)' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing.xl,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.xl,
          padding: `28px ${tokens.spacing.xl}px`,
          maxWidth,
          width: '100%',
          boxShadow: 'var(--shadow-xl)',
          animation: 'dialogIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
