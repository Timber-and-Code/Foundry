/**
 * CardioHomePreview — interactive mockup of the redesigned cardio surface.
 * Mounted at /preview/cardio-card (DEV only).
 *
 * Walks: Home (lift orange + cardio amber, side-by-side) → Cardio Designer
 * full-screen page → back to Home with new composition. Includes saved
 * presets and the Other/Custom modality flow.
 */
import { useState } from 'react';
import { tokens } from '../../styles/tokens';

type View = 'home' | 'designer';
type DayMode = 'lift' | 'cardio' | 'completed';
type Intensity = 'easy' | 'moderate' | 'hard';
type Modality = 'walk' | 'run' | 'bike' | 'row' | 'swim' | 'stairs' | 'elliptical' | 'jump-rope' | 'other';
type Protocol = 'liss' | 'zone2' | 'tempo' | 'tabata' | 'emom' | 'sprint-intervals' | 'free';

interface Composition {
  intensity: Intensity;
  modality: Modality;
  protocol: Protocol;
  duration: number;
  customLabel?: string;
}

interface Preset extends Composition {
  id: string;
  label: string;
}

const LIFT_ACCENT = tokens.colors.accent; // #E8651A — saturated brand orange
const CARDIO_ACCENT = tokens.colors.gold; // #D4983C — warm amber

// Each protocol has a sensible default duration + valid durations menu.
// Tabata is structurally 30s × 8 = 4 min, so all valid durations are
// multiples of 4. Other protocols use a standard menu.
const TABATA_DURATIONS = [4, 8, 12, 16, 20];
const STANDARD_DURATIONS = [10, 15, 20, 30, 45, 60];

const PROTOCOL_DEFAULTS: Record<Protocol, { duration: number; durations: number[]; note?: string }> = {
  liss:               { duration: 45, durations: STANDARD_DURATIONS, note: 'Long, slow, steady — base aerobic work' },
  zone2:              { duration: 30, durations: STANDARD_DURATIONS, note: 'Conversational pace, sustainable' },
  tempo:              { duration: 20, durations: STANDARD_DURATIONS, note: 'Sustained moderate-hard effort' },
  tabata:             { duration: 4,  durations: TABATA_DURATIONS,   note: '30s on / 30s off · 8 rounds = 4 min · multiples for repeats' },
  emom:               { duration: 12, durations: STANDARD_DURATIONS, note: 'Every minute on the minute' },
  'sprint-intervals': { duration: 15, durations: STANDARD_DURATIONS, note: 'Max effort + full recovery alternation' },
  free:               { duration: 30, durations: STANDARD_DURATIONS },
};

const DEFAULT_COMP: Composition = {
  intensity: 'easy',
  modality: 'walk',
  protocol: 'zone2',
  duration: PROTOCOL_DEFAULTS.zone2.duration,
};

// New users start with zero saved presets — empty row shows hint copy.
// Once they save one via Designer, presets persist locally.
const STARTING_PRESETS: Preset[] = [];

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
  { v: 'jump-rope', l: 'Jump Rope' },
  { v: 'other', l: 'Other / Custom' },
];

const PROTOCOL_OPTS: { v: Protocol; l: string; desc: string }[] = [
  { v: 'liss', l: 'LISS', desc: 'Long, slow, steady — recovery and base building' },
  { v: 'zone2', l: 'Zone 2', desc: 'Aerobic base — conversational, sustainable' },
  { v: 'tempo', l: 'Tempo', desc: 'Sustained moderate-hard effort' },
  { v: 'tabata', l: 'Tabata', desc: '20s on / 10s off × 8 rounds' },
  { v: 'emom', l: 'EMOM', desc: 'Every minute on the minute' },
  { v: 'sprint-intervals', l: 'Sprint Intervals', desc: 'Alternating max effort + full recovery' },
  { v: 'free', l: 'Free', desc: 'No prescribed structure — log freely' },
];

function describeComp(c: Composition): { line: string; blurb: string } {
  const intensity = INTENSITY_OPTS.find((o) => o.v === c.intensity)!;
  const modality =
    c.modality === 'other' && c.customLabel
      ? c.customLabel.toUpperCase()
      : MODALITY_OPTS.find((o) => o.v === c.modality)!.l.toUpperCase();
  const protocol = PROTOCOL_OPTS.find((o) => o.v === c.protocol)!;
  return {
    line: `${intensity.l.toUpperCase()} · ${modality} · ${protocol.l.toUpperCase()} · ${c.duration} MIN`,
    blurb: `${intensity.sub} · ${protocol.desc.split(/[—.]/, 1)[0].trim().toLowerCase()}`,
  };
}

export default function CardioHomePreview() {
  const [view, setView] = useState<View>('home');
  const [dayMode, setDayMode] = useState<DayMode>('cardio');
  const [comp, setComp] = useState<Composition>(DEFAULT_COMP);
  const [presets, setPresets] = useState<Preset[]>(STARTING_PRESETS);

  const reset = () => {
    setView('home');
    setDayMode('cardio');
    setComp(DEFAULT_COMP);
    setPresets(STARTING_PRESETS);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root, #0A0A0C)',
        color: 'var(--text-primary, #E8E4DC)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Sticky meta bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(10,10,12,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', system-ui, sans-serif",
              fontSize: 16,
              letterSpacing: '0.08em',
              color: CARDIO_ACCENT,
            }}
          >
            CARDIO HOME MOCKUP
          </div>
          <button
            onClick={reset}
            style={{
              background: 'transparent',
              border: '1px solid var(--border, rgba(255,255,255,0.15))',
              color: 'var(--text-secondary, #999)',
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 999,
              cursor: 'pointer',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Reset
          </button>
        </div>

        {view === 'home' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {(['lift', 'cardio', 'completed'] as DayMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setDayMode(m)}
                style={{
                  flex: 1,
                  background: dayMode === m ? CARDIO_ACCENT + '22' : 'transparent',
                  border: `1px solid ${dayMode === m ? CARDIO_ACCENT : 'var(--border, rgba(255,255,255,0.12))'}`,
                  color: dayMode === m ? CARDIO_ACCENT : 'var(--text-secondary, #aaa)',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {m === 'lift' ? 'Lift Day' : m === 'cardio' ? 'Cardio-Forward Day' : 'Completed'}
              </button>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--text-muted, #777)', lineHeight: 1.4 }}>
          {view === 'home' && dayMode === 'lift' && (
            <>
              <strong>Home — lift day.</strong> Lift card (orange) is primary. Cardio is a compact
              strip below — single line, optional. Tap to expand or jump to designer.
            </>
          )}
          {view === 'home' && dayMode === 'cardio' && (
            <>
              <strong>Home — cardio-forward day.</strong> Both cards visible. Cardio (amber) shows
              today&rsquo;s composition + presets. Tap{' '}
              <em style={{ color: CARDIO_ACCENT }}>Edit</em> for the full designer; tap a preset
              chip to swap composition; tap <em style={{ color: CARDIO_ACCENT }}>Start</em> to
              session.
            </>
          )}
          {view === 'home' && dayMode === 'completed' && (
            <>
              <strong>Home — cardio already logged today.</strong> Card collapses to a status pill.
              Tap to view the session.
            </>
          )}
          {view === 'designer' && (
            <>
              <strong>Cardio Designer.</strong> Full-screen, four-axis picker. Tap any axis to
              expand its options. &ldquo;Other / Custom&rdquo; under modality reveals a text field.
              &ldquo;Save as preset&rdquo; persists to localStorage. Tap{' '}
              <em style={{ color: CARDIO_ACCENT }}>Done</em> to return to Home with the new
              composition pre-loaded.
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 80px' }}>
        {view === 'home' && (
          <HomeStack
            dayMode={dayMode}
            comp={comp}
            presets={presets}
            onApplyPreset={(p) => setComp(p)}
            onEdit={() => setView('designer')}
            onStart={() => alert('Routes to /cardio/:date — preview only')}
            onMarkDone={() => setDayMode('completed')}
          />
        )}

        {view === 'designer' && (
          <CardioDesigner
            comp={comp}
            presets={presets}
            onChange={setComp}
            onSavePreset={(label) => {
              const id = `p${Date.now()}`;
              setPresets((prev) => [...prev, { ...comp, id, label }]);
            }}
            onDone={() => setView('home')}
          />
        )}
      </div>

      <div
        style={{
          maxWidth: 480,
          margin: '24px auto 16px',
          padding: 16,
          fontSize: 11,
          color: 'var(--text-muted, #777)',
          lineHeight: 1.6,
          borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.05))',
        }}
      >
        <div style={{ marginBottom: 8, color: 'var(--text-secondary, #999)', fontWeight: 700 }}>
          Behavior summary
        </div>
        <div>• Lift card uses orange accent ({LIFT_ACCENT}); cardio card uses amber ({CARDIO_ACCENT}).</div>
        <div>• On lift days, cardio collapses to a one-line strip — non-competing.</div>
        <div>• &ldquo;Edit&rdquo; routes to a dedicated full-screen designer page (not inline) — that&rsquo;s where real composition happens.</div>
        <div>• Recommendation seeded from goal (existing pickRecommendedCardio behavior).</div>
        <div>• Saved presets stored in localStorage initially. <em>FLAG: sync to Supabase next round.</em></div>
        <div>• Modality includes Other/Custom for free-text labels.</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── HOME STACK ──────────────── */

function HomeStack({
  dayMode,
  comp,
  presets,
  onApplyPreset,
  onEdit,
  onStart,
  onMarkDone,
}: {
  dayMode: DayMode;
  comp: Composition;
  presets: Preset[];
  onApplyPreset: (p: Preset) => void;
  onEdit: () => void;
  onStart: () => void;
  onMarkDone: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
      {/* Today header */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.16em',
          color: 'var(--text-muted, #777)',
          marginBottom: 0,
        }}
      >
        TODAY · MON APR 29
      </div>

      {/* Lift card (orange accent) — always present */}
      <LiftCard accent={LIFT_ACCENT} />

      {/* Cardio surface — compact on lift days, full on cardio days, pill when done */}
      {dayMode === 'lift' && (
        <CardioCompactStrip comp={comp} onTap={onEdit} accent={CARDIO_ACCENT} />
      )}
      {dayMode === 'cardio' && (
        <CardioCard
          comp={comp}
          presets={presets}
          onApplyPreset={onApplyPreset}
          onEdit={onEdit}
          onStart={() => {
            onMarkDone();
            onStart();
          }}
          accent={CARDIO_ACCENT}
        />
      )}
      {dayMode === 'completed' && <CardioDonePill accent={CARDIO_ACCENT} />}
    </div>
  );
}

/* ─────────────────────────────────────────── LIFT CARD ──────────────── */

function LiftCard({ accent }: { accent: string }) {
  return (
    <div
      style={{
        background: 'var(--bg-card, #16161A)',
        border: `1px solid ${accent}55`,
        borderRadius: tokens.radius.xl,
        padding: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: accent,
          }}
        >
          LIFT TODAY · WK 4 / 7
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
            padding: '3px 8px',
            borderRadius: 999,
            background: accent + '22',
            color: accent,
          }}
        >
          HYPERTROPHY
        </div>
      </div>

      <div
        style={{
          fontFamily: "'Bebas Neue', system-ui, sans-serif",
          fontSize: 38,
          color: 'var(--text-primary, #E8E4DC)',
          lineHeight: 1,
          marginBottom: 4,
          letterSpacing: '0.02em',
        }}
      >
        PUSH A
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary, #aaa)', marginBottom: 14 }}>
        5 exercises · ~50 min · target 1–2 RIR
      </div>

      <button
        onClick={() => alert('Lift Start — preview only')}
        style={{
          width: '100%',
          padding: 14,
          background: 'transparent',
          border: `1px solid ${accent}`,
          color: accent,
          borderRadius: tokens.radius.lg,
          fontFamily: "'Bebas Neue', system-ui, sans-serif",
          fontSize: 18,
          letterSpacing: '0.12em',
          cursor: 'pointer',
          boxShadow: `0 0 0 1px ${accent}`,
        }}
      >
        Start <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────── CARDIO CARD (full) ────── */

function CardioCard({
  comp,
  presets,
  onApplyPreset,
  onEdit,
  onStart,
  accent,
}: {
  comp: Composition;
  presets: Preset[];
  onApplyPreset: (p: Preset) => void;
  onEdit: () => void;
  onStart: () => void;
  accent: string;
}) {
  const { line, blurb } = describeComp(comp);
  return (
    <div
      style={{
        background: 'var(--bg-card, #16161A)',
        border: `1px solid ${accent}55`,
        borderRadius: tokens.radius.xl,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke={accent}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: accent,
              }}
            >
              CARDIO TODAY
            </div>
          </div>
        </div>

        <div
          style={{
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontSize: 24,
            color: 'var(--text-primary, #E8E4DC)',
            lineHeight: 1.05,
            letterSpacing: '0.04em',
            marginBottom: 4,
          }}
        >
          {line}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', marginBottom: 16 }}>
          {blurb}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onEdit}
            style={{
              flex: '0 0 36%',
              padding: '12px 8px',
              background: 'transparent',
              border: '1px solid var(--border, rgba(255,255,255,0.12))',
              color: 'var(--text-primary, #E8E4DC)',
              borderRadius: tokens.radius.lg,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            ✎ Edit
          </button>
          <button
            onClick={onStart}
            style={{
              flex: 1,
              padding: 12,
              background: 'transparent',
              border: `1px solid ${accent}`,
              color: accent,
              borderRadius: tokens.radius.lg,
              fontFamily: "'Bebas Neue', system-ui, sans-serif",
              fontSize: 18,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              boxShadow: `0 0 0 1px ${accent}`,
            }}
          >
            Start <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      {/* Presets row — empty state shows hint copy until user saves one */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.05))',
          background: 'rgba(255,255,255,0.01)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          overflowX: 'auto',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: 'var(--text-muted, #777)',
            flexShrink: 0,
          }}
        >
          PRESETS
        </div>
        {presets.length === 0 ? (
          <button
            onClick={onEdit}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'transparent',
              border: '1px dashed var(--border, rgba(255,255,255,0.15))',
              borderRadius: tokens.radius.md,
              color: 'var(--text-muted, #888)',
              fontSize: 11,
              cursor: 'pointer',
              textAlign: 'left',
              fontStyle: 'italic',
            }}
          >
            Save your first session as a preset →
          </button>
        ) : (
          <>
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => onApplyPreset(p)}
                style={{
                  flexShrink: 0,
                  padding: '6px 10px',
                  background: 'transparent',
                  border: '1px solid var(--border, rgba(255,255,255,0.12))',
                  borderRadius: 999,
                  color: 'var(--text-primary, #E8E4DC)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={onEdit}
              aria-label="Add preset (via designer)"
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                background: 'transparent',
                border: '1px dashed var(--border, rgba(255,255,255,0.2))',
                borderRadius: 999,
                color: 'var(--text-muted, #777)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── CARDIO COMPACT (lift days) ── */

function CardioCompactStrip({
  comp,
  onTap,
  accent,
}: {
  comp: Composition;
  onTap: () => void;
  accent: string;
}) {
  const { line } = describeComp(comp);
  return (
    <button
      onClick={onTap}
      style={{
        width: '100%',
        padding: '10px 14px',
        background: 'var(--bg-card, #16161A)',
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
        borderRadius: tokens.radius.md,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: accent,
            flexShrink: 0,
          }}
        >
          + ADD CARDIO
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted, #888)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          · {line.toLowerCase()}
        </div>
      </div>
      <span style={{ color: 'var(--text-muted, #666)', fontSize: 14 }}>›</span>
    </button>
  );
}

/* ─────────────────────────────────────────── CARDIO DONE PILL ──────── */

function CardioDonePill({ accent }: { accent: string }) {
  return (
    <button
      style={{
        width: '100%',
        padding: '12px 16px',
        background: 'var(--bg-card, #16161A)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        borderRadius: tokens.radius.lg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>
          Cardio logged today ✓
        </span>
      </div>
      <span style={{ fontSize: 14, color: 'var(--text-muted, #777)' }}>›</span>
    </button>
  );
}

/* ─────────────────────────────────────────── DESIGNER (full screen) ── */

function CardioDesigner({
  comp,
  presets,
  onChange,
  onSavePreset,
  onDone,
}: {
  comp: Composition;
  presets: Preset[];
  onChange: (c: Composition) => void;
  onSavePreset: (label: string) => void;
  onDone: () => void;
}) {
  const [openAxis, setOpenAxis] = useState<null | 'intensity' | 'modality' | 'protocol' | 'duration'>(null);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [presetLabel, setPresetLabel] = useState('');

  const close = () => setOpenAxis(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onDone}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary, #aaa)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ‹ Back
        </button>
        <div
          style={{
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontSize: 22,
            color: CARDIO_ACCENT,
            letterSpacing: '0.08em',
          }}
        >
          DESIGN CARDIO
        </div>
        <button
          onClick={onDone}
          style={{
            background: 'transparent',
            border: 'none',
            color: CARDIO_ACCENT,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          Done
        </button>
      </div>

      {/* Live preview line */}
      <div
        style={{
          background: 'var(--bg-card, #16161A)',
          border: `1px solid ${CARDIO_ACCENT}55`,
          borderRadius: tokens.radius.lg,
          padding: '16px 18px',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: 'var(--text-muted, #777)',
            marginBottom: 6,
          }}
        >
          YOUR SESSION
        </div>
        <div
          style={{
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontSize: 22,
            color: 'var(--text-primary, #E8E4DC)',
            lineHeight: 1.1,
            letterSpacing: '0.04em',
          }}
        >
          {describeComp(comp).line}
        </div>
      </div>

      {/* Axis rows */}
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
              onChange({ ...comp, intensity: o.v });
              close();
            }}
            primary={o.l}
            secondary={o.sub}
          />
        ))}
      </AxisRow>

      <AxisRow
        label="WORKOUT"
        value={
          comp.modality === 'other' && comp.customLabel
            ? comp.customLabel
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
                  onChange({ ...comp, modality: 'other', customLabel: comp.customLabel || '' });
                } else {
                  onChange({ ...comp, modality: o.v, customLabel: undefined });
                  close();
                }
              }}
              primary={o.l}
              compact
            />
          ))}
        </div>
        {comp.modality === 'other' && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'var(--text-muted, #777)',
              }}
            >
              CUSTOM LABEL
            </div>
            <input
              autoFocus
              value={comp.customLabel || ''}
              onChange={(e) => onChange({ ...comp, customLabel: e.target.value })}
              placeholder="e.g. Spin Class, Hiking, Pickleball"
              style={{
                background: 'transparent',
                border: '1px solid var(--border, rgba(255,255,255,0.15))',
                borderRadius: 6,
                color: 'var(--text-primary, #E8E4DC)',
                fontSize: 14,
                padding: '10px 12px',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={close}
              disabled={!comp.customLabel}
              style={{
                marginTop: 4,
                padding: '8px',
                background: comp.customLabel ? CARDIO_ACCENT + '22' : 'transparent',
                border: `1px solid ${comp.customLabel ? CARDIO_ACCENT : 'var(--border, rgba(255,255,255,0.1))'}`,
                color: comp.customLabel ? CARDIO_ACCENT : 'var(--text-muted, #555)',
                borderRadius: 6,
                cursor: comp.customLabel ? 'pointer' : 'default',
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

      <AxisRow
        label="PROTOCOL"
        value={PROTOCOL_OPTS.find((o) => o.v === comp.protocol)!.l}
        open={openAxis === 'protocol'}
        onToggle={() => setOpenAxis(openAxis === 'protocol' ? null : 'protocol')}
      >
        {PROTOCOL_OPTS.map((o) => (
          <OptionButton
            key={o.v}
            selected={comp.protocol === o.v}
            onClick={() => {
              // Picking a protocol auto-sets duration to that protocol's
              // default, and re-validates against the protocol's menu.
              const def = PROTOCOL_DEFAULTS[o.v];
              const validDur = def.durations.includes(comp.duration) ? comp.duration : def.duration;
              onChange({ ...comp, protocol: o.v, duration: validDur });
              close();
            }}
            primary={o.l}
            secondary={o.desc}
          />
        ))}
      </AxisRow>

      <AxisRow
        label="DURATION"
        value={`${comp.duration} min`}
        open={openAxis === 'duration'}
        onToggle={() => setOpenAxis(openAxis === 'duration' ? null : 'duration')}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {PROTOCOL_DEFAULTS[comp.protocol].durations.map((d) => (
            <OptionButton
              key={d}
              selected={comp.duration === d}
              onClick={() => {
                onChange({ ...comp, duration: d });
                close();
              }}
              primary={`${d} min`}
              compact
            />
          ))}
        </div>
        {PROTOCOL_DEFAULTS[comp.protocol].note && (
          <div
            style={{
              fontSize: 10,
              color: CARDIO_ACCENT,
              marginTop: 8,
              textAlign: 'center',
              letterSpacing: '0.04em',
            }}
          >
            {PROTOCOL_DEFAULTS[comp.protocol].note}
          </div>
        )}
        <div
          style={{
            fontSize: 9,
            color: 'var(--text-muted, #555)',
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          (custom-minute entry pending — flag for next round)
        </div>
      </AxisRow>

      {/* Save as preset */}
      <div style={{ marginTop: 8 }}>
        {!savePromptOpen ? (
          <button
            onClick={() => setSavePromptOpen(true)}
            style={{
              width: '100%',
              padding: 12,
              background: 'transparent',
              border: '1px dashed var(--border, rgba(255,255,255,0.2))',
              borderRadius: tokens.radius.md,
              color: 'var(--text-secondary, #aaa)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            + Save as preset
          </button>
        ) : (
          <div
            style={{
              background: 'var(--bg-card, #16161A)',
              border: '1px solid var(--border, rgba(255,255,255,0.08))',
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
              style={{
                background: 'transparent',
                border: '1px solid var(--border, rgba(255,255,255,0.15))',
                borderRadius: 6,
                color: 'var(--text-primary, #E8E4DC)',
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
                  border: '1px solid var(--border, rgba(255,255,255,0.1))',
                  borderRadius: 6,
                  color: 'var(--text-muted, #888)',
                  cursor: 'pointer',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  if (!presetLabel.trim()) return;
                  onSavePreset(presetLabel.trim());
                  setSavePromptOpen(false);
                  setPresetLabel('');
                }}
                disabled={!presetLabel.trim()}
                style={{
                  flex: 1,
                  padding: 10,
                  background: presetLabel.trim() ? CARDIO_ACCENT + '22' : 'transparent',
                  border: `1px solid ${presetLabel.trim() ? CARDIO_ACCENT : 'var(--border, rgba(255,255,255,0.1))'}`,
                  borderRadius: 6,
                  color: presetLabel.trim() ? CARDIO_ACCENT : 'var(--text-muted, #555)',
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
      </div>

      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted, #555)',
          textAlign: 'center',
          marginTop: 4,
        }}
      >
        {presets.length} saved preset{presets.length === 1 ? '' : 's'} · stored locally
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
        background: 'var(--bg-card, #16161A)',
        border: `1px solid ${open ? CARDIO_ACCENT + '55' : 'var(--border, rgba(255,255,255,0.08))'}`,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
        transition: 'border 200ms',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary, #E8E4DC)',
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
              color: 'var(--text-muted, #777)',
              minWidth: 70,
              textAlign: 'left',
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: "'Bebas Neue', system-ui, sans-serif",
              fontSize: 16,
              color: 'var(--text-primary, #E8E4DC)',
              letterSpacing: '0.04em',
            }}
          >
            {value.toUpperCase()}
          </div>
        </div>
        <span
          style={{
            color: 'var(--text-muted, #777)',
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
      style={{
        width: '100%',
        textAlign: 'left',
        padding: compact ? '10px 8px' : '12px 14px',
        background: selected ? CARDIO_ACCENT + '18' : 'transparent',
        border: `1px solid ${selected ? CARDIO_ACCENT : 'var(--border, rgba(255,255,255,0.08))'}`,
        borderRadius: tokens.radius.md,
        color: selected ? CARDIO_ACCENT : 'var(--text-primary, #E8E4DC)',
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
            color: 'var(--text-muted, #777)',
            fontWeight: 400,
          }}
        >
          {secondary}
        </div>
      )}
    </button>
  );
}
