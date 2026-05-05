/**
 * CardioDesigner — full-screen 4-axis cardio session composer (Group D / C2).
 *
 * Replaces the "browse 7 hardcoded protocols" pattern with a composable
 * session designer. Lifter dials in:
 *   - INTENSITY  (easy / moderate / hard)
 *   - WORKOUT    (walk / run / bike / row / swim / stairs / elliptical / jump rope / other)
 *   - PROTOCOL   (LISS / Zone 2 / Tempo / Tabata / EMOM / Sprint Intervals / Free)
 *   - DURATION   (preset chips per protocol; Tabata clamps to multiples of 4)
 *
 * Cross-axis rules (enforced in component state):
 *   - Tabata → durations clamp to {4,8,12,16,20}; selecting Tabata snaps
 *     duration to 4 if the current value isn't valid.
 *   - Switching protocol resets duration to that protocol's default unless
 *     the current value is still valid for the new protocol's menu.
 *   - Swim removes Tabata from the protocol menu.
 *   - Free relaxes all rules.
 *
 * "Save as preset" persists via persistence helpers (local-only today; flag
 * in saveCardioPreset for Supabase sync follow-up). The Designer doesn't
 * own any session-start logic — callers (CardioBrowser, HomeCardioCard)
 * handle the route/launch path.
 */
import { useState, useEffect, useMemo } from 'react';
import { tokens } from '../../styles/tokens';
import { saveCardioPreset } from '../../utils/store';
import type {
  CardioPreset,
  Intensity,
  Modality,
  ProtocolKind,
  CardioTarget,
} from '../../types';

// ── Cross-axis defaults ─────────────────────────────────────────────────────
const TABATA_DURATIONS = [4, 8, 12, 16, 20];
const STANDARD_DURATIONS = [10, 15, 20, 30, 45, 60];

interface ProtocolMeta {
  duration: number;
  durations: number[];
  note?: string;
}

const PROTOCOL_DEFAULTS: Record<ProtocolKind, ProtocolMeta> = {
  liss:              { duration: 45, durations: STANDARD_DURATIONS, note: 'Long, slow, steady — base aerobic work' },
  zone2:             { duration: 30, durations: STANDARD_DURATIONS, note: 'Conversational pace, sustainable' },
  tempo:             { duration: 20, durations: STANDARD_DURATIONS, note: 'Sustained moderate-hard effort' },
  tabata:            { duration: 4,  durations: TABATA_DURATIONS,   note: '30s on / 30s off · 8 rounds = 4 min · multiples for repeats' },
  emom:              { duration: 12, durations: STANDARD_DURATIONS, note: 'Every minute on the minute' },
  sprint_intervals:  { duration: 15, durations: STANDARD_DURATIONS, note: 'Max effort + full recovery alternation' },
  free:              { duration: 30, durations: STANDARD_DURATIONS },
};

const INTENSITY_OPTS: { v: Intensity; l: string; sub: string }[] = [
  { v: 'easy', l: 'Easy', sub: 'Conversational' },
  { v: 'moderate', l: 'Moderate', sub: 'Challenging' },
  { v: 'hard', l: 'Hard', sub: 'Near max' },
];

const MODALITY_OPTS: { v: Modality; l: string }[] = [
  { v: 'walk', l: 'Walk' },
  { v: 'run', l: 'Run' },
  { v: 'bike', l: 'Bike' },
  { v: 'row', l: 'Row' },
  { v: 'swim', l: 'Swim' },
  { v: 'stairs', l: 'Stairs' },
  { v: 'elliptical', l: 'Elliptical' },
  { v: 'jump_rope', l: 'Jump Rope' },
  { v: 'other', l: 'Other / Custom' },
];

const PROTOCOL_OPTS: { v: ProtocolKind; l: string; desc: string }[] = [
  { v: 'liss', l: 'LISS', desc: 'Long, slow, steady — recovery and base building' },
  { v: 'zone2', l: 'Zone 2', desc: 'Aerobic base — conversational, sustainable' },
  { v: 'tempo', l: 'Tempo', desc: 'Sustained moderate-hard effort' },
  { v: 'tabata', l: 'Tabata', desc: '20s on / 10s off × 8 rounds' },
  { v: 'emom', l: 'EMOM', desc: 'Every minute on the minute' },
  { v: 'sprint_intervals', l: 'Sprint Intervals', desc: 'Alternating max effort + full recovery' },
  { v: 'free', l: 'Free', desc: 'No prescribed structure — log freely' },
];

const CARDIO_ACCENT = tokens.colors.gold;

export interface CardioComposition {
  intensity: Intensity;
  modality: Modality;
  /** Set when modality === 'other'. */
  modalityCustom?: string;
  protocol: ProtocolKind;
  duration: number;
}

export const DEFAULT_CARDIO_COMP: CardioComposition = {
  intensity: 'easy',
  modality: 'walk',
  protocol: 'zone2',
  duration: PROTOCOL_DEFAULTS.zone2.duration,
};

export function describeCardioComp(c: CardioComposition): { line: string; blurb: string } {
  const intensity = INTENSITY_OPTS.find((o) => o.v === c.intensity)!;
  const modalityLabel =
    c.modality === 'other' && c.modalityCustom
      ? c.modalityCustom.toUpperCase()
      : MODALITY_OPTS.find((o) => o.v === c.modality)!.l.toUpperCase();
  const protocol = PROTOCOL_OPTS.find((o) => o.v === c.protocol)!;
  return {
    line: `${intensity.l.toUpperCase()} · ${modalityLabel} · ${protocol.l.toUpperCase()} · ${c.duration} MIN`,
    blurb: `${intensity.sub} · ${protocol.desc.split(/[—.]/, 1)[0].trim().toLowerCase()}`,
  };
}

// ── Cross-axis enforcement ──────────────────────────────────────────────────
export function reconcileComposition(c: CardioComposition): CardioComposition {
  // Swim removes Tabata; coerce to Zone 2 if user had Swim+Tabata.
  let next: CardioComposition = { ...c };
  if (next.modality === 'swim' && next.protocol === 'tabata') {
    next = { ...next, protocol: 'zone2', duration: PROTOCOL_DEFAULTS.zone2.duration };
  }
  // Snap duration into the protocol's valid menu.
  const meta = PROTOCOL_DEFAULTS[next.protocol];
  if (!meta.durations.includes(next.duration)) {
    next = { ...next, duration: meta.duration };
  }
  return next;
}

interface CardioDesignerProps {
  initial?: CardioComposition;
  onClose: () => void;
  /** Called with the final composition when the lifter taps Done. The
   *  parent decides whether to launch a session, schedule, or just stash
   *  it. */
  onDone: (comp: CardioComposition) => void;
  /** Bundle G — called when the lifter taps "Use this session today".
   *  Caller opens CardioApplySheet with `{ kind: 'composed', session }`.
   *  Optional so existing call-sites (which only pass onDone) keep
   *  working without touching every parent. */
  onApplyToSchedule?: (comp: CardioComposition) => void;
}

export default function CardioDesigner({ initial, onClose, onDone, onApplyToSchedule }: CardioDesignerProps) {
  const [comp, setComp] = useState<CardioComposition>(() =>
    reconcileComposition(initial ?? DEFAULT_CARDIO_COMP),
  );
  const [openAxis, setOpenAxis] = useState<null | 'intensity' | 'modality' | 'protocol' | 'duration'>(null);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [presetLabel, setPresetLabel] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const closeAxis = () => setOpenAxis(null);

  const update = (next: CardioComposition) => {
    setComp(reconcileComposition(next));
  };

  // Re-run reconciliation if `initial` changes (e.g. caller hands in a
  // different preset). Most callers won't, but the cheap effect makes the
  // contract explicit.
  useEffect(() => {
    if (initial) setComp(reconcileComposition(initial));
  }, [initial]);

  const protocolOpts = useMemo(() => {
    return comp.modality === 'swim'
      ? PROTOCOL_OPTS.filter((o) => o.v !== 'tabata')
      : PROTOCOL_OPTS;
  }, [comp.modality]);

  const valid = comp.modality !== 'other' || !!comp.modalityCustom?.trim();

  const handleSavePreset = () => {
    const label = presetLabel.trim();
    if (!label) return;
    const preset: CardioPreset = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label,
      intensity: comp.intensity,
      modality: comp.modality,
      modalityCustom: comp.modalityCustom,
      protocol: comp.protocol,
      target: { kind: 'duration', minutes: comp.duration } as CardioTarget,
      isUserSaved: true,
    };
    saveCardioPreset(preset);
    setSavePromptOpen(false);
    setPresetLabel('');
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  const { line } = describeCardioComp(comp);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root)',
        color: 'var(--text-primary)',
        fontFamily: tokens.fontFamily.body,
        paddingBottom: 80,
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--bg-root)',
          borderBottom: '1px solid var(--border)',
          padding: '14px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Cancel"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
            padding: '4px 8px',
            minWidth: 60,
            textAlign: 'left',
          }}
        >
          ‹ Cancel
        </button>
        <div
          style={{
            fontFamily: tokens.fontFamily.display,
            fontSize: 22,
            color: CARDIO_ACCENT,
            letterSpacing: '0.08em',
          }}
        >
          DESIGN CARDIO
        </div>
        <button
          onClick={() => valid && onDone(comp)}
          disabled={!valid}
          aria-disabled={!valid}
          style={{
            background: 'transparent',
            border: 'none',
            color: valid ? CARDIO_ACCENT : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 800,
            cursor: valid ? 'pointer' : 'not-allowed',
            padding: '4px 8px',
            letterSpacing: '0.04em',
            minWidth: 60,
            textAlign: 'right',
          }}
        >
          Done
        </button>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Live preview */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: `1px solid ${CARDIO_ACCENT}55`,
            borderRadius: tokens.radius.lg,
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: 'var(--text-muted)',
              marginBottom: 6,
            }}
          >
            YOUR SESSION
          </div>
          <div
            style={{
              fontFamily: tokens.fontFamily.display,
              fontSize: 22,
              color: 'var(--text-primary)',
              lineHeight: 1.1,
              letterSpacing: '0.04em',
            }}
          >
            {line}
          </div>
        </div>

        {/* INTENSITY axis */}
        <AxisRow
          label="INTENSITY"
          value={INTENSITY_OPTS.find((o) => o.v === comp.intensity)!.l}
          open={openAxis === 'intensity'}
          onToggle={() => setOpenAxis(openAxis === 'intensity' ? null : 'intensity')}
        >
          {INTENSITY_OPTS.map((o) => (
            <OptionButton
              key={o.v}
              selected={comp.intensity === o.v}
              onClick={() => {
                update({ ...comp, intensity: o.v });
                closeAxis();
              }}
              primary={o.l}
              secondary={o.sub}
            />
          ))}
        </AxisRow>

        {/* MODALITY axis */}
        <AxisRow
          label="WORKOUT"
          value={
            comp.modality === 'other' && comp.modalityCustom
              ? comp.modalityCustom
              : MODALITY_OPTS.find((o) => o.v === comp.modality)!.l
          }
          open={openAxis === 'modality'}
          onToggle={() => setOpenAxis(openAxis === 'modality' ? null : 'modality')}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {MODALITY_OPTS.map((o) => (
              <OptionButton
                key={o.v}
                selected={comp.modality === o.v}
                onClick={() => {
                  if (o.v === 'other') {
                    update({ ...comp, modality: 'other', modalityCustom: comp.modalityCustom || '' });
                  } else {
                    update({ ...comp, modality: o.v, modalityCustom: undefined });
                    closeAxis();
                  }
                }}
                primary={o.l}
                compact
              />
            ))}
          </div>
          {comp.modality === 'other' && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="cardio-custom-label"
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: 'var(--text-muted)',
                }}
              >
                CUSTOM LABEL
              </label>
              <input
                id="cardio-custom-label"
                autoFocus
                value={comp.modalityCustom || ''}
                onChange={(e) => update({ ...comp, modalityCustom: e.target.value })}
                placeholder="e.g. Spin Class, Hiking, Pickleball"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.md,
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  padding: '10px 12px',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={closeAxis}
                disabled={!comp.modalityCustom?.trim()}
                style={{
                  marginTop: 4,
                  padding: '8px',
                  background: comp.modalityCustom?.trim()
                    ? CARDIO_ACCENT + '22'
                    : 'transparent',
                  border: `1px solid ${comp.modalityCustom?.trim() ? CARDIO_ACCENT : 'var(--border)'}`,
                  color: comp.modalityCustom?.trim() ? CARDIO_ACCENT : 'var(--text-muted)',
                  borderRadius: tokens.radius.md,
                  cursor: comp.modalityCustom?.trim() ? 'pointer' : 'default',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                }}
              >
                CONFIRM
              </button>
            </div>
          )}
        </AxisRow>

        {/* PROTOCOL axis */}
        <AxisRow
          label="PROTOCOL"
          value={PROTOCOL_OPTS.find((o) => o.v === comp.protocol)!.l}
          open={openAxis === 'protocol'}
          onToggle={() => setOpenAxis(openAxis === 'protocol' ? null : 'protocol')}
        >
          {protocolOpts.map((o) => (
            <OptionButton
              key={o.v}
              selected={comp.protocol === o.v}
              onClick={() => {
                // Picking a new protocol resets duration to that protocol's
                // default if the current value isn't valid for the new menu.
                const def = PROTOCOL_DEFAULTS[o.v];
                const validDur = def.durations.includes(comp.duration)
                  ? comp.duration
                  : def.duration;
                update({ ...comp, protocol: o.v, duration: validDur });
                closeAxis();
              }}
              primary={o.l}
              secondary={o.desc}
            />
          ))}
        </AxisRow>

        {/* DURATION axis — preset chips + Custom… entry. Custom values
            bypass reconcileComposition()'s snap-to-menu so they stick;
            chips still route through update() so the cross-axis Tabata /
            Swim coercions keep working as before. */}
        <DurationAxis
          comp={comp}
          open={openAxis === 'duration'}
          onToggle={() => setOpenAxis(openAxis === 'duration' ? null : 'duration')}
          onPickPreset={(d) => {
            update({ ...comp, duration: d });
            closeAxis();
          }}
          onPickCustom={(d) => {
            // Direct setter — preserves a custom value that's outside the
            // protocol's preset chip list. The custom helper has already
            // applied range + Tabata-multiple-of-4 clamping.
            setComp({ ...comp, duration: d });
          }}
        />

        {/* Bundle G — "Use this session today" CTA. Opens CardioApplySheet
            via the parent with the composed payload so the lifter can drop
            this exact session onto a day in their week. Hidden when the
            host doesn't wire `onApplyToSchedule` (keeps existing standalone
            uses of CardioDesigner unchanged). */}
        {onApplyToSchedule && (
          <button
            onClick={() => {
              if (valid) onApplyToSchedule(comp);
            }}
            disabled={!valid}
            style={{
              width: '100%',
              padding: 14,
              marginTop: 8,
              background: valid ? `${CARDIO_ACCENT}18` : 'transparent',
              border: `1px solid ${valid ? CARDIO_ACCENT : 'var(--border)'}`,
              borderRadius: tokens.radius.md,
              color: valid ? CARDIO_ACCENT : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.08em',
              cursor: valid ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase',
            }}
          >
            Use this session today
          </button>
        )}

        {/* Save as preset */}
        <div style={{ marginTop: 8 }}>
          {!savePromptOpen ? (
            <button
              onClick={() => valid && setSavePromptOpen(true)}
              disabled={!valid}
              style={{
                width: '100%',
                padding: 12,
                background: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: tokens.radius.md,
                color: valid ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                cursor: valid ? 'pointer' : 'not-allowed',
                textTransform: 'uppercase',
              }}
            >
              + Save as preset
            </button>
          ) : (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.md,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <input
                autoFocus
                value={presetLabel}
                onChange={(e) => setPresetLabel(e.target.value)}
                placeholder="Preset name (e.g. Sunday Bike)"
                aria-label="Preset name"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.md,
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  padding: '10px 12px',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => {
                    setSavePromptOpen(false);
                    setPresetLabel('');
                  }}
                  style={{
                    flex: 1,
                    padding: 10,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: tokens.radius.md,
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSavePreset}
                  disabled={!presetLabel.trim()}
                  style={{
                    flex: 1,
                    padding: 10,
                    background: presetLabel.trim() ? CARDIO_ACCENT + '22' : 'transparent',
                    border: `1px solid ${presetLabel.trim() ? CARDIO_ACCENT : 'var(--border)'}`,
                    borderRadius: tokens.radius.md,
                    color: presetLabel.trim() ? CARDIO_ACCENT : 'var(--text-muted)',
                    cursor: presetLabel.trim() ? 'pointer' : 'default',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                  }}
                >
                  SAVE
                </button>
              </div>
            </div>
          )}
          {savedFlash && (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginTop: 6,
                fontSize: 11,
                color: CARDIO_ACCENT,
                textAlign: 'center',
                letterSpacing: '0.06em',
              }}
            >
              Preset saved.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AxisRow({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${open ? CARDIO_ACCENT + '55' : 'var(--border)'}`,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
        transition: 'border 200ms',
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${label} — ${open ? 'collapse' : 'expand'}`}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: 'var(--text-muted)',
              minWidth: 70,
              textAlign: 'left',
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: tokens.fontFamily.display,
              fontSize: 16,
              color: 'var(--text-primary)',
              letterSpacing: '0.04em',
            }}
          >
            {value.toUpperCase()}
          </div>
        </div>
        <span
          aria-hidden="true"
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 200ms',
          }}
        >
          ⌄
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: '0 14px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  primary,
  secondary,
  compact,
}: {
  selected: boolean;
  onClick: () => void;
  primary: string;
  secondary?: string;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: compact ? '10px 8px' : '12px 14px',
        background: selected ? CARDIO_ACCENT + '18' : 'transparent',
        border: `1px solid ${selected ? CARDIO_ACCENT : 'var(--border)'}`,
        borderRadius: tokens.radius.md,
        color: selected ? CARDIO_ACCENT : 'var(--text-primary)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          fontSize: compact ? 12 : 13,
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}
      >
        {primary}
      </div>
      {secondary && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            fontWeight: 400,
          }}
        >
          {secondary}
        </div>
      )}
    </button>
  );
}

// ── DurationAxis ───────────────────────────────────────────────────────────
// Wrapper around AxisRow that adds the existing preset chips PLUS a
// "Custom…" entry. Tapping Custom slides out a number input (1–180 min);
// Tabata rounds the input to the nearest multiple of 4 with an inline
// note. Validation is on blur — non-numeric / out-of-range gets a brief
// inline hint, no toast. Preset taps go through onPickPreset (which
// reconciles cross-axis); custom values go through onPickCustom (direct
// setter, since they fall outside the protocol's chip menu and would
// otherwise be snapped back to default by reconcileComposition).
const CUSTOM_MIN = 1;
const CUSTOM_MAX = 180;

function clampToTabata(n: number): number {
  // Round to nearest multiple of 4, but never below 4.
  return Math.max(4, Math.round(n / 4) * 4);
}

function DurationAxis({
  comp,
  open,
  onToggle,
  onPickPreset,
  onPickCustom,
}: {
  comp: CardioComposition;
  open: boolean;
  onToggle: () => void;
  onPickPreset: (d: number) => void;
  onPickCustom: (d: number) => void;
}) {
  const meta = PROTOCOL_DEFAULTS[comp.protocol];
  const presetDurations = meta.durations;
  // "Custom" is active when the current selected duration isn't in the
  // protocol's chip list.
  const customActive = !presetDurations.includes(comp.duration);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(customActive ? String(comp.duration) : '');
  const [hint, setHint] = useState<string | null>(null);

  const isTabata = comp.protocol === 'tabata';

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setHint('Enter a number between 1 and 180.');
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || Number.isNaN(n)) {
      setHint('Numbers only.');
      return;
    }
    if (n < CUSTOM_MIN || n > CUSTOM_MAX) {
      setHint(`Pick a value between ${CUSTOM_MIN} and ${CUSTOM_MAX} minutes.`);
      return;
    }
    const final = isTabata ? clampToTabata(Math.round(n)) : Math.round(n);
    setHint(null);
    setDraft(String(final));
    onPickCustom(final);
    setEditing(false);
  };

  return (
    <AxisRow
      label="DURATION"
      value={`${comp.duration} min`}
      open={open}
      onToggle={onToggle}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {presetDurations.map((d) => (
          <OptionButton
            key={d}
            selected={comp.duration === d}
            onClick={() => {
              setEditing(false);
              setHint(null);
              onPickPreset(d);
            }}
            primary={`${d} min`}
            compact
          />
        ))}
        <OptionButton
          selected={customActive}
          onClick={() => {
            setHint(null);
            setEditing(true);
            setDraft(customActive ? String(comp.duration) : '');
          }}
          primary={customActive ? `${comp.duration} min` : 'Custom…'}
          compact
        />
      </div>
      {editing && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <label
            htmlFor="cardio-custom-duration"
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: 'var(--text-muted)',
            }}
          >
            CUSTOM DURATION (MIN)
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              id="cardio-custom-duration"
              autoFocus
              type="number"
              inputMode="numeric"
              min={CUSTOM_MIN}
              max={CUSTOM_MAX}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (hint) setHint(null);
              }}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                } else if (e.key === 'Escape') {
                  setEditing(false);
                  setHint(null);
                }
              }}
              placeholder={isTabata ? 'e.g. 12' : 'e.g. 25'}
              aria-label="Custom duration in minutes"
              aria-describedby={hint ? 'cardio-custom-duration-hint' : undefined}
              aria-invalid={hint ? true : undefined}
              style={{
                flex: 1,
                background: 'transparent',
                border: `1px solid ${hint ? 'var(--danger, #f44336)' : 'var(--border)'}`,
                borderRadius: tokens.radius.md,
                color: 'var(--text-primary)',
                fontSize: 14,
                padding: '10px 12px',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={commit}
              style={{
                padding: '0 14px',
                background: CARDIO_ACCENT + '22',
                border: `1px solid ${CARDIO_ACCENT}`,
                borderRadius: tokens.radius.md,
                color: CARDIO_ACCENT,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.08em',
                fontFamily: 'inherit',
              }}
            >
              SET
            </button>
          </div>
          {isTabata && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
              }}
            >
              Tabata rounds to nearest 4 min.
            </div>
          )}
          {hint && (
            <div
              id="cardio-custom-duration-hint"
              role="alert"
              style={{
                fontSize: 11,
                color: 'var(--danger, #f44336)',
                letterSpacing: '0.02em',
              }}
            >
              {hint}
            </div>
          )}
        </div>
      )}
      {meta.note && !editing && (
        <div
          style={{
            fontSize: 10,
            color: CARDIO_ACCENT,
            marginTop: 8,
            textAlign: 'center',
            letterSpacing: '0.04em',
          }}
        >
          {meta.note}
        </div>
      )}
    </AxisRow>
  );
}
