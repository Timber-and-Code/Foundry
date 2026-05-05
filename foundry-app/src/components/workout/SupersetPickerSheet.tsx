import { tokens } from '../../styles/tokens';
import type { Exercise } from '../../types';

export interface SupersetPickerSheetProps {
  /** All exercises in the current workout. */
  exercises: Exercise[];
  /** Index of the exercise that wants to pair (the "source"). */
  sourceIdx: number;
  /** Indexes of exercises already done (rendered muted in the picker). */
  doneIndices?: Set<number>;
  /** Called with targetIdx when the user selects a partner. */
  onSelect: (targetIdx: number) => void;
  /** Called when the sheet is dismissed without selection. */
  onClose: () => void;
}

/**
 * Modal picker for choosing a superset partner from anywhere in the workout.
 *
 * Lists every exercise EXCEPT the source; exercises already in a different
 * superset are shown but disabled. Tapping an entry pairs the two and (if
 * not already adjacent) splices the target to sit right after the source.
 */
export default function SupersetPickerSheet({
  exercises,
  sourceIdx,
  doneIndices,
  onSelect,
  onClose,
}: SupersetPickerSheetProps) {
  const sourceEx = exercises[sourceIdx];
  if (!sourceEx) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="superset-picker-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 200,
        padding: 0,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderTop: `2px solid var(--accent)`,
          borderTopLeftRadius: tokens.radius.xxl,
          borderTopRightRadius: tokens.radius.xxl,
          width: '100%',
          maxWidth: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: 'var(--bg-card)',
            padding: '18px 20px 12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            id="superset-picker-title"
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.2em',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Superset With
          </div>
          <div
            style={{
              fontSize: 18,
              fontFamily: tokens.fontFamily.display,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
            }}
          >
            {sourceEx.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginTop: 4,
            }}
          >
            Pick the second exercise in the pair.
          </div>
        </div>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: '6px 12px 12px',
          }}
        >
          {exercises.map((ex, idx) => {
            if (idx === sourceIdx) return null;
            const alreadyPaired = !!ex.supersetGroupId;
            const isDone = doneIndices?.has(idx) === true;
            const disabled = alreadyPaired;
            return (
              <li key={`${idx}-${ex.id || ex.name}`}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '14px 12px',
                    margin: '4px 0',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: tokens.radius.md,
                    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: isDone && !disabled ? 0.6 : 1,
                  }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ex.name}
                  </span>
                  {alreadyPaired && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: '0.16em',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        marginLeft: 8,
                        flexShrink: 0,
                      }}
                    >
                      Already paired
                    </span>
                  )}
                  {isDone && !alreadyPaired && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: '0.16em',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        marginLeft: 8,
                        flexShrink: 0,
                      }}
                    >
                      Done
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div
          style={{
            padding: '0 16px 16px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.md,
              color: 'var(--text-secondary)',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
