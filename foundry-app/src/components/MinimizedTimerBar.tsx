import { tokens } from '../styles/tokens';

interface RestTimer {
  remaining: number;
  total: number;
  exName: string;
}

interface MinimizedTimerBarProps {
  restTimer: RestTimer;
  /** Tap handler. `done=true` when the timer has hit zero (acknowledge);
   *  `done=false` while still running (expand to full overlay). */
  onTap: (done: boolean) => void;
}

/**
 * Editorial rest timer.
 *
 * Two states, ported from /preview/hybrid/focus:
 * - **Running** (`remaining > 0`): a small soft-shadow toast pinned above
 *   the bottom nav. Shows "REST · MM:SS" + a Skip button. Tapping the
 *   countdown expands to the full ring overlay (DayView).
 * - **At zero** (`remaining === 0`): a blocking alarm modal.
 *   "REST COMPLETE / NEXT SET / I'm Ready". `+30s` snoozes the timer
 *   back into a 30-second resting window via the same onTap handler
 *   (parent decides what +30s means; we only emit `done=false`).
 *
 * Replaces the prior heavy gradient-bar that lived at the bottom — the
 * toast model is far less visually intrusive between sets.
 */
export default function MinimizedTimerBar({ restTimer, onTap }: MinimizedTimerBarProps) {
  const { remaining, exName } = restTimer;
  const done = remaining <= 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  if (done) {
    // ── Blocking overtime alarm ─────────────────────────────────────────
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rest-alarm-title"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.78)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            background: 'var(--bg-card)',
            border: '2px solid var(--accent)',
            borderRadius: 16,
            padding: '24px 22px 20px',
            textAlign: 'center',
            fontFamily: 'inherit',
            boxShadow: '0 18px 56px rgba(0,0,0,0.6), 0 0 0 8px rgba(232,101,26,0.14)',
            animation: 'restAlarmGlow 1.4s ease-in-out infinite',
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.25em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: 6,
              fontWeight: 700,
            }}
          >
            Rest Complete
          </div>
          <h2
            id="rest-alarm-title"
            style={{
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
              fontSize: 38,
              letterSpacing: '0.02em',
              color: 'var(--text-primary)',
              margin: '0 0 4px 0',
              lineHeight: 1,
              fontWeight: 400,
            }}
          >
            Next Set
          </h2>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 18,
              fontWeight: 600,
            }}
          >
            {exName}
          </div>
          <button
            onClick={() => onTap(true)}
            style={{
              width: '100%',
              height: 52,
              borderRadius: tokens.radius.md,
              background: 'var(--accent)',
              color: 'var(--bg-root, #0A0A0C)',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(232,101,26,0.4)',
              fontFamily: 'inherit',
            }}
          >
            I'm Ready
          </button>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              marginTop: 10,
              lineHeight: 1.4,
            }}
          >
            Alarm repeats until acknowledged
          </div>
        </div>
        <style>{`
          @keyframes restAlarmGlow {
            0%, 100% { box-shadow: 0 18px 56px rgba(0,0,0,0.6), 0 0 0 8px rgba(232,101,26,0.14); }
            50% { box-shadow: 0 18px 56px rgba(0,0,0,0.6), 0 0 0 14px rgba(232,101,26,0.22); }
          }
        `}</style>
      </div>
    );
  }

  // ── Resting (countdown) toast ─────────────────────────────────────────
  // Whole toast is the tap target — taps anywhere except Skip jump back
  // to the workout. Mirrors the old MinimizedTimerBar's outer-div handler.
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Resting · ${timeStr} · ${exName}. Tap to return to workout.`}
      data-coach="rest-timer"
      onClick={() => onTap(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap(false);
        }
      }}
      style={{
        position: 'fixed',
        bottom: 80,
        left: 16,
        right: 16,
        maxWidth: 388,
        margin: '0 auto',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: tokens.radius.md,
        padding: '12px 16px',
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        alignItems: 'center',
        gap: 10,
        zIndex: 500,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontFamily: 'inherit',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          textAlign: 'left',
          color: 'inherit',
        }}
      >
        <span
          aria-live="polite"
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Rest
        </span>
        <span
          style={{
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 28,
            color: 'var(--accent)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.02em',
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          {timeStr}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          maxWidth: 90,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 600,
        }}
      >
        {exName}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTap(true);
        }}
        style={{
          padding: '8px 14px',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.sm,
          background: 'transparent',
          fontSize: 12,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}
      >
        Skip
      </button>
    </div>
  );
}
