import { type ReactNode } from 'react';
import { tokens } from '../../styles/tokens';
import type { Exercise } from '../../types';

export interface SupersetGroupProps {
  /** Exercises in this superset, in render order. */
  exercises: Exercise[];
  /** Already-rendered ExerciseCard nodes — caller composes the cards (which
   *  need full callback wiring from DayView), this wrapper supplies just
   *  the chrome. */
  children: ReactNode;
  /** Optional handler — drops the supersetGroupId from each exercise. */
  onUnpair?: () => void;
}

/**
 * Visual wrapper that binds two or more exercises into a superset.
 *
 * Chrome (left rail accent, header strip, faint background tint) makes the
 * pairing read as one block instead of two adjacent cards. The cards
 * themselves are rendered by the caller — DayView already builds them with
 * the full callback set, so this component just lays out the shared frame.
 *
 * DEV-flagged at the call site (see SUPERSETS_ENABLED in DayView).
 */
export default function SupersetGroup({ exercises, children, onUnpair }: SupersetGroupProps) {
  const labels = exercises.map((_e, i) => `A${i + 1}`).join(', ');
  const names = exercises.map((e) => e.name).join(', ');

  return (
    <div
      role="group"
      aria-label={`Superset: ${names}`}
      style={{
        position: 'relative',
        borderRadius: tokens.radius.lg,
        border: '1px solid var(--border)',
        borderLeft: '2px solid var(--accent)',
        background: 'rgba(var(--accent-rgb),0.04)',
        padding: '8px 8px 4px',
        marginBottom: 12,
      }}
    >
      {/* Header strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 8px 10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.2em',
              color: 'var(--accent)',
              textTransform: 'uppercase',
            }}
          >
            Superset
          </span>
          <span
            aria-hidden="true"
            style={{ color: 'var(--text-muted)', fontSize: 11 }}
          >
            &middot;
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              letterSpacing: '0.06em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {labels}
          </span>
        </div>
        {onUnpair && (
          <button
            type="button"
            onClick={onUnpair}
            aria-label="Unpair superset"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-muted)',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.sm,
              padding: '4px 8px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontFamily: 'inherit',
            }}
          >
            Unpair
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
