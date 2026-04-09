import React, { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { store, ageFromDob, isEduEmail } from '../../utils/store';
import { supabase } from '../../utils/supabase';
import FoundryBanner from '../shared/FoundryBanner';
import AutoBuilderFlow from './AutoBuilderFlow';
import ManualBuilderFlow from './ManualBuilderFlow';
import CardioSetupFlow from './CardioSetupFlow';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import type { Profile } from '../../types';

interface SetupPageProps {
  onComplete: (profile: Profile) => void;
}

export default function SetupPage({ onComplete }: SetupPageProps) {
  const { signup, user } = useAuth();
  const { showToast } = useToast();
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

  const [step, setStep] = useState(1);
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
      gender: tp?.gender || '',
      weight: tp?.weight || '' as string | number,
      goal: savedGoal || tp?.goal || '',
      goalNote: '' as string,
      email: '',
      password: '',
      mesoLength: tp?.mesoLength || 6,
      sessionDuration: tp?.sessionDuration || 60,
      equipment: (tp?.equipment || []) as string[],
      theme: localStorage.getItem('foundry:theme') || 'dark',
      startDate: todayStr,
      splitType: tp?.splitType || 'ppl',
      workoutDays: (tp?.workoutDays || [1, 2, 3, 4, 5, 6]) as number[],
      daysPerWeek: tp?.daysPerWeek || 6,
    };
  });
  const [setupDob, setSetupDob] = useState<{ month: string; day: string; year: string }>(() => {
    let saved: Record<string, unknown> = {};
    try {
      saved = JSON.parse(store.get('foundry:onboarding_data') || '{}');
    } catch { /* JSON parse fallback */ }
    const savedDob = saved.dob as { month?: string; day?: string; year?: string } | undefined;
    if (savedDob && savedDob.month) {
      return {
        month: savedDob.month || '',
        day: savedDob.day || '',
        year: savedDob.year || '',
      };
    }
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
  const SETUP_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Student verification state
  const [isStudent, setIsStudent] = useState(() => {
    try {
      const p = JSON.parse(store.get('foundry:profile') || '{}');
      return !!p.isStudent;
    } catch { return false; }
  });
  const [studentEmail, setStudentEmail] = useState(() => {
    try {
      const p = JSON.parse(store.get('foundry:profile') || '{}');
      return (p.studentEmail as string) || '';
    } catch { return ''; }
  });
  const [studentEmailError, setStudentEmailError] = useState('');

  const [aiLoading, setAiLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
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

  const goNext = async () => {
    setError('');
    if (step === 1) {
      if (!form.name.trim()) {
        setError('Please enter your name.');
        return;
      }
      // Gender is optional — no validation needed
      // DOB required (all three fields) — needed for free-tier age qualification.
      if (!setupDob.month || !setupDob.day || !setupDob.year) {
        setError('Please enter your full date of birth.');
        return;
      }
      // Email + password gate — create the account here so the meso the user
      // is about to build is tied to a persistent Supabase account from the
      // first set. Skipped entirely if the user is already signed in (e.g.
      // returning via the Sign in link on Pick Your Path).
      if (!user) {
        const email = form.email.trim();
        const password = form.password;
        if (!email || !email.includes('@')) {
          setError('Please enter a valid email address.');
          return;
        }
        if (!password || password.length < 6) {
          setError('Password must be at least 6 characters.');
          return;
        }
        setSignupLoading(true);
        try {
          const { error: signupError } = await signup(email, password);
          if (signupError) {
            setSignupLoading(false);
            const msg = (signupError.message || '').toLowerCase();
            if (msg.includes('already registered') || msg.includes('already exists')) {
              setError(
                'You already have an account with this email. Tap "Sign in instead" below to log in, or "Forgot password?" to reset it.'
              );
            } else {
              setError(signupError.message || 'Sign up failed. Please try again.');
            }
            return;
          }
          showToast('Account created — check your email to confirm', 'success');
        } catch (e) {
          setSignupLoading(false);
          const err = e as Error;
          setError(err.message || 'Sign up failed. Please try again.');
          return;
        }
        setSignupLoading(false);
      }
      setPathMode(null);
    }
    setStep(2);
    window.scrollTo(0, 0);
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
    const isPathSelect = step === 2 && pathMode === null;
    const isAutoInputs = step === 2 && pathMode === 'auto';
    const progressPct = step === 1 ? '33%' : isPathSelect ? '55%' : '100%';
    const title =
      step === 1
        ? 'About You'
        : isPathSelect
          ? 'Build Mode'
          : isAutoInputs
            ? 'Quick Build'
            : 'Your Program';
    const subtitle =
      step === 1
        ? 'Step 1 of 2'
        : isPathSelect
          ? 'Step 2 of 2'
          : isAutoInputs
            ? 'Foundry Auto-Build'
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
      if (isAutoInputs || isPathSelect) {
        if (isAutoInputs) setPathMode(null);
        else {
          setStep(1);
          setPathMode(null);
        }
        window.scrollTo(0, 0);
      } else {
        setStep(1);
        window.scrollTo(0, 0);
      }
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
          {step === 2 && (
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

          {/* ─── STEP 1 ─── */}
          {step === 1 && (
            <div style={{ padding: '24px 20px 40px' }}>
              {/* Name */}
              <div style={sec}>
                <label style={sLabel}>Your name *</label>
                <input
                  type="text"
                  placeholder="First name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  style={inputStyle}
                  autoFocus
                />
              </div>

              {/* Gender */}
              <div style={sec}>
                <label style={sLabel}>Gender</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  {[
                    ['m', 'Male'],
                    ['f', 'Female'],
                    ['nb', 'Other'],
                  ].map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set('gender', val)}
                      style={{
                        padding: '16px',
                        borderRadius: tokens.radius.md,
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: '0.03em',
                        background:
                          form.gender === val ? 'rgba(var(--accent-rgb),0.14)' : 'var(--bg-card)',
                        border: `1px solid ${form.gender === val ? 'var(--accent)' : 'var(--border)'}`,
                        color: form.gender === val ? 'var(--accent)' : 'var(--text-primary)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date of Birth + Weight */}
              <div style={{ ...sec }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={sLabel}>Date of Birth</label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1.5fr',
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    {/* Month */}
                    <select
                      value={setupDob.month}
                      onChange={(e) => setSetupDob((d) => ({ ...d, month: e.target.value }))}
                      style={{
                        ...inputStyle,
                        marginTop: 0,
                        padding: '14px 10px',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 10px center',
                        paddingRight: 28,
                      }}
                    >
                      <option value="">Month</option>
                      {SETUP_MONTHS.map((m, i) => (
                        <option key={i} value={String(i + 1)}>
                          {m}
                        </option>
                      ))}
                    </select>
                    {/* Day */}
                    <select
                      value={setupDob.day}
                      onChange={(e) => setSetupDob((d) => ({ ...d, day: e.target.value }))}
                      style={{
                        ...inputStyle,
                        marginTop: 0,
                        padding: '14px 10px',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 10px center',
                        paddingRight: 28,
                      }}
                    >
                      <option value="">Day</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={String(d)}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {/* Year */}
                    <select
                      value={setupDob.year}
                      onChange={(e) => setSetupDob((d) => ({ ...d, year: e.target.value }))}
                      style={{
                        ...inputStyle,
                        marginTop: 0,
                        padding: '14px 10px',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 10px center',
                        paddingRight: 28,
                      }}
                    >
                      <option value="">Year</option>
                      {Array.from(
                        { length: new Date().getFullYear() - 1929 },
                        (_, i) => new Date().getFullYear() - i
                      ).map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Free tier callout */}
                  {(() => {
                    const age = ageFromDob(setupDob);
                    if (age === null) return null;
                    const isYoung = age < 18,
                      isSenior = age >= 62;
                    if (!isYoung && !isSenior) return null;
                    return (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '10px 12px',
                          borderRadius: tokens.radius.md,
                          background: 'var(--phase-accum)12',
                          border: '1px solid var(--phase-accum)44',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--phase-accum)',
                            fontWeight: 600,
                            lineHeight: 1.4,
                          }}
                        >
                          {isYoung
                            ? 'The Foundry is permanently free for users under 18.'
                            : 'The Foundry is permanently free for adults 62 and over.'}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Student verification */}
                  {(() => {
                    const age = ageFromDob(setupDob);
                    // Don't show student toggle if already qualifying via age
                    if (age !== null && (age < 18 || age >= 62)) return null;
                    return (
                      <div style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsStudent(!isStudent);
                            if (isStudent) { setStudentEmail(''); setStudentEmailError(''); }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            width: '100%',
                          }}
                        >
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: tokens.radius.sm,
                              border: `2px solid ${isStudent ? 'var(--phase-accum)' : 'var(--border)'}`,
                              background: isStudent ? 'var(--phase-accum)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s',
                            }}
                          >
                            {isStudent && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                            I'm a student
                          </span>
                        </button>

                        {isStudent && (
                          <div style={{ marginTop: 10 }}>
                            <input
                              type="email"
                              inputMode="email"
                              placeholder="your.name@school.edu"
                              value={studentEmail}
                              onChange={(e) => {
                                setStudentEmail(e.target.value);
                                setStudentEmailError('');
                              }}
                              onBlur={() => {
                                if (studentEmail.trim() && !isEduEmail(studentEmail)) {
                                  setStudentEmailError('Enter a valid .edu email address');
                                }
                              }}
                              style={{
                                ...inputStyle,
                                borderColor: studentEmailError ? '#e05252' : undefined,
                              }}
                            />
                            {studentEmailError && (
                              <div style={{ fontSize: 11, color: '#e05252', marginTop: 4 }}>
                                {studentEmailError}
                              </div>
                            )}
                            {studentEmail.trim() && isEduEmail(studentEmail) && (
                              <div
                                style={{
                                  marginTop: 8,
                                  padding: '10px 12px',
                                  borderRadius: tokens.radius.md,
                                  background: 'var(--phase-accum)12',
                                  border: '1px solid var(--phase-accum)44',
                                }}
                              >
                                <span style={{ fontSize: 12, color: 'var(--phase-accum)', fontWeight: 600, lineHeight: 1.4 }}>
                                  The Foundry is free for students. Welcome aboard.
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label style={sLabel}>Weight (lbs)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g. 185"
                    value={form.weight}
                    onChange={(e) => set('weight', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Save your progress — email + password signup (required) */}
              <div style={sec}>
                <label style={sLabel}>Save your progress *</label>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    marginTop: 4,
                    marginBottom: 10,
                  }}
                >
                  Create your free Foundry account to sync your meso across
                  devices and keep your work safe.
                </div>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Password (at least 6 characters)"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  style={{ ...inputStyle, marginTop: 10 }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      const email = form.email.trim();
                      if (!email || !email.includes('@')) {
                        setError('Enter your email address first.');
                        return;
                      }
                      setError('');
                      try {
                        const { error: resetErr } =
                          await supabase.auth.resetPasswordForEmail(email);
                        if (resetErr) {
                          setError(resetErr.message);
                        } else {
                          showToast('Password reset email sent', 'success');
                        }
                      } catch {
                        setError('Could not send reset email. Try again.');
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                    }}
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      store.set('foundry:wants_auth', '1');
                      window.dispatchEvent(new Event('foundry:wants_auth'));
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: tokens.colors.accent,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                    }}
                  >
                    Sign in instead
                  </button>
                </div>
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
                onClick={goNext}
                disabled={signupLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '20px',
                  borderRadius: tokens.radius.md,
                  cursor: signupLoading ? 'not-allowed' : 'pointer',
                  background: 'var(--btn-primary-bg)',
                  border: '1px solid var(--btn-primary-border)',
                  color: 'var(--btn-primary-text)',
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  boxShadow: '0 4px 24px rgba(var(--accent-rgb),0.3)',
                  opacity: signupLoading ? 0.7 : 1,
                }}
              >
                {signupLoading ? 'Creating account…' : 'Continue →'}
              </button>
            </div>
          )}

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
