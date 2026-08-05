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
  /** Also rebuild every other day with no logged work. */
  onApplyAll: () => void;
  /** Redraw only the unlocked slots. Omitted, locking is hidden. */
  onRebuildUnlocked?: (lockedSlots: number[]) => void;
  /** Slots the last redraw could not fill with a unique exercise. */
  unresolved?: number[];
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
  onRebuildUnlocked,
  unresolved = [],
}: RebuildDayModalProps) {
  // Locks are held by EXERCISE ID, not slot index. A redraw can move an
  // exercise between slots, and a lock that tracked position would silently
  // start protecting whatever landed there instead of the lift the lifter
  // actually chose to keep.
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const lockedSlots = preview.after
    .map((s, i) => (lockedIds.has(s.id) ? i : -1))
    .filter((i) => i >= 0);
  const unlockedCount = preview.after.length - lockedSlots.length;
  const toggleLock = (id: string) =>
    setLockedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

        {/* A day's exercise list is meso-wide by construction — only the set
            count varies week to week. So rebuilding this day rebuilds it for
            every week, and saying so up front stops people reading this as
            "just today's session". */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        >
          Applies to {preview.label} in every week of this meso — it&rsquo;s the same
          session each time, only the set count changes.
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
            This came back with the same exercises. Applying it changes nothing —
            close and rebuild again for a different set.
          </div>
        )}

        {/* was → now, because "is this better?" is unanswerable without the
            thing it replaced. */}
        <div style={{ marginBottom: 4 }}>
          {preview.after.map((slot, i) => {
            const was = preview.before[i];
            const same = was?.id === slot.id;
            const isLocked = lockedIds.has(slot.id);
            const stuck = unresolved.includes(i);
            const row = (
              <>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
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
                  {stuck && (
                    <div style={{ fontSize: 11, color: 'var(--warning, #ff9800)', marginTop: 2 }}>
                      No other option left that isn&rsquo;t already in this session
                    </div>
                  )}
                </div>
                {isLocked ? (
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
                    KEEPING
                  </span>
                ) : same ? (
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>unchanged</span>
                ) : null}
              </>
            );
            if (!onRebuildUnlocked) {
              return <div key={`${slot.id}-${i}`} style={rowStyle}>{row}</div>;
            }
            return (
              <button
                key={`${slot.id}-${i}`}
                onClick={() => toggleLock(slot.id)}
                aria-pressed={isLocked}
                aria-label={`${isLocked ? 'Stop keeping' : 'Keep'} ${slot.name}`}
                disabled={busy}
                style={{
                  ...rowStyle,
                  width: '100%',
                  background: isLocked ? 'var(--bg-inset)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border-subtle)',
                  borderLeft: `2px solid ${isLocked ? 'var(--accent)' : 'transparent'}`,
                  paddingLeft: 8,
                  cursor: busy ? 'wait' : 'pointer',
                }}
              >
                {row}
              </button>
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

        {onRebuildUnlocked && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Tap any exercise to keep it, then rebuild the rest.
            </div>
            <button
              onClick={() => onRebuildUnlocked(lockedSlots)}
              disabled={busy || unlockedCount === 0}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: tokens.radius.md,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: unlockedCount === 0 ? 'var(--text-dim)' : 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: busy || unlockedCount === 0 ? 'default' : 'pointer',
              }}
            >
              {unlockedCount === 0
                ? 'Keeping everything — nothing to rebuild'
                : lockedSlots.length === 0
                  ? 'Rebuild again'
                  : `Rebuild the other ${unlockedCount}`}
            </button>
          </div>
        )}

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
            {busy ? 'Applying…' : `Keep this ${preview.label}`}
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
                  : `Yes — rebuild all ${others + 1} days`}
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
                {/* Names the days rather than counting them. "Rebuild the rest
                    of the meso" reads as "copy this session onto the other
                    days", which is the opposite of what happens — each one
                    gets its own independent draw. */}
                <span>Rebuild my other days too</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                  {preview.otherLabels.join(', ')} — each gets its own new session
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
