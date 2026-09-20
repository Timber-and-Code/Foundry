import React, { useEffect, useRef, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { store, isEduEmail } from '../../utils/store';
import FoundryBanner from '../shared/FoundryBanner';
import AutoBuilderFlow from './AutoBuilderFlow';
import type { CoachOutcome } from './ProgramReview';
import ManualBuilderFlow from './ManualBuilderFlow';
import CardioSetupFlow from './CardioSetupFlow';
import Beat1Essentials, { type Beat1Values } from './Beat1Essentials';
import Beat2Preview, { type Beat2Saved } from './Beat2Preview';
import ProgramReady from './ProgramReady';
import ProgramReview from './ProgramReview';
import { generateProgram } from '../../utils/program';
import { getExerciseDB } from '../../data/exerciseDB';
import { getTrainedExerciseIds } from '../../utils/trainingHistory';
import { trainedIdsIncludingCurrent } from '../../utils/nextMeso';
import { loadProfile } from '../../utils/store';
import { loadSetupSession, saveSetupSession, clearSetupSession } from '../../utils/setupSession';
import { emit } from '../../utils/events';
import type { Profile, TrainingDay } from '../../types';

/**
 * foundry:setup_v2 flag — default ON for fresh users, OFF when carrying
 * a meso forward or when an archive already exists. Explicit opt-in/out
 * via the 1/0 values overrides the auto-default.
 */
function shouldUseSetupV2(): boolean {
  const explicit = store.get('foundry:setup_v2');
  if (explicit === '1') return true;
  if (explicit === '0') return false;
  try {
    const transition = JSON.parse(store.get('foundry:meso_transition') || 'null');
    if (transition && transition.profile) return false;
  } catch { /* meso_transition parse fallback */ }
  try {
    const archive = JSON.parse(store.get('foundry:archive') || '[]');
    if (Array.isArray(archive) && archive.length > 0) return false;
  } catch { /* archive parse fallback */ }
  return true;
}

type V2Step = 'beat1' | 'beat2' | 'ready';

interface SetupPageProps {
  onComplete: (profile: Profile) => void;
  /**
   * 'plan-next' builds the NEXT meso while the current one is still in its
   * deload. Same builders, but the result is saved as a draft by the caller
   * and nothing live changes — so it always takes the returning-lifter path
   * and can be backed out of.
   *
   * 'after-meso' is the same flow from the end-of-meso sheet: the finished
   * meso stays live (and its summary viewable) until the result is started,
   * which the caller does straight away.
   */
  mode?: 'new' | 'plan-next' | 'after-meso';
  /** Leave without building. Shown as Back on the first screen. */
  onCancel?: () => void;
}

export default function SetupPage({ onComplete: onCompleteProp, mode = 'new', onCancel: onCancelProp }: SetupPageProps) {
  // Progress saved from an earlier visit — iOS reloads a backgrounded web
  // view, which used to throw the whole build away. See utils/setupSession.
  const [restored] = useState(() => loadSetupSession(mode)?.state ?? null);
  const r = <T,>(key: string, fallback: T): T =>
    restored && restored[key] !== undefined && restored[key] !== null ? (restored[key] as T) : fallback;
  const onComplete = (p: Profile) => {
    clearSetupSession();
    onCompleteProp(p);
  };
  const onCancel = onCancelProp
    ? () => {
        clearSetupSession();
        onCancelProp();
      }
    : undefined;
  // Both non-'new' modes build on top of a meso that is still live.
  const planningNext = mode !== 'new';
  const startsNow = mode === 'after-meso';
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
  const [pathMode, setPathMode] = useState<string | null>(() => r<string | null>('pathMode', null));
  const [manualExStep, setManualExStep] = useState(() => r('manualExStep', false));
  const [manualPairStep, setManualPairStep] = useState(() => r('manualPairStep', false));
  const [dayExercises, setDayExercises] = useState<Record<number, string[]>>(() => r('dayExercises', {}));
  const [dayPairs, setDayPairs] = useState<Record<number, [number, number][]>>(() => r('dayPairs', {}));
  const [cardioDays, setCardioDays] = useState<Set<number>>(() => new Set(r<number[]>('cardioDays', [])));
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => {
    if (restored?.form) return restored.form as never;
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
    let current: Partial<Profile> = {};
    try {
      current = JSON.parse(store.get('foundry:profile') || '{}');
    } catch { /* JSON parse fallback */ }
    return {
      // The manual builder spreads this form into the profile, and
      // validateProfile REJECTS one without experience — the app then reads
      // "no profile" and drops the lifter on the empty shell. Onboarding sets
      // it for a first meso; a returning lifter's form never had it.
      experience:
        // The live profile first: the builder can change experience, and the
        // onboarding answer would otherwise win it back on the next meso.
        current.experience || (saved.experience as string) || tp?.experience || 'intermediate',
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
  const [showCardioStep, setShowCardioStep] = useState(() => r('showCardioStep', false));
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(() => r<Profile | null>('pendingProfile', null));
  // Every meso is reviewed day by day before it exists — see ProgramReview.
  const [review, setReview] = useState<{ profile: Profile; program: TrainingDay[]; coach?: CoachOutcome } | null>(() => r('review', null));

  // The frame's scroller (the window no longer scrolls) and the pinned
  // footer slot. Step changes call window.scrollTo(0, 0) all over this flow;
  // this is what actually returns the new step to the top now.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [footerSlot, setFooterSlot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo?.(0, 0);
  }, [pathMode, manualExStep, manualPairStep]);

  // Auto-builder specific state
  const [autoForm, setAutoForm] = useState(() => {
    if (restored?.autoForm) return restored.autoForm as never;
    let saved: Record<string, unknown> = {};
    try {
      saved = JSON.parse(store.get('foundry:onboarding_data') || '{}');
    } catch { /* JSON parse fallback */ }
    return {
      experience: (loadProfile()?.experience || (saved.experience as string) || null) as string | null,
      split: null as string | null,
      daysPerWeek: null as number | null,
      mesoLength: null as number | null,
      equipment: [] as string[],
      startDate: todayStr,
    };
  });

  // ── Shared callbacks ─────────────────────────────────────────────────────
  const maybePromptCardio = (built: Profile) => {
    // How the coach pass went, for the review screen. Transient: it never
    // reaches the saved profile.
    const { coachError, ...rest } = built as Profile & { coachError?: string };
    const coach: CoachOutcome | undefined = coachError
      ? { status: 'failed', reason: coachError }
      : Array.isArray(rest.aiDays) && rest.aiDays.length > 0 && rest.autoBuilt
        ? { status: 'tuned', note: (rest as { aiCoachNote?: string }).aiCoachNote }
        : undefined;
    // Inject student verification + birthdate into profile
    const enriched = { ...rest } as Profile;
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
    // Generate ONCE (generateProgram shuffles) and review exactly that.
    // Anchor continuity reads the live meso too when building on top of one.
    const trainedIds = planningNext
      ? (() => {
          const live = loadProfile();
          return live ? trainedIdsIncludingCurrent(live) : getTrainedExerciseIds();
        })()
      : getTrainedExerciseIds();
    const program = generateProgram(enriched, getExerciseDB() as never, { trainedIds });
    if (!program.some((d) => d.exercises && d.exercises.length > 0)) {
      setError("Couldn't build the program — the exercise library hasn't loaded. Try again.");
      return;
    }
    setError('');
    setReview({ profile: enriched, program, coach });
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
      // step (IntakeCard lives outside SetupPage now) — except when the
      // caller can take us back out, e.g. planning the next meso.
      if (isPathSelect) {
        onCancel?.();
        return;
      }
      setPathMode(null);
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
          {(pathMode !== null || onCancel) && (
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
  // Phase 2 v2 state machine (Beat 1 → Beat 2 → ProgramReady)
  // ════════════════════════════════════════════════════════
  const [setupV2] = useState<boolean>(() => !planningNext && shouldUseSetupV2());
  const [v2Step, setV2Step] = useState<V2Step>(() => r<V2Step>('v2Step', 'beat1'));
  const [beat1Values, setBeat1Values] = useState<Beat1Values | null>(() => r<Beat1Values | null>('beat1Values', null));
  const [v2Profile, setV2Profile] = useState<Profile | null>(() => r<Profile | null>('v2Profile', null));
  const beat2Saved = useRef<Beat2Saved | null>(r<Beat2Saved | null>('beat2', null));

  // Save as the lifter goes. Cheap (a few KB) and only while setup is open.
  const persist = () =>
    saveSetupSession(mode, {
      pathMode, manualExStep, manualPairStep, dayExercises, dayPairs,
      cardioDays: [...cardioDays], form, autoForm, review, pendingProfile, showCardioStep,
      v2Step, beat1Values, v2Profile, beat2: beat2Saved.current,
    });
  useEffect(persist, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    mode, pathMode, manualExStep, manualPairStep, dayExercises, dayPairs, cardioDays, form, autoForm,
    review, pendingProfile, showCardioStep, v2Step, beat1Values, v2Profile,
  ]);

  const announced = useRef(false);
  useEffect(() => {
    if (announced.current || !restored) return;
    announced.current = true;
    const hasProgress = restored.pathMode != null || restored.review || restored.showCardioStep || (restored.v2Step && restored.v2Step !== 'beat1');
    if (hasProgress) emit('foundry:toast', { message: 'Picked up where you left off.', type: 'success' });
  }, [restored]);

  if (setupV2) {
    if (v2Step === 'beat1') {
      return (
        <Beat1Essentials
          onContinue={(values) => {
            setBeat1Values(values);
            setV2Step('beat2');
            window.scrollTo(0, 0);
          }}
        />
      );
    }
    if (v2Step === 'beat2' && beat1Values) {
      return (
        <Beat2Preview
          beat1={beat1Values}
          saved={beat2Saved.current}
          onPersist={(b) => {
            beat2Saved.current = b;
            persist();
          }}
          onSave={(p) => {
            setV2Profile(p);
            setV2Step('ready');
            window.scrollTo(0, 0);
          }}
          onEditEssentials={() => {
            beat2Saved.current = null;
            setV2Step('beat1');
            window.scrollTo(0, 0);
          }}
        />
      );
    }
    if (v2Step === 'ready' && v2Profile) {
      return (
        <ProgramReady
          profile={{
            name: v2Profile.name,
            mesoLength: v2Profile.mesoLength,
            splitType: v2Profile.splitType,
            startDate: v2Profile.startDate,
          }}
          onContinue={() => onComplete(v2Profile)}
        />
      );
    }
    // v2 fell out of a valid state — drop to the legacy render. Shouldn't
    // happen in normal flow; guards against stale branch state.
  }

  if (review) {
    return (
      <ProgramReview
        program={review.program}
        coach={review.coach}
        onEdit={(program) => setReview((cur) => (cur ? { ...cur, program } : cur))}
        userEquipment={Array.isArray(review.profile.equipment) ? review.profile.equipment : undefined}
        subtitle={startsNow ? 'NEXT MESO' : planningNext ? 'PLAN NEXT MESO' : 'MESOCYCLE SETUP'}
        onBack={() => {
          setReview(null);
          window.scrollTo(0, 0);
        }}
        onConfirm={(program) => {
          // Pinned as aiDays: generateProgram returns it verbatim, so every
          // later build of this meso is the program just approved.
          setPendingProfile({ ...review.profile, aiDays: program });
          setReview(null);
          setShowCardioStep(true);
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  // ════════════════════════════════════════════════════════
  // RENDER (legacy path — v2 flag OFF)
  // ════════════════════════════════════════════════════════
  return (
    <>
      <div
        className="fd-setup-frame"
        style={{
          background: 'var(--bg-root)',
          display: 'flex',
          flexDirection: 'column',
          // Phones: the 480 column. Regular+: banner full-bleed, questions
          // in a form column below.
          maxWidth: 'var(--shell-max)',
          margin: '0 auto',
        }}
      >
        {/* Foundry Banner */}
        {/* flex: none — the banner clips its overflow, so as a flex child it
            would otherwise be squashed to make room for the scroller. */}
        <div style={{ flex: 'none' }}>
          <FoundryBanner subtitle={startsNow ? 'NEXT MESO' : planningNext ? 'PLAN NEXT MESO' : 'MESOCYCLE SETUP'} />
        </div>
        {/* Everything between the banner and the builder's footer scrolls
            here — see .fd-setup-frame. */}
        <div ref={scrollRef} className="fd-setup-scroll">
        {/* Meso 2+ continuation banner */}
        <div className="fd-form">
        {(() => {
          let t = null;
          try {
            t = JSON.parse(store.get('foundry:meso_transition') || 'null');
          } catch { /* JSON parse fallback */ }
          if (!t && !planningNext) return null;
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
                  {startsNow
                    ? 'BUILDING YOUR NEXT MESO'
                    : planningNext
                      ? 'PLANNING YOUR NEXT MESO'
                      : 'MESO 2 — CONTINUING YOUR PROGRESS'}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  {startsNow
                    ? 'Your finished meso stays on record until you start this one. Back out any time.'
                    : planningNext
                    ? "This meso's settings are pre-loaded. Nothing changes until you start the new one — finish your deload, or tap Start now on Home."
                    : 'Your previous settings are pre-loaded. Change anything you want, then build.'}
                </div>
              </div>
            </div>
          );
        })()}
        </div>

        {/* Content */}
        <div className="fd-form">
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
              planningNext={planningNext}
              footerSlot={footerSlot}
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
              planningNext={planningNext}
            />
          )}
        </div>
        </div>
        {/* Pinned under the scroller; the Quick Build footer portals in. */}
        <div ref={setFooterSlot} className="fd-form" style={{ flex: 'none' }} />
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
          planningNext={planningNext}
          startsNow={startsNow}
        />
      )}
    </>
  );
}
