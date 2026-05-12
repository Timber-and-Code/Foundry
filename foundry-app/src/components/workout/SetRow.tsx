import React from 'react';
import { tokens } from '../../styles/tokens';

export interface SetRowProps {
  exIdx: number;
  setIdx: number;
  weight: string | number;
  reps: string | number;
  isDone: boolean;
  isActive: boolean;
  isSuggestedWeight: boolean;
  isSuggestedReps: boolean;
  isMissedRow: boolean;
  canRemove: boolean;
  readOnly: boolean;
  exerciseName: string;
  /** Override for the leading badge in editorial mode. Defaults to setIdx + 1
   *  zero-padded ("01"). Pass a custom string for non-default badging. */
  rowNumber?: string;
  /** Optional small label rendered next to / under the row number. Used by
   *  SupersetRoundView to surface the exercise name in each round row. */
  rowLabel?: string;
  /** When true and rowNumber is undefined, the badge slot renders nothing
   *  (no fallback to setIdx + 1). Used by SupersetRoundView so the leading
   *  column shows ONLY the rowLabel (exercise name) without a set-number
   *  badge above it. */
  hideBadgeFallback?: boolean;
  /** When true, the leading column is dropped entirely from the editorial
   *  grid. Used by SupersetRoundView where the exercise name is rendered as
   *  its own row above the inputs (full container width, no truncation
   *  regardless of name length). Solo cards keep the leading badge column. */
  noLeadingColumn?: boolean;
  onUpdateWeight: (value: string) => void;
  onUpdateReps: (value: string) => void;
  onWeightBlur: (value: string) => void;
  onCheckmark: () => void;
  /** Emit intent to remove. Confirm dialog stays in the parent. */
  onRequestRemove?: () => void;
  variant?: 'editorial' | 'legacy';
}

/**
 * Single set row — extracted from ExerciseCard so the round-grouped superset
 * layout (SupersetRoundView) can reuse the exact editorial input chrome
 * without a copy-paste of 130+ lines of inline styles.
 *
 * Visual contracts preserved verbatim from ExerciseCard's prior inline impl:
 *   - editorial grid: 32px 1fr 1fr 44px 28px
 *   - legacy grid:    1fr 1fr 1fr 28px
 *   - editorial inputs are borderless, Bebas display font, italic-orange when
 *     the value is a suggestion, muted when the row is done.
 *   - keyboard-aware: weight & reps inputs scrollIntoView on focus so the
 *     iOS numeric keypad doesn't cover the row.
 *   - inputMode="decimal" on weight, "numeric" on reps (Capacitor / iOS
 *     keyboard hint).
 */
export default function SetRow({
  setIdx,
  weight,
  reps,
  isDone,
  isActive,
  isSuggestedWeight,
  isSuggestedReps,
  isMissedRow,
  canRemove,
  readOnly,
  rowNumber,
  rowLabel,
  hideBadgeFallback = false,
  noLeadingColumn = false,
  onUpdateWeight,
  onUpdateReps,
  onWeightBlur,
  onCheckmark,
  onRequestRemove,
  variant = 'legacy',
}: SetRowProps) {
  const editorial = variant === 'editorial';

  // Editorial input: fully borderless, Bebas display font for the numerals.
  // Matches the preview's editorial typography — set values read as
  // headlines, not form fields.
  const editorialInputStyle = (suggested: boolean): React.CSSProperties => ({
    width: '100%',
    textAlign: 'center',
    fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
    fontSize: 22,
    fontWeight: 400,
    letterSpacing: '0.02em',
    padding: '6px 0',
    color: isDone
      ? 'var(--text-secondary)'
      : suggested
      ? 'var(--text-accent)'
      : 'var(--text-primary)',
    fontStyle: suggested ? 'italic' : 'normal',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontVariantNumeric: 'tabular-nums',
    boxSizing: 'border-box',
  });

  const legacyInputStyle = (suggested: boolean): React.CSSProperties => ({
    minWidth: 0,
    width: '100%',
    background: 'var(--bg-inset)',
    border: suggested ? '1.5px solid var(--text-accent)' : '1px solid var(--border)',
    borderRadius: tokens.radius.sm,
    padding: '8px 6px',
    fontSize: 14,
    color: suggested ? 'var(--text-accent)' : 'var(--text-primary)',
    fontStyle: suggested ? 'italic' : 'normal',
    outline: 'none',
    textAlign: 'center',
    boxSizing: 'border-box',
  });

  const rowBg = editorial
    ? isDone
      ? 'linear-gradient(90deg, rgba(232,101,26,0.08) 0%, transparent 100%)'
      : isActive
      ? 'linear-gradient(90deg, rgba(232,101,26,0.12) 0%, transparent 100%)'
      : 'transparent'
    : undefined;

  const badgeText =
    rowNumber !== undefined
      ? rowNumber
      : hideBadgeFallback
      ? null
      : String(setIdx + 1).padStart(2, '0');
  // SupersetRoundView renders the exercise name as its own row ABOVE the
  // inputs (no character-count limit), so the leading badge column is
  // dropped entirely in that mode. Solo cards keep the 32px leading column
  // for the "01" / "02" zero-padded set number.
  const editorialCols = noLeadingColumn
    ? '1fr 1fr 44px 28px'
    : '32px 1fr 1fr 44px 28px';

  return (
    <div
      data-coach={isMissedRow ? 'missed-row' : undefined}
      data-testid={`set-row-${setIdx}`}
      style={{
        display: 'grid',
        gridTemplateColumns: editorial ? editorialCols : '1fr 1fr 1fr 28px',
        gap: editorial ? 10 : 8,
        alignItems: 'center',
        padding: editorial ? '12px 0' : 0,
        marginBottom: editorial ? 0 : 6,
        borderBottom: editorial ? '1px solid var(--border-subtle, var(--border))' : 'none',
        background: rowBg,
        opacity: !editorial && isDone ? 0.6 : 1,
      }}
    >
      {editorial && !noLeadingColumn && (
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: 1,
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 400,
            color: isDone
              ? 'var(--accent)'
              : isActive
              ? 'var(--text-primary)'
              : 'var(--text-muted)',
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {badgeText !== null && <span>{badgeText}</span>}
          {rowLabel && (
            <span
              style={{
                // When the badge is absent (round-view rows), the label is
                // the only thing in the leading column — render it as the
                // primary identifier in display Bebas at 15px so it reads
                // alongside the 22px weight/reps numbers without dominating.
                // When the badge IS present (legacy stacked layout, unused
                // after the A/B drop but kept for safety), the label is a
                // 9px subscript under the badge.
                fontFamily: badgeText === null
                  ? "'Bebas Neue', 'Inter', system-ui, sans-serif"
                  : 'inherit',
                fontSize: badgeText === null ? 15 : 9,
                fontWeight: badgeText === null ? 400 : 700,
                letterSpacing: badgeText === null ? '0.04em' : '0.08em',
                color: badgeText === null
                  ? (isDone ? 'var(--accent)' : isActive ? 'var(--text-primary)' : 'var(--text-secondary)')
                  : 'var(--text-muted)',
                textTransform: 'uppercase',
                lineHeight: 1.05,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {rowLabel}
            </span>
          )}
        </span>
      )}
      <input
        type="number"
        inputMode="decimal"
        placeholder="—"
        value={weight || ''}
        aria-label={`Set ${setIdx + 1} weight in pounds`}
        onChange={(e) => onUpdateWeight(e.target.value)}
        onBlur={(e) => onWeightBlur(e.target.value)}
        onFocus={(e) => {
          const target = e.currentTarget;
          requestAnimationFrame(() =>
            target.scrollIntoView({ block: 'center', behavior: 'smooth' }),
          );
        }}
        disabled={isDone || readOnly}
        style={editorial ? editorialInputStyle(isSuggestedWeight) : legacyInputStyle(isSuggestedWeight)}
      />
      <input
        type="number"
        inputMode="numeric"
        placeholder="—"
        value={reps || ''}
        aria-label={`Set ${setIdx + 1} reps`}
        onChange={(e) => onUpdateReps(e.target.value)}
        onFocus={(e) => {
          const target = e.currentTarget;
          requestAnimationFrame(() =>
            target.scrollIntoView({ block: 'center', behavior: 'smooth' }),
          );
        }}
        disabled={isDone || readOnly}
        style={editorial ? editorialInputStyle(isSuggestedReps) : legacyInputStyle(isSuggestedReps)}
      />
      <button
        onClick={onCheckmark}
        disabled={readOnly}
        aria-pressed={isDone}
        aria-label={
          isDone
            ? `Set ${setIdx + 1} complete — tap to undo`
            : `Mark set ${setIdx + 1} complete`
        }
        style={
          editorial
            ? {
                width: 36,
                height: 36,
                justifySelf: 'end',
                border: isDone ? 'none' : '1.5px solid var(--accent)',
                borderRadius: 8,
                background: isDone ? 'var(--accent)' : 'transparent',
                color: isDone ? 'var(--bg-root, #0A0A0C)' : 'var(--text-muted)',
                cursor: readOnly ? 'default' : 'pointer',
                fontSize: 16,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }
            : {
                minWidth: 0,
                width: '100%',
                border: isDone ? '2px solid var(--success)' : '1.5px solid var(--accent)',
                borderRadius: tokens.radius.sm,
                padding: '8px 6px',
                background: isDone ? 'var(--success)' : 'var(--bg-inset)',
                color: isDone ? 'white' : 'var(--text-muted)',
                cursor: readOnly ? 'default' : 'pointer',
                fontSize: 18,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }
        }
      >
        <span aria-hidden="true">{isDone ? '✓' : ''}</span>
      </button>
      {canRemove && onRequestRemove ? (
        <button
          onClick={onRequestRemove}
          aria-label={`Remove set ${setIdx + 1}`}
          style={{
            width: 28,
            height: '100%',
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span aria-hidden="true">−</span>
        </button>
      ) : (
        <div aria-hidden="true" />
      )}
    </div>
  );
}
