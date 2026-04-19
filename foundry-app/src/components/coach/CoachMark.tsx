import React, { useEffect, useLayoutEffect, useState } from 'react';
import { tokens } from '../../styles/tokens';

interface CoachMarkProps {
  anchorSelector: string;
  title?: string;
  copy: string;
  onDismiss: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Positioned tooltip that anchors to a DOM element matching `anchorSelector`.
 * If the anchor is not mounted, the mark positions as a centered banner near
 * the bottom of the viewport as a fallback.
 *
 * Dismiss: tap "Got it", tap backdrop. Focus returns to anchor.
 */
export default function CoachMark({ anchorSelector, title, copy, onDismiss }: CoachMarkProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [above, setAbove] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(anchorSelector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      // Prefer placing the mark BELOW the anchor. If the anchor is in the
      // bottom half of the viewport, place ABOVE instead.
      setAbove(r.top + r.height > window.innerHeight * 0.55);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchorSelector]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  // Fallback when anchor not found: bottom-centered banner
  const fallbackMode = !rect;

  const tooltipWidth = 300;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 480;
  const clampedLeft = rect
    ? Math.max(12, Math.min(viewportW - tooltipWidth - 12, rect.left + rect.width / 2 - tooltipWidth / 2))
    : 12;

  const tooltipStyle: React.CSSProperties = fallbackMode
    ? {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: Math.min(tooltipWidth, viewportW - 24),
      }
    : {
        position: 'fixed',
        left: clampedLeft,
        top: above ? rect!.top - 12 : rect!.top + rect!.height + 12,
        width: Math.min(tooltipWidth, viewportW - 24),
        transform: above ? 'translateY(-100%)' : 'none',
      };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'coach-mark-title' : undefined}
      aria-describedby="coach-mark-body"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 950,
        // Fallback mode (no anchor): a gentle global dim so the tooltip has
        // contrast. Anchor mode: transparent — the spotlight ring's box-shadow
        // handles the dimming with a cutout over the anchor so it stays
        // legible.
        background: fallbackMode ? 'rgba(0,0,0,0.55)' : 'transparent',
        animation: 'coachMarkFadeIn 200ms ease',
      }}
      onClick={onDismiss}
    >
      {/* Spotlight ring on anchor — big box-shadow darkens everything outside
          the hole, leaving the anchor fully visible. */}
      {rect && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            borderRadius: 12,
            boxShadow:
              '0 0 0 9999px rgba(0,0,0,0.65), 0 0 24px rgba(232,101,26,0.5)',
            border: `2px solid ${tokens.colors.accent}`,
            pointerEvents: 'none',
            animation: 'coachMarkPulse 1.6s ease-in-out infinite',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...tooltipStyle,
          background: tokens.colors.bgCard,
          border: `1px solid ${tokens.colors.accentBorder}`,
          borderRadius: tokens.radius.xl,
          padding: '16px 18px 14px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          color: tokens.colors.textPrimary,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {title && (
          <div
            id="coach-mark-title"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: tokens.colors.accent,
              marginBottom: 6,
            }}
          >
            {title}
          </div>
        )}
        <div
          id="coach-mark-body"
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: tokens.colors.textPrimary,
            marginBottom: 14,
          }}
        >
          {copy}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: tokens.colors.accent,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            padding: '4px 0',
            textTransform: 'uppercase',
          }}
        >
          Got it
        </button>
      </div>

      <style>{`
        @keyframes coachMarkFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes coachMarkPulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.65), 0 0 24px rgba(232,101,26,0.5); }
          50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.65), 0 0 36px rgba(232,101,26,0.75); }
        }
      `}</style>
    </div>
  );
}
