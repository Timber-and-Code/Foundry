import { useId, type ReactNode } from 'react';
import { tokens } from '../../styles/tokens';

interface AccordionBarProps {
  /** All-caps category label shown on the header's first line. */
  label: string;
  /** Current selected value shown on the header's second line. */
  value: string;
  /** Whether this bar is expanded. Parent owns the one-open-at-a-time state. */
  open: boolean;
  /** Toggle handler — flip between open / closed. */
  onToggle: () => void;
  /** Body content rendered below the header when open. */
  children: ReactNode;
}

/**
 * AccordionBar — full-width collapsible row used in the Beat 2 preview.
 *
 * Replaces the 3-chip row that opened bottom sheets. One bar open at a
 * time is enforced by the parent via `open` + `onToggle`. Header is a
 * real button with `aria-expanded` / `aria-controls` for screen readers.
 * Body renders inline only when open — simpler than a max-height
 * transition and dodges the "children keep rendering off-screen" perf
 * trap on the DayAccordion beneath us.
 */
export default function AccordionBar({
  label,
  value,
  open,
  onToggle,
  children,
}: AccordionBarProps) {
  const bodyId = useId();
  return (
    <div
      style={{
        borderRadius: tokens.radius.md,
        border: `1px solid ${open ? tokens.colors.accent : 'rgba(255,255,255,0.08)'}`,
        background: tokens.colors.bgCard,
        overflow: 'hidden',
        transition: 'border-color 180ms ease',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          color: tokens.colors.textPrimary,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontFamily: tokens.fontFamily.body,
        }}
      >
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 3,
            lineHeight: 1.15,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: tokens.colors.textPrimary,
              fontFamily: tokens.fontFamily.display,
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: tokens.colors.textMuted,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 18,
            color: tokens.colors.accent,
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 180ms ease',
            flexShrink: 0,
          }}
        >
          {'▾'}
        </span>
      </button>
      {open && (
        <div
          id={bodyId}
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '12px 16px 16px',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
