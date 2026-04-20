import { useState } from 'react';
import { tokens } from '../../styles/tokens';

interface MiniDemoCardProps {
  onComplete: () => void;
}

/**
 * Single-tap demo row that looks like a DayView exercise row.
 * No localStorage writes. No RestTimerContext. Purely local state.
 */
export default function MiniDemoCard({ onComplete }: MiniDemoCardProps) {
  const [logged, setLogged] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        alignItems: 'stretch',
      }}
    >
      <div
        style={{
          background: tokens.colors.bgCard,
          border: `1px solid ${logged ? tokens.colors.accentBorder : 'rgba(255,255,255,0.08)'}`,
          borderRadius: tokens.radius.xl,
          padding: '18px 18px 22px',
          transition: 'border-color 300ms ease, box-shadow 300ms ease',
          boxShadow: logged ? '0 0 20px rgba(232,101,26,0.25)' : 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: tokens.colors.textPrimary,
              letterSpacing: '0.01em',
            }}
          >
            Bench Press
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: tokens.colors.textMuted,
              textTransform: 'uppercase',
            }}
          >
            Week 2
          </div>
        </div>

        {/* Set row */}
        <button
          type="button"
          onClick={() => {
            if (logged) return;
            setLogged(true);
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { (navigator as any).vibrate?.(10); } catch { /* ignore */ }
            }
          }}
          aria-pressed={logged}
          aria-label={logged ? 'Set logged' : 'Tap to log this set'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 14px',
            borderRadius: tokens.radius.lg,
            background: logged ? tokens.colors.accentMuted : tokens.colors.bgInset,
            border: `1px solid ${logged ? tokens.colors.accent : 'rgba(255,255,255,0.08)'}`,
            cursor: logged ? 'default' : 'pointer',
            transition: 'all 250ms ease',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: tokens.colors.textMuted,
              textTransform: 'uppercase',
            }}
          >
            Set 1
          </div>
          <div
            style={{
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontVariantNumeric: 'tabular-nums',
              fontSize: 16,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
            }}
          >
            <span>140 lb</span>
            <span style={{ color: tokens.colors.textMuted, fontWeight: 500 }}>×</span>
            <span>8</span>
          </div>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: logged ? tokens.colors.accent : 'transparent',
              border: `2px solid ${logged ? tokens.colors.accent : 'rgba(255,255,255,0.15)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 250ms ease',
              fontSize: 14,
              color: 'white',
              fontWeight: 900,
            }}
            aria-hidden="true"
          >
            {logged ? '✓' : ''}
          </div>
        </button>
      </div>

      {/* Reveal copy on log */}
      <div
        aria-live="polite"
        style={{
          maxHeight: logged ? 120 : 0,
          opacity: logged ? 1 : 0,
          overflow: 'hidden',
          transform: logged ? 'translateY(0)' : 'translateY(-4px)',
          transition: 'max-height 400ms ease, opacity 300ms ease, transform 300ms ease',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            background: tokens.colors.accentMuted,
            borderRadius: tokens.radius.md,
            fontSize: 13,
            color: tokens.colors.textPrimary,
            lineHeight: 1.5,
            marginBottom: 14,
          }}
        >
          That's it. Foundry handles the rest — progression, rest timer, deload — as you go.
        </div>
      </div>

      {logged && (
        <button
          type="button"
          onClick={onComplete}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            borderRadius: tokens.radius.xl,
            background: tokens.colors.btnPrimaryBg,
            border: `1px solid ${tokens.colors.btnPrimaryBorder}`,
            color: tokens.colors.btnPrimaryText,
            cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(232,101,26,0.35)',
          }}
        >
          Build my program
        </button>
      )}
    </div>
  );
}
