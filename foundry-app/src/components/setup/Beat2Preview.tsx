import { useEffect, useMemo, useState } from 'react';
import { tokens } from '../../styles/tokens';
import PhaseBar from '../shared/PhaseBar';
import { generateProgram } from '../../utils/program';
import { getExerciseDB } from '../../data/exerciseDB';
import { store } from '../../utils/store';
import { callFoundryAI } from '../../utils/api';
import type { Beat1Values } from './Beat1Essentials';
import type { Profile, TrainingDay } from '../../types';
import SplitSheet, { type SplitType } from './SplitSheet';
import MesoLengthSheet, { type MesoLength } from './MesoLengthSheet';
import SessionLengthSheet, { type SessionLength } from './SessionLengthSheet';
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
  const [splitOpen, setSplitOpen] = useState(false);
  const [lengthOpen, setLengthOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);

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
    // Serialize the user's current (possibly edited) days in the shape
    // program.ts/ManualBuilder expects as a fallback when aiDays is not
    // present.
    const manualDayExercises: Record<string, unknown[]> = {};
    days.forEach((d, i) => {
      manualDayExercises[String(i)] = d.exercises.map((e, idx) => ({
        id: e.id,
        name: e.name,
        muscle: e.muscle,
        anchor: d.anchors.includes(idx),
      }));
    });
    const deterministicProfile: Profile = {
      ...(profileDraft as Profile),
      manualDayExercises: manualDayExercises as Profile['manualDayExercises'],
      autoBuilt: split !== 'custom',
    };
    try {
      const result = await callFoundryAI({
        split: split === 'custom' ? 'ppl' : split,
        daysPerWeek: beat1.daysPerWeek,
        mesoLength: length,
        experience: intake.experience,
        equipment: [beat1.equipment],
        name: intake.name,
        gender: intake.gender,
        goal,
        goalNote: '',
      });
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

      {/* Sticky chip row */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 20,
          position: 'sticky',
          top: 0,
          background: tokens.colors.bgRoot,
          paddingBottom: 8,
          zIndex: 2,
        }}
      >
        <Chip label={SPLIT_LABEL[split]} onClick={() => setSplitOpen(true)} />
        <Chip label={`${length} WEEKS`} onClick={() => setLengthOpen(true)} />
        <Chip label={SESSION_LABEL[session]} onClick={() => setSessionOpen(true)} />
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

      <SplitSheet
        open={splitOpen}
        current={split}
        daysPerWeek={beat1.daysPerWeek}
        onSelect={setSplit}
        onClose={() => setSplitOpen(false)}
      />
      <MesoLengthSheet
        open={lengthOpen}
        current={length}
        onSelect={setLength}
        onClose={() => setLengthOpen(false)}
      />
      <SessionLengthSheet
        open={sessionOpen}
        current={session}
        onSelect={setSession}
        onClose={() => setSessionOpen(false)}
      />
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: tokens.radius.pill,
        background: tokens.colors.bgCard,
        border: `1px solid ${tokens.colors.accentBorder}`,
        color: tokens.colors.textPrimary,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {label} <span aria-hidden="true" style={{ color: tokens.colors.accent }}>▾</span>
    </button>
  );
}
