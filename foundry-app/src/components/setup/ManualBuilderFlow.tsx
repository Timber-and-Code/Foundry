import React, { useState } from 'react';
import { EXERCISE_DB } from '../../data/exercises';
import { GOAL_OPTIONS, TAG_ACCENT } from '../../data/constants';
import { tokens } from '../../styles/tokens';
import HammerIcon from '../shared/HammerIcon';

interface SplitConfigEntry {
  label: string;
  validDays: number[];
  defaultDays: Record<number, number[]>;
  desc: string;
}

export interface ManualBuilderFlowProps {
  form: {
    name: string;
    age: string;
    gender: string;
    weight: string;
    goal: string;
    goalNote: string;
    mesoLength: number;
    sessionDuration: number;
    equipment: string[];
    theme: string;
    startDate: string;
    splitType: string;
    workoutDays: number[];
    daysPerWeek: number;
  };
  manualExStep: boolean;
  manualPairStep: boolean;
  dayExercises: Record<number, string[]>;
  dayPairs: Record<number, [number, number][]>;
  cardioDays: Set<number>;
  error: string;
  sLabel: React.CSSProperties;
  sec: React.CSSProperties;
  inputStyle: React.CSSProperties;
  SPLIT_CONFIG: Record<string, SplitConfigEntry>;
  mesoEnd: string | null;
  set: (k: string, v: any) => void;
  setSplit: (split: string) => void;
  setDayCount: (n: number) => void;
  toggleEquipment: (item: string) => void;
  toggleDay: (dayNum: number) => void;
  setManualExStep: (v: boolean) => void;
  setManualPairStep: (v: boolean) => void;
  setDayExercises: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
  setDayPairs: React.Dispatch<React.SetStateAction<Record<number, [number, number][]>>>;
  setCardioDays: React.Dispatch<React.SetStateAction<Set<number>>>;
  setError: (v: string) => void;
  maybePromptCardio: (profile: any) => void;
}

export default function ManualBuilderFlow({
  form,
  manualExStep,
  manualPairStep,
  dayExercises,
  dayPairs,
  cardioDays,
  error,
  sLabel,
  sec,
  inputStyle,
  SPLIT_CONFIG,
  mesoEnd,
  set,
  setSplit,
  setDayCount,
  toggleEquipment,
  toggleDay,
  setManualExStep,
  setManualPairStep,
  setDayExercises,
  setDayPairs,
  setCardioDays,
  setError,
  maybePromptCardio,
}: ManualBuilderFlowProps) {
  const [pairPickFirst, setPairPickFirst] = useState<{ dayIdx: number; exIdx: number } | null>(null);

  // ── Split day templates (shared between exercise picker and pairing step) ──
  const splitDayTemplates: Record<string, Record<number, string[][]>> = {
    ppl: {
      3: [
        ['Push Day', 'PUSH'],
        ['Pull Day', 'PULL'],
        ['Legs Day', 'LEGS'],
      ],
      5: [
        ['Push Day 1', 'PUSH'],
        ['Pull Day 1', 'PULL'],
        ['Legs Day', 'LEGS'],
        ['Push Day 2', 'PUSH'],
        ['Pull Day 2', 'PULL'],
      ],
      6: [
        ['Push 1', 'PUSH'],
        ['Pull 1', 'PULL'],
        ['Legs 1', 'LEGS'],
        ['Push 2', 'PUSH'],
        ['Pull 2', 'PULL'],
        ['Legs 2', 'LEGS'],
      ],
    },
    upper_lower: {
      2: [
        ['Upper Body', 'UPPER'],
        ['Lower Body', 'LOWER'],
      ],
      4: [
        ['Upper A', 'UPPER'],
        ['Lower A', 'LOWER'],
        ['Upper B', 'UPPER'],
        ['Lower B', 'LOWER'],
      ],
    },
    full_body: {
      2: [
        ['Full Body A', 'FULL'],
        ['Full Body B', 'FULL'],
      ],
      3: [
        ['Full Body A', 'FULL'],
        ['Full Body B', 'FULL'],
        ['Full Body C', 'FULL'],
      ],
    },
  };

  const numDays = form.workoutDays?.length || form.daysPerWeek || 6;
  const dayTemplates =
    (splitDayTemplates as Record<string, any>)[form.splitType]?.[numDays] ||
    Array.from({ length: numDays }, (_, i) => [`Day ${i + 1}`, 'FULL']);

  const tagColors: Record<string, string> = {
    PUSH: 'var(--tag-push)',
    PULL: 'var(--tag-pull)',
    LEGS: 'var(--tag-legs)',
    UPPER: 'var(--phase-peak)',
    LOWER: 'var(--accent-blue)',
    FULL: 'var(--phase-deload)',
  };

  const tagColorsPair: Record<string, string> = {
    PUSH: 'var(--tag-push)',
    PULL: 'var(--tag-pull)',
    LEGS: 'var(--tag-legs)',
    UPPER: 'var(--phase-intens)',
    LOWER: 'var(--phase-accum)',
    FULL: 'var(--accent)',
  };

  // ── Exercise picker helpers ──
  const getExercisesForTag = (dayTag: string): Record<string, typeof EXERCISE_DB[number][]> => {
    let tagFilter: string[];
    if (dayTag === 'PUSH') tagFilter = ['PUSH'];
    else if (dayTag === 'PULL') tagFilter = ['PULL'];
    else if (dayTag === 'LEGS') tagFilter = ['LEGS'];
    else if (dayTag === 'UPPER') tagFilter = ['PUSH', 'PULL'];
    else if (dayTag === 'LOWER') tagFilter = ['LEGS'];
    else tagFilter = ['PUSH', 'PULL', 'LEGS'];
    const exs = EXERCISE_DB.filter((e) => tagFilter.includes(e.tag));
    const groups: Record<string, typeof EXERCISE_DB[number][]> = {};
    exs.forEach((e) => {
      if (!groups[e.muscle]) groups[e.muscle] = [];
      groups[e.muscle].push(e);
    });
    return groups;
  };

  const toggleExercise = (dayIdx: number, exId: string) => {
    setDayExercises((prev) => {
      const current = prev[dayIdx] || [];
      const exists = current.includes(exId);
      return {
        ...prev,
        [dayIdx]: exists ? current.filter((id) => id !== exId) : [...current, exId],
      };
    });
  };

  const allDaysValid = dayTemplates.every(
    (_: any, i: number) => cardioDays.has(i) || (dayExercises[i] || []).length >= 3
  );

  // ── Pairing helpers ──
  const togglePair = (dayIdx: number, exIdx: number) => {
    if (pairPickFirst === null) {
      setPairPickFirst({ dayIdx, exIdx });
    } else if (pairPickFirst.dayIdx !== dayIdx || pairPickFirst.exIdx === exIdx) {
      setPairPickFirst(null);
    } else {
      const a = Math.min(pairPickFirst.exIdx, exIdx);
      const b = Math.max(pairPickFirst.exIdx, exIdx);
      setDayPairs((prev) => {
        const existing = prev[dayIdx] || [];
        const filtered = existing.filter(
          ([pa, pb]) => pa !== a && pb !== b && pa !== b && pb !== a
        );
        return { ...prev, [dayIdx]: [...filtered, [a, b]] };
      });
      setPairPickFirst(null);
    }
  };

  const removePair = (dayIdx: number, a: number, b: number) => {
    setDayPairs((prev) => ({
      ...prev,
      [dayIdx]: (prev[dayIdx] || []).filter(([pa, pb]) => !(pa === a && pb === b)),
    }));
  };

  const isPaired = (dayIdx: number, exIdx: number) => {
    return (dayPairs[dayIdx] || []).some(([a, b]) => a === exIdx || b === exIdx);
  };

  const getPairLabel = (dayIdx: number, exIdx: number) => {
    const pair = (dayPairs[dayIdx] || []).find(([a, b]) => a === exIdx || b === exIdx);
    if (!pair) return null;
    return pair[0] === exIdx ? 'A' : 'B';
  };

  // ═══════════════════════════════════════════════
  // MANUAL FORM (split, days, equipment, etc.)
  // ═══════════════════════════════════════════════
  if (!manualExStep) {
    return (
      <div style={{ padding: '24px 20px 40px' }}>
        {/* Training split */}
        <div style={sec}>
          <label style={sLabel}>Training split *</label>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 8,
            }}
          >
            {[
              ['full_body', 'Full Body', 'All muscle groups every session. 2–3 days/week.'],
              [
                'upper_lower',
                'Upper / Lower',
                'Upper and lower body alternate. 2 or 4 days/week.',
              ],
              ['ppl', 'Push / Pull / Legs', 'Classic 3-way split. 3, 5, or 6 days/week.'],
            ].map(([key, label, desc]) => {
              const sel = form.splitType === key;
              const validDaysForSplit = (SPLIT_CONFIG as Record<string, any>)[key]?.validDays || [];
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSplit(key);
                    setDayExercises({});
                  }}
                  className="btn-card"
                  style={{
                    padding: '16px',
                    borderRadius: tokens.radius.lg,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: sel ? 'rgba(var(--accent-rgb),0.1)' : 'var(--bg-card)',
                    border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: sel ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        padding: '2px 8px',
                        borderRadius: tokens.radius.sm,
                        background: sel
                          ? 'rgba(var(--accent-rgb),0.15)'
                          : 'var(--bg-surface)',
                        color: sel ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {validDaysForSplit.join('/')}d
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      lineHeight: 1.5,
                    }}
                  >
                    {desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Days per week */}
        <div style={sec}>
          <label style={sLabel}>Days per week *</label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5,1fr)',
              gap: 8,
              marginTop: 8,
            }}
          >
            {[2, 3, 4, 5, 6].map((n) => {
              const validDays = (SPLIT_CONFIG as Record<string, any>)[form.splitType]?.validDays || [2, 3, 4, 5, 6];
              const valid = validDays.includes(n);
              const active = form.workoutDays.length === n;
              return (
                <button
                  key={n}
                  onClick={() => (valid ? setDayCount(n) : null)}
                  style={{
                    padding: '16px 4px',
                    borderRadius: tokens.radius.md,
                    cursor: valid ? 'pointer' : 'not-allowed',
                    fontWeight: 700,
                    fontSize: 16,
                    letterSpacing: '0.02em',
                    background: active
                      ? 'rgba(var(--accent-rgb),0.14)'
                      : valid
                        ? 'var(--bg-card)'
                        : 'var(--bg-inset)',
                    border: `1px solid ${active ? 'var(--accent)' : valid ? 'var(--border)' : 'var(--border)'}`,
                    color: active
                      ? 'var(--accent)'
                      : valid
                        ? 'var(--text-primary)'
                        : 'var(--text-dim)',
                    opacity: valid ? 1 : 0.35,
                    transition: 'all 0.15s',
                  }}
                >
                  {n}
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      marginTop: 4,
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      opacity: valid ? 1 : 0.7,
                    }}
                  >
                    DAYS
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Meso length */}
        <div style={sec}>
          <label style={sLabel}>Meso cycle length *</label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,1fr)',
              gap: 8,
              marginTop: 8,
            }}
          >
            {([
              [4, 'SHORT'],
              [6, 'STANDARD'],
              [8, 'EXTENDED'],
              [12, 'LONG'],
            ] as [number, string][]).map(([n, tag]) => (
              <button
                key={n}
                onClick={() => set('mesoLength', n)}
                style={{
                  padding: '14px 4px',
                  borderRadius: tokens.radius.md,
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 18,
                  letterSpacing: '0.02em',
                  background:
                    form.mesoLength === n ? 'rgba(var(--accent-rgb),0.14)' : 'var(--bg-card)',
                  border: `1px solid ${form.mesoLength === n ? 'var(--accent)' : 'var(--border)'}`,
                  color: form.mesoLength === n ? 'var(--accent)' : 'var(--text-primary)',
                  transition: 'all 0.15s',
                }}
              >
                {n}
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    marginTop: 4,
                    letterSpacing: '0.04em',
                    color: form.mesoLength === n ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {tag}
                </div>
              </button>
            ))}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              marginTop: 8,
            }}
          >
            {form.mesoLength === 4 && 'Sharp, focused push. Great for a specific block.'}
            {form.mesoLength === 6 && 'Standard — the sweet spot for most trainees.'}
            {form.mesoLength === 8 &&
              'Extended accumulation before peaking. More volume base.'}
            {form.mesoLength === 12 &&
              'Full periodization — max accumulation + long peak. Commitment required.'}
          </div>
        </div>

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
              const sel = form.equipment.includes(val);
              return (
                <button
                  key={val}
                  onClick={() => toggleEquipment(val)}
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

        {/* Which days */}
        <div style={sec}>
          <label style={sLabel}>Which days?</label>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              marginTop: 4,
              marginBottom: 8,
            }}
          >
            Tap to customise
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              ['Su', 0],
              ['M', 1],
              ['Tu', 2],
              ['W', 3],
              ['Th', 4],
              ['F', 5],
              ['Sa', 6],
            ] as [string, number][]).map(([lbl, num]) => {
              const sel = form.workoutDays.includes(num);
              return (
                <button
                  key={num}
                  onClick={() => toggleDay(num)}
                  className="btn-toggle"
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    borderRadius: tokens.radius.lg,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.02em',
                    background: sel ? 'rgba(var(--accent-rgb),0.16)' : 'var(--bg-card)',
                    border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                    color: sel ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>

        {/* Start date */}
        <div style={sec}>
          <label style={sLabel}>Start date *</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }}
          />
          {mesoEnd && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 8,
              }}
            >
              Ends <b style={{ color: 'var(--text-primary)' }}>{mesoEnd}</b> ·{' '}
              {form.mesoLength} weeks
            </div>
          )}
        </div>

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
          onClick={() => {
            setError('');
            if (form.equipment.length === 0) {
              setError('Select at least one equipment type.');
              return;
            }
            const splitValidDays = (SPLIT_CONFIG as Record<string, any>)[form.splitType]?.validDays;
            if (splitValidDays && !splitValidDays.includes(form.workoutDays.length)) {
              setError(
                `${(SPLIT_CONFIG as Record<string, any>)[form.splitType]?.label || form.splitType} needs ${splitValidDays.join(' or ')} training days — you have ${form.workoutDays.length} selected.`
              );
              return;
            }
            setManualExStep(true);
            window.scrollTo(0, 0);
          }}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '20px',
            borderRadius: tokens.radius.md,
            cursor: 'pointer',
            background: 'var(--btn-primary-bg)',
            border: '1px solid var(--btn-primary-border)',
            color: 'var(--btn-primary-text)',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '0.04em',
            boxShadow: '0 4px 24px rgba(var(--accent-rgb),0.35)',
          }}
        >
          Choose Exercises →
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // SUPERSET PAIRING STEP
  // ═══════════════════════════════════════════════
  if (manualPairStep) {
    return (
      <div style={{ padding: '24px 20px 40px' }}>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: 6,
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>Optional:</strong> pair
          exercises as supersets. Tap two exercises in the same day to link them — the
          rest timer fires after both sets are complete.
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          Best pairings: push + pull (bench + row), curl + pushdown, quad + hamstring.
          Don't pair two heavy compounds.
        </div>

        {dayTemplates.map(([dayLabel, dayTag]: any, dayIdx: any) => {
          const exIds = dayExercises[dayIdx] || [];
          const accent = (tagColorsPair as Record<string, any>)[dayTag] || 'var(--accent)';
          const pairs = dayPairs[dayIdx] || [];

          return (
            <div
              key={dayIdx}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid var(--border)`,
                borderRadius: tokens.radius.lg,
                overflow: 'hidden',
                marginBottom: 14,
                borderLeft: `3px solid ${accent}`,
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    padding: '2px 7px',
                    borderRadius: tokens.radius.sm,
                    background: accent + '22',
                    color: accent,
                  }}
                >
                  {dayTag}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {dayLabel}
                </span>
                {pairs.length > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 12,
                      color: 'var(--phase-intens)',
                      fontWeight: 700,
                    }}
                  >
                    {pairs.length} superset
                    {pairs.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {exIds.map((id, i) => {
                  const ex = EXERCISE_DB.find((e) => e.id === id);
                  if (!ex) return null;
                  const paired = isPaired(dayIdx, i);
                  const label = getPairLabel(dayIdx, i);
                  const isPicking =
                    pairPickFirst?.dayIdx === dayIdx && pairPickFirst?.exIdx === i;
                  const isFirst = i === 0;

                  let partnerName = '';
                  if (paired) {
                    const pair = (dayPairs[dayIdx] || []).find(
                      ([a, b]) => a === i || b === i
                    );
                    const partnerIdx = pair ? (pair[0] === i ? pair[1] : pair[0]) : -1;
                    const partnerId = partnerIdx >= 0 ? exIds[partnerIdx] : null;
                    const partnerEx = partnerId
                      ? EXERCISE_DB.find((e) => e.id === partnerId)
                      : null;
                    partnerName = partnerEx?.name || '';
                  }

                  return (
                    <button
                      key={id}
                      onClick={() => !isFirst && togglePair(dayIdx, i)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        textAlign: 'left',
                        padding: '9px 12px',
                        borderRadius: tokens.radius.md,
                        cursor: isFirst ? 'default' : 'pointer',
                        background: isPicking
                          ? 'rgba(232,101,26,0.15)'
                          : paired
                            ? 'rgba(232,101,26,0.08)'
                            : 'var(--bg-surface)',
                        border: `1px solid ${isPicking ? 'var(--phase-intens)' : paired ? 'rgba(232,101,26,0.4)' : 'var(--border)'}`,
                        transition: 'all 0.12s',
                        width: '100%',
                      }}
                    >
                      {isFirst ? (
                        <HammerIcon size={16} />
                      ) : label ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            minWidth: 16,
                            textAlign: 'center',
                            color: 'var(--phase-intens)',
                            background: 'rgba(232,101,26,0.2)',
                            padding: '1px 5px',
                            borderRadius: tokens.radius.xs,
                          }}
                        >
                          {label}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--text-dim)',
                            minWidth: 16,
                            textAlign: 'center',
                          }}
                        >
                          {i + 1}
                        </span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: paired
                              ? 'var(--text-primary)'
                              : 'var(--text-secondary)',
                          }}
                        >
                          {ex.name}
                        </div>
                        {paired && partnerName && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--phase-intens)',
                              marginTop: 1,
                            }}
                          >
                            ↕ superset with {partnerName}
                          </div>
                        )}
                      </div>
                      {paired && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const pair = (dayPairs[dayIdx] || []).find(
                              ([a, b]) => a === i || b === i
                            );
                            if (pair) removePair(dayIdx, pair[0], pair[1]);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 14,
                            color: 'var(--text-muted)',
                            padding: '2px 4px',
                          }}
                        >
                          ×
                        </button>
                      )}
                      {isPicking && (
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--phase-intens)',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          ← tap partner
                        </span>
                      )}
                      {!isFirst && !paired && !isPicking && (
                        <span
                          style={{
                            fontSize: 16,
                            color: 'var(--border)',
                            flexShrink: 0,
                          }}
                        >
                          ○
                        </span>
                      )}
                      {isFirst && (
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--text-muted)',
                            flexShrink: 0,
                          }}
                        >
                          anchor (no pair)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr',
            gap: 10,
            marginTop: 8,
          }}
        >
          <button
            onClick={() => {
              setManualPairStep(false);
              window.scrollTo(0, 0);
            }}
            className="btn-ghost"
            style={{
              padding: '18px',
              borderRadius: tokens.radius.md,
              cursor: 'pointer',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            ‹ Back
          </button>
          <button
            onClick={() => {
              const goalOption = GOAL_OPTIONS.find((g) => g.id === form.goal);
              const profile = {
                ...form,
                priority: goalOption?.priority || 'both',
                manualDayExercises: dayExercises,
                manualDayPairs: dayPairs,
                manualCardioDays: [...cardioDays],
                manualBuilt: true,
              };
              maybePromptCardio(profile);
            }}
            className="btn-primary"
            style={{
              padding: '18px',
              borderRadius: tokens.radius.md,
              cursor: 'pointer',
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '0.04em',
              boxShadow: '0 4px 24px rgba(var(--accent-rgb),0.3)',
            }}
          >
            Start Training →
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // EXERCISE PICKER PER DAY
  // ═══════════════════════════════════════════════
  const cardioColor = TAG_ACCENT['CARDIO'];

  return (
    <div style={{ padding: '24px 20px 40px' }}>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: 20,
        }}
      >
        Pick exercises for each training day. The first exercise you select becomes the{' '}
        <strong style={{ color: 'var(--accent)' }}>anchor lift</strong>{' '}
        <HammerIcon size={14} style={{ marginLeft: 2 }} />. Select at least 3 per day.
      </div>

      {dayTemplates.map(([dayLabel, dayTag]: any, dayIdx: any) => {
        const selected = dayExercises[dayIdx] || [];
        const isCardio = cardioDays.has(dayIdx);
        const accent = isCardio ? cardioColor : (tagColors as Record<string, any>)[dayTag] || 'var(--accent)';
        const exGroups = getExercisesForTag(dayTag);
        const count = selected.length;
        const countColor =
          count < 3
            ? 'var(--danger)'
            : count <= 6
              ? 'var(--accent)'
              : 'var(--text-muted)';

        return (
          <div
            key={dayIdx}
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${isCardio ? cardioColor + '44' : 'var(--border)'}`,
              borderRadius: tokens.radius.lg,
              overflow: 'hidden',
              marginBottom: 16,
              borderLeft: `3px solid ${accent}`,
            }}
          >
            {/* Day header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: isCardio ? `${cardioColor}0d` : 'var(--bg-surface)',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '3px 8px',
                  borderRadius: tokens.radius.md,
                  background: accent + '22',
                  color: accent,
                }}
              >
                {isCardio ? 'CARDIO' : dayTag}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {isCardio ? 'Cardio Day' : dayLabel}
              </span>
              {/* Cardio toggle */}
              <button
                onClick={() =>
                  setCardioDays((prev) => {
                    const next = new Set(prev);
                    next.has(dayIdx) ? next.delete(dayIdx) : next.add(dayIdx);
                    return next;
                  })
                }
                style={{
                  marginLeft: 'auto',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  padding: '3px 10px',
                  borderRadius: tokens.radius.sm,
                  cursor: 'pointer',
                  border: 'none',
                  background: isCardio ? `${cardioColor}22` : 'var(--bg-deep)',
                  color: isCardio ? cardioColor : 'var(--text-muted)',
                  outline: isCardio
                    ? `1px solid ${cardioColor}55`
                    : '1px solid var(--border)',
                }}
              >
                ♥ {isCardio ? 'CARDIO DAY ✓' : 'MAKE CARDIO'}
              </button>
              {!isCardio && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: tokens.radius.sm,
                    background:
                      count < 3
                        ? 'rgba(var(--danger-rgb,220,38,38),0.1)'
                        : 'rgba(var(--accent-rgb),0.12)',
                    color: countColor,
                  }}
                >
                  {count} selected
                  {count < 3 ? ' — min 3' : count > 6 ? ' — consider trimming' : ''}
                </span>
              )}
            </div>

            {/* Cardio day — simple info, no exercise picker */}
            {isCardio ? (
              <div
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: `${cardioColor}08`,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={cardioColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  Dedicated cardio day — you'll log type, duration, and intensity during
                  the session.
                </span>
              </div>
            ) : (
              <>
                {/* Selected order strip */}
                {selected.length > 0 && (
                  <div
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'var(--bg-inset)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.05em',
                        marginBottom: 6,
                      }}
                    >
                      ORDER
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 4,
                      }}
                    >
                      {selected.map((id, i) => {
                        const ex = EXERCISE_DB.find((e) => e.id === id);
                        if (!ex) return null;
                        return (
                          <span
                            key={id}
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: tokens.radius.pill,
                              background: i === 0 ? accent + '33' : 'var(--bg-surface)',
                              border: `1px solid ${i === 0 ? accent : 'var(--border)'}`,
                              color: i === 0 ? accent : 'var(--text-secondary)',
                            }}
                          >
                            {i === 0 ? (
                              <>
                                <HammerIcon size={13} style={{ marginRight: 3 }} />
                              </>
                            ) : (
                              `${i + 1}. `
                            )}
                            {ex.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Exercise groups */}
                <div style={{ padding: '12px 16px' }}>
                  {Object.entries(exGroups).map(([muscle, exs]) => (
                    <div key={muscle} style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          color: 'var(--text-muted)',
                          marginBottom: 6,
                        }}
                      >
                        {muscle.toUpperCase()}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        {exs.map((ex) => {
                          const isSel = selected.includes(ex.id);
                          const isAnchor = selected[0] === ex.id;
                          return (
                            <button
                              key={ex.id}
                              onClick={() => toggleExercise(dayIdx, ex.id)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: tokens.radius.md,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: isSel ? 700 : 500,
                                background: isAnchor
                                  ? accent + '33'
                                  : isSel
                                    ? 'rgba(var(--accent-rgb),0.1)'
                                    : 'var(--bg-surface)',
                                border: `1px solid ${isAnchor ? accent : isSel ? 'rgba(var(--accent-rgb),0.4)' : 'var(--border)'}`,
                                color: isAnchor
                                  ? accent
                                  : isSel
                                    ? 'var(--text-primary)'
                                    : 'var(--text-muted)',
                                transition: 'all 0.12s',
                              }}
                            >
                              {isAnchor ? (
                                <HammerIcon size={13} style={{ marginRight: 3 }} />
                              ) : (
                                ''
                              )}
                              {ex.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}

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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: 10,
        }}
      >
        <button
          onClick={() => {
            setManualExStep(false);
            window.scrollTo(0, 0);
          }}
          className="btn-ghost"
          style={{
            padding: '18px',
            borderRadius: tokens.radius.md,
            cursor: 'pointer',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          ‹ Back
        </button>
        <button
          onClick={() => {
            setError('');
            if (!allDaysValid) {
              setError('Each day needs at least 3 exercises selected.');
              return;
            }
            setManualPairStep(true);
            window.scrollTo(0, 0);
          }}
          className="btn-primary"
          style={{
            padding: '18px',
            borderRadius: tokens.radius.md,
            cursor: 'pointer',
            background: 'var(--btn-primary-bg)',
            border: '1px solid var(--btn-primary-border)',
            color: 'var(--btn-primary-text)',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '0.04em',
            boxShadow: '0 4px 24px rgba(var(--accent-rgb),0.3)',
            opacity: allDaysValid ? 1 : 0.5,
          }}
        >
          Start Training →
        </button>
      </div>
    </div>
  );
}
