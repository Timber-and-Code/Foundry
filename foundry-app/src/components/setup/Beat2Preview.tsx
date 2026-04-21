import { useEffect, useMemo, useState } from 'react';
import { tokens } from '../../styles/tokens';
import PhaseBar from '../shared/PhaseBar';
import { generateProgram } from '../../utils/program';
import { getExerciseDB } from '../../data/exerciseDB';
import { store } from '../../utils/store';
import { callFoundryAI } from '../../utils/api';
import type { Beat1Values } from './Beat1Essentials';
import type { Exercise, Profile, TrainingDay } from '../../types';
import { SplitBody, type SplitType } from './SplitSheet';
import { MesoLengthBody, type MesoLength } from './MesoLengthSheet';
import { SessionLengthBody, type SessionLength } from './SessionLengthSheet';
import AccordionBar from './AccordionBar';
import DayAccordion, { type DayBuild } from './DayAccordion';

interface Beat2Props {
  beat1: Beat1Values;
  onSave: (profile: Profile) => void;
  onEditEssentials: () => void;
}

const SPLIT_LABEL: Record<SplitType, string> = {
  ppl: 'Push / Pull / Legs',
  upper_lower: 'Upper / Lower',
  push_pull: 'Push / Pull',
  full_body: 'Full Body',
  traditional: 'Traditional',
  custom: 'Custom',
};

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
 * Map program.ts TrainingDay[] output into the DayBuild[] shape the
 * DayAccordion works with. Anchors become an indices-array instead of
 * per-exercise booleans to keep state mutations simple.
 */
function toDayBuilds(days: TrainingDay[]): DayBuild[] {
  return days.map((d) => {
    const exercises = (d.exercises || []).map((e) => ({
      id: String(e.id ?? e.name ?? ''),
      name: String(e.name ?? ''),
      muscle: String(e.muscle ?? 'other'),
    }));
    const anchors: number[] = [];
    (d.exercises || []).forEach((e, i) => {
      if (e.anchor) anchors.push(i);
    });
    return {
      tag: String(d.tag ?? 'CUSTOM'),
      label: String(d.label ?? `Day ${d.dayNum ?? '?'}`),
      exercises,
      anchors,
    };
  });
}

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
export default function Beat2Preview({ beat1, onSave, onEditEssentials: _onEditEssentials }: Beat2Props) {
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
      const td = generateProgram(
        profileDraft as Profile,
        getExerciseDB() as unknown as Parameters<typeof generateProgram>[1],
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
    const lockedDays: TrainingDay[] = days
      .map((d, i): TrainingDay => {
        const exercises: Exercise[] = d.exercises.map((e, idx) => {
          const isAnchor = d.anchors.includes(idx);
          const match = dbNow.find((x) => x.id === e.id) as unknown as
            | { [k: string]: unknown }
            | undefined;
          if (match) {
            return {
              id: String(match.id),
              name: String(match.name),
              muscle: String(match.muscle || e.muscle || 'other'),
              muscles: (match.muscles as string[] | undefined) || [String(match.muscle || e.muscle)],
              equipment: (match.equipment as string | string[] | undefined) || 'barbell',
              tag: String(match.tag || d.tag || 'FULL'),
              anchor: isAnchor,
              sets: isAnchor ? 4 : 3,
              reps: typeof match.reps === 'string' ? match.reps : '6-12',
              rest: typeof match.rest === 'string' ? match.rest : isAnchor ? '3 min' : '2 min',
              warmup: isAnchor ? 'Full protocol' : '1 feeler set',
              progression: match.pattern === 'isolation' ? 'reps' : 'weight',
              description: typeof match.description === 'string' ? match.description : '',
              videoUrl: typeof match.videoUrl === 'string' ? match.videoUrl : '',
              bw: !!match.bw,
            } as Exercise;
          }
          return {
            id: e.id,
            name: e.name,
            muscle: e.muscle,
            muscles: [e.muscle],
            equipment: 'barbell',
            tag: d.tag,
            anchor: isAnchor,
            sets: isAnchor ? 4 : 3,
            reps: '6-12',
            rest: isAnchor ? '3 min' : '2 min',
            warmup: isAnchor ? 'Full protocol' : '1 feeler set',
            progression: 'weight',
            description: '',
            videoUrl: '',
          } as Exercise;
        });
        return {
          dayNum: i + 1,
          label: d.label,
          tag: d.tag,
          muscles: '',
          note: '',
          cardio: null,
          exercises,
        };
      })
      .filter((d) => d.exercises.length > 0);

    const deterministicProfile: Profile = {
      ...(profileDraft as Profile),
      aiDays: lockedDays,
      autoBuilt: split !== 'custom',
    };
    try {
      const result = await callFoundryAI(
        {
          split: split === 'custom' ? 'ppl' : split,
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
      <div
        style={{
          fontFamily: "'Bebas Neue', 'Inter', sans-serif",
          fontSize: 28,
          letterSpacing: '0.12em',
          marginBottom: 16,
        }}
      >
        YOUR PROGRAM
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
          value={SPLIT_LABEL[split]}
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
