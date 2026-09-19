import React, { useEffect, useRef } from 'react';
import { tokens } from '../../styles/tokens';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  zIndex?: number;
  blur?: boolean;
}

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

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
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const el = contentRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key !== 'Tab') return;
      const focusable = el.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable.length) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault(); lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault(); firstEl.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: tokens.colors.overlay,
        backdropFilter: blur ? 'blur(6px)' : undefined,
        display: 'flex',
        // A dialog taller than the screen must scroll, and its top must stay
        // reachable. Centring with align-items:center pushed a tall card off
        // both edges with no scroll — the friend sheet trapped users until a
        // force-close. The backdrop scrolls; margin:auto on the card centres
        // it only when it fits.
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        padding: tokens.spacing.xl,
        paddingTop: `calc(${tokens.spacing.xl}px + env(safe-area-inset-top, 0px))`,
        paddingBottom: `calc(${tokens.spacing.xl}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: 'auto 0',
          flexShrink: 0,
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
