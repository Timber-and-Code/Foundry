import { useState } from 'react';
import { tokens } from '../../styles/tokens';

interface MiniDemoCardProps {
  onComplete: () => void;
}

/**
 * Single-tap demo that mirrors the real ExerciseCard: a Weight / Reps /
 * Done grid, with a "Last session" hint above. After logging, a
 * forward-looking "Next session" hint reveals — same shape, opposite
 * direction — so the user sees how progression surfaces in the app.
 *
 * No localStorage writes. No RestTimerContext. Purely local state.
 */
export default function MiniDemoCard({ onComplete }: MiniDemoCardProps) {
  const [logged, setLogged] = useState(false);

  const handleLog = () => {
    if (logged) return;
    setLogged(true);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { (navigator as any).vibrate?.(10); } catch { /* ignore */ }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        alignItems: 'stretch',
      }}
    >
      {/* Exercise card — mirrors the live ExerciseCard layout */}
      <div
        style={{
          background: tokens.colors.bgCard,
          border: `1px solid ${logged ? tokens.colors.accentBorder : 'rgba(255,255,255,0.08)'}`,
          borderRadius: tokens.radius.xl,
          padding: '16px 16px 18px',
          transition: 'border-color 300ms ease, box-shadow 300ms ease',
          boxShadow: logged ? '0 0 20px rgba(232,101,26,0.25)' : 'none',
        }}
      >
        {/* Header: exercise + week */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 14,
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

        {/* Last session hint — identical style to the real ExerciseCard */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginBottom: 12,
            padding: '8px 10px',
            background: 'var(--bg-inset)',
            borderRadius: tokens.radius.sm,
          }}
        >
          Last session: 135 × 8
        </div>

        {/* Column headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 48px',
            gap: 8,
            marginBottom: 6,
            fontSize: 11,
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}
          aria-hidden="true"
        >
          <div>Weight (lbs)</div>
          <div>Reps</div>
          <div style={{ textAlign: 'center' }}>Done</div>
        </div>

        {/* Set row — Weight / Reps / Done grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 48px',
            gap: 8,
            alignItems: 'center',
            opacity: logged ? 0.6 : 1,
            transition: 'opacity 250ms ease',
          }}
        >
          <div
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.sm,
              padding: '10px 6px',
              fontSize: 14,
              color: 'var(--text-primary)',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            140
          </div>
          <div
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.sm,
              padding: '10px 6px',
              fontSize: 14,
              color: 'var(--text-primary)',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            8
          </div>
          <button
            type="button"
            onClick={handleLog}
            disabled={logged}
            aria-pressed={logged}
            aria-label={logged ? 'Set logged' : 'Tap to log this set'}
            style={{
              width: 32,
              height: 32,
              margin: '0 auto',
              borderRadius: '50%',
              background: logged ? tokens.colors.accent : 'transparent',
              border: `2px solid ${logged ? tokens.colors.accent : 'rgba(255,255,255,0.25)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 250ms ease',
              fontSize: 16,
              color: 'white',
              fontWeight: 900,
              cursor: logged ? 'default' : 'pointer',
              padding: 0,
            }}
          >
            {logged ? '✓' : ''}
          </button>
        </div>
      </div>

      {/* Reveal on log: forward-looking hint mirrors "Last session",
          then explainer follows with a small stagger. */}
      <div
        aria-live="polite"
        style={{
          maxHeight: logged ? 180 : 0,
          opacity: logged ? 1 : 0,
          overflow: 'hidden',
          transform: logged ? 'translateY(0)' : 'translateY(-4px)',
          transition: 'max-height 500ms ease, opacity 300ms ease, transform 300ms ease',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginBottom: 10,
        }}
      >
        {/* Next session hint — same shape as "Last session" but forward-looking */}
        <div
          style={{
            fontSize: 12,
            color: tokens.colors.accent,
            padding: '10px 12px',
            background: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.accentBorder}`,
            borderRadius: tokens.radius.sm,
            fontWeight: 600,
            opacity: logged ? 1 : 0,
            transform: logged ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'opacity 260ms ease, transform 260ms ease',
            transitionDelay: logged ? '0ms' : '0ms',
          }}
        >
          Next session: 140 × 9
        </div>

        {/* Explainer — follows the hint with a small stagger */}
        <div
          style={{
            padding: '12px 14px',
            background: tokens.colors.accentMuted,
            borderRadius: tokens.radius.md,
            fontSize: 13,
            color: tokens.colors.textPrimary,
            lineHeight: 1.5,
            opacity: logged ? 1 : 0,
            transform: logged ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'opacity 260ms ease, transform 260ms ease',
            transitionDelay: logged ? '180ms' : '0ms',
          }}
        >
          That's it. The Foundry handles the rest — progression, rest timer, deload — as you go.
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
