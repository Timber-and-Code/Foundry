import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useActiveSession } from '../../contexts/ActiveSessionContext';
import { TAG_ACCENT } from '../../data/constants';
import { tokens } from '../../styles/tokens';
import HammerIcon from './HammerIcon';

const IDLE_CLOSE_MS = 15 * 60 * 1000; // 15 minutes

function formatElapsed(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PulseIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />
    </svg>
  );
}

/**
 * Generic stretch/yoga glyph — paired arcs suggesting a bend/extension. The
 * app doesn't ship a dedicated mobility icon in /shared yet, so we match
 * PulseIcon's stroke style rather than MobilityCard's emoji.
 */
function MobilityIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <path d="M4 17c3-4 5-6 8-6s5 2 8 6" />
      <path d="M4 7c3 4 5 6 8 6s5-2 8-6" />
    </svg>
  );
}

/**
 * Banner announcing an in-flight workout or cardio session. Rendered once
 * in App's sticky header stack, directly below FoundryBanner. Hides itself
 * when:
 *   - there is no active session, or
 *   - the user is already on the session's route (no need to nag them back).
 *
 * Not a replacement for `completedDays` / `isWeekComplete` rest-state rendering
 * on Home — purely an additive, cross-route signal.
 */
function ActiveSessionBar() {
  const { session, clearActiveSession } = useActiveSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [tick, setTick] = useState(0);

  // Tick once a second so the elapsed clock updates live without redrawing the
  // whole app shell.
  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [session]);

  if (!session) return null;
  if (location.pathname === session.route) return null;

  // Reference `tick` so the interval above re-renders this component every
  // second and the elapsed clock stays live.
  void tick;
  const elapsed = Date.now() - session.startedAt;

  let accent: string;
  let label: string;
  let stat: string;
  let icon: ReactNode;
  let ariaPrefix: string;
  if (session.kind === 'lifting') {
    accent = TAG_ACCENT.PUSH;
    label = session.label.toUpperCase();
    stat = `SET ${Math.min(session.setsDone + 1, session.totalSets)}/${session.totalSets} · ${formatElapsed(elapsed)}`;
    icon = <HammerIcon size={18} />;
    ariaPrefix = 'Workout';
  } else if (session.kind === 'cardio') {
    accent = TAG_ACCENT.CARDIO;
    const elapsedMin = Math.floor(elapsed / 60000);
    const elapsedSec = Math.floor((elapsed % 60000) / 1000);
    label = session.label.toUpperCase();
    stat = `${elapsedMin}:${String(elapsedSec).padStart(2, '0')} / ${session.durationMin}:00`;
    icon = <PulseIcon size={18} color={accent} />;
    ariaPrefix = 'Cardio';
  } else {
    // mobility
    accent = TAG_ACCENT.MOBILITY || TAG_ACCENT.CARDIO;
    label = session.label.toUpperCase();
    stat = `MOBILITY · ${formatElapsed(elapsed)}`;
    icon = <MobilityIcon size={18} color={accent} />;
    ariaPrefix = 'Mobility';
  }

  const showClose = elapsed > IDLE_CLOSE_MS;

  const go = () => navigate(session.route);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${ariaPrefix} in progress — ${label}`}
      style={{
        // Rendered inside App's sticky header stack (below FoundryBanner),
        // so this bar no longer pins itself — that overlap hid the banner.
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--bg-root)',
        borderBottom: `2px solid ${accent}`,
      }}
    >
      <button
        type="button"
        onClick={go}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flex: 1,
          minWidth: 0,
          padding: '8px 14px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {icon}
        <span
          style={{
            fontSize: tokens.fontSize.sm,
            fontWeight: tokens.fontWeight.bold,
            letterSpacing: '0.08em',
            color: accent,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: tokens.fontSize.sm,
            fontWeight: tokens.fontWeight.semibold,
            letterSpacing: '0.04em',
            color: 'var(--text-secondary)',
            flex: 1,
          }}
        >
          · {stat}
        </span>
        <span
          aria-hidden
          style={{
            fontSize: tokens.fontSize.base,
            color: accent,
            fontWeight: tokens.fontWeight.bold,
          }}
        >
          →
        </span>
      </button>
      {showClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            clearActiveSession();
          }}
          aria-label="Dismiss inactive session"
          style={{
            // Inline flex sibling of the main button — was position:absolute,
            // which dropped the × on top of the → arrow.
            flexShrink: 0,
            minWidth: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderLeft: '1px solid var(--border-subtle, var(--border))',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default ActiveSessionBar;
