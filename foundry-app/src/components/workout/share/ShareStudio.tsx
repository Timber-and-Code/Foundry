import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { tokens } from '../../../styles/tokens';
import { emit } from '../../../utils/events';
import { captureNodeToPng } from '../../../utils/shareWorkout';
import { shareImage, downloadImage } from '../../../utils/shareImage';
import {
  ShareCardView,
  availableTemplates,
  TEMPLATE_LABEL,
  CARD_W,
  CARD_H,
  type ShareCardData,
  type ShareTemplate,
} from './ShareCards';

interface ShareStudioProps {
  open: boolean;
  onClose: () => void;
  data: ShareCardData;
  /** Caption for "Copy caption" — the image is the message, text is optional. */
  caption: string;
}

/**
 * Share a finished workout: pick a template, see exactly the image that will
 * be sent, tap Share. The image goes to the system share sheet (see
 * utils/shareImage) — which already lists every app the lifter has, so this
 * screen doesn't duplicate it with brand tiles.
 */
export default function ShareStudio({ open, onClose, data, caption }: ShareStudioProps) {
  const templates = availableTemplates(data.stats);
  const [template, setTemplate] = useState<ShareTemplate>(templates[0]);
  const [busy, setBusy] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const touchX = useRef<number | null>(null);
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    if (open) setTemplate(availableTemplates(data.stats)[0]);
  }, [open, data.stats]);

  // Fit the 1080 × 1920 card into whatever space the stage has.
  useLayoutEffect(() => {
    if (!open) return;
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      setScale(Math.max(0.1, Math.min(r.width / CARD_W, r.height / CARD_H)));
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fileName = `foundry-${data.dayLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-w${data.weekIdx + 1}-${template}.png`;

  const render = async () => {
    const node = captureRef.current;
    if (!node) throw new Error('share card missing');
    return captureNodeToPng(node, 1);
  };

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const dataUrl = await render();
      const outcome = await shareImage({ dataUrl, fileName, title: `${data.dayLabel} — The Foundry` });
      if (outcome === 'saved') emit('foundry:toast', { message: 'Image saved.', type: 'success' });
    } catch (e) {
      console.warn('[Foundry] share failed', e);
      emit('foundry:toast', { message: "Couldn't share the image. Try again.", type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      downloadImage(await render(), fileName);
    } catch {
      emit('foundry:toast', { message: "Couldn't save the image. Try again.", type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      emit('foundry:toast', { message: 'Caption copied.', type: 'success' });
    } catch {
      emit('foundry:toast', { message: "Couldn't copy the caption.", type: 'error' });
    }
  };

  const step = (dir: 1 | -1) => {
    const i = templates.indexOf(template);
    const next = templates[i + dir];
    if (next) setTemplate(next);
  };

  const secondary: React.CSSProperties = {
    flex: 1,
    minHeight: 48,
    borderRadius: tokens.radius.lg,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-studio-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 320,
        background: '#050404',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 16px 16px',
          boxSizing: 'border-box',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2
            id="share-studio-title"
            style={{ margin: 0, fontFamily: "'Bebas Neue', 'Inter', sans-serif", fontWeight: 400, fontSize: 30, letterSpacing: '0.1em', color: 'var(--text-primary)' }}
          >
            SHARE WORKOUT
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 44, height: 44, borderRadius: 22, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 20, cursor: 'pointer' }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {templates.length > 1 && (
          <div role="radiogroup" aria-label="Image style" style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 999, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {templates.map((t) => {
              const on = t === template;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTemplate(t)}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    borderRadius: 999,
                    border: 'none',
                    background: on ? tokens.colors.accent : 'transparent',
                    color: on ? '#fff' : 'var(--text-secondary)',
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {TEMPLATE_LABEL[t]}
                </button>
              );
            })}
          </div>
        )}

        {/* Live preview: the same component the image is captured from, scaled to fit. */}
        <div
          ref={stageRef}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}
          style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            aria-label={`Preview: ${TEMPLATE_LABEL[template]} image`}
            role="img"
            style={{
              width: CARD_W * scale,
              height: CARD_H * scale,
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,101,26,0.25)',
              flexShrink: 0,
            }}
          >
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: CARD_W, height: CARD_H, pointerEvents: 'none' }}>
              <ShareCardView template={template} data={data} />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onShare}
          disabled={busy}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: tokens.radius.lg,
            background: tokens.colors.btnPrimaryBg,
            border: `1px solid ${tokens.colors.btnPrimaryBorder}`,
            color: tokens.colors.btnPrimaryText,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.06em',
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'PREPARING IMAGE…' : 'SHARE'}
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {!native && (
            <button type="button" onClick={onSave} disabled={busy} style={secondary}>
              Save image
            </button>
          )}
          <button type="button" onClick={onCopy} style={secondary}>
            Copy caption
          </button>
        </div>
      </div>

      {/* Full-size capture surface, off-screen. */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -99999, top: 0, width: CARD_W, height: CARD_H, pointerEvents: 'none' }}>
        <ShareCardView ref={captureRef} template={template} data={data} />
      </div>
    </div>
  );
}
