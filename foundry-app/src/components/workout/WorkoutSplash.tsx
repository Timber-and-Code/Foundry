import { tokens } from '../../styles/tokens';
import { getMeso, getWeekPhase, PHASE_COLOR, getWeekRir } from '../../data/constants';
import { getWeekSets } from '../../utils/store';
import FriendsStrip from '../social/FriendsStrip';
import type { Exercise } from '../../types';

interface WorkoutSplashProps {
  dayName: string;
  dayIdx: number;
  weekIdx: number;
  exercises: Exercise[];
  mesoId?: string | null;
  onStart: () => void;
  onBack: () => void;
}

export default function WorkoutSplash({
  dayName,
  weekIdx,
  exercises,
  mesoId,
  onStart,
  onBack,
}: WorkoutSplashProps) {
  const phase = getWeekPhase()[weekIdx] || 'Accumulation';
  const phaseColor = PHASE_COLOR[phase] || '#E8E4DC';
  const rir = getWeekRir()[weekIdx] || '';
  const totalWeeks = getMeso().weeks;
  const totalSets = exercises.reduce(
    (acc, ex) => acc + getWeekSets(Number(ex.sets ?? 0), weekIdx, totalWeeks),
    0,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-splash-title"
      onClick={onStart}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 240,
        background: 'var(--bg-root, #0A0A0C)',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          flex: 1,
          border: `2px solid ${phaseColor}`,
          borderRadius: tokens.radius.xxl,
          padding: '20px 22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 100%)',
        }}
      >
        {/* Header row: back, phase chip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            aria-label="Go back"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-accent)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              padding: '4px 6px',
            }}
          >
            <span aria-hidden="true">←</span> Back
          </button>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              padding: '4px 10px',
              borderRadius: tokens.radius.pill,
              background: phaseColor + '22',
              color: phaseColor,
              border: `1px solid ${phaseColor}55`,
            }}
          >
            {phase.toUpperCase()}
          </div>
        </div>

        {/* Meta line */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.14em',
          }}
        >
          WEEK {weekIdx + 1} / {totalWeeks} &middot; DAY {/* dayIdx is 0-indexed */} {/* displays dayName below */}
        </div>

        {/* Title */}
        <div>
          <div
            id="workout-splash-title"
            style={{
              fontSize: 34,
              fontWeight: 900,
              color: 'var(--text-primary)',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
            }}
          >
            {dayName}
          </div>
        </div>

        {/* Stat grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            padding: '14px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
          }}
        >
          <Stat label="EXERCISES" value={String(exercises.length)} />
          <Stat label="SETS" value={String(totalSets)} />
          <Stat label="TARGET" value={rir || '—'} />
        </div>

        {/* Friends strip if shared meso */}
        {mesoId && (
          <div onClick={(e) => e.stopPropagation()}>
            <FriendsStrip mesoId={mesoId} onSelectFriend={() => { /* #8: Friend Progress View */ }} />
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Start CTA */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          style={{
            width: '100%',
            padding: '20px',
            borderRadius: tokens.radius.lg,
            background: phaseColor,
            border: 'none',
            color: phaseColor === '#E8E4DC' || phaseColor === '#D4983C' ? '#0A0A0C' : '#0A0A0C',
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          START WORKOUT <span aria-hidden="true">→</span>
        </button>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: -10,
          }}
        >
          Or tap anywhere to begin
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}
