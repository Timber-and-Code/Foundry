/**
 * Show the redrawn session, THEN ask how far to apply it.
 *
 * The old flow was two window.confirm()s that described the change in prose
 * and asked for a decision before showing it. Nobody can judge "rebuild Full
 * Body C?" without seeing what Full Body C became — so the scope question
 * comes second, once there's something concrete on screen.
 *
 * The result being previewed is applied verbatim. generateProgram shuffles,
 * so re-running it at apply time would swap the workout out from under the
 * person who just approved it.
 */
import { useState } from 'react';
import Modal from '../ui/Modal';
import { tokens } from '../../styles/tokens';
import type { RebuildPreview } from '../../utils/rebuildSession';

interface RebuildDayModalProps {
  preview: RebuildPreview;
  busy?: boolean;
  onCancel: () => void;
  /** Apply to the previewed day only. */
  onApplyDay: () => void;
  /** Also redraw every other day with no logged work. */
  onApplyAll: () => void;
}

const rowStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  padding: '7px 0',
  borderBottom: '1px solid var(--border-subtle)',
} as const;

export default function RebuildDayModal({
  preview,
  busy = false,
  onCancel,
  onApplyDay,
  onApplyAll,
}: RebuildDayModalProps) {
  // Escalating to the whole cycle redraws the other days too, and those
  // aren't on screen. Confirm the widening explicitly rather than letting one
  // tap change days the lifter never looked at.
  const [confirmAll, setConfirmAll] = useState(false);
  const others = preview.otherDays.length;

  return (
    <Modal open onClose={busy ? () => {} : onCancel} maxWidth={440}>
      <div style={{ maxHeight: '78vh', overflowY: 'auto' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: 'var(--accent)',
            marginBottom: 4,
          }}
        >
          REBUILT
        </div>
        <div
          style={{
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 26,
            fontWeight: 400,
            color: 'var(--text-primary)',
            letterSpacing: '0.02em',
            lineHeight: 1.05,
            marginBottom: 14,
          }}
        >
          {preview.label}
        </div>

        {!preview.changed && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              lineHeight: 1.6,
              marginBottom: 14,
            }}
          >
            The redraw landed on the same exercises. Applying it changes nothing —
            close and try again for a different draw.
          </div>
        )}

        {/* was → now, because "is this better?" is unanswerable without the
            thing it replaced. */}
        <div style={{ marginBottom: 4 }}>
          {preview.after.map((slot, i) => {
            const was = preview.before[i];
            const same = was?.id === slot.id;
            return (
              <div key={`${slot.id}-${i}`} style={rowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {slot.name}
                  </div>
                  {was && !same && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        marginTop: 1,
                        textDecoration: 'line-through',
                      }}
                    >
                      {was.name}
                    </div>
                  )}
                </div>
                {same && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
                    unchanged
                  </div>
                )}
              </div>
            );
          })}
          {/* Slots the rebuild dropped. */}
          {preview.before.slice(preview.after.length).map((was, i) => (
            <div key={`dropped-${i}`} style={rowStyle}>
              <div
                style={{
                  flex: 1,
                  fontSize: 15,
                  color: 'var(--text-muted)',
                  textDecoration: 'line-through',
                }}
              >
                {was.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>removed</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
          <button
            onClick={onApplyDay}
            disabled={busy}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: tokens.radius.md,
              background: 'var(--accent)',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: '0.04em',
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? 'Applying…' : 'Use this session'}
          </button>

          {others > 0 &&
            (confirmAll ? (
              <button
                onClick={onApplyAll}
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: tokens.radius.md,
                  background: 'transparent',
                  border: '1px solid var(--accent)',
                  color: 'var(--accent)',
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  cursor: busy ? 'wait' : 'pointer',
                }}
              >
                {busy
                  ? 'Applying…'
                  : `Yes — redraw this and ${others} other day${others === 1 ? '' : 's'}`}
              </button>
            ) : (
              <button
                onClick={() => setConfirmAll(true)}
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: tokens.radius.md,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  cursor: busy ? 'wait' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  alignItems: 'center',
                }}
              >
                <span>Rebuild the rest of the cycle too</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                  Also redraws {others} day{others === 1 ? '' : 's'} you haven&rsquo;t trained
                </span>
              </button>
            ))}

          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: tokens.radius.md,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            Keep what I had
          </button>
        </div>
      </div>
    </Modal>
  );
}
