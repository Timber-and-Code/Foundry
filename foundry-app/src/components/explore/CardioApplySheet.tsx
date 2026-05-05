import { useEffect, useMemo, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { CARDIO_WORKOUTS } from '../../data/constants';
import { loadCardioPresets, saveCardioPreset } from '../../utils/persistence';
import { describeCardioComp, type CardioComposition } from './CardioDesigner';
import type { CardioScheduleSlot, Profile, CardioPreset } from '../../types';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// ─── Apply payload (Bundle G) ──────────────────────────────────────────────
// CardioApplySheet now accepts either a built-in/saved preset by id OR a
// freshly-composed CardioSession from the Designer. Composed sessions are
// persisted as user presets first (auto-labelled) so the schedule slot can
// still reference a stable preset id — keeps the slot shape (`protocol:
// string`) untouched while the consumer reads the full session back via
// `loadCardioPresets()`.
export type CardioApplyPayload =
  | { kind: 'preset'; presetId: string }
  | { kind: 'composed'; session: CardioComposition };

function lookupProtocolLabel(id: string, presets: CardioPreset[] | null): string {
  // Built-in CARDIO_WORKOUTS share ids with their CardioPreset projections.
  // Fall through to user-saved presets so the conflict toast shows the
  // lifter's chosen label (e.g. "Sunday Bike") rather than the raw usr_* id.
  const builtin = CARDIO_WORKOUTS.find((w) => w.id === id);
  if (builtin) return builtin.label;
  const userPreset = (presets ?? loadCardioPresets()).find((p) => p.id === id);
  if (userPreset) return userPreset.label;
  return id;
}

function deriveLabelForComposition(c: CardioComposition): string {
  // Match the Designer's preview line so the auto-named preset is
  // recognisable in CardioBrowser → My Saved.
  const { line } = describeCardioComp(c);
  return line;
}

interface CardioApplySheetProps {
  /** Discriminated payload: built-in/user preset id OR composed session. */
  payload: CardioApplyPayload;
  /** Display label shown in the sheet header. For preset payloads the
   *  caller resolves this from CARDIO_WORKOUTS / loadCardioPresets(); for
   *  composed payloads, this is typically the describeCardioComp(...).line. */
  protocolLabel: string;
  schedule: CardioScheduleSlot[];
  /** Returns the next schedule + the count of net-new entries. The
   *  resolvedProtocolId tells the caller WHICH protocol id was scheduled
   *  (matters for `composed` payloads which mint a fresh user preset). */
  onApply: (
    nextSchedule: CardioScheduleSlot[],
    addedCount: number,
    resolvedProtocolId: string,
  ) => void;
  onClose: () => void;
}

export default function CardioApplySheet({
  payload,
  protocolLabel,
  schedule,
  onApply,
  onClose,
}: CardioApplySheetProps) {
  // For `preset` payloads we know the id immediately; for `composed` we
  // resolve at apply time (so we don't write a preset on every sheet open).
  const presetIdForSelection: string | null =
    payload.kind === 'preset' ? payload.presetId : null;

  // Pre-select DOWs where this protocol is already scheduled (only meaningful
  // for preset payloads — composed sessions are by definition new).
  const initiallySelected = useMemo(
    () =>
      new Set(
        presetIdForSelection
          ? schedule
              .filter((s) => s.protocol === presetIdForSelection)
              .map((s) => s.dayOfWeek)
          : [],
      ),
    [schedule, presetIdForSelection],
  );
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initiallySelected));

  // Conflict lookup: DOW → existing (different) protocol id.
  // For composed payloads every existing entry conflicts since the new
  // protocol id doesn't exist yet — that's the correct UX.
  const conflicts = useMemo(() => {
    const map: Record<number, string> = {};
    for (const slot of schedule) {
      if (slot.protocol !== presetIdForSelection) map[slot.dayOfWeek] = slot.protocol;
    }
    return map;
  }, [schedule, presetIdForSelection]);

  // Cache user presets once for label lookups (avoids loadCardioPresets per
  // conflict row render).
  const userPresets = useMemo(() => loadCardioPresets(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (dow: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dow)) next.delete(dow);
      else next.add(dow);
      return next;
    });
  };

  const apply = () => {
    // Resolve the protocol id we'll schedule. For composed payloads we mint
    // a fresh user preset on first apply so the schedule slot has a stable
    // id to reference (and CardioBrowser → My Saved picks it up).
    let resolvedId: string;
    if (payload.kind === 'preset') {
      resolvedId = payload.presetId;
    } else {
      const session = payload.session;
      const newPreset: CardioPreset = {
        id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: deriveLabelForComposition(session),
        intensity: session.intensity,
        modality: session.modality,
        modalityCustom: session.modalityCustom,
        protocol: session.protocol,
        target: { kind: 'duration', minutes: session.duration },
        isUserSaved: true,
      };
      saveCardioPreset(newPreset);
      resolvedId = newPreset.id;
    }

    // Build next schedule: keep entries for *other* protocols on days we
    // didn't touch, remove entries for this protocol on days no longer
    // selected, add entries for newly-selected days (overwriting any
    // conflicting other-protocol slots).
    const filtered = schedule.filter((s) => {
      if (selected.has(s.dayOfWeek)) return false; // we own this DOW now
      if (s.protocol === resolvedId) return false; // remove any deselected entries of this protocol
      return true;
    });
    const added: CardioScheduleSlot[] = Array.from(selected).map((dayOfWeek) => ({
      dayOfWeek,
      protocol: resolvedId,
    }));
    const next = [...filtered, ...added].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    // Count net-new entries (not already scheduled for this protocol)
    const addedCount = Array.from(selected).filter((d) => !initiallySelected.has(d)).length;
    onApply(next, addedCount, resolvedId);
  };

  const changed =
    selected.size !== initiallySelected.size ||
    Array.from(selected).some((d) => !initiallySelected.has(d));

  const conflictDays = Array.from(selected).filter((d) => conflicts[d]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cardio-apply-heading"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: tokens.colors.overlay,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          borderRadius: `${tokens.radius.xl}px ${tokens.radius.xl}px 0 0`,
          padding: '18px 20px 24px',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
          width: '100%',
          maxWidth: 520,
          // Without these constraints the day-picker grid + confirm buttons
          // sit below the visible fold on iPhone-class viewports — testers
          // saw "just the top portion of an orange box" with nothing tappable.
          maxHeight: '85vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          boxShadow: 'var(--shadow-xl)',
          animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: 'var(--border)',
            margin: '0 auto 14px',
          }}
          aria-hidden="true"
        />
        <div
          id="cardio-apply-heading"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: 'var(--accent)',
            marginBottom: 4,
          }}
        >
          ADD TO SCHEDULE
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          {protocolLabel}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            marginBottom: 16,
          }}
        >
          Pick the days you want this on. You can apply to more than one day.
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
            marginBottom: 14,
          }}
          role="group"
          aria-label="Days of the week"
        >
          {DOW_LABELS.map((label, dow) => {
            const isSelected = selected.has(dow);
            const conflictProtoId = conflicts[dow];
            return (
              <button
                key={dow}
                onClick={() => toggle(dow)}
                aria-pressed={isSelected}
                style={{
                  padding: '10px 0',
                  borderRadius: tokens.radius.md,
                  border: isSelected
                    ? '1px solid var(--accent)'
                    : conflictProtoId
                      ? '1px solid rgba(var(--accent-rgb),0.35)'
                      : '1px solid var(--border)',
                  background: isSelected
                    ? 'rgba(var(--accent-rgb),0.14)'
                    : 'var(--bg-inset)',
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  textTransform: 'uppercase' as const,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {conflictDays.length > 0 && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1.55,
              background: 'rgba(var(--accent-rgb),0.07)',
              border: '1px solid rgba(var(--accent-rgb),0.2)',
              borderRadius: tokens.radius.md,
              padding: '10px 12px',
              marginBottom: 16,
            }}
            role="status"
          >
            {conflictDays.map((d) => (
              <div key={d} style={{ marginBottom: d === conflictDays[conflictDays.length - 1] ? 0 : 4 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{DOW_LABELS[d]}:</strong>{' '}
                replaces {lookupProtocolLabel(conflicts[d], userPresets)}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: tokens.radius.lg,
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={!changed}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: tokens.radius.lg,
              background: changed ? 'var(--btn-primary-bg)' : 'var(--bg-inset)',
              border: `1px solid ${changed ? 'var(--btn-primary-border)' : 'var(--border)'}`,
              color: changed ? 'var(--btn-primary-text)' : 'var(--text-muted)',
              fontSize: 13,
              fontWeight: 700,
              cursor: changed ? 'pointer' : 'not-allowed',
              letterSpacing: '0.02em',
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-export for CardioProtocolDetail to consume profile updates
export function applyCardioScheduleUpdate(
  profile: Profile,
  nextSchedule: CardioScheduleSlot[]
): Profile {
  return { ...profile, cardioSchedule: nextSchedule };
}
