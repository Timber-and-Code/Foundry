import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { tokens } from '../../styles/tokens';
import { ageFromDob } from '../../utils/store';
import { callFoundryAI, CoachAuthRequiredError } from '../../utils/api';
import { getExerciseDB } from '../../data/exerciseDB';
import EquipmentPicker from './EquipmentPicker';
import { GOAL_OPTIONS } from '../../data/constants';
import FoundryBanner from '../shared/FoundryBanner';
import { EXPERIENCE_OPTIONS, experienceLabel, experienceTier } from '../../utils/experience';
import { formatSplitName } from '../../utils/splitLabel';

export interface AutoBuilderFlowProps {
  form: {
    name: string;
    age: string;
    gender: string;
    weight: string;
    goal: string;
    goalNote: string;
    theme: string;
  };
  setupDob: { month: string; day: string; year: string };
  autoForm: {
    experience: string | null;
    split: string | null;
    daysPerWeek: number | null;
    mesoLength: number | null;
    sessionDuration?: number | null;
    equipment: string[];
    startDate: string;
  };
  aiLoading: boolean;
  error: string;
  sLabel: React.CSSProperties;
  sec: React.CSSProperties;
  inputStyle: React.CSSProperties;
  setAuto: (k: string, v: string | number | string[] | null) => void;
  toggleAutoEquip: (item: string) => void;
  setAiLoading: (v: boolean) => void;
  setAiCoachNote: (v: string) => void;
  setError: (v: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybePromptLegBalance: (built: any) => void;
  /** Planning the next meso: no start date (it starts when it's started) and no "Start Training". */
  planningNext?: boolean;
  /** SetupPage's pinned slot under its scroller. Without one (tests,
   *  standalone) the footer falls back to sticking inside the form. */
  footerSlot?: HTMLElement | null;
}

export default function AutoBuilderFlow({
  form,
  setupDob,
  autoForm,
  aiLoading,
  error,
  sLabel,
  sec,
  inputStyle,
  setAuto,
  toggleAutoEquip,
  setAiLoading,
  setAiCoachNote,
  setError,
  maybePromptLegBalance,
  planningNext = false,
  footerSlot = null,
}: AutoBuilderFlowProps) {
  // The form is one long page and the split cards alone fill a phone
  // screen. The footer names the next unanswered question and takes you to
  // it, so nothing below the fold can be missed.
  const splitRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef<HTMLDivElement>(null);
  const equipRef = useRef<HTMLDivElement>(null);
  const steps = [
    { key: 'split', label: 'Split', ref: splitRef, missing: !autoForm.split ? 'Training split' : '' },
    {
      key: 'schedule',
      label: 'Schedule',
      ref: scheduleRef,
      missing: !autoForm.daysPerWeek ? 'Days per week' : !autoForm.mesoLength ? 'Meso length' : '',
    },
    { key: 'level', label: 'Level', ref: levelRef, missing: !autoForm.experience ? 'Experience level' : '' },
    { key: 'equipment', label: 'Equipment', ref: equipRef, missing: autoForm.equipment.length === 0 ? 'Equipment' : '' },
  ];
  const nextStep = steps.find((st) => st.missing);
  const goTo = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  const eyebrow = (n: number) => (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'var(--accent)',
        marginBottom: 6,
      }}
    >
      QUESTION {n} OF 4
    </div>
  );

  const handleAutoSubmit = async () => {
    setError('');
    if (!autoForm.split) {
      setError('Select a training split.');
      return;
    }
    if (!autoForm.daysPerWeek) {
      setError('Select how many days per week.');
      return;
    }
    if (!autoForm.mesoLength) {
      setError('Select a meso length.');
      return;
    }
    if (autoForm.equipment.length === 0) {
      setError('Select at least one equipment type.');
      return;
    }

    const sessMap: Record<string, number> = { beginner: 60, intermediate: 75, advanced: 90 };
    const daysMap: Record<string, Record<number, number[]>> = {
      ppl: {
        2: [1, 4],
        3: [1, 3, 5],
        4: [1, 2, 4, 5],
        5: [1, 2, 3, 5, 6],
        6: [1, 2, 3, 4, 5, 6],
      },
      upper_lower: {
        2: [1, 4],
        3: [1, 3, 5],
        4: [1, 2, 4, 5],
        5: [1, 2, 3, 5, 6],
      },
      full_body: { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5] },
    };
    const workoutDays = (daysMap[autoForm.split] || daysMap.ppl)[autoForm.daysPerWeek] || [
      1, 2, 3, 4, 5, 6,
    ];
    const goalOption = GOAL_OPTIONS.find((g) => g.id === form.goal);
    const derivedPriority = goalOption?.priority || 'both';
    const derivedGoal = goalOption
      ? goalOption.label
      : `${autoForm.experience} ${autoForm.split} program`;

    const built = {
      name: form.name,
      age: String(ageFromDob(setupDob) || form.age || ''),
      gender: form.gender,
      dob: setupDob,
      weight: form.weight,
      theme: form.theme,
      startDate: autoForm.startDate,
      goal: form.goal || '',
      goalLabel: derivedGoal,
      equipment: autoForm.equipment,
      experience: autoForm.experience,
      priority: derivedPriority,
      splitType: autoForm.split,
      daysPerWeek: autoForm.daysPerWeek,
      workoutDays,
      mesoLength: autoForm.mesoLength,
      sessionDuration: autoForm.sessionDuration || sessMap[experienceTier(autoForm.experience)] || 60,
      autoBuilt: true,
    };
    setAiLoading(true);
    setAiCoachNote('');
    setError('');

    try {
      const result = await callFoundryAI({
        split: autoForm.split || 'ppl',
        daysPerWeek: autoForm.daysPerWeek || 3,
        mesoLength: autoForm.mesoLength || 6,
        experience: autoForm.experience || '',
        equipment: autoForm.equipment,
        name: form.name,
        gender: form.gender,
        goal: form.goal || '',
        goalNote: form.goalNote || '',
        // Without the library the coach is shown an EMPTY "available
        // exercises" list and has to invent ids that match nothing in the app.
      }, getExerciseDB() as Parameters<typeof callFoundryAI>[1]);

      const aiBuilt = {
        name: form.name,
        age: String(ageFromDob(setupDob) || form.age || ''),
        gender: form.gender,
        dob: setupDob,
        weight: form.weight,
        theme: form.theme,
        startDate: autoForm.startDate,
        goal: form.goal || '',
        goalLabel: derivedGoal,
        equipment: autoForm.equipment,
        experience: autoForm.experience,
        priority: derivedPriority,
        splitType: autoForm.split,
        daysPerWeek: autoForm.daysPerWeek,
        workoutDays,
        mesoLength: autoForm.mesoLength,
        sessionDuration: autoForm.sessionDuration || sessMap[experienceTier(autoForm.experience)] || 60,
        autoBuilt: true,
        aiDays: result.days,
        aiCoachNote: result.coachNote,
      };

      if (result.coachNote) setAiCoachNote(result.coachNote);
      setAiLoading(false);
      maybePromptLegBalance(aiBuilt);
    } catch (err: unknown) {
      setAiLoading(false);
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      setError(
        err instanceof CoachAuthRequiredError
          ? 'Sign in to have the coach build your program — using a program built from your selections instead.'
          : isTimeout
          ? 'The Foundry took too long to respond — using a program built from your selections instead.'
          : "Couldn't reach The Foundry — using a program built from your selections instead."
      );
      maybePromptLegBalance(built);
    }
  };

  // Always on screen: where you are, and one button that is always the
  // next thing to do.
  const footer = (
      <div
        style={{
          // Pinned: in SetupPage's slot it sits outside the scroller. The
          // sticky fallback is for a standalone render.
          position: footerSlot ? 'relative' : 'sticky',
          bottom: 0,
          zIndex: 5,
          margin: footerSlot ? 0 : '0 -20px',
          padding: '12px 20px calc(14px + env(safe-area-inset-bottom, 0px))',
          background: 'var(--bg-root)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div
          role="group"
          aria-label="Questions"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}
        >
          {steps.map((st) => {
            const done = !st.missing;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => goTo(st.ref)}
                aria-label={`${st.label}: ${done ? 'done' : 'not answered'}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px 0 2px',
                  minHeight: 32,
                  cursor: 'pointer',
                  textAlign: 'left',
                  // Buttons centre their content vertically; a label that
                  // wrapped would lift its bar out of line with the others.
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: done ? 'var(--accent)' : 'var(--border)',
                    marginBottom: 6,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    // Fixed box: the ✓ glyph is taller than the caps.
                    display: 'block',
                    height: 14,
                    lineHeight: '14px',
                    overflow: 'hidden',
                    color: done ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {done && <span aria-hidden="true">✓ </span>}
                  {st.label}
                </span>
              </button>
            );
          })}
        </div>
        {nextStep ? (
          <button
            type="button"
            onClick={() => goTo(nextStep.ref)}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: tokens.radius.md,
              cursor: 'pointer',
              background: 'var(--bg-card)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            Next: {nextStep.missing} <span aria-hidden="true">↓</span>
          </button>
        ) : (
          <button
            onClick={handleAutoSubmit}
            disabled={aiLoading}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: tokens.radius.md,
              cursor: aiLoading ? 'not-allowed' : 'pointer',
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '0.04em',
              boxShadow: '0 4px 24px rgba(var(--accent-rgb),0.35)',
              opacity: aiLoading ? 0.7 : 1,
            }}
          >
            {aiLoading ? 'Building...' : <>Build My Meso <span aria-hidden="true">→</span></>}
          </button>
        )}
      </div>
  );

  return (
    <div style={{ padding: footerSlot ? '24px 20px 24px' : '24px 20px 0' }}>
      {/* AI Loading overlay */}
      {aiLoading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: tokens.colors.overlayHeavy,
            zIndex: 300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: 32,
          }}
        >
          <FoundryBanner subtitle="BUILDING YOUR PROGRAM" />
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: tokens.radius.full,
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px',
              }}
            />
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '0.02em',
              }}
            >
              The Foundry is building your meso...
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 8,
                lineHeight: 1.6,
                maxWidth: 280,
              }}
            >
              The Foundry is selecting exercises, setting progressive overload targets, and
              sequencing your training week.
            </div>
          </div>
        </div>
      )}

      {/* Q1: Training Split */}
      <div ref={splitRef} style={{ ...sec, scrollMarginTop: 12 }}>
        {eyebrow(1)}
        <label
          style={{
            ...sLabel,
            fontSize: 15,
            letterSpacing: '0.01em',
            color: 'var(--text-primary)',
          }}
        >
          What training split?
        </label>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 4,
            marginBottom: 12,
          }}
        >
          How your weekly sessions are organized
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            [
              'full_body',
              'FULL BODY',
              'Every session',
              'Push + pull + legs every workout. High frequency, great for beginners and time-constrained schedules. Each muscle trained 2-3×/week.',
              'Push, pull and legs every workout.',
            ],
            [
              'upper_lower',
              'UPPER / LOWER',
              '2-session rotation',
              'Upper body and lower body alternate. Each area trained 2× per week. Excellent balance of frequency and recovery.',
              'Upper and lower days alternate.',
            ],
            [
              'ppl',
              'PUSH / PULL / LEGS',
              'Classic 3-way split',
              'Chest-shoulders-triceps, back-biceps, legs. The gold standard for hypertrophy. Each muscle hit 1-2×/week on 3-6 days.',
              'Chest/shoulders/triceps · back/biceps · legs.',
            ],
            [
              'push_pull',
              'PUSH / PULL',
              '4-day split',
              'Push and pull alternate with legs integrated into each session. No dedicated leg day, 4 days per week.',
              'Push and pull days, legs folded into both.',
            ],
          ].map(([val, label, badge, desc, short]) => {
            const sel = autoForm.split === val;
            return (
              <button
                key={val}
                aria-pressed={sel}
                onClick={() => {
                  const first = !autoForm.split;
                  setAuto('split', val);
                  // First pick: bring the next question up. Changing your
                  // mind later shouldn't move the page under your thumb.
                  if (first) setTimeout(() => goTo(scheduleRef), 180);
                }}
                className="btn-card"
                style={{
                  padding: sel ? '16px 16px' : '14px 16px',
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: sel ? 'rgba(var(--accent-rgb),0.10)' : 'var(--bg-card)',
                  border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: sel ? 6 : 0,
                  }}
                >
                  {sel && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: tokens.radius.full,
                        background: 'var(--accent)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: '0.03em',
                      color: sel ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      padding: '3px 8px',
                      borderRadius: tokens.radius.md,
                      background: sel
                        ? 'rgba(var(--accent-rgb),0.18)'
                        : 'var(--bg-surface)',
                      color: sel ? 'var(--accent)' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {badge}
                  </span>
                </div>
                {/* Only the chosen card opens up: four full descriptions filled
                    the whole first screen and hid every question below. */}
                {(
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      paddingLeft: sel ? 18 : 0,
                      marginTop: sel ? 0 : 4,
                    }}
                  >
                    {sel ? desc : short}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Q2: Days/week + Meso length */}
      <div ref={scheduleRef} style={{ ...sec, scrollMarginTop: 12 }}>
        {eyebrow(2)}
        <label
          style={{
            ...sLabel,
            fontSize: 15,
            letterSpacing: '0.01em',
            color: 'var(--text-primary)',
          }}
        >
          Volume & duration
        </label>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 4,
            marginBottom: 14,
          }}
        >
          How often will you train, and how long is this block?
        </div>
        {/* DAYS PER WEEK */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              marginBottom: 8,
            }}
          >
            DAYS PER WEEK
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5,1fr)',
              gap: 8,
            }}
          >
            {[2, 3, 4, 5, 6].map((n) => {
              const validForSplit =
                !autoForm.split ||
                ({
                  full_body: [2, 3, 4],
                  upper_lower: [2, 3, 4, 5],
                  ppl: [3, 5, 6],
                  push_pull: [4],
                } as Record<string, number[]>)[autoForm.split]?.includes(n);
              const sel = autoForm.daysPerWeek === n;
              return (
                <button
                  key={n}
                  onClick={() =>
                    !autoForm.split || validForSplit ? setAuto('daysPerWeek', n) : null
                  }
                  className="btn-toggle"
                  style={{
                    padding: '12px 4px',
                    borderRadius: tokens.radius.md,
                    cursor: validForSplit || !autoForm.split ? 'pointer' : 'not-allowed',
                    textAlign: 'center',
                    background: sel
                      ? 'rgba(var(--accent-rgb),0.14)'
                      : validForSplit || !autoForm.split
                        ? 'var(--bg-card)'
                        : 'var(--bg-inset)',
                    border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                    opacity: !autoForm.split || validForSplit ? 1 : 0.35,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: sel ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* MESO LENGTH */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              marginBottom: 8,
            }}
          >
            MESO LENGTH
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              [4, '4 wk'],
              [6, '6 wk'],
              [8, '8 wk'],
              [12, '12 wk'],
            ] as [number, string][]).map(([n, label]) => {
              const sel = autoForm.mesoLength === n;
              return (
                <button
                  key={n}
                  onClick={() => setAuto('mesoLength', n)}
                  className="btn-toggle"
                  style={{
                    flex: 1,
                    padding: '12px 4px',
                    borderRadius: tokens.radius.md,
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: sel ? 'rgba(var(--accent-rgb),0.14)' : 'var(--bg-card)',
                    border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: sel ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* SESSION DURATION */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              marginBottom: 8,
            }}
          >
            SESSION LENGTH
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5,1fr)',
              gap: 8,
            }}
          >
            {([
              [30, '30m'],
              [45, '45m'],
              [60, '60m'],
              [75, '75m'],
              [90, '90m'],
            ] as [number, string][]).map(([n, label]) => {
              const tier = experienceTier(autoForm.experience);
              const defaultDur = tier === 'beginner' ? 60 : tier === 'advanced' ? 90 : 75;
              const sel = (autoForm.sessionDuration || defaultDur) === n;
              return (
                <button
                  key={n}
                  onClick={() => setAuto('sessionDuration', n)}
                  className="btn-toggle"
                  style={{
                    padding: '12px 4px',
                    borderRadius: tokens.radius.md,
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: sel ? 'rgba(var(--accent-rgb),0.14)' : 'var(--bg-card)',
                    border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: sel ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Experience — pre-filled, and changeable: a lifter two years in
          shouldn't be stuck with what they said on day one. It sets which
          exercises are in play and the default session length. */}
      <div ref={levelRef} style={{ ...sec, scrollMarginTop: 12 }}>
        {eyebrow(3)}
        <label
          id="auto-exp-label"
          style={{
            ...sLabel,
            fontSize: 15,
            letterSpacing: '0.01em',
            color: 'var(--text-primary)',
          }}
        >
          Experience level
        </label>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 12 }}>
          How long you&rsquo;ve been lifting consistently. Update it as you grow.
        </div>
        <div
          role="group"
          aria-labelledby="auto-exp-label"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}
        >
          {EXPERIENCE_OPTIONS.map((o) => {
            const sel = !!autoForm.experience && experienceTier(autoForm.experience) === o.tier;
            return (
              <button
                key={o.value}
                aria-pressed={sel}
                onClick={() => setAuto('experience', o.value)}
                className="btn-toggle"
                style={{
                  padding: '12px 4px',
                  borderRadius: tokens.radius.md,
                  cursor: 'pointer',
                  textAlign: 'center',
                  background: sel ? 'rgba(var(--accent-rgb),0.14)' : 'var(--bg-card)',
                  border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: sel ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  {o.label}
                </span>
              </button>
            );
          })}
        </div>
        {autoForm.experience && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            {EXPERIENCE_OPTIONS.find((o) => o.tier === experienceTier(autoForm.experience))!.hint}
          </div>
        )}
      </div>

      {/* Equipment */}
      <div ref={equipRef} style={{ ...sec, scrollMarginTop: 12 }}>
        {eyebrow(4)}
        <label
          style={{
            ...sLabel,
            fontSize: 15,
            letterSpacing: '0.01em',
            color: 'var(--text-primary)',
          }}
        >
          Available equipment
        </label>
        <EquipmentPicker
          selected={autoForm.equipment}
          onToggle={toggleAutoEquip}
          onSetAll={(values) => setAuto('equipment', values)}
        />
      </div>

      {/* Start date — a planned meso starts on the day it's started */}
      {!planningNext && (
      <div style={sec}>
        <label style={sLabel}>Start date</label>
        <input
          type="date"
          value={autoForm.startDate}
          onChange={(e) => setAuto('startDate', e.target.value)}
          style={{
            ...inputStyle,
            colorScheme: 'dark',
            WebkitAppearance: 'none',
            appearance: 'none',
            display: 'block',
            minWidth: 0,
            maxWidth: '100%',
          }}
        />
      </div>
      )}

      {/* Program summary preview */}
      {autoForm.split &&
        autoForm.daysPerWeek &&
        autoForm.mesoLength &&
        autoForm.experience && (
          <div
            style={{
              background: 'rgba(var(--accent-rgb),0.06)',
              border: '1px solid rgba(var(--accent-rgb),0.25)',
              borderRadius: tokens.radius.lg,
              padding: '18px 16px',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: 'var(--accent)',
                marginBottom: 12,
              }}
            >
              THE FOUNDRY WILL DESIGN
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              {[
                [
                  'Split',
                  formatSplitName(autoForm.split),
                ],
                ['Length', `${autoForm.mesoLength}-week meso`],
                ['Frequency', `${autoForm.daysPerWeek} days/week`],
                [
                  'Level',
                  experienceLabel(autoForm.experience),
                ],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: tokens.radius.lg,
                    padding: '10px 12px',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      marginBottom: 3,
                    }}
                  >
                    {(k as string).toUpperCase()}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                    }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginTop: 12,
                lineHeight: 1.5,
              }}
            >
              The Foundry will select exercises, set progression targets, and sequence your
              week for maximum results.
            </div>
          </div>
        )}

      {/* Error */}
      {error && (
        <div
          style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger)',
            borderRadius: tokens.radius.md,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--danger)',
          }}
        >
          {error}
        </div>
      )}

      {footerSlot ? createPortal(footer, footerSlot) : footer}
    </div>
  );
}
