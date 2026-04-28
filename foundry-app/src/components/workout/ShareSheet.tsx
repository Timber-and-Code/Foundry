import React, { useEffect, useRef, useState } from 'react';
import { tokens } from '../../styles/tokens';

/**
 * ShareSheet — Foundry-branded share surface with destination tiles.
 *
 * Tile handlers are picked for each platform's reality:
 *
 *   - X / Threads / Facebook / WhatsApp / Reddit / LinkedIn: open the public
 *     web intent URL (twitter.com/intent/tweet, threads.net/intent/post, etc.)
 *     in a new tab AND download the PNG. These intents accept text + URL only,
 *     so the PNG is in the user's downloads folder ready to attach.
 *
 *   - Instagram / Snapchat / TikTok: use navigator.share({ files }) when the
 *     browser supports it (iOS Safari 15+, Capacitor WKWebView 15+, Chrome
 *     Android). That surfaces the OS share sheet WITH the captured PNG
 *     attached, which is the only way to push an image into IG/Snap/TikTok
 *     from a web context. Fall back to PNG download + the app's URL scheme
 *     (instagram://library, snapchat://camera) so the user can manually
 *     attach the saved image from their photo library.
 *
 *   - More: full OS share sheet with the file attached. Picks up Email, SMS,
 *     Pinterest, Bluesky, LinkedIn, Telegram — anything else the user has
 *     installed.
 *
 * Below the grid: Save image (download only), Copy caption (clipboard),
 * Cancel.
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
  /** Called whenever an action completes (or is cancelled). */
  onDone?: (outcome: string) => void;
}

type DestId =
  | 'instagram'
  | 'snapchat'
  | 'tiktok'
  | 'x'
  | 'threads'
  | 'facebook'
  | 'whatsapp'
  | 'reddit'
  | 'more';

interface TileSpec {
  id: DestId;
  label: string;
  /** Background for the icon container. */
  bg: string;
  /** Foreground color for the SVG glyph. */
  fg: string;
  /** Inline SVG children (24×24 viewBox). */
  glyph: React.ReactNode;
}

// Brand-colored tiles, 3×3 grid. Order favors visual / story-friendly apps
// in the first row since those are the highest-intent destinations for a
// fitness share.
const TILES: TileSpec[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    bg: 'radial-gradient(circle at 30% 107%, #FDC468 0%, #FD5949 30%, #D6249F 60%, #285AEB 95%)',
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
      <path
        d="M12 2c3.3 0 5.7 2.6 5.7 5.9 0 .9-.1 2-.3 3 .3.1.7.2 1.1.2.5 0 1 .3 1 .8 0 .6-.9.9-1.8 1.3-.5.2-1.1.5-1.4.9.2.7 1.4 2.1 3.1 2.7.4.2.6.5.6.8 0 .3-.2.7-.8.9-1 .3-2.1.3-2.7.8-.6.7-.3 1.5-.8 1.8-.6.3-1.3-.2-2.3-.1-1.4.1-2.1 1.6-3.4 1.6s-2-1.5-3.4-1.6c-1-.1-1.7.4-2.3.1-.5-.3-.2-1.1-.8-1.8-.6-.5-1.7-.5-2.7-.8-.6-.2-.8-.6-.8-.9 0-.3.2-.6.6-.8 1.7-.6 2.9-2 3.1-2.7-.3-.4-.9-.7-1.4-.9-.9-.4-1.8-.7-1.8-1.3 0-.5.5-.8 1-.8.4 0 .8-.1 1.1-.2-.2-1-.3-2.1-.3-3C6.3 4.6 8.7 2 12 2Z"
        fill="currentColor"
      />
    ),
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    bg: '#000000',
    fg: '#FFFFFF',
    glyph: (
      <path
        d="M16 3a4 4 0 0 0 4 4v3a7 7 0 0 1-4-1.3V15a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3V3h3Z"
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
    id: 'threads',
    label: 'Threads',
    bg: '#000000',
    fg: '#FFFFFF',
    glyph: (
      <path
        d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2Zm4.4 11.7c-.4 1.7-1.7 2.9-3.6 3.4-1.5.4-3.1.2-4.4-.6-.5-.3-1-.7-1.4-1.2l1.5-1c.5.6 1.1 1 1.8 1.2 1.1.3 2.3.1 3-.5.5-.4.8-1 .6-1.6-.2-.7-.9-1-2-1.2l-1.7-.3c-1.5-.3-2.6-1.2-2.7-2.6 0-1.5 1.2-2.7 3-3.1 1.7-.4 3.4 0 4.5 1l-1.4 1.1c-.6-.5-1.4-.7-2.3-.5-.7.2-1.3.6-1.4 1.2-.1.6.3.9 1.5 1.2l1.5.3c1.6.3 3.2 1 3.5 2.7Z"
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
        d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.4V9.7c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5v1.8h2.6l-.4 2.9h-2.2v7A10 10 0 0 0 22 12Z"
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
        d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4-3.6-.3-.5.3-.5.8-1.6.1-.2 0-.3 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.2 3.1c.1.2 2 3.1 4.9 4.3 1.8.7 2.5.8 3.4.7.5-.1 1.7-.7 2-1.3.2-.7.2-1.2.1-1.3-.1-.2-.3-.3-.6-.5h0Zm-5.5 7.3c-3.4 0-6.5-1.8-8.2-4.7L2 22l5-1.4a9.7 9.7 0 0 0 4.9 1.3 9.6 9.6 0 0 0 9.7-9.7 9.6 9.6 0 0 0-9.6-9.7 9.6 9.6 0 0 0-9.7 9.7c0 1.9.5 3.7 1.5 5.3"
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
      <>
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <circle cx="9" cy="13" r="1.4" fill="#FFF" />
        <circle cx="15" cy="13" r="1.4" fill="#FFF" />
        <path d="M8.5 15.5c1 1 5 1 6 0" stroke="#FFF" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    id: 'more',
    label: 'More…',
    bg: 'var(--bg-inset, #1a1a1a)',
    fg: 'var(--text-primary, #e5e5e5)',
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    payloadRef.current = null;
    setPreviewUrl(null);
    setCopied(false);
    setHint(null);
    getPayload()
      .then((p) => {
        payloadRef.current = p;
        setPreviewUrl(p.dataUrl);
      })
      .catch(() => {
        /* handled per-tile */
      });
  }, [open, getPayload]);

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

  const tryNativeShareWithFile = async (p: ShareSheetPayload): Promise<boolean> => {
    try {
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [p.file] })
      ) {
        await navigator.share({ title: p.title, text: p.text, files: [p.file] });
        return true;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return false;
    }
    return false;
  };

  const flashHint = (msg: string) => {
    setHint(msg);
    setTimeout(() => setHint((h) => (h === msg ? null : h)), 2400);
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
        case 'instagram': {
          // IG accepts files via the OS share sheet on iOS/Android; fall
          // back to download + open IG so the user can attach manually.
          const ok = await tryNativeShareWithFile(p);
          if (!ok) {
            downloadPng(p);
            flashHint('Image saved — opening Instagram');
            setTimeout(() => {
              window.location.href = 'instagram://library';
              setTimeout(() => openInNewTab('https://www.instagram.com'), 600);
            }, 400);
          }
          break;
        }
        case 'snapchat': {
          const ok = await tryNativeShareWithFile(p);
          if (!ok) {
            downloadPng(p);
            flashHint('Image saved — opening Snapchat');
            setTimeout(() => {
              window.location.href = 'snapchat://camera';
              setTimeout(() => openInNewTab('https://www.snapchat.com'), 600);
            }, 400);
          }
          break;
        }
        case 'tiktok': {
          const ok = await tryNativeShareWithFile(p);
          if (!ok) {
            downloadPng(p);
            flashHint('Image saved — opening TikTok');
            setTimeout(() => {
              window.location.href = 'snssdk1233://';
              setTimeout(() => openInNewTab('https://www.tiktok.com'), 600);
            }, 400);
          }
          break;
        }
        case 'x':
          downloadPng(p);
          openInNewTab(`https://twitter.com/intent/tweet?text=${enc(p.text)}`);
          flashHint('Image saved — attach in the post');
          break;
        case 'threads':
          downloadPng(p);
          openInNewTab(`https://www.threads.net/intent/post?text=${enc(p.text)}`);
          flashHint('Image saved — attach in the post');
          break;
        case 'facebook':
          downloadPng(p);
          openInNewTab(
            `https://www.facebook.com/sharer/sharer.php?u=${enc(p.url)}&quote=${enc(p.text)}`,
          );
          flashHint('Image saved — attach in the post');
          break;
        case 'whatsapp': {
          const ok = await tryNativeShareWithFile(p);
          if (!ok) {
            downloadPng(p);
            openInNewTab(`https://wa.me/?text=${enc(p.text)}`);
            flashHint('Image saved — attach in the chat');
          }
          break;
        }
        case 'reddit':
          downloadPng(p);
          openInNewTab(
            `https://www.reddit.com/submit?url=${enc(p.url)}&title=${enc(p.title)}`,
          );
          flashHint('Image saved — attach in the post');
          break;
        case 'more': {
          const ok = await tryNativeShareWithFile(p);
          if (!ok) {
            // No share API → just download the PNG so the user has it.
            downloadPng(p);
            flashHint('Image saved');
          }
          break;
        }
      }
      onDone?.(id);
    } catch (err) {
      console.warn('[Foundry] Share tile failed', err);
      onDone?.('error');
    }
  };

  const handleSave = async () => {
    const p = await awaitPayload();
    if (!p) {
      onDone?.('error');
      return;
    }
    downloadPng(p);
    flashHint('Image saved');
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
          maxHeight: '92vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
            marginBottom: 14,
          }}
        >
          Pick a destination — image attaches automatically where supported.
        </div>

        {/* Preview card */}
        <div
          style={{
            background: 'var(--bg-inset, var(--bg-root))',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.xl,
            padding: 12,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 160,
            overflow: 'hidden',
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Workout share card preview"
              style={{
                maxWidth: '100%',
                maxHeight: 200,
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

        {/* Inline transient hint — saves us from needing the toast context */}
        {hint && (
          <div
            role="status"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--accent)',
              textAlign: 'center',
              marginBottom: 10,
              letterSpacing: '0.04em',
            }}
          >
            {hint}
          </div>
        )}

        {/* 3×3 destination grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 16,
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
                gap: 6,
                padding: '8px 4px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                minHeight: 78,
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
                <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" style={{ color: tile.fg }}>
                  {tile.glyph}
                </svg>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
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

        {/* Utility row — Save / Copy / Cancel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
