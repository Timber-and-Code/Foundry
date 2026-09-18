import { useEffect, useMemo, useState } from 'react';
import { tokens } from '../../styles/tokens';
import PhaseBar from '../shared/PhaseBar';
import { generateProgram } from '../../utils/program';
import { getTrainedExerciseIds } from '../../utils/trainingHistory';
import { getExerciseDB } from '../../data/exerciseDB';
import { store } from '../../utils/store';
import { callFoundryAI } from '../../utils/api';
import type { Beat1Values } from './Beat1Essentials';
import type { Profile } from '../../types';
import { SplitBody, type SplitType } from './SplitSheet';
import { MesoLengthBody, type MesoLength } from './MesoLengthSheet';
import { SessionLengthBody, type SessionLength } from './SessionLengthSheet';
import AccordionBar from './AccordionBar';
import DayAccordion, { type DayBuild } from './DayAccordion';
import { formatSplitName } from '../../utils/splitLabel';
import { toDayBuilds, hydrateDayBuilds } from './dayBuilds';

interface Beat2Props {
  beat1: Beat1Values;
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
 * whenever any beat-level selection changes. The AI refinement runs
 * once at save time and replaces the day list with a coach-tuned
 * version; on failure we fall back to the deterministic build.
 */
export default function Beat2Preview({ beat1, onSave, onEditEssentials }: Beat2Props) {
  const [split, setSplit] = useState<SplitType>('upper_lower');
  const [length, setLength] = useState<MesoLength>(6);
  const [session, setSession] = useState<SessionLength>('standard');
  // One-open-at-a-time: clicking any bar collapses the others. Null = all closed.
  const [openBar, setOpenBar] = useState<'split' | 'session' | 'length' | null>(null);

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
  const [days, setDays] = useState<DayBuild[]>([]);
  useEffect(() => {
    if (split === 'custom') {
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
      setDays(toDayBuilds(td));
    } catch {
      setDays([]);
    }
  }, [profileDraft, split, beat1.workoutDays]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    const dbNow = getExerciseDB();

    // Lock in the user's current preview as the deterministic program.
    // We hydrate each DayBuild back into a full TrainingDay using
    // EXERCISE_DB so the Home view can render the exact program the user
    // saw — regardless of whether the AI refinement below succeeds.
    const lockedDays = hydrateDayBuilds(days, dbNow as never);

    const deterministicProfile: Profile = {
      ...(profileDraft as Profile),
      aiDays: lockedDays,
      autoBuilt: split !== 'custom',
    };
    // Custom split is hand-built by the user. Skip the AI refinement entirely
    // — calling it with split='ppl' (the prior fallback) overwrote the user's
    // chosen days with a generic 3-day Push/Pull/Legs program.
    if (split === 'custom') {
      setSaving(false);
      onSave(deterministicProfile);
      return;
    }
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
        dbNow as Parameters<typeof callFoundryAI>[1],
      );
      const aiProfile: Profile = {
        ...deterministicProfile,
        aiDays: result.days,
      };
      setSaving(false);
      onSave(aiProfile);
    } catch (err: unknown) {
      // Graceful fallback — ship the deterministic program, surface a
      // soft error inline so the user knows the coach pass didn't run.
      setSaving(false);
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      setSaveError(
        isTimeout
          ? 'Coach refinement timed out — saving the program we built instead.'
          : "Coach refinement unavailable — saving the program we built instead.",
      );
      onSave(deterministicProfile);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.bgRoot,
        color: tokens.colors.textPrimary,
        fontFamily: "'Inter', system-ui, sans-serif",
        maxWidth: 480,
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

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || days.length === 0}
        style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 40px)',
          maxWidth: 440,
          padding: '16px',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          borderRadius: tokens.radius.xl,
          background: saving ? 'rgba(232,101,26,0.35)' : tokens.colors.btnPrimaryBg,
          border: `1px solid ${tokens.colors.btnPrimaryBorder}`,
          color: tokens.colors.btnPrimaryText,
          cursor: saving ? 'wait' : 'pointer',
          boxShadow: saving ? 'none' : '0 4px 24px rgba(232,101,26,0.35)',
          zIndex: 5,
          opacity: days.length === 0 ? 0.5 : 1,
        }}
      >
        {saving ? 'Building…' : 'Save program'}
      </button>
    </div>
  );
}
