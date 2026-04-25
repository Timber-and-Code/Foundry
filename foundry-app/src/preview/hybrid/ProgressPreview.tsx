import { useState, type CSSProperties } from 'react';
import { PHASE_COLORS, type Phase } from '../forge-v2/fixtures';

// Preview-only fixture for the Progress tab redesign.
// Sub-tabs: "This Week" (current week volume + lifts grouped by workout +
// cardio) and "Meso History" (current meso cycle, lifts grouped by muscle).
// Meso History has a nested "Previous Meso Cycles" archive entry.

type SegStatus = 'done' | 'current' | 'upcoming';
type DayTag = 'PUSH' | 'PULL' | 'LEGS' | 'CORE';

const PHASE: Phase = 'Intensification';
const PHASE_COLOR = PHASE_COLORS[PHASE];

const TAG_ACCENT: Record<DayTag, string> = {
  PUSH: '#E8651A',
  PULL: '#5B8FA8',
  LEGS: '#D4983C',
  CORE: '#A8A4A0',
};

// ----- This Week fixture -----
const WEEK_FIXTURE = {
  weekIdx: 5,
  workouts: [
    { label: 'Mon', tag: 'PUSH' as DayTag, name: 'Push A', status: 'done' as SegStatus },
    { label: 'Tue', tag: 'PULL' as DayTag, name: 'Pull A', status: 'current' as SegStatus },
    { label: 'Wed', tag: 'LEGS' as DayTag, name: 'Legs A', status: 'upcoming' as SegStatus },
    { label: 'Thu', tag: 'PUSH' as DayTag, name: 'Push B', status: 'upcoming' as SegStatus },
    { label: 'Fri', tag: 'PULL' as DayTag, name: 'Pull B', status: 'upcoming' as SegStatus },
    { label: 'Sat', tag: 'LEGS' as DayTag, name: 'Legs B', status: 'upcoming' as SegStatus },
  ],
  volumeByTag: [
    { tag: 'Chest', sets: 12, mev: 8, mrv: 22 },
    { tag: 'Back', sets: 14, mev: 10, mrv: 25 },
    { tag: 'Legs', sets: 0, mev: 8, mrv: 20 },
    { tag: 'Shoulders', sets: 6, mev: 8, mrv: 18 },
  ],
  // Lifts grouped by workout (matches live app's CURRENT WEIGHTS pattern)
  liftsByWorkout: [
    {
      workoutId: 'push-a',
      name: 'Push A',
      tag: 'PUSH' as DayTag,
      day: 'Mon',
      status: 'done' as SegStatus,
      lifts: [
        { name: 'Bench Press', top: '225 × 6', e1rm: 262, delta: +4, anchor: true },
        { name: 'Incline DB Press', top: '90 × 10', e1rm: 125, delta: +2 },
        { name: 'Overhead Press', top: '135 × 8', e1rm: 170, delta: 0, anchor: true },
        { name: 'Lateral Raise', top: '25 × 15', e1rm: 38, delta: +1 },
        { name: 'Tricep Rope', top: '60 × 12', e1rm: 80, delta: 0 },
      ],
    },
    {
      workoutId: 'pull-a',
      name: 'Pull A',
      tag: 'PULL' as DayTag,
      day: 'Tue',
      status: 'current' as SegStatus,
      lifts: [
        { name: 'Barbell Row', top: '205 × 8', e1rm: 258, delta: +2, anchor: true },
        { name: 'Pull-ups', top: 'BW × 10', e1rm: 245, delta: 0 },
        { name: 'Seated Row', top: '180 × 10', e1rm: 238, delta: +4 },
        { name: 'Face Pull', top: '50 × 15', e1rm: 72, delta: 0 },
        { name: 'EZ Curl', top: '95 × 10', e1rm: 130, delta: +2 },
      ],
    },
  ],
  cardio: [
    { name: 'Zone 2 · Bike', when: 'Mon', minutes: 35, avgHr: 142 },
    { name: 'Intervals · Assault', when: 'Wed', minutes: 18, avgHr: 168 },
  ],
};

// ----- Meso History fixture -----
const MESO_FIXTURE = {
  mesoNumber: 7,
  startDate: 'Mar 3',
  phase: PHASE,
  weeks: [
    { label: 'Wk 1', phase: 'Accum', status: 'done' as SegStatus, sessions: { done: 6, total: 6 } },
    { label: 'Wk 2', phase: 'Accum', status: 'done' as SegStatus, sessions: { done: 6, total: 6 } },
    { label: 'Wk 3', phase: 'Accum', status: 'done' as SegStatus, sessions: { done: 6, total: 6 } },
    { label: 'Wk 4', phase: 'Intens', status: 'done' as SegStatus, sessions: { done: 6, total: 6 } },
    { label: 'Wk 5', phase: 'Intens', status: 'done' as SegStatus, sessions: { done: 6, total: 6 } },
    { label: 'Wk 6', phase: 'Intens', status: 'current' as SegStatus, sessions: { done: 1, total: 6 } },
    { label: 'Wk 7', phase: 'Deload', status: 'upcoming' as SegStatus, sessions: { done: 0, total: 4 } },
  ],
  // Lifts grouped by muscle (aggregate view — workout grouping doesn't work
  // because Bench Press appears in both Push A and Push B).
  liftsByMuscle: [
    {
      muscle: 'Chest',
      lifts: [
        { name: 'Bench Press', start: 225, current: 250, pr: 255 },
        { name: 'Incline DB Press', start: 75, current: 90, pr: 90 },
        { name: 'Weighted Dips', start: 45, current: 70, pr: 75 },
      ],
    },
    {
      muscle: 'Back',
      lifts: [
        { name: 'Barbell Row', start: 185, current: 210, pr: 210 },
        { name: 'Deadlift', start: 365, current: 405, pr: 415 },
        { name: 'Pull-ups', start: 0, current: 25, pr: 25 },
      ],
    },
    {
      muscle: 'Quads',
      lifts: [
        { name: 'Back Squat', start: 305, current: 345, pr: 345 },
        { name: 'Leg Press', start: 405, current: 495, pr: 495 },
      ],
    },
    {
      muscle: 'Hamstrings',
      lifts: [
        { name: 'Romanian Deadlift', start: 245, current: 285, pr: 285 },
        { name: 'Leg Curl', start: 110, current: 135, pr: 140 },
      ],
    },
    {
      muscle: 'Shoulders',
      lifts: [
        { name: 'Overhead Press', start: 135, current: 150, pr: 155 },
        { name: 'Lateral Raise', start: 20, current: 25, pr: 27.5 },
      ],
    },
    {
      muscle: 'Arms',
      lifts: [
        { name: 'EZ Curl', start: 75, current: 95, pr: 95 },
        { name: 'Tricep Rope', start: 50, current: 60, pr: 62.5 },
      ],
    },
  ],
  mesoCardio: [
    { kind: 'Zone 2', sessions: 11, totalMin: 385, trendLabel: '+12% vs last meso' },
    { kind: 'Intervals', sessions: 6, totalMin: 108, trendLabel: 'Avg HR 169 (+4)' },
  ],
  bw: { start: 188.4, current: 191.2, unit: 'lb' },
};

// ----- Previous Meso Cycles fixture -----
interface PrevMeso {
  id: string;
  number: number;
  dates: string;
  phaseSummary: string;
  liftsByMuscle: { muscle: string; lifts: { name: string; start: number; end: number; pr: number }[] }[];
  cardio: { sessions: number; totalMin: number };
  sessions: { done: number; total: number };
  bwDelta: string;
}

const PREVIOUS_MESOS: PrevMeso[] = [
  {
    id: 'meso-06',
    number: 6,
    dates: 'Jan 6 – Feb 23',
    phaseSummary: 'Hypertrophy block · 7 wk',
    liftsByMuscle: [
      { muscle: 'Chest', lifts: [
        { name: 'Bench Press', start: 215, end: 235, pr: 240 },
        { name: 'Incline DB Press', start: 70, end: 85, pr: 85 },
      ]},
      { muscle: 'Back', lifts: [
        { name: 'Barbell Row', start: 175, end: 195, pr: 200 },
        { name: 'Deadlift', start: 355, end: 385, pr: 395 },
      ]},
      { muscle: 'Quads', lifts: [
        { name: 'Back Squat', start: 295, end: 325, pr: 330 },
      ]},
      { muscle: 'Hamstrings', lifts: [
        { name: 'Romanian Deadlift', start: 235, end: 265, pr: 275 },
      ]},
    ],
    cardio: { sessions: 14, totalMin: 420 },
    sessions: { done: 38, total: 42 },
    bwDelta: '+3.1 lb',
  },
  {
    id: 'meso-05',
    number: 5,
    dates: 'Nov 4 – Dec 22',
    phaseSummary: 'Strength block · 6 wk',
    liftsByMuscle: [
      { muscle: 'Chest', lifts: [
        { name: 'Bench Press', start: 205, end: 220, pr: 225 },
      ]},
      { muscle: 'Back', lifts: [
        { name: 'Barbell Row', start: 165, end: 180, pr: 185 },
        { name: 'Deadlift', start: 335, end: 365, pr: 375 },
      ]},
      { muscle: 'Quads', lifts: [
        { name: 'Back Squat', start: 275, end: 305, pr: 310 },
      ]},
    ],
    cardio: { sessions: 10, totalMin: 280 },
    sessions: { done: 34, total: 36 },
    bwDelta: '+1.4 lb',
  },
  {
    id: 'meso-04',
    number: 4,
    dates: 'Sep 2 – Oct 20',
    phaseSummary: 'Hypertrophy block · 7 wk',
    liftsByMuscle: [
      { muscle: 'Chest', lifts: [
        { name: 'Bench Press', start: 195, end: 215, pr: 215 },
      ]},
      { muscle: 'Back', lifts: [
        { name: 'Deadlift', start: 315, end: 345, pr: 350 },
      ]},
      { muscle: 'Quads', lifts: [
        { name: 'Back Squat', start: 255, end: 290, pr: 295 },
      ]},
    ],
    cardio: { sessions: 16, totalMin: 460 },
    sessions: { done: 40, total: 42 },
    bwDelta: '+2.8 lb',
  },
];

export default function ProgressPreview() {
  const [subTab, setSubTab] = useState<'week' | 'meso'>('week');
  const [viewPrev, setViewPrev] = useState(false);

  if (viewPrev) {
    return <PreviousCyclesView onBack={() => setViewPrev(false)} />;
  }

  return (
    <Shell>
      <Header />
      <SubTabBar value={subTab} onChange={setSubTab} />
      {subTab === 'week' ? <ThisWeekView /> : <MesoHistoryView onOpenPrev={() => setViewPrev(true)} />}
    </Shell>
  );
}

// ============ Shell + header + sub-tab bar ============

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--ff-body)',
        maxWidth: 480,
        margin: '0 auto',
        padding: '20px 20px 40px 20px',
      }}
    >
      {children}
    </div>
  );
}

function Header() {
  return (
    <>
      <div
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 34,
          letterSpacing: '0.04em',
          marginBottom: 4,
          lineHeight: 1,
        }}
      >
        PROGRESS
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        How the current week and the meso are shaping up.
      </div>
    </>
  );
}

function SubTabBar({
  value,
  onChange,
}: {
  value: 'week' | 'meso';
  onChange: (v: 'week' | 'meso') => void;
}) {
  const tabs = [
    { key: 'week', label: 'This Week' },
    { key: 'meso', label: 'Meso History' },
  ] as const;
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        marginBottom: 16,
        padding: 4,
        background: 'var(--bg-inset)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 999,
      }}
    >
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: 999,
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--btn-primary-text, #0a0907)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'background 150ms, color 150ms',
              fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ============ This Week ============

function ThisWeekView() {
  // Default: current workout expanded.
  const currentWorkout = WEEK_FIXTURE.liftsByWorkout.find((w) => w.status === 'current');
  const [expanded, setExpanded] = useState<string | null>(currentWorkout?.workoutId ?? null);

  return (
    <>
      <SectionLabel>Week {WEEK_FIXTURE.weekIdx + 1} · {PHASE}</SectionLabel>

      <Card>
        <WeeklyBar />
      </Card>

      <SectionLabel>Volume this week</SectionLabel>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {WEEK_FIXTURE.volumeByTag.map((v) => (
            <VolumeRow key={v.tag} {...v} />
          ))}
        </div>
      </Card>

      <SectionLabel>Lifts this week</SectionLabel>
      {WEEK_FIXTURE.liftsByWorkout.map((w) => (
        <WorkoutLiftCard
          key={w.workoutId}
          workout={w}
          open={expanded === w.workoutId}
          onToggle={() => setExpanded(expanded === w.workoutId ? null : w.workoutId)}
        />
      ))}

      <SectionLabel>Cardio this week</SectionLabel>
      <Card>
        {WEEK_FIXTURE.cardio.length === 0 ? (
          <Empty>No cardio logged yet.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {WEEK_FIXTURE.cardio.map((c, i) => (
              <CardioRow key={i} {...c} />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function WeeklyBar() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${WEEK_FIXTURE.workouts.length}, 1fr)`,
        gap: 4,
        alignItems: 'end',
      }}
    >
      {WEEK_FIXTURE.workouts.map((w, i) => {
        const isDone = w.status === 'done';
        const isCurrent = w.status === 'current';
        const segStyle: CSSProperties = {
          height: 10,
          borderRadius: 3,
          background: 'var(--border-subtle)',
        };
        if (isDone) {
          segStyle.background = PHASE_COLOR;
          segStyle.boxShadow = `0 0 6px ${PHASE_COLOR}88`;
        } else if (isCurrent) {
          segStyle.background = 'var(--text-secondary)';
        }
        const tagColor = isDone
          ? PHASE_COLOR
          : isCurrent
          ? 'var(--text-primary)'
          : 'var(--text-muted)';
        const dayColor = isCurrent ? 'var(--text-primary)' : 'var(--text-muted)';
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  color: dayColor,
                  textTransform: 'uppercase',
                  fontWeight: isCurrent ? 700 : 600,
                  marginBottom: 2,
                  lineHeight: 1,
                }}
              >
                {w.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--ff-display)',
                  fontSize: 13,
                  letterSpacing: '0.04em',
                  color: tagColor,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {w.name}
              </div>
            </div>
            <div style={segStyle} aria-label={`${w.label} ${w.name}: ${w.status}`} />
          </div>
        );
      })}
    </div>
  );
}

function VolumeRow({ tag, sets, mev, mrv }: { tag: string; sets: number; mev: number; mrv: number }) {
  const pct = Math.min(100, Math.round((sets / mrv) * 100));
  const color =
    sets === 0
      ? 'var(--text-muted)'
      : sets < mev
      ? 'var(--text-secondary)'
      : sets > mrv
      ? '#E8651A'
      : 'var(--accent)';
  const mevPct = (mev / mrv) * 100;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{tag}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color }}>{sets}</span> · MEV {mev} · MRV {mrv}
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 6,
          background: 'var(--border-subtle)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: color,
            transition: 'width 200ms',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${mevPct}%`,
            top: -2,
            bottom: -2,
            width: 1,
            background: 'var(--text-primary)',
            opacity: 0.25,
          }}
        />
      </div>
    </div>
  );
}

function WorkoutLiftCard({
  workout,
  open,
  onToggle,
}: {
  workout: (typeof WEEK_FIXTURE.liftsByWorkout)[number];
  open: boolean;
  onToggle: () => void;
}) {
  const accent = TAG_ACCENT[workout.tag];
  const isDone = workout.status === 'done';
  const isCurrent = workout.status === 'current';
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isDone || isCurrent ? accent + '44' : 'var(--border-subtle)'}`,
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%',
          background: isDone || isCurrent ? accent + '11' : 'transparent',
          border: 'none',
          borderBottom: open ? '1px solid var(--border-subtle)' : 'none',
          padding: '12px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'inherit',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            background: accent + '22',
            color: accent,
            fontFamily: 'var(--ff-display)',
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 6,
            letterSpacing: '0.08em',
          }}
        >
          {workout.tag}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 16,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {workout.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {workout.day} · {workout.lifts.length} lifts
            {isCurrent ? ' · today' : ''}
          </div>
        </div>
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 14,
            fontVariantNumeric: 'tabular-nums',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 150ms',
          }}
          aria-hidden
        >
          ›
        </span>
      </button>
      {open && (
        <div style={{ padding: '8px 14px 12px 14px' }}>
          {workout.lifts.map((l, i) => {
            const deltaColor =
              l.delta > 0 ? accent : l.delta < 0 ? 'var(--text-muted)' : 'var(--text-secondary)';
            const deltaLabel = l.delta === 0 ? '—' : `${l.delta > 0 ? '+' : ''}${l.delta} lb`;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '6px 0',
                  borderBottom:
                    i < workout.lifts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      lineHeight: 1.2,
                    }}
                  >
                    {l.anchor ? '⚒ ' : ''}
                    {l.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    Top: {l.top}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: 'var(--ff-display)',
                      fontSize: 18,
                      color: 'var(--text-primary)',
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1,
                    }}
                  >
                    {l.e1rm}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: deltaColor,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    e1RM · {deltaLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardioRow({
  name,
  when,
  minutes,
  avgHr,
}: {
  name: string;
  when: string;
  minutes: number;
  avgHr: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 14,
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            lineHeight: 1.1,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{when}</div>
      </div>
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <div
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 18,
            color: 'var(--text-primary)',
            lineHeight: 1,
          }}
        >
          {minutes} min
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Avg HR {avgHr}
        </div>
      </div>
    </div>
  );
}

// ============ Meso History ============

function MesoHistoryView({ onOpenPrev }: { onOpenPrev: () => void }) {
  const totals = MESO_FIXTURE.weeks.reduce(
    (a, w) => ({ done: a.done + w.sessions.done, total: a.total + w.sessions.total }),
    { done: 0, total: 0 },
  );
  // Default: first muscle group expanded
  const [expandedMuscle, setExpandedMuscle] = useState<string | null>(
    MESO_FIXTURE.liftsByMuscle[0]?.muscle ?? null,
  );

  return (
    <>
      <SectionLabel>
        Meso 0{MESO_FIXTURE.mesoNumber} · since {MESO_FIXTURE.startDate}
      </SectionLabel>

      <Card>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 11,
              letterSpacing: '0.16em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            Sessions
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: 32,
                lineHeight: 1,
                color: PHASE_COLOR,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
              }}
            >
              {totals.done}
            </span>
            <span
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: 18,
                lineHeight: 1,
                color: 'var(--text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              / {totals.total}
            </span>
          </div>
        </div>
        <MesoWeeksBar />
      </Card>

      <SectionLabel>Lifts this meso</SectionLabel>
      {MESO_FIXTURE.liftsByMuscle.map((m) => (
        <MuscleLiftCard
          key={m.muscle}
          muscle={m.muscle}
          lifts={m.lifts.map((l) => ({ ...l, end: l.current }))}
          open={expandedMuscle === m.muscle}
          onToggle={() => setExpandedMuscle(expandedMuscle === m.muscle ? null : m.muscle)}
          accent={PHASE_COLOR}
        />
      ))}

      <SectionLabel>Cardio this meso</SectionLabel>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MESO_FIXTURE.mesoCardio.map((c) => (
            <div
              key={c.kind}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--ff-display)',
                    fontSize: 14,
                    letterSpacing: '0.04em',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    lineHeight: 1.1,
                  }}
                >
                  {c.kind}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.trendLabel}</div>
              </div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                <div
                  style={{
                    fontFamily: 'var(--ff-display)',
                    fontSize: 18,
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                  }}
                >
                  {c.totalMin} min
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {c.sessions} sessions
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <SectionLabel>Bodyweight</SectionLabel>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 14,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
            }}
          >
            Start → Now
          </div>
          <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            <div
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: 20,
                color: 'var(--text-primary)',
                lineHeight: 1,
              }}
            >
              {MESO_FIXTURE.bw.start} → {MESO_FIXTURE.bw.current} {MESO_FIXTURE.bw.unit}
            </div>
            <div
              style={{
                fontSize: 10,
                color: PHASE_COLOR,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              +{(MESO_FIXTURE.bw.current - MESO_FIXTURE.bw.start).toFixed(1)} {MESO_FIXTURE.bw.unit}
            </div>
          </div>
        </div>
      </Card>

      <button
        onClick={onOpenPrev}
        style={{
          width: '100%',
          marginTop: 18,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          color: 'inherit',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 16,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              lineHeight: 1.1,
            }}
          >
            Previous Meso Cycles
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Look back at every past meso — lifts, cardio, PRs.
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 22, lineHeight: 1 }} aria-hidden>
          ›
        </div>
      </button>
    </>
  );
}

function MuscleLiftCard({
  muscle,
  lifts,
  open,
  onToggle,
  accent,
}: {
  muscle: string;
  lifts: { name: string; start: number; end: number; pr: number }[];
  open: boolean;
  onToggle: () => void;
  accent: string;
}) {
  const totalDelta = lifts.reduce((sum, l) => sum + (l.end - l.start), 0);
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${accent}44`,
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%',
          background: `${accent}11`,
          border: 'none',
          borderBottom: open ? '1px solid var(--border-subtle)' : 'none',
          padding: '12px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'inherit',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 16,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {muscle}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {lifts.length} {lifts.length === 1 ? 'lift' : 'lifts'}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginRight: 8 }}>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 18,
              color: totalDelta > 0 ? accent : 'var(--text-secondary)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {totalDelta > 0 ? '+' : ''}
            {totalDelta}
          </div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            total lb
          </div>
        </div>
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 14,
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 150ms',
          }}
          aria-hidden
        >
          ›
        </span>
      </button>
      {open && (
        <div style={{ padding: '8px 14px 12px 14px' }}>
          {lifts.map((l, i) => {
            const d = l.end - l.start;
            const isPRAhead = l.pr > l.end;
            return (
              <div
                key={l.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '6px 0',
                  borderBottom: i < lifts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      lineHeight: 1.2,
                    }}
                  >
                    {l.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {l.start} → {l.end} lb
                    {isPRAhead ? ` · PR ${l.pr}` : ''}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--ff-display)',
                    fontSize: 18,
                    color: d > 0 ? accent : 'var(--text-secondary)',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {d > 0 ? '+' : ''}
                  {d}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MesoWeeksBar() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${MESO_FIXTURE.weeks.length}, 1fr)`,
        gap: 4,
        alignItems: 'end',
      }}
    >
      {MESO_FIXTURE.weeks.map((w, i) => {
        const isDone = w.status === 'done';
        const isCurrent = w.status === 'current';
        const segStyle: CSSProperties = {
          height: 10,
          borderRadius: 3,
          background: 'var(--border-subtle)',
        };
        if (isDone) {
          segStyle.background = PHASE_COLOR;
          segStyle.boxShadow = `0 0 6px ${PHASE_COLOR}88`;
        } else if (isCurrent) {
          segStyle.background = 'var(--text-secondary)';
        }
        const phaseColor = isDone
          ? PHASE_COLOR
          : isCurrent
          ? 'var(--text-primary)'
          : 'var(--text-muted)';
        const labelColor = isCurrent ? 'var(--text-primary)' : 'var(--text-muted)';
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  color: labelColor,
                  textTransform: 'uppercase',
                  fontWeight: isCurrent ? 700 : 600,
                  marginBottom: 2,
                  lineHeight: 1,
                }}
              >
                {w.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--ff-display)',
                  fontSize: 12,
                  letterSpacing: '0.04em',
                  color: phaseColor,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {w.phase}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 2,
                  lineHeight: 1,
                }}
              >
                {w.sessions.done}/{w.sessions.total}
              </div>
            </div>
            <div style={segStyle} aria-label={`${w.label} ${w.phase}: ${w.status}`} />
          </div>
        );
      })}
    </div>
  );
}

// ============ Previous Meso Cycles view ============

function PreviousCyclesView({ onBack }: { onBack: () => void }) {
  const [expandedMeso, setExpandedMeso] = useState<string | null>(PREVIOUS_MESOS[0].id);

  return (
    <Shell>
      <button
        onClick={onBack}
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          background: 'transparent',
          border: 'none',
          padding: 0,
          marginBottom: 14,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        ← Meso History
      </button>

      <div
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 28,
          letterSpacing: '0.04em',
          marginBottom: 4,
          lineHeight: 1,
        }}
      >
        PREVIOUS MESO CYCLES
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
        Every past meso — lifts by muscle, cardio, PRs.
      </div>

      {PREVIOUS_MESOS.map((m) => {
        const open = expandedMeso === m.id;
        return (
          <div
            key={m.id}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              marginBottom: 12,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setExpandedMeso(open ? null : m.id)}
              aria-expanded={open}
              style={{
                width: '100%',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--ff-display)',
                    fontSize: 20,
                    letterSpacing: '0.04em',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                  }}
                >
                  Meso 0{m.number}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {m.dates} · {m.phaseSummary}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontFamily: 'var(--ff-display)',
                    fontSize: 16,
                    color: 'var(--accent)',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {m.sessions.done}/{m.sessions.total}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginTop: 2,
                  }}
                >
                  {open ? 'Hide' : 'View'}
                </div>
              </div>
            </button>
            {open && (
              <div
                style={{
                  padding: '4px 14px 16px 14px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--ff-display)',
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    margin: '12px 0 8px 0',
                  }}
                >
                  Lifts by muscle
                </div>
                {m.liftsByMuscle.map((grp) => (
                  <div key={grp.muscle} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontFamily: 'var(--ff-display)',
                        fontSize: 13,
                        letterSpacing: '0.08em',
                        color: 'var(--accent)',
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}
                    >
                      {grp.muscle}
                    </div>
                    {grp.lifts.map((l, i) => (
                      <div
                        key={l.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '5px 0',
                          borderBottom:
                            i < grp.lifts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              lineHeight: 1.2,
                            }}
                          >
                            {l.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {l.start} → {l.end} lb · PR {l.pr}
                          </div>
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--ff-display)',
                            fontSize: 16,
                            color: 'var(--accent)',
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1,
                          }}
                        >
                          +{l.end - l.start}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                <div
                  style={{
                    fontFamily: 'var(--ff-display)',
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    margin: '6px 0 6px 0',
                  }}
                >
                  Cardio
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {m.cardio.sessions} sessions · {m.cardio.totalMin} min
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>BW {m.bwDelta}</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </Shell>
  );
}

// ============ shared primitives ============

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--ff-display)',
        fontSize: 11,
        letterSpacing: '0.18em',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 6,
      }}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{children}</div>
  );
}
