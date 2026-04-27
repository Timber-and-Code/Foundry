import React, { useEffect, useRef, useState } from 'react';
import { tokens } from '../../styles/tokens';

/**
 * ShareSheet — Foundry-branded share surface.
 *
 * Beta testers reported the previous 11-tile destination grid was unreliable:
 * tapping IG/Snap/X tiles re-launched our own app instead of actually sharing
 * (universal-link routing intercepted the OS handoff). This redesign drops
 * the per-destination tile picker in favor of three actions that consistently
 * work across iOS / Android / web:
 *
 *   1. Save image → downloads the PNG so the user can attach manually anywhere.
 *   2. Copy caption → puts the promo text + URL on the clipboard.
 *   3. Share via system → invokes the OS share sheet with the captured PNG file
 *      (the same payload the failing tiles tried to hand to specific apps).
 *
 * Visually the sheet now mirrors the post-workout summary card aesthetic
 * (var(--bg-card), border-radius xl, Bebas section header) so the share
 * surface reads as part of the completion flow rather than a separate
 * destination chooser.
 */

export interface ShareSheetPayload {
  /** Captured PNG as a File for native-share routes. */
  file: File;
  /** PNG as a data URL for download fallbacks. */
  dataUrl: string;
  /** Filename for downloads, e.g. "foundry-push-a-w2.png". */
  fileName: string;
  /** Title of the share, used by native share and as email subject. */
  title: string;
  /** Full promo body (caption + stats + URL). */
  text: string;
  /** Canonical link to share (used by link-only intents). */
  url: string;
}

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  /** Resolves once per open to the captured payload. Runs lazily so we don't
   *  re-capture the ShareCard on every re-render. */
  getPayload: () => Promise<ShareSheetPayload>;
  /** Called whenever an action completes (or is cancelled). The caller
   *  typically closes the sheet + modal, or shows a toast. */
  onDone?: (outcome: 'save' | 'copy' | 'system' | 'cancelled' | 'error') => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

function ShareSheet({ open, onClose, getPayload, onDone }: ShareSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const payloadRef = useRef<ShareSheetPayload | null>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Preload the PNG as soon as the sheet opens so taps feel instant.
  useEffect(() => {
    if (!open) return;
    payloadRef.current = null;
    setPreviewUrl(null);
    setCopied(false);
    getPayload()
      .then((p) => {
        payloadRef.current = p;
        setPreviewUrl(p.dataUrl);
      })
      .catch(() => {
        // Capture failure — handled per-action when the user taps.
      });
  }, [open, getPayload]);

  // Focus + Escape + scroll lock.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstFocusRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const awaitPayload = async (): Promise<ShareSheetPayload | null> => {
    if (payloadRef.current) return payloadRef.current;
    try {
      const p = await getPayload();
      payloadRef.current = p;
      return p;
    } catch {
      return null;
    }
  };

  const handleSave = async () => {
    const p = await awaitPayload();
    if (!p) {
      onDone?.('error');
      return;
    }
    const a = document.createElement('a');
    a.href = p.dataUrl;
    a.download = p.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onDone?.('save');
  };

  const handleCopy = async () => {
    const p = await awaitPayload();
    if (!p) {
      onDone?.('error');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${p.text}\n${p.url}`);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      onDone?.('copy');
    } catch {
      onDone?.('error');
    }
  };

  const handleSystemShare = async () => {
    const p = await awaitPayload();
    if (!p) {
      onDone?.('error');
      return;
    }
    try {
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [p.file] })
      ) {
        await navigator.share({
          title: p.title,
          text: p.text,
          files: [p.file],
        });
        onDone?.('system');
        return;
      }
      // No file-share support — fall back to the basic share API (text only)
      // so the user still gets a destination picker.
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: p.title, text: p.text, url: p.url });
        onDone?.('system');
        return;
      }
      // Last resort on platforms with no share API at all — save the PNG.
      handleSave();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        onDone?.('cancelled');
        return;
      }
      onDone?.('error');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-sheet-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 320,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        style={{
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          borderTopLeftRadius: tokens.radius.xl,
          borderTopRightRadius: tokens.radius.xl,
          padding: '14px 16px 28px',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom, 0px))',
          maxWidth: 480,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.6)',
          animation: 'foundrySheetSlideUp 0.22s cubic-bezier(0.34,1.1,0.64,1)',
          maxHeight: '90vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grip */}
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 4,
            borderRadius: 999,
            background: 'rgba(232,228,220,0.25)',
            margin: '0 auto 16px',
          }}
        />

        <div
          id="share-sheet-title"
          style={{
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            textAlign: 'center',
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            marginBottom: 4,
          }}
        >
          Share Your Workout
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          Save the card, copy the caption, or pick a destination.
        </div>

        {/* Preview card — mirrors the post-workout summary card chrome. */}
        <div
          style={{
            background: 'var(--bg-inset, var(--bg-root))',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.xl,
            padding: 12,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 180,
            overflow: 'hidden',
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Workout share card preview"
              style={{
                maxWidth: '100%',
                maxHeight: 220,
                width: 'auto',
                height: 'auto',
                borderRadius: tokens.radius.lg,
                boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Building card…
            </div>
          )}
        </div>

        {/* Three reliable actions, stacked. Save/Copy never depend on the OS
            share routing; System fan-outs to the native picker for everything
            else (IG / Snap / X / Email / SMS / etc.). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            ref={firstFocusRef}
            type="button"
            onClick={handleSystemShare}
            data-testid="share-system"
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: tokens.radius.lg,
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 400,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Share via system
          </button>
          <button
            type="button"
            onClick={handleSave}
            data-testid="share-save"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: tokens.radius.lg,
              background: 'transparent',
              border: `1px solid ${tokens.colors.accentBorder}`,
              color: tokens.colors.accent,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Save Image
          </button>
          <button
            type="button"
            onClick={handleCopy}
            data-testid="share-copy"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: tokens.radius.lg,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {copied ? 'Copied ✓' : 'Copy Caption'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginTop: 4,
              width: '100%',
              padding: '12px',
              borderRadius: tokens.radius.lg,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        @keyframes foundrySheetSlideUp {
          from { transform: translateY(100%); opacity: 0.4; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default React.memo(ShareSheet);
