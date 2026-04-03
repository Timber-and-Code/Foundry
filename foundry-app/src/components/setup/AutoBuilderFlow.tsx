import React from 'react';
import { tokens } from '../../styles/tokens';
import { ageFromDob } from '../../utils/store';
import { callFoundryAI } from '../../utils/api';
import { GOAL_OPTIONS } from '../../data/constants';
import FoundryBanner from '../shared/FoundryBanner';

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
    equipment: string[];
    startDate: string;
  };
  aiLoading: boolean;
  error: string;
  sLabel: React.CSSProperties;
  sec: React.CSSProperties;
  inputStyle: React.CSSProperties;
  setAuto: (k: string, v: any) => void;
  toggleAutoEquip: (item: string) => void;
  setAiLoading: (v: boolean) => void;
  setAiCoachNote: (v: string) => void;
  setError: (v: string) => void;
  maybePromptLegBalance: (built: any) => void;
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
}: AutoBuilderFlowProps) {
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

    const sessMap: Record<string, number> = { beginner: 60, intermediate: 75, experienced: 90 };
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
      sessionDuration: sessMap[autoForm.experience || ''] || 60,
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
      });

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
        sessionDuration: sessMap[autoForm.experience || ''] || 60,
        autoBuilt: true,
        aiDays: result.days,
        aiCoachNote: result.coachNote,
      };

      if (result.coachNote) setAiCoachNote(result.coachNote);
      setAiLoading(false);
      maybePromptLegBalance(aiBuilt);
    } catch (err: any) {
      setAiLoading(false);
      const isTimeout = err.name === 'AbortError';
      setError(
        isTimeout
          ? 'The Foundry took too long to respond — using a program built from your selections instead.'
          : "Couldn't reach The Foundry — using a program built from your selections instead."
      );
      maybePromptLegBalance(built);
    }
  };

  return (
    <div style={{ padding: '24px 20px 40px' }}>
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
                borderRadius: '50%',
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
      <div style={sec}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--accent)',
            marginBottom: 6,
          }}
        >
          QUESTION 1 OF 3
        </div>
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
            ],
            [
              'upper_lower',
              'UPPER / LOWER',
              '2-session rotation',
              'Upper body and lower body alternate. Each area trained 2× per week. Excellent balance of frequency and recovery.',
            ],
            [
              'ppl',
              'PUSH / PULL / LEGS',
              'Classic 3-way split',
              'Chest-shoulders-triceps, back-biceps, legs. The gold standard for hypertrophy. Each muscle hit 1-2×/week on 3-6 days.',
            ],
            [
              'push_pull',
              'PUSH / PULL',
              '4-day split',
              'Push and pull alternate with legs integrated into each session. No dedicated leg day, 4 days per week.',
            ],
          ].map(([val, label, badge, desc]) => {
            const sel = autoForm.split === val;
            return (
              <button
                key={val}
                onClick={() => setAuto('split', val)}
                className="btn-card"
                style={{
                  padding: '18px 16px',
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
                    marginBottom: 6,
                  }}
                >
                  {sel && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
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
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.55,
                    paddingLeft: sel ? 18 : 0,
                  }}
                >
                  {desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Q2: Days/week + Meso length */}
      <div style={sec}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--accent)',
            marginBottom: 6,
          }}
        >
          QUESTION 2 OF 3
        </div>
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
      </div>

      {/* Experience — pre-filled from onboarding, shown read-only */}
      {autoForm.experience && (
        <div style={sec}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--accent)',
              marginBottom: 6,
            }}
          >
            QUESTION 3 OF 3
          </div>
          <label
            style={{
              ...sLabel,
              fontSize: 15,
              letterSpacing: '0.01em',
              color: 'var(--text-primary)',
            }}
          >
            Experience level
          </label>
          <div
            style={{
              marginTop: 10,
              padding: '14px 16px',
              borderRadius: tokens.radius.lg,
              background: 'rgba(var(--accent-rgb),0.08)',
              border: '1px solid var(--accent)44',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {autoForm.experience === 'new'
                ? 'Under 1 year'
                : autoForm.experience === 'intermediate'
                  ? '1–3 years'
                  : '3+ years'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              set during onboarding
            </span>
          </div>
        </div>
      )}

      {/* Equipment */}
      <div style={sec}>
        <label
          style={{
            ...sLabel,
            fontSize: 15,
            letterSpacing: '0.01em',
            color: 'var(--text-primary)',
          }}
        >
          Available equipment *
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginTop: 8,
          }}
        >
          {[
            'barbell',
            'dumbbell',
            'bodyweight',
            'kettlebell',
            'band',
            'machine',
            'cable',
          ].map((val) => {
            const names: Record<string, string> = {
              barbell: 'Barbell',
              dumbbell: 'Dumbbells',
              bodyweight: 'Bodyweight',
              kettlebell: 'Kettlebell',
              band: 'Bands',
              machine: 'Machines',
              cable: 'Cable',
            };
            const sel = autoForm.equipment.includes(val);
            return (
              <button
                key={val}
                onClick={() => toggleAutoEquip(val)}
                className="btn-toggle"
                style={{
                  padding: '12px 14px',
                  borderRadius: tokens.radius.md,
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: sel ? 'rgba(var(--accent-rgb),0.14)' : 'var(--bg-card)',
                  border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: tokens.radius.sm,
                    flexShrink: 0,
                    border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                    background: sel ? 'var(--accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {sel && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5l2 2 4-4"
                        stroke="#fff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: sel ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  {names[val]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Start date */}
      <div style={sec}>
        <label style={sLabel}>Start date</label>
        <input
          type="date"
          value={autoForm.startDate}
          onChange={(e) => setAuto('startDate', e.target.value)}
          style={{ ...inputStyle, colorScheme: 'dark' }}
        />
      </div>

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
                  ({
                    ppl: 'Push · Pull · Legs',
                    upper_lower: 'Upper / Lower',
                    full_body: 'Full Body',
                  } as Record<string, string>)[autoForm.split],
                ],
                ['Length', `${autoForm.mesoLength}-week meso`],
                ['Frequency', `${autoForm.daysPerWeek} days/week`],
                [
                  'Level',
                  autoForm.experience.charAt(0).toUpperCase() +
                    autoForm.experience.slice(1),
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

      <button
        onClick={handleAutoSubmit}
        disabled={aiLoading}
        className="btn-primary"
        style={{
          width: '100%',
          padding: '20px',
          borderRadius: tokens.radius.md,
          cursor: aiLoading ? 'not-allowed' : 'pointer',
          background: 'var(--btn-primary-bg)',
          border: '1px solid var(--btn-primary-border)',
          color: 'var(--btn-primary-text)',
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: '0.04em',
          boxShadow: '0 4px 24px rgba(var(--accent-rgb),0.35)',
          opacity: aiLoading ? 0.7 : 1,
        }}
      >
        {aiLoading ? 'Building...' : 'Build My Meso →'}
      </button>
    </div>
  );
}
