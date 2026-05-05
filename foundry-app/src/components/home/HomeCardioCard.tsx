/**
 * HomeCardioCard — redesigned cardio surface on Home (Group D / C3).
 *
 * Visual reference: src/components/workout/CardioHomePreview.tsx (DEV
 * preview at /preview/cardio-card). This component is the production
 * mirror — same shape but reads real state.
 *
 * Layout:
 *   - Composition line in Bebas (e.g. "MODERATE · BIKE · ZONE 2 · 30 MIN").
 *   - Edit pencil top-right opens the Designer pre-loaded with the
 *     current composition.
 *   - User-saved presets render as horizontally-scrollable chips below.
 *     Empty state: a dashed "Save your first session in the Designer"
 *     CTA that also routes to the Designer.
 *
 * Day-mode adaptive (resolved by the caller):
 *   - 'lift_only'   → render as a compact one-line strip below the lift
 *                     card (non-competing).
 *   - 'lift+cardio' → render full card below the lift card.
 *   - 'cardio_only' → render full card as the primary action (caller
 *                     decides ordering — we just ship the full card).
 *   - 'rest'        → caller should NOT mount this component on rest
 *                     days; we early-return null defensively.
 *
 * Color tokens: cardio uses gold (#D4983C / tokens.colors.gold) — the
 * lift card stays on the saturated brand orange (tokens.colors.accent).
 */
import { useState, useEffect, useMemo } from 'react';
import { tokens } from '../../styles/tokens';
import { CARDIO_WORKOUTS } from '../../data/constants';
import { loadCardioPresets } from '../../utils/store';
import CardioDesigner, {
  type CardioComposition,
  describeCardioComp,
} from '../explore/CardioDesigner';
import type {
  Profile,
  CardioPreset,
  CardioScheduleSlot,
  CardioSession,
} from '../../types';

const CARDIO_ACCENT = tokens.colors.gold;

export type CardioDayMode = 'lift_only' | 'lift+cardio' | 'cardio_only' | 'rest';

export interface HomeCardioCardProps {
  /** Resolved by HomeTab from useMesoState's day type + cardioSchedule. */
  dayMode: CardioDayMode;
  /** YYYY-MM-DD for today's cardio key. */
  dateStr: string;
  /** The schedule slot (built-in protocol) for today, if any. */
  todayCardioSlot: CardioScheduleSlot | null;
  /** Last-saved CardioSession for today (drives "logged" pill). */
  todayCardioSession: CardioSession | null;
  /** For pickRecommendedCardio when there's no slot. */
  profile: Profile | null;
  onOpenCardio: (dateStr: string, protocolId: string | null) => void;
}

// pickRecommendedCardio — replicates the HomeTab heuristic for Home's
// default composition when nothing's scheduled. Lift-focused goals prefer
// low-interference Endurance; otherwise the first goal-matched protocol.
function pickRecommendedCardio(goalId?: string | null): typeof CARDIO_WORKOUTS[number] {
  const goal = goalId || 'build_muscle';
  const candidates = CARDIO_WORKOUTS.filter((w) => w.recommendedFor?.includes(goal));
  const preferEndurance = goal === 'build_muscle' || goal === 'build_strength';
  if (preferEndurance) {
    const easy = candidates.find((w) => w.category === 'Endurance');
    if (easy) return easy;
  }
  return (
    candidates[0] ||
    CARDIO_WORKOUTS.find((w) => w.id === 'easy_walk') ||
    CARDIO_WORKOUTS[0]
  );
}

// Adapt a built-in CARDIO_WORKOUTS entry into the Designer's composition
// shape. The built-ins were reshaped to carry the typed axis fields in
// the C2 prep commit, so this is just a field rename.
function compFromBuiltIn(w: typeof CARDIO_WORKOUTS[number]): CardioComposition {
  return {
    intensity: w.intensity,
    modality: w.modality,
    protocol: w.protocol,
    duration: w.target.minutes,
  };
}

function compFromPreset(p: CardioPreset): CardioComposition {
  return {
    intensity: p.intensity,
    modality: p.modality,
    modalityCustom: p.modalityCustom,
    protocol: p.protocol,
    duration: p.target.minutes,
  };
}

export default function HomeCardioCard({
  dayMode,
  dateStr,
  todayCardioSlot,
  todayCardioSession,
  profile,
  onOpenCardio,
}: HomeCardioCardProps) {
  const [showDesigner, setShowDesigner] = useState(false);
  const [userPresets, setUserPresets] = useState<CardioPreset[]>(() => loadCardioPresets());
  const [composition, setComposition] = useState<CardioComposition | null>(null);

  // Refresh user presets when the Designer closes (it may have saved one).
  useEffect(() => {
    if (!showDesigner) setUserPresets(loadCardioPresets());
  }, [showDesigner]);

  // Resolve the *active* composition shown on the card. Priority:
  //   1. Lifter's in-session composition (set via Designer in this mount).
  //   2. Today's scheduled built-in protocol (cardioSchedule).
  //   3. pickRecommendedCardio fallback.
  const activeComp: CardioComposition = useMemo(() => {
    if (composition) return composition;
    if (todayCardioSlot) {
      const proto = CARDIO_WORKOUTS.find((w) => w.id === todayCardioSlot.protocol);
      if (proto) return compFromBuiltIn(proto);
    }
    return compFromBuiltIn(pickRecommendedCardio(profile?.goal));
  }, [composition, todayCardioSlot, profile?.goal]);

  // Resolve the protocol id we'll route through onOpenCardio. The Designer
  // (composition) flow doesn't have a built-in id — we pass null so
  // CardioSessionView falls back to the composed type/duration/intensity.
  const launchProtocolId: string | null = useMemo(() => {
    if (composition) return null; // Designer composition path
    if (todayCardioSlot) return todayCardioSlot.protocol;
    return pickRecommendedCardio(profile?.goal).id;
  }, [composition, todayCardioSlot, profile?.goal]);

  // Rest day — render nothing. Caller is supposed to short-circuit but the
  // defensive null keeps the component honest.
  if (dayMode === 'rest') return null;

  if (showDesigner) {
    return (
      <CardioDesigner
        initial={activeComp}
        onClose={() => setShowDesigner(false)}
        onDone={(comp) => {
          setComposition(comp);
          setShowDesigner(false);
        }}
      />
    );
  }

  // Cardio already logged today — collapse to a status pill regardless of
  // dayMode. The lifter shouldn't see a duplicate "start cardio" surface
  // when they've already finished.
  if (todayCardioSession?.completed) {
    return (
      <button
        data-testid="home-cardio-logged"
        data-tour="cardio-card"
        onClick={() => onOpenCardio(dateStr, todayCardioSlot?.protocol ?? null)}
        style={{
          width: '100%',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          padding: '12px 16px',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CardioIcon size={13} color={CARDIO_ACCENT} />
          <span style={{ fontSize: 14, fontWeight: 700, color: CARDIO_ACCENT }}>
            Cardio logged today ✓
          </span>
        </div>
        <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 700 }}>
          ›
        </span>
      </button>
    );
  }

  // Lift-only day → compact strip. Non-competing single-line surface
  // below the lift card.
  if (dayMode === 'lift_only') {
    const { line } = describeCardioComp(activeComp);
    return (
      <button
        data-testid="home-cardio-strip"
        data-tour="cardio-card"
        onClick={() => setShowDesigner(true)}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.md,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <CardioIcon size={12} color={CARDIO_ACCENT} />
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: CARDIO_ACCENT,
              flexShrink: 0,
            }}
          >
            + ADD CARDIO
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            · {line.toLowerCase()}
          </div>
        </div>
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          ›
        </span>
      </button>
    );
  }

  // lift+cardio OR cardio_only → full card.
  const { line, blurb } = describeCardioComp(activeComp);
  return (
    <div
      data-testid="home-cardio-full"
      data-tour="cardio-card"
      style={{
        width: '100%',
        background: 'var(--bg-card)',
        border: `1px solid ${CARDIO_ACCENT}55`,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ padding: '14px 16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CardioIcon size={13} color={CARDIO_ACCENT} />
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: CARDIO_ACCENT,
              }}
            >
              CARDIO TODAY
            </div>
          </div>
          <button
            onClick={() => setShowDesigner(true)}
            aria-label="Edit cardio composition"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 14,
              padding: '2px 6px',
              minWidth: 28,
              minHeight: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✎
          </button>
        </div>
        <div
          style={{
            fontFamily: tokens.fontFamily.display,
            fontSize: 22,
            color: 'var(--text-primary)',
            lineHeight: 1.1,
            letterSpacing: '0.04em',
            marginBottom: 4,
          }}
        >
          {line}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginBottom: 14,
            lineHeight: 1.4,
          }}
        >
          {blurb}
        </div>
        <button
          onClick={() => onOpenCardio(dateStr, launchProtocolId)}
          aria-label="Start cardio session"
          style={{
            width: '100%',
            padding: 12,
            background: `${CARDIO_ACCENT}15`,
            border: `1px solid ${CARDIO_ACCENT}`,
            color: CARDIO_ACCENT,
            borderRadius: tokens.radius.lg,
            fontFamily: tokens.fontFamily.display,
            fontSize: 18,
            letterSpacing: '0.12em',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          START <span aria-hidden="true">→</span>
        </button>
      </div>

      {/* Presets row — empty state shows hint copy until user saves one */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border-subtle)',
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
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          PRESETS
        </div>
        {userPresets.length === 0 ? (
          <button
            onClick={() => setShowDesigner(true)}
            data-testid="home-cardio-empty-presets"
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'transparent',
              border: '1px dashed var(--border)',
              borderRadius: tokens.radius.md,
              color: 'var(--text-muted)',
              fontSize: 11,
              cursor: 'pointer',
              textAlign: 'left',
              fontStyle: 'italic',
            }}
          >
            Save your first session in the Designer →
          </button>
        ) : (
          <>
            {userPresets.map((p) => (
              <button
                key={p.id}
                onClick={() => setComposition(compFromPreset(p))}
                style={{
                  flexShrink: 0,
                  padding: '6px 10px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.pill,
                  color: 'var(--text-primary)',
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
              onClick={() => setShowDesigner(true)}
              aria-label="Add preset (via designer)"
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                background: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: tokens.radius.pill,
                color: 'var(--text-muted)',
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

function CardioIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
