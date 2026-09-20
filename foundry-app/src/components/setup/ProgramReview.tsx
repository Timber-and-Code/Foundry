import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import FoundryBanner from '../shared/FoundryBanner';
import DayAccordion, { type DayBuild } from './DayAccordion';
import { toDayBuilds, hydrateDayBuilds } from './dayBuilds';
import { getExerciseDB } from '../../data/exerciseDB';
import type { TrainingDay } from '../../types';

/** How the AI coach pass went. Undefined = no coach involved (hand-built). */
export type CoachOutcome =
  | { status: 'tuned'; note?: string }
  | { status: 'failed'; reason: string };

interface ProgramReviewProps {
  /** The program the builder produced — generated ONCE by the caller. */
  program: TrainingDay[];
  userEquipment?: string[];
  coach?: CoachOutcome;
  subtitle: string;
  /** Every edit, as a full program — lets the caller save progress. */
  onEdit?: (program: TrainingDay[]) => void;
  /** Receives the exact program to install, edits included. */
  onConfirm: (program: TrainingDay[]) => void;
  onBack: () => void;
}

/**
 * The returning-lifter counterpart of Beat2Preview: every day's lifts, with
 * swap / add / anchor, before anything is created. Whatever is confirmed
 * here is the program that gets installed — the caller pins it as
 * `aiDays`, which generateProgram returns verbatim (it would otherwise
 * reshuffle).
 */
export default function ProgramReview({ program, userEquipment, coach, subtitle, onEdit, onConfirm, onBack }: ProgramReviewProps) {
  const [days, setDaysState] = useState(() => toDayBuilds(program));
  const setDays = (next: DayBuild[]) => {
    setDaysState(next);
    // A day emptied mid-edit would be dropped by hydration and shift the
    // rest; only report complete programs.
    if (onEdit && next.every((d) => d.exercises.length > 0)) {
      onEdit(hydrateDayBuilds(next, getExerciseDB() as never, program));
    }
  };
  const empty = days.some((d) => d.exercises.length === 0);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root)',
        // Phones: the 480 column. Regular+: banner goes full-bleed and the
        // review below sizes itself (2-up day cards at >=1000px).
        maxWidth: 'var(--shell-max)',
        margin: '0 auto',
        color: 'var(--text-primary)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <FoundryBanner subtitle={subtitle} />
      <div className="fd-wide" style={{ padding: '20px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Bebas Neue', 'Inter', sans-serif",
              fontSize: 28,
              letterSpacing: '0.12em',
              fontWeight: 400,
            }}
          >
            YOUR PROGRAM
          </h1>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.md,
              padding: '8px 16px',
              minHeight: 36,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            <span aria-hidden="true">‹</span> Back
          </button>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          Open a day to check its lifts. Swap anything you don't want — this is exactly what you'll train.
        </p>

        {coach?.status === 'tuned' && (
          <div
            role="status"
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.colors.accent}`,
              background: 'rgba(232,101,26,0.10)',
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ fontWeight: 800, letterSpacing: '0.1em', color: tokens.colors.accent }}>COACH-TUNED</span>
            {' · '}
            {coach.note || 'Your coach designed this program around your split, schedule and equipment.'}
          </div>
        )}
        {coach?.status === 'failed' && (
          <div
            role="status"
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: tokens.radius.md,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-primary)' }}>STANDARD BUILD</span>
            {' · '}
            {coach.reason} This program was built from your selections instead — it's complete and ready to train.{' '}
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                fontWeight: 700,
                color: tokens.colors.accent,
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Go back and try the coach again
            </button>
          </div>
        )}

        <DayAccordion days={days} onDaysChange={setDays} userEquipment={userEquipment} />

        <button
          type="button"
          className="fd-setup-cta"
          disabled={empty}
          onClick={() => onConfirm(hydrateDayBuilds(days, getExerciseDB() as never, program))}
          style={{
            width: '100%',
            marginTop: 24,
            padding: '16px 0',
            borderRadius: tokens.radius.lg,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.04em',
            background: 'var(--btn-primary-bg)',
            border: '1px solid var(--btn-primary-border)',
            color: 'var(--btn-primary-text)',
            cursor: empty ? 'default' : 'pointer',
            opacity: empty ? 0.5 : 1,
          }}
        >
          Looks good <span aria-hidden="true">→</span>
        </button>
        {empty && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Every day needs at least one exercise.
          </div>
        )}
      </div>
    </div>
  );
}
