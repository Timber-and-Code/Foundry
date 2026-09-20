import { useEffect, useMemo, useRef, useState } from 'react';
import { tokens } from '../../styles/tokens';
import PhaseBar from '../shared/PhaseBar';
import { generateProgram } from '../../utils/program';
import { getTrainedExerciseIds } from '../../utils/trainingHistory';
import { getExerciseDB } from '../../data/exerciseDB';
import { store } from '../../utils/store';
import { callFoundryAI, CoachAuthRequiredError } from '../../utils/api';
import type { Beat1Values } from './Beat1Essentials';
import type { Profile, TrainingDay } from '../../types';
import { SplitBody, type SplitType } from './SplitSheet';
import { MesoLengthBody, type MesoLength } from './MesoLengthSheet';
import { SessionLengthBody, type SessionLength } from './SessionLengthSheet';
import AccordionBar from './AccordionBar';
import DayAccordion, { type DayBuild } from './DayAccordion';
import { formatSplitName } from '../../utils/splitLabel';
import { toDayBuilds, hydrateDayBuilds } from './dayBuilds';

/** What the preview needs to come back exactly as it was left. */
export interface Beat2Saved {
  split: SplitType;
  length: MesoLength;
  session: SessionLength;
  days: DayBuild[];
  source?: TrainingDay[];
  tuned: boolean;
}

interface Beat2Props {
  beat1: Beat1Values;
  /** Restored state from an interrupted setup (see utils/setupSession). */
  saved?: Beat2Saved | null;
  onPersist?: (state: Beat2Saved) => void;
  onSave: (profile: Profile) => void;
  onEditEssentials: () => void;
}

const SESSION_LABEL: Record<SessionLength, string> = {
  short: '~30–45 min',
  standard: '~45–60 min',
  long: '~60–75 min',
};

const SESSION_DURATION: Record<SessionLength, number> = {
  short: 40,
  standard: 55,
  long: 70,
};

/**
 * Beat 2 — live program preview.
 *
 * Chip row opens bottom sheets (Split / Length / Session). The
 * DayAccordion renders the current program shape in real time, driven
 * by a deterministic client-side `generateProgram(profile, DB)` call
 * whenever any beat-level selection changes.
 *
 * The coach pass (AI) runs BEFORE saving and lands in this same list, so the
 * lifter reviews — and can swap — the coach-tuned program. Save installs
 * exactly what is on screen; nothing is replaced after approval. (It used to
 * run at save time and overwrite the reviewed days with its own.) Changing
 * split / length / session drops the tuning, since it no longer matches.
 */
export default function Beat2Preview({ beat1, saved, onPersist, onSave, onEditEssentials }: Beat2Props) {
  const [split, setSplit] = useState<SplitType>(saved?.split ?? 'upper_lower');
  const [length, setLength] = useState<MesoLength>(saved?.length ?? 6);
  const [session, setSession] = useState<SessionLength>(saved?.session ?? 'standard');
  // One-open-at-a-time: clicking any bar collapses the others. Null = all closed.
  const [openBar, setOpenBar] = useState<'split' | 'session' | 'length' | null>(null);
  const [saveError, setSaveError] = useState('');

  // Onboarding intake carries name/gender/goal/experience forward.
  const intake = useMemo(() => {
    try {
      const data = JSON.parse(store.get('foundry:onboarding_data') || '{}');
      return {
        name: (data.name as string) || '',
        gender: (data.gender as string) || '',
        experience: (data.experience as string) || 'intermediate',
      };
    } catch {
      return { name: '', gender: '', experience: 'intermediate' };
    }
  }, []);
  const goal = useMemo(() => store.get('foundry:onboarding_goal') || '', []);

  const profileDraft: Partial<Profile> = useMemo(
    () => ({
      name: intake.name,
      gender: intake.gender,
      experience: intake.experience,
      goal,
      splitType: split,
      daysPerWeek: beat1.daysPerWeek,
      workoutDays: beat1.workoutDays,
      equipment: [beat1.equipment],
      mesoLength: length,
      sessionDuration: SESSION_DURATION[session],
      startDate: beat1.startDate,
    }),
    [intake, goal, split, length, session, beat1],
  );

  // Deterministic preview — fast, offline-safe. Recomputed on any change.
  const [days, setDays] = useState<DayBuild[]>(saved?.days ?? []);
  // The program `days` was made from — carries each lift's prescription
  // through to the saved program. Coach-tuned days replace it.
  const [source, setSource] = useState<TrainingDay[] | undefined>(saved?.source);
  const [tune, setTune] = useState<'idle' | 'tuning' | 'tuned' | 'failed'>(saved?.tuned ? 'tuned' : 'idle');
  // Restored from an interrupted setup: keep that exact program (swaps,
  // coach tuning) instead of rolling a new one on mount.
  const skipFirstBuild = useRef(!!saved && saved.days.length > 0);
  useEffect(() => {
    if (skipFirstBuild.current) {
      skipFirstBuild.current = false;
      return;
    }
    setTune('idle');
    setSaveError('');
    if (split === 'custom') {
      setSource(undefined);
      // Custom split seeds each day with an empty exercise list; the
      // user composes via the DayAccordion swap flow.
      setDays(
        beat1.workoutDays.map((_, i) => ({
          tag: 'CUSTOM',
          label: `Day ${i + 1}`,
          exercises: [],
          anchors: [],
        })),
      );
      return;
    }
    try {
      // ExerciseEntry[] from exerciseDB and DbExercise[] from program.ts
      // share the hot-path fields (id/name/muscle/tag/anchor). The cast
      // keeps the call site clean while generator logic inspects only
      // the fields both shapes agree on.
      // Same continuity the real generation uses, so the preview shows the
      // program you'll actually get rather than a different roll of anchors.
      const td = generateProgram(
        profileDraft as Profile,
        getExerciseDB() as unknown as Parameters<typeof generateProgram>[1],
        { trainedIds: getTrainedExerciseIds() },
      );
      setSource(td);
      setDays(toDayBuilds(td));
    } catch {
      setSource(undefined);
      setDays([]);
    }
  }, [profileDraft, split, beat1.workoutDays]);

  useEffect(() => {
    if (tune === 'tuning') return;
    onPersist?.({ split, length, session, days, source, tuned: tune === 'tuned' });
    // onPersist is a fresh closure each render; the state is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split, length, session, days, source, tune]);

  const handleSave = () => {
    onSave({
      ...(profileDraft as Profile),
      // Exactly the program on screen — coach-tuned or not, edits included.
      aiDays: hydrateDayBuilds(days, getExerciseDB() as never, source),
      autoBuilt: split !== 'custom',
    });
  };

  const handleTune = async () => {
    setTune('tuning');
    setSaveError('');
    try {
      const result = await callFoundryAI(
        {
          split,
          daysPerWeek: beat1.daysPerWeek,
          mesoLength: length,
          experience: intake.experience,
          equipment: [beat1.equipment],
          name: intake.name,
          gender: intake.gender,
          goal,
          goalNote: '',
        },
        getExerciseDB() as Parameters<typeof callFoundryAI>[1],
      );
      if (!result.days?.some((d) => d.exercises?.length)) throw new Error('empty coach program');
      setSource(result.days);
      setDays(toDayBuilds(result.days));
      setTune('tuned');
      window.scrollTo(0, 0);
    } catch (err: unknown) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      setTune('failed');
      setSaveError(
        err instanceof CoachAuthRequiredError
          ? 'The coach needs a free account. Save this build now — once you create an account, the coach can tune your next meso.'
          : isTimeout
          ? 'The coach pass timed out. This is the standard build — save it, or try the coach again.'
          : "The coach pass isn't available right now. This is the standard build — save it, or try the coach again.",
      );
    }
  };

  // Custom splits are hand-built — no coach pass.
  const needsTune = split !== 'custom' && tune !== 'tuned' && tune !== 'failed';
  const busy = tune === 'tuning';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.bgRoot,
        color: tokens.colors.textPrimary,
        fontFamily: "'Inter', system-ui, sans-serif",
        // 480 on phones; the dashboard width on wider screens, where the
        // setting bars sit 3-up and the day cards 2-up (>=1000px).
        maxWidth: 'var(--wide-max)',
        margin: '0 auto',
        padding: '20px 20px 120px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header row: Back → Beat 1 + page title. The plumbing already
          existed in SetupPage (onEditEssentials sets v2Step back to 'beat1')
          but no UI was firing it, so testers had no way to change days /
          goal / experience once they reached the program preview. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={onEditEssentials}
          aria-label="Back to essentials — change days, goal, or experience"
          style={{
            minHeight: 36,
            padding: '6px 10px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.md,
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'inherit',
          }}
        >
          <span aria-hidden="true">‹</span> BACK
        </button>
        <div
          style={{
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: 28,
            letterSpacing: '0.12em',
          }}
        >
          YOUR PROGRAM
        </div>
      </div>

      {/* Stacked accordion bars — replaces the old chip-row + bottom-sheet
          combo. Inline expansion keeps the user in one place and exposes
          bigger tap targets. */}
      <div
        className="fd-grid-3"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <AccordionBar
          label="SPLIT"
          value={formatSplitName(split)}
          open={openBar === 'split'}
          onToggle={() => setOpenBar(openBar === 'split' ? null : 'split')}
        >
          <SplitBody
            current={split}
            daysPerWeek={beat1.daysPerWeek}
            onSelect={(s) => {
              setSplit(s);
              setOpenBar(null);
            }}
          />
        </AccordionBar>
        <AccordionBar
          label="SESSION LENGTH"
          value={SESSION_LABEL[session]}
          open={openBar === 'session'}
          onToggle={() => setOpenBar(openBar === 'session' ? null : 'session')}
        >
          <SessionLengthBody
            current={session}
            onSelect={(s) => {
              setSession(s);
              setOpenBar(null);
            }}
          />
        </AccordionBar>
        <AccordionBar
          label="MESO LENGTH"
          value={`${length} WEEKS`}
          open={openBar === 'length'}
          onToggle={() => setOpenBar(openBar === 'length' ? null : 'length')}
        >
          <MesoLengthBody
            current={length}
            onSelect={(l) => {
              setLength(l);
              setOpenBar(null);
            }}
          />
        </AccordionBar>
      </div>

      <PhaseBar variant="static" />

      {tune === 'tuned' && (
        <div
          role="status"
          style={{
            marginTop: 16,
            padding: '10px 12px',
            borderRadius: tokens.radius.md,
            border: `1px solid ${tokens.colors.accent}`,
            background: 'rgba(232,101,26,0.10)',
            fontSize: 12,
            lineHeight: 1.5,
            color: tokens.colors.textSecondary,
          }}
        >
          <span style={{ fontWeight: 800, letterSpacing: '0.1em', color: tokens.colors.accent }}>COACH-TUNED</span>
          {' · '}Your coach reworked this program. Review each day and swap anything you don't want — what you save is what you'll train.
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <DayAccordion
          days={days}
          onDaysChange={setDays}
          userEquipment={[beat1.equipment]}
        />
      </div>

      {saveError && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 12px',
            borderRadius: tokens.radius.md,
            border: '1px solid var(--danger)',
            background: 'var(--danger-bg, rgba(244,67,54,0.1))',
            color: 'var(--danger)',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {saveError}
        </div>
      )}

      {needsTune && !busy && days.length > 0 && (
        <button
          type="button"
          onClick={handleSave}
          style={{
            display: 'block',
            margin: '18px auto 0',
            background: 'transparent',
            border: 'none',
            color: tokens.colors.textMuted,
            fontSize: 12,
            textDecoration: 'underline',
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          Skip the coach — save this build
        </button>
      )}

      <button
        type="button"
        onClick={needsTune ? handleTune : handleSave}
        disabled={busy || days.length === 0}
        style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 40px)',
          // 440 on phones (the 480 column minus its gutters); tracks the
          // form column on wider screens so the CTA never spans an iPad.
          maxWidth: 'calc(var(--form-max) - 40px)',
          padding: '16px',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          borderRadius: tokens.radius.xl,
          background: busy ? 'rgba(232,101,26,0.35)' : tokens.colors.btnPrimaryBg,
          border: `1px solid ${tokens.colors.btnPrimaryBorder}`,
          color: tokens.colors.btnPrimaryText,
          cursor: busy ? 'wait' : 'pointer',
          boxShadow: busy ? 'none' : '0 4px 24px rgba(232,101,26,0.35)',
          zIndex: 5,
          opacity: days.length === 0 ? 0.5 : 1,
        }}
      >
        {busy ? 'Coach is tuning…' : needsTune ? 'Coach-tune my program' : 'Save program'}
      </button>
    </div>
  );
}
