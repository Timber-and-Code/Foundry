import React, { useState, useRef, useEffect } from 'react';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';

const MicroTour = React.lazy(() => import('./MicroTour'));

type Experience = 'new' | 'intermediate' | 'advanced';
type GoalKey = 'muscle_and_strength' | 'lose_fat' | 'improve_fitness' | 'sport_performance';

interface GoalPill {
  key: GoalKey;
  label: string;
  sub: string;
  storageGoal: string;
  anchorStrengthBias: boolean;
}

const GOAL_PILLS: GoalPill[] = [
  {
    key: 'muscle_and_strength',
    label: 'Build muscle and strength',
    sub: 'Grow, and get stronger doing it.',
    storageGoal: 'build_muscle',
    anchorStrengthBias: true,
  },
  {
    key: 'lose_fat',
    label: 'Lose fat',
    sub: 'Keep your strength while leaning out.',
    storageGoal: 'lose_fat',
    anchorStrengthBias: false,
  },
  {
    key: 'improve_fitness',
    label: 'Improve fitness',
    sub: 'Work capacity, conditioning, wind.',
    storageGoal: 'improve_fitness',
    anchorStrengthBias: false,
  },
  {
    key: 'sport_performance',
    label: 'Sport performance',
    sub: 'Peak for a sport or event.',
    storageGoal: 'sport_conditioning',
    anchorStrengthBias: false,
  },
];

interface ExperiencePill {
  key: Experience;
  label: string;
}

// Labels match AutoBuilderFlow's display ranges so the value round-trips
// through onboarding → builder without the user seeing a mismatch.
const EXPERIENCE_PILLS: ExperiencePill[] = [
  { key: 'new', label: 'Under 1 year' },
  { key: 'intermediate', label: '1–3 years' },
  { key: 'advanced', label: '3+ years' },
];

interface IntakeCardProps {
  onDone: () => void;
}

export default function IntakeCard({ onDone }: IntakeCardProps) {
  const [name, setName] = useState('');
  const [experience, setExperience] = useState<Experience | null>(null);
  const [goal, setGoal] = useState<GoalKey | null>(null);
  const [showTour, setShowTour] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const experienceRef = useRef<HTMLDivElement>(null);
  const goalRef = useRef<HTMLDivElement>(null);

  const nameValid = name.trim().length > 0;
  const experienceRevealed = nameValid;
  const goalRevealed = nameValid && experience !== null;
  const ready = nameValid && experience !== null && goal !== null;

  const progressPct = ready
    ? 100
    : goalRevealed && goal
      ? 100
      : experienceRevealed && experience
        ? 66
        : nameValid
          ? 33
          : 0;

  // Auto-scroll to reveal new sections (guard: jsdom lacks scrollIntoView)
  useEffect(() => {
    if (
      experienceRevealed &&
      !experience &&
      experienceRef.current &&
      typeof experienceRef.current.scrollIntoView === 'function'
    ) {
      experienceRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [experienceRevealed, experience]);

  useEffect(() => {
    if (
      goalRevealed &&
      !goal &&
      goalRef.current &&
      typeof goalRef.current.scrollIntoView === 'function'
    ) {
      goalRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [goalRevealed, goal]);

  const handleSubmit = (path: 'direct' | 'tour' = 'direct') => {
    if (!ready || !goal || !experience) return;
    const pill = GOAL_PILLS.find((p) => p.key === goal)!;
    store.set(
      'foundry:onboarding_data',
      JSON.stringify({ name: name.trim(), experience }),
    );
    store.set('foundry:onboarding_goal', pill.storageGoal);
    store.set('foundry:onboarded', '1');
    store.set('foundry:path', path);
    if (pill.anchorStrengthBias) {
      store.set('foundry:anchor_strength_bias', '1');
    } else {
      store.remove('foundry:anchor_strength_bias');
    }
    onDone();
  };

  if (showTour) {
    return (
      <React.Suspense
        fallback={
          <div
            style={{
              minHeight: '100vh',
              background: tokens.colors.bgRoot,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ color: tokens.colors.textMuted, fontSize: 13 }}>Loading…</div>
          </div>
        }
      >
        <MicroTour
          onDone={() => {
            // User finished tour — treat as direct-path submission if ready,
            // otherwise return to IntakeCard with tour context
            setShowTour(false);
            if (ready) handleSubmit('tour');
          }}
          onSkip={() => setShowTour(false)}
        />
      </React.Suspense>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.bgRoot,
        color: tokens.colors.textPrimary,
        fontFamily: "'Inter', system-ui, sans-serif",
        maxWidth: 480,
        margin: '0 auto',
        padding: '28px 24px 32px',
        boxSizing: 'border-box',
      }}
    >
      {/* Progress line */}
      <div
        aria-hidden="true"
        style={{
          height: 2,
          background: 'rgba(232,101,26,0.12)',
          borderRadius: tokens.radius.pill,
          marginBottom: 24,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progressPct}%`,
            height: '100%',
            background: tokens.colors.accent,
            borderRadius: tokens.radius.pill,
            transition: 'width 350ms ease',
          }}
        />
      </div>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: 32,
            letterSpacing: '0.12em',
            color: tokens.colors.textPrimary,
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          THE FOUNDRY
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: tokens.colors.textMuted,
            letterSpacing: '0.02em',
          }}
        >
          Takes 30 seconds. This shapes your first mesocycle.
        </div>
      </div>

      {/* Field 1 — Name */}
      <FieldBlock label="What should we call you?">
        <input
          ref={nameInputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          maxLength={40}
          placeholder="Your name"
          autoComplete="given-name"
          aria-label="Your name"
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: tokens.radius.md,
            border: `1px solid ${nameValid ? tokens.colors.accentBorder : 'var(--border, rgba(255,255,255,0.08))'}`,
            background: tokens.colors.bgInput,
            color: tokens.colors.textPrimary,
            fontSize: 15,
            fontWeight: 500,
            outline: 'none',
            transition: 'border-color 200ms ease',
            boxSizing: 'border-box',
          }}
        />
      </FieldBlock>

      {/* Field 2 — Experience */}
      <Reveal show={experienceRevealed}>
        <div ref={experienceRef}>
          <FieldBlock label="How long have you been training?">
            <PillGroup
              ariaLabel="Training duration"
              options={EXPERIENCE_PILLS}
              selected={experience}
              onSelect={setExperience}
            />
          </FieldBlock>
        </div>
      </Reveal>

      {/* Field 3 — Goal */}
      <Reveal show={goalRevealed}>
        <div ref={goalRef}>
          <FieldBlock label="What brings you here?">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {GOAL_PILLS.map((p) => {
                const selected = goal === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setGoal(p.key)}
                    aria-pressed={selected}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${selected ? tokens.colors.accent : 'rgba(255,255,255,0.08)'}`,
                      background: selected ? tokens.colors.accentMuted : tokens.colors.bgCard,
                      color: tokens.colors.textPrimary,
                      cursor: 'pointer',
                      transition: 'all 200ms ease',
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{p.sub}</div>
                  </button>
                );
              })}
            </div>
          </FieldBlock>
        </div>
      </Reveal>

      {/* CTA */}
      <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button
          type="button"
          disabled={!ready}
          onClick={() => handleSubmit('direct')}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            borderRadius: tokens.radius.xl,
            background: ready ? tokens.colors.btnPrimaryBg : 'rgba(192,57,43,0.3)',
            border: `1px solid ${ready ? tokens.colors.btnPrimaryBorder : 'rgba(232,101,26,0.2)'}`,
            color: ready ? tokens.colors.btnPrimaryText : tokens.colors.textDim,
            cursor: ready ? 'pointer' : 'not-allowed',
            boxShadow: ready ? '0 4px 24px rgba(232,101,26,0.35)' : 'none',
            transition: 'all 200ms ease',
          }}
        >
          Build my program
        </button>

        <button
          type="button"
          onClick={() => setShowTour(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: tokens.colors.textMuted,
            fontSize: 13,
            fontWeight: 600,
            padding: 8,
          }}
        >
          Show me how this works <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: tokens.colors.textSecondary,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Reveal({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        maxHeight: show ? '600px' : 0,
        opacity: show ? 1 : 0,
        overflow: 'hidden',
        transform: show ? 'translateY(0)' : 'translateY(-6px)',
        transition:
          'max-height 400ms ease, opacity 300ms ease, transform 300ms ease',
      }}
      aria-hidden={!show}
    >
      {children}
    </div>
  );
}

function PillGroup<T extends string>({
  options,
  selected,
  onSelect,
  ariaLabel,
}: {
  options: { key: T; label: string }[];
  selected: T | null;
  onSelect: (k: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
    >
      {options.map((opt) => {
        const isSelected = selected === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(opt.key)}
            style={{
              padding: '10px 16px',
              borderRadius: tokens.radius.pill,
              border: `1px solid ${isSelected ? tokens.colors.accent : 'rgba(255,255,255,0.12)'}`,
              background: isSelected ? tokens.colors.accentMuted : 'transparent',
              color: isSelected ? tokens.colors.textPrimary : tokens.colors.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 180ms ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
