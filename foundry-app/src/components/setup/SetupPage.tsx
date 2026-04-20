import React, { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { store, isEduEmail } from '../../utils/store';
import FoundryBanner from '../shared/FoundryBanner';
import AutoBuilderFlow from './AutoBuilderFlow';
import ManualBuilderFlow from './ManualBuilderFlow';
import CardioSetupFlow from './CardioSetupFlow';
import type { Profile } from '../../types';

interface SetupPageProps {
  onComplete: (profile: Profile) => void;
}

export default function SetupPage({ onComplete }: SetupPageProps) {
  const SPLIT_CONFIG = {
    ppl: {
      label: 'Push · Pull · Legs',
      validDays: [3, 5, 6],
      defaultDays: { 3: [1, 3, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] } as Record<number, number[]>,
      desc: 'Each muscle group hit 1–2×/week. The gold standard for hypertrophy and strength.',
    },
    upper_lower: {
      label: 'Upper / Lower',
      validDays: [2, 4],
      defaultDays: { 2: [1, 4], 4: [1, 2, 4, 5] } as Record<number, number[]>,
      desc: 'Upper body + lower body rotation. 2 sessions per muscle group. Great recovery balance.',
    },
    full_body: {
      label: 'Full Body',
      validDays: [2, 3, 4, 5],
      defaultDays: {
        2: [1, 4],
        3: [1, 3, 5],
        4: [1, 2, 4, 5],
        5: [1, 2, 3, 4, 5],
      } as Record<number, number[]>,
      desc: 'Push, pull, and legs every session. High frequency, great for beginners and busy schedules.',
    },
    push_pull: {
      label: 'Push / Pull',
      validDays: [4],
      defaultDays: { 4: [1, 2, 4, 5] } as Record<number, number[]>,
      desc: '4-day push/pull with legs folded in. No dedicated leg day.',
    },
  };
  const splitsForDays = (n: number) =>
    Object.entries(SPLIT_CONFIG)
      .filter(([, c]) => c.validDays.includes(n))
      .map(([k]) => k);
  // DAY_NAMES — was used by removed SchedulePreview
  const todayStr = new Date().toISOString().split('T')[0];

  // Onboarding v2: IntakeCard now collects name/gender/experience/goal
  // before SetupPage mounts, so Step 1 ("About You") is dropped and we
  // land users directly on path choice. DOB + student + weight are
  // captured later (signup + BW weekly prompt respectively).
  // `step` stays as a constant for the few remaining `step === 2` guards
  // until the surrounding render tree is simplified further.
  const [step] = useState(2);
  const [pathMode, setPathMode] = useState<string | null>(null);
  const [manualExStep, setManualExStep] = useState(false);
  const [manualPairStep, setManualPairStep] = useState(false);
  const [dayExercises, setDayExercises] = useState<Record<number, string[]>>({});
  const [dayPairs, setDayPairs] = useState<Record<number, [number, number][]>>({});
  const [cardioDays, setCardioDays] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => {
    let saved: Record<string, unknown> = {};
    try {
      saved = JSON.parse(store.get('foundry:onboarding_data') || '{}');
    } catch { /* JSON parse fallback */ }
    const savedGoal = store.get('foundry:onboarding_goal') || '';
    let transition: { profile?: Partial<Profile> } | null = null;
    try {
      transition = JSON.parse(store.get('foundry:meso_transition') || 'null');
    } catch { /* JSON parse fallback */ }
    const tp = transition?.profile || null;
    return {
      name: (saved.name as string) || tp?.name || '',
      age: saved.age ? String(saved.age) : tp?.age ? String(tp.age) : '',
      gender: (saved.gender as string) || tp?.gender || '',
      weight: tp?.weight || '' as string | number,
      goal: savedGoal || tp?.goal || '',
      goalNote: '' as string,
      email: '',
      password: '',
      mesoLength: tp?.mesoLength || 6,
      sessionDuration: tp?.sessionDuration || 60,
      equipment: (tp?.equipment || []) as string[],
      theme: store.get('foundry:theme') || 'dark',
      startDate: todayStr,
      splitType: tp?.splitType || 'ppl',
      workoutDays: (tp?.workoutDays || [1, 2, 3, 4, 5, 6]) as number[],
      daysPerWeek: tp?.daysPerWeek || 6,
    };
  });
  // Onboarding v2: DOB + student status captured at signup
  // (SaveProgressSheet), not in SetupPage. These state handles exist only
  // to feed AutoBuilderFlow and the profile enrichment below — their
  // setters are no longer called from within SetupPage.
  const [setupDob] = useState<{ month: string; day: string; year: string }>(() => {
    try {
      const profile = JSON.parse(store.get('foundry:profile') || '{}');
      if (profile.birthdate) {
        const parts = profile.birthdate.split('-');
        if (parts.length === 3) {
          return {
            year: parts[0],
            month: String(parseInt(parts[1])),
            day: String(parseInt(parts[2])),
          };
        }
      }
    } catch { /* JSON parse fallback */ }
    return { month: '', day: '', year: '' };
  });

  const [isStudent] = useState(() => {
    try {
      const p = JSON.parse(store.get('foundry:profile') || '{}');
      return !!p.isStudent;
    } catch { return false; }
  });
  const [studentEmail] = useState(() => {
    try {
      const p = JSON.parse(store.get('foundry:profile') || '{}');
      return (p.studentEmail as string) || '';
    } catch { return ''; }
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [, setAiCoachNote] = useState('');
  const [legBalancePrompt, setLegBalancePrompt] = useState<Profile | null>(null);
  const [showCardioStep, setShowCardioStep] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);

  // Auto-builder specific state
  const [autoForm, setAutoForm] = useState(() => {
    let saved: Record<string, unknown> = {};
    try {
      saved = JSON.parse(store.get('foundry:onboarding_data') || '{}');
    } catch { /* JSON parse fallback */ }
    return {
      experience: (saved.experience as string) || null as string | null,
      split: null as string | null,
      daysPerWeek: null as number | null,
      mesoLength: null as number | null,
      equipment: [] as string[],
      startDate: todayStr,
    };
  });

  // ── Shared callbacks ─────────────────────────────────────────────────────
  const maybePromptCardio = (built: Profile) => {
    // Inject student verification + birthdate into profile
    const enriched = { ...built };
    if (isStudent && studentEmail && isEduEmail(studentEmail)) {
      enriched.isStudent = true;
      enriched.studentEmail = studentEmail.trim().toLowerCase();
      enriched.studentVerifiedAt = new Date().toISOString();
    }
    if (setupDob.year && setupDob.month && setupDob.day) {
      const m = String(setupDob.month).padStart(2, '0');
      const d = String(setupDob.day).padStart(2, '0');
      enriched.birthdate = `${setupDob.year}-${m}-${d}`;
    }
    setPendingProfile(enriched);
    setShowCardioStep(true);
    window.scrollTo(0, 0);
  };
  const maybePromptLegBalance = (built: Profile) => {
    if (built.splitType === 'ppl' && (built.daysPerWeek === 5 || built.workoutDays?.length === 5)) {
      setLegBalancePrompt(built);
    } else {
      maybePromptCardio(built);
    }
  };

  const setAuto = (k: string, v: string | number | string[] | null) => setAutoForm((f) => ({ ...f, [k]: v }));
  const toggleAutoEquip = (item: string) => {
    setAutoForm((f) => {
      const has = f.equipment.includes(item);
      if (has && f.equipment.length === 1) return f;
      return {
        ...f,
        equipment: has ? f.equipment.filter((e) => e !== item) : [...f.equipment, item],
      };
    });
  };

  const set = (k: string, v: string | number | string[] | number[]) => setForm((f) => ({ ...f, [k]: v }));

  const setSplit = (split: string) => {
    const cfg = (SPLIT_CONFIG as Record<string, { label: string; validDays: number[]; defaultDays: Record<number, number[]>; desc: string }>)[split];
    const best = cfg.validDays[cfg.validDays.length - 1];
    setForm((f) => ({
      ...f,
      splitType: split,
      workoutDays: cfg.defaultDays[best],
      daysPerWeek: best,
    }));
  };

  const setDayCount = (n: number) => {
    const compatible = splitsForDays(n);
    const split = compatible.includes(form.splitType)
      ? form.splitType
      : compatible[0] || form.splitType;
    const cfg = (SPLIT_CONFIG as Record<string, { label: string; validDays: number[]; defaultDays: Record<number, number[]>; desc: string }>)[split];
    const days = cfg?.defaultDays[n] || form.workoutDays;
    setForm((f) => ({
      ...f,
      daysPerWeek: n,
      workoutDays: days,
      splitType: split,
    }));
  };

  const toggleEquipment = (item: string) => {
    setForm((f) => {
      const has = f.equipment.includes(item);
      if (has && f.equipment.length === 1) return f;
      return {
        ...f,
        equipment: has ? f.equipment.filter((e) => e !== item) : [...f.equipment, item],
      };
    });
  };

  const toggleDay = (dayNum: number) => {
    setForm((f) => {
      const has = f.workoutDays.includes(dayNum);
      if (has && f.workoutDays.length === 1) return f;
      const next = has
        ? f.workoutDays.filter((d) => d !== dayNum)
        : [...f.workoutDays, dayNum].sort((a, b) => a - b);
      return { ...f, workoutDays: next, daysPerWeek: next.length };
    });
  };


  // ── Shared style atoms ─────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-accent)',
    borderRadius: tokens.radius.md,
    color: 'var(--text-primary)',
    fontSize: 16,
    padding: '16px',
    outline: 'none',
    fontFamily: 'inherit',
    marginTop: 8,
    boxSizing: 'border-box',
  };
  const sLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: 'var(--phase-intens)',
    display: 'block',
    marginBottom: 0,
  };
  const sec: React.CSSProperties = { marginBottom: 24 };

  // ── Meso end date ─────────────────────────────────────────────────────
  const mesoEnd = (() => {
    if (!form.startDate) return null;
    const s = new Date(form.startDate + 'T00:00:00');
    const e = new Date(s.getTime() + form.mesoLength * 7 * 86400000 - 86400000);
    return e.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  })();

  // sessionSeq, tagColor, SchedulePreview — removed, available in git history

  // ── Progress header ────────────────────────────────────────────────────
  const Header = () => {
    const isPathSelect = pathMode === null;
    const isAutoInputs = pathMode === 'auto';
    // Progress bar now only reflects Step 2 + child flow progression; Step 1
    // was removed with the IntakeCard consolidation.
    const progressPct = isPathSelect ? '50%' : '100%';
    const title = isPathSelect
      ? 'Build Mode'
      : isAutoInputs
        ? 'Quick Build'
        : 'Your Program';
    const subtitle = isPathSelect
      ? 'Pick your path'
      : isAutoInputs
        ? 'The Foundry Auto-Build'
        : 'Manual Setup';

    const handleBack = () => {
      setError('');
      if (manualPairStep) {
        setManualPairStep(false);
        window.scrollTo(0, 0);
        return;
      }
      if (manualExStep) {
        setManualExStep(false);
        window.scrollTo(0, 0);
        return;
      }
      // From any inner flow, back → path select. Path select has no earlier
      // step (IntakeCard lives outside SetupPage now).
      if (isAutoInputs) setPathMode(null);
      window.scrollTo(0, 0);
    };

    return (
      <div style={{ padding: '20px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: 'var(--phase-intens)',
              }}
            >
              {subtitle}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: 4,
                letterSpacing: '0.01em',
              }}
            >
              {title}
            </div>
          </div>
          {pathMode !== null && (
            <button
              onClick={handleBack}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.md,
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.02em',
              }}
            >
              ‹ Back
            </button>
          )}
        </div>
        <div
          style={{
            height: 3,
            background: 'var(--bg-surface)',
            borderRadius: tokens.radius.pill,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: tokens.radius.pill,
              background: 'var(--accent)',
              width: progressPct,
              transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════
  return (
    <>
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-root)',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        {/* Foundry Banner */}
        <FoundryBanner subtitle="MESOCYCLE SETUP" />
        {/* Meso 2+ continuation banner */}
        {(() => {
          let t = null;
          try {
            t = JSON.parse(store.get('foundry:meso_transition') || 'null');
          } catch { /* JSON parse fallback */ }
          if (!t) return null;
          return (
            <div
              style={{
                margin: '12px 20px 0',
                padding: '10px 14px',
                background: 'var(--phase-accum)11',
                border: '1px solid var(--phase-accum)33',
                borderRadius: tokens.radius.lg,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: 'var(--phase-accum)',
                    marginBottom: 2,
                  }}
                >
                  MESO 2 — CONTINUING YOUR PROGRESS
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  Your previous settings are pre-loaded. Change anything you want, then build.
                </div>
              </div>
            </div>
          );
        })()}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Header />


          {/* ─── PATH SELECT ─── */}
          {step === 2 && pathMode === null && (
            <div style={{ padding: '24px 20px 40px' }}>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                Hey <strong style={{ color: 'var(--text-primary)' }}>{form.name}</strong> — how do
                you want to build your meso?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => {
                    setPathMode('auto');
                    window.scrollTo(0, 0);
                  }}
                  className="btn-card"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: tokens.radius.lg,
                    padding: '18px 20px',
                    transition: 'all 0.15s',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          letterSpacing: '0.03em',
                          color: 'var(--text-primary)',
                          marginBottom: 4,
                        }}
                      >
                        The Foundry builds my meso
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          lineHeight: 1.5,
                        }}
                      >
                        Answer 3 questions · The Foundry selects your exercises, sets, reps, and
                        progressions
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        padding: '3px 8px',
                        borderRadius: tokens.radius.sm,
                        background: 'rgba(var(--accent-rgb),0.15)',
                        color: 'var(--accent)',
                        flexShrink: 0,
                        marginLeft: 12,
                      }}
                    >
                      AUTO
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setPathMode('manual');
                    window.scrollTo(0, 0);
                  }}
                  className="btn-card"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: tokens.radius.lg,
                    padding: '18px 20px',
                    transition: 'all 0.15s',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          letterSpacing: '0.03em',
                          color: 'var(--text-primary)',
                          marginBottom: 4,
                        }}
                      >
                        I'll build my own meso
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          lineHeight: 1.5,
                        }}
                      >
                        Choose split, days, meso length · select target muscles per day
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        padding: '3px 8px',
                        borderRadius: tokens.radius.sm,
                        background: 'var(--bg-surface)',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                        marginLeft: 12,
                      }}
                    >
                      MANUAL
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ─── AUTO BUILDER INPUTS ─── */}
          {step === 2 && pathMode === 'auto' && (
            <AutoBuilderFlow
              form={{ ...form, name: String(form.name), weight: String(form.weight) }}
              setupDob={setupDob}
              autoForm={autoForm}
              aiLoading={aiLoading}
              error={error}
              sLabel={sLabel}
              sec={sec}
              inputStyle={inputStyle}
              setAuto={setAuto}
              toggleAutoEquip={toggleAutoEquip}
              setAiLoading={setAiLoading}
              setAiCoachNote={setAiCoachNote}
              setError={setError}
              maybePromptLegBalance={maybePromptLegBalance}
            />
          )}

          {/* ─── MANUAL BUILDER ─── */}
          {step === 2 && pathMode === 'manual' && (
            <ManualBuilderFlow
              form={{ ...form, name: String(form.name), weight: String(form.weight), sessionDuration: Number(form.sessionDuration) }}
              manualExStep={manualExStep}
              manualPairStep={manualPairStep}
              dayExercises={dayExercises}
              dayPairs={dayPairs}
              cardioDays={cardioDays}
              error={error}
              sLabel={sLabel}
              sec={sec}
              inputStyle={inputStyle}
              SPLIT_CONFIG={SPLIT_CONFIG}
              mesoEnd={mesoEnd}
              set={set}
              setSplit={setSplit}
              setDayCount={setDayCount}
              toggleEquipment={toggleEquipment}
              toggleDay={toggleDay}
              setManualExStep={setManualExStep}
              setManualPairStep={setManualPairStep}
              setDayExercises={setDayExercises}
              setDayPairs={setDayPairs}
              setCardioDays={setCardioDays}
              setError={setError}
              maybePromptCardio={maybePromptCardio}
            />
          )}
        </div>
      </div>

      {/* ── 5-Day PPL Leg Balance Prompt ── */}
      {legBalancePrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: tokens.colors.overlayMed,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.xxl,
              padding: 28,
              maxWidth: 360,
              width: '100%',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'var(--accent)',
                marginBottom: 10,
              }}
            >
              COACH NOTE
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 12,
                lineHeight: 1.35,
              }}
            >
              Your Push and Pull days are getting twice the weekly volume as Legs.
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--text-dim)',
                lineHeight: 1.55,
                marginBottom: 24,
              }}
            >
              Want to add a leg accessory block to Pull Day 2 to balance it out? Think leg press,
              hamstring curls, and calves — nothing crazy, just enough to close the gap.
            </div>
            <button
              onClick={() => {
                maybePromptCardio({ ...legBalancePrompt, pplLegBalance: true });
                setLegBalancePrompt(null);
              }}
              className="btn-primary"
              style={{
                width: '100%',
                marginBottom: 10,
                padding: '14px 0',
                fontSize: 15,
                fontWeight: 700,
                background: 'var(--btn-primary-bg)',
                border: '1px solid var(--btn-primary-border)',
                color: 'var(--btn-primary-text)',
                borderRadius: tokens.radius.lg,
              }}
            >
              Yes, balance it out
            </button>
            <button
              onClick={() => {
                maybePromptCardio({
                  ...legBalancePrompt,
                  pplLegBalance: false,
                });
                setLegBalancePrompt(null);
              }}
              style={{
                width: '100%',
                padding: '12px 0',
                fontSize: 14,
                fontWeight: 600,
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                color: 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              Keep as-is
            </button>
          </div>
        </div>
      )}

      {/* ── Cardio Plan Step ── */}
      {showCardioStep && (
        <CardioSetupFlow
          pendingProfile={pendingProfile}
          onComplete={onComplete}
        />
      )}
    </>
  );
}
