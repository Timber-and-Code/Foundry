import React, { useEffect, useId, useRef } from 'react';
import ExerciseBrowser, {
  type ExerciseBrowserItem,
} from '../shared/ExerciseBrowser';
import SwapScopeSelector from './SwapScopeSelector';

export interface SwapMenuProps {
  /** When true, the menu is mounted + slid into view. */
  open: boolean;
  /** Fired when the user taps BACK or presses Escape. */
  onClose: () => void;
  /** Name of the exercise being replaced — surfaced in the subheader. */
  replacingName: string;
  /** Exercises grouped by muscle — typically from `buildSwapGroups`. */
  exerciseGroups: Record<string, ExerciseBrowserItem[]>;
  /** Expand this muscle group on mount and pin it to the top of the list. */
  autoExpandMuscle?: string;
  /** User's equipment list — rows needing other kit are dimmed. */
  userEquipment?: string[];
  /** Fires when a replacement is picked. */
  onSelect: (newExId: string) => void;
  /** Optional — add a custom exercise by name (select mode only). */
  onCustomExercise?: (name: string) => void;
  /**
   * When set, the scope picker is shown instead of the browser. This is
   * the gate between "pick new exercise" and "apply for this week / meso".
   */
  scopePending: { exerciseName: string } | null;
  /** Scope-picker handlers. */
  onScopeMeso: () => void;
  onScopeWeek: () => void;
  onScopeCancel: () => void;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * SwapMenu — full-height slide-in submenu that replaces SwapSheet.
 *
 * Design choices baked in:
 *   - NOT a bottom sheet. A fixed, full-viewport overlay that slides in
 *     from the right. No dark scrim — the container uses `--bg-root` so
 *     the user sees the submenu as part of the app, not "on top of" it.
 *   - Search bar is pinned directly under the subheader, above the
 *     scroll area, so the iOS keyboard can't cover it.
 *   - Big BACK button in the header (44pt tap target) because the old
 *     variant had a tiny, low-contrast back.
 *   - Muscle of the exercise being replaced is auto-expanded AND hoisted
 *     to the top of the list (see ExerciseBrowser).
 *
 * Scope selector is still chained on top — SwapScopeSelector stays as
 * the gate between "picked new exercise" and "applied for this week /
 * meso".
 */
function SwapMenu({
  open,
  onClose,
  replacingName,
  exerciseGroups,
  autoExpandMuscle,
  userEquipment,
  onSelect,
  onCustomExercise,
  scopePending,
  onScopeMeso,
  onScopeWeek,
  onScopeCancel,
}: SwapMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // onClose is read from a ref so the focus-management effect below
  // doesn't re-run every time the parent passes a fresh inline callback.
  // (DayView's logSet path re-renders the SwapMenu mid-typing, which
  // used to refocus the BACK button on every keystroke and made the
  // search input untypeable.)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Body scroll lock + focus management while open. Only depends on
  // `open` — onClose changes do NOT re-run this effect, see above.
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const el = containerRef.current;
    const first = el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const focusable = el.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable.length) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocus.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'var(--bg-root)',
          display: 'flex',
          flexDirection: 'column',
          transform: 'translateX(0)',
          animation: 'swapMenuSlideIn 0.22s cubic-bezier(0.34,1.1,0.64,1)',
          overflow: 'hidden',
        }}
      >
        {/* ── Sticky header ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 8px',
            borderBottom: '1px solid var(--border-subtle, var(--border))',
            background: 'var(--bg-root)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Go back"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              minWidth: 44,
              minHeight: 44,
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>
              &#8249;
            </span>
            <span>BACK</span>
          </button>
          <div
            id={titleId}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-primary)',
            }}
          >
            SWAP EXERCISE
          </div>
          {/* Right spacer — matches the BACK button width so the title stays centred. */}
          <div aria-hidden="true" style={{ minWidth: 72 }} />
        </div>

        {/* ── Sticky subheader: replacing ────────────────────────────── */}
        {replacingName && (
          <div
            style={{
              padding: '8px 16px 10px',
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
              background: 'var(--bg-root)',
              borderBottom: '1px solid var(--border-subtle, var(--border))',
              flexShrink: 0,
            }}
          >
            Replacing: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{replacingName}</span>
          </div>
        )}

        {/* ── Scroll area (search bar is sticky inside ExerciseBrowser) ── */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <ExerciseBrowser
            groups={exerciseGroups}
            mode="select"
            autoExpandMuscle={autoExpandMuscle}
            userEquipment={userEquipment}
            onSelect={onSelect}
            onCustomExercise={onCustomExercise}
          />
        </div>
      </div>

      {/* ── Scope gate ────────────────────────────────────────────────── */}
      {scopePending && (
        <SwapScopeSelector
          exerciseName={scopePending.exerciseName}
          onMeso={onScopeMeso}
          onWeek={onScopeWeek}
          onCancel={onScopeCancel}
        />
      )}

      {/* One-off keyframe — intentionally inline so this component is
          self-contained and doesn't depend on a global CSS edit. */}
      <style>{`
        @keyframes swapMenuSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

export default React.memo(SwapMenu);
