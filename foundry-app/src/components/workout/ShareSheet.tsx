import React, { useEffect, useRef } from 'react';
import { tokens } from '../../styles/tokens';

/**
 * ShareSheet — Foundry-branded destination picker that replaces the tiny OS
 * native share sheet as the primary entry point. Big 112px tiles in a
 * 3-column grid, brand-colored icons, and an explicit "More…" tile that
 * falls back to the OS share sheet for everything we didn't shortcut.
 *
 * Destination semantics:
 *   - IG / Snap: route through the OS native share sheet because those apps
 *     have no public web intent that accepts a file.
 *   - X / Facebook / WhatsApp / Threads / Reddit / LinkedIn: open a web
 *     intent URL (text + link only — the PNG is auto-downloaded alongside so
 *     the user can attach manually).
 *   - Copy: writes the promo text to the clipboard.
 *   - Save: downloads the PNG only.
 *   - More…: full OS share sheet (everything else — Email / SMS / TikTok /
 *     Pinterest / Bluesky / Messages / etc.).
 *
 * The sheet assumes the caller has already captured the PNG; the caller
 * passes the file and text, the sheet just wires taps to destinations.
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
  /** Called whenever a destination completes (or is cancelled). The caller
   *  typically closes the sheet + modal, or shows a toast. Outcome is one of
   *  the Destination IDs or 'cancelled'. */
  onDone?: (outcome: string) => void;
}

type DestId =
  | 'instagram'
  | 'snapchat'
  | 'x'
  | 'facebook'
  | 'whatsapp'
  | 'threads'
  | 'reddit'
  | 'linkedin'
  | 'copy'
  | 'save'
  | 'more';

const AMBER = '#D4983C';

// ─── Brand tiles ────────────────────────────────────────────────────────────
// Each tile owns its icon + brand color. Icons are inline SVG paths. The
// monochrome footer tiles (Copy, Save, More) use the Foundry neutral palette
// so they read as "app actions", not third-party brands.

interface TileSpec {
  id: DestId;
  label: string;
  /** Background color for the circular icon container. */
  bg: string;
  /** Stroke/fill for the inline SVG glyph (typically white for brand tiles). */
  fg: string;
  /** Inline SVG children. Rendered inside a 56×56 viewBox(0 0 24 24). */
  glyph: React.ReactNode;
}

const TILES: TileSpec[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    // Brand gradient baked in as a radial; approximates the official IG ramp.
    bg:
      'radial-gradient(circle at 30% 107%, #FDC468 0%, #FD5949 30%, #D6249F 60%, #285AEB 95%)',
    fg: '#FFFFFF',
    glyph: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" ry="5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
      </>
    ),
  },
  {
    id: 'snapchat',
    label: 'Snapchat',
    bg: '#FFFC00',
    fg: '#000000',
    glyph: (
      // Stylised ghost silhouette.
      <path
        d="M12 2c3.3 0 5.7 2.6 5.7 5.9 0 .9-.1 2-.3 3 .3.1.7.2 1.1.2.5 0 1 .3 1 .8 0 .6-.9.9-1.8 1.3-.5.2-1.1.5-1.4.9.2.7 1.4 2.1 3.1 2.7.4.2.6.5.6.8 0 .3-.2.7-.8.9-1 .3-2.1.3-2.7.8-.6.7-.3 1.5-.8 1.8-.6.3-1.3-.2-2.3-.1-1.4.1-2.1 1.6-3.4 1.6s-2-1.5-3.4-1.6c-1-.1-1.7.4-2.3.1-.5-.3-.2-1.1-.8-1.8-.6-.5-1.7-.5-2.7-.8-.6-.2-.8-.6-.8-.9 0-.3.2-.6.6-.8 1.7-.6 2.9-2 3.1-2.7-.3-.4-.9-.7-1.4-.9-.9-.4-1.8-.7-1.8-1.3 0-.5.5-.8 1-.8.4 0 .8-.1 1.1-.2-.2-1-.3-2.1-.3-3C6.3 4.6 8.7 2 12 2Z"
        fill="currentColor"
      />
    ),
  },
  {
    id: 'x',
    label: 'X',
    bg: '#000000',
    fg: '#FFFFFF',
    glyph: (
      <path
        d="M18.9 2.5h3l-6.6 7.5 7.8 11.5h-6.1l-4.8-7-5.5 7H3.7l7-8L3.2 2.5h6.2l4.3 6.3 5.2-6.3Zm-1.1 17.4h1.7L7.2 4.1H5.4l12.4 15.8Z"
        fill="currentColor"
      />
    ),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    bg: '#1877F2',
    fg: '#FFFFFF',
    glyph: (
      <path
        d="M13.5 22v-8h2.6l.4-3.3h-3V8.5c0-1 .3-1.7 1.7-1.7h1.5V3.9c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.9H8v3.3h2.6V22h2.9Z"
        fill="currentColor"
      />
    ),
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    bg: '#25D366',
    fg: '#FFFFFF',
    glyph: (
      <path
        d="M17.4 14c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-.7-.3-1.3-.6-1.9-1.1-.5-.4-.9-1-1.3-1.5-.1-.2 0-.4.1-.5.1-.1.2-.2.3-.4.1-.1.2-.2.2-.4.1-.1 0-.3 0-.4-.1-.1-.6-1.4-.8-2-.2-.5-.4-.4-.6-.4H9c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.1-.5-.2Zm-5.4 7.4c-1.7 0-3.3-.5-4.7-1.4L4 21l1.1-3.2c-1-1.5-1.5-3.2-1.5-5C3.6 7.6 7.4 3.8 12 3.8c2.2 0 4.4.9 5.9 2.5 1.6 1.6 2.5 3.7 2.5 5.9 0 4.6-3.8 8.4-8.4 8.4Zm7.2-15.6c-1.9-1.9-4.4-3-7.2-3-5.6 0-10.1 4.5-10.1 10.1 0 1.8.5 3.5 1.4 5.1L2 22.5l4.9-1.3c1.5.8 3.2 1.2 4.9 1.2 5.6 0 10.1-4.5 10.1-10.1 0-2.7-1-5.2-2.9-7.1Z"
        fill="currentColor"
      />
    ),
  },
  {
    id: 'threads',
    label: 'Threads',
    bg: '#000000',
    fg: '#FFFFFF',
    glyph: (
      <path
        d="M12.2 22h-.1c-3.2 0-5.6-1-7.2-3.1C3.5 17 2.9 14.6 2.9 12c0-2.6.7-5 2-6.9C6.5 3 8.9 2 12.1 2h.1c3.2 0 5.6 1 7.3 2.9 1 1.2 1.7 2.6 2 4.3l-2.1.5c-.3-1.3-.7-2.3-1.4-3.1-1.2-1.4-3.1-2.1-5.7-2.1h-.1c-2.6 0-4.6.8-5.7 2.4-1 1.4-1.5 3.5-1.5 5.6 0 2.1.5 4.2 1.5 5.6 1.2 1.7 3.1 2.5 5.7 2.5h.1c2.4 0 4-.6 5.3-1.9.8-.8 1.2-1.8 1.3-3 0-1.7-.5-2.8-1.7-3.5-.2 2.2-1 3.5-2 4.3-1.2 1-2.7 1.3-4.5 1-2.1-.3-3.8-1.6-3.8-3.7 0-2 1.7-3.4 4.2-3.4.8 0 1.6.1 2.4.2 0-.4-.1-.8-.4-1.2-.4-.7-1.1-1-2-1-.9 0-1.6.3-2.2 1l-1.5-1.3c.9-1 2-1.7 3.7-1.7 1.8 0 3.1.9 3.8 2.2.3.5.5 1.1.5 1.8 1.5.3 2.7 1 3.4 2.1.8 1.2 1.1 2.6.9 4-.2 1.6-.9 2.9-2 3.9-1.5 1.5-3.6 2.3-6.3 2.3Zm-.4-9.3c-1.3 0-2.3.5-2.3 1.3 0 .7.9 1.4 2.2 1.6 1 .2 2-.1 2.7-.7.6-.5 1-1.2 1.1-2.2-.5 0-1.5-.1-2.3-.1-.5 0-1 .1-1.4.1Z"
        fill="currentColor"
      />
    ),
  },
  {
    id: 'reddit',
    label: 'Reddit',
    bg: '#FF4500',
    fg: '#FFFFFF',
    glyph: (
      <path
        d="M22 12.2c0-1.1-.9-2-2-2-.5 0-1 .2-1.3.5-1.3-.9-3-1.5-4.9-1.6l1-4.4 3 .7c0 .8.6 1.4 1.4 1.4.8 0 1.4-.6 1.4-1.4 0-.8-.6-1.4-1.4-1.4-.5 0-1 .3-1.3.7l-3.4-.8c-.2 0-.3.1-.4.2l-1.1 4.9c-1.9.1-3.6.7-4.9 1.6-.3-.3-.8-.5-1.3-.5-1.1 0-2 .9-2 2 0 .7.4 1.4 1.1 1.7v.7c0 3.7 4.1 6.6 9.2 6.6s9.2-2.9 9.2-6.6v-.7c.7-.3 1.1-1 1.1-1.7ZM7 13.7c0-.8.6-1.4 1.4-1.4.8 0 1.4.6 1.4 1.4 0 .8-.6 1.4-1.4 1.4-.8 0-1.4-.6-1.4-1.4Zm8 4.7c-1 1-3.4 1-4.1 0-.1-.1-.3-.1-.4 0-.1.1-.1.3 0 .4.5.5 1.5.8 2.5.8 1 0 2-.3 2.5-.8.1-.1.1-.3 0-.4-.2-.1-.4-.1-.5 0Zm.6-3.3c-.8 0-1.4-.6-1.4-1.4 0-.8.6-1.4 1.4-1.4.8 0 1.4.6 1.4 1.4 0 .8-.6 1.4-1.4 1.4Z"
        fill="currentColor"
      />
    ),
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    bg: '#0A66C2',
    fg: '#FFFFFF',
    glyph: (
      <path
        d="M6.9 21.8H3V9h3.9v12.8Zm-2-14.5c-1.2 0-2.2-1-2.2-2.2C2.7 3.9 3.7 3 4.9 3s2.2 1 2.2 2.2c0 1.2-1 2.1-2.2 2.1Zm16.9 14.5H18V15.6c0-1.5 0-3.4-2.1-3.4-2.1 0-2.4 1.6-2.4 3.3v6.3H9.8V9h3.5v1.7h.1c.5-.9 1.7-1.9 3.4-1.9 3.7 0 4.4 2.4 4.4 5.6v7.4Z"
        fill="currentColor"
      />
    ),
  },
  {
    id: 'copy',
    label: 'Copy link',
    bg: '#2A2622',
    fg: '#E8E4DC',
    glyph: (
      <path
        d="M9.5 14.5a2.3 2.3 0 0 0 3.3 0l3.8-3.8a2.3 2.3 0 1 0-3.3-3.3l-1.2 1.2m1.2 5.4a2.3 2.3 0 0 1-3.3 0l-3.8-3.8a2.3 2.3 0 1 1 3.3-3.3l1.2 1.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  {
    id: 'save',
    label: 'Save PNG',
    bg: '#2A2622',
    fg: '#E8E4DC',
    glyph: (
      <path
        d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  {
    id: 'more',
    label: 'More…',
    bg: AMBER,
    fg: '#0A0A0C',
    glyph: (
      <>
        <circle cx="6" cy="12" r="1.6" fill="currentColor" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        <circle cx="18" cy="12" r="1.6" fill="currentColor" />
      </>
    ),
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

function ShareSheet({ open, onClose, getPayload, onDone }: ShareSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const payloadRef = useRef<ShareSheetPayload | null>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  // Preload the PNG as soon as the sheet opens so taps feel instant.
  useEffect(() => {
    if (!open) return;
    payloadRef.current = null;
    getPayload()
      .then((p) => {
        payloadRef.current = p;
      })
      .catch(() => {
        // Capture failure — handled per-tile when the user taps.
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

  // Wait for capture if it hasn't resolved yet. Never more than ~2s under
  // normal conditions since the PNG is ready-to-go once fonts load.
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

  const downloadPng = (p: ShareSheetPayload) => {
    const a = document.createElement('a');
    a.href = p.dataUrl;
    a.download = p.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const tryNativeShare = async (p: ShareSheetPayload): Promise<boolean> => {
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
        return true;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return false;
    }
    return false;
  };

  const handleTile = async (id: DestId) => {
    const p = await awaitPayload();
    if (!p) {
      onDone?.('error');
      return;
    }
    const enc = encodeURIComponent;
    try {
      switch (id) {
        case 'instagram':
        case 'snapchat': {
          // Only native share can actually hand a file to IG / Snap. Fall
          // back to downloading the PNG so the user can open the app
          // manually if the native sheet isn't available.
          const ok = await tryNativeShare(p);
          if (!ok) {
            downloadPng(p);
          }
          break;
        }
        case 'x':
          downloadPng(p);
          openInNewTab(`https://twitter.com/intent/tweet?text=${enc(p.text)}`);
          break;
        case 'facebook':
          downloadPng(p);
          openInNewTab(
            `https://www.facebook.com/sharer/sharer.php?u=${enc(p.url)}&quote=${enc(p.text)}`,
          );
          break;
        case 'whatsapp': {
          // WhatsApp accepts files via native share on iOS/Android — try
          // that first, fall back to wa.me text intent + PNG download.
          const ok = await tryNativeShare(p);
          if (!ok) {
            downloadPng(p);
            openInNewTab(`https://wa.me/?text=${enc(p.text)}`);
          }
          break;
        }
        case 'threads':
          downloadPng(p);
          openInNewTab(
            `https://www.threads.net/intent/post?text=${enc(p.text)}`,
          );
          break;
        case 'reddit':
          downloadPng(p);
          openInNewTab(
            `https://www.reddit.com/submit?url=${enc(p.url)}&title=${enc(p.title)}`,
          );
          break;
        case 'linkedin':
          downloadPng(p);
          openInNewTab(
            `https://www.linkedin.com/sharing/share-offsite/?url=${enc(p.url)}`,
          );
          break;
        case 'copy':
          try {
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(p.text);
            }
          } catch {
            // Clipboard can fail on insecure contexts. Silent.
          }
          break;
        case 'save':
          downloadPng(p);
          break;
        case 'more': {
          // Kick the full OS native share sheet — everything else we didn't
          // tile (TikTok / Email / SMS / Pinterest / Bluesky / Messages).
          await tryNativeShare(p);
          break;
        }
      }
      onDone?.(id);
    } catch (err) {
      console.warn('[Foundry] Share tile failed', err);
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
        // Click on backdrop closes; the sheet itself stops propagation.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        style={{
          background: '#1A1814',
          borderTopLeftRadius: tokens.radius.xl,
          borderTopRightRadius: tokens.radius.xl,
          padding: '20px 16px 28px',
          maxWidth: 520,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.6)',
          animation: 'foundrySheetSlideUp 0.22s cubic-bezier(0.34,1.1,0.64,1)',
          // Short landscape viewports can clip 4 rows of 148px tiles; let
          // the sheet itself scroll instead of overflowing off-screen.
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
            margin: '0 auto 14px',
          }}
        />

        <div
          id="share-sheet-title"
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginBottom: 18,
          }}
        >
          Share your workout
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 14,
          }}
        >
          {TILES.map((tile, idx) => (
            <button
              key={tile.id}
              ref={idx === 0 ? firstFocusRef : undefined}
              type="button"
              onClick={() => handleTile(tile.id)}
              aria-label={`Share to ${tile.label}`}
              data-testid={`share-tile-${tile.id}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 8,
                padding: '10px 4px 8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                minHeight: 86,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: tile.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: tile.fg,
                  boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
                }}
              >
                <svg
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  style={{ color: tile.fg }}
                >
                  {tile.glyph}
                </svg>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {tile.label}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 20,
            width: '100%',
            padding: '14px',
            borderRadius: tokens.radius.lg,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          CANCEL
        </button>
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
