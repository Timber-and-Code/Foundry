import { forwardRef, useRef, useState, type CSSProperties } from 'react';

// Preview-only sandbox for the Schedule tab's MESO OVERVIEW modal.
// Adds a phase-colored segment bar at top that complements (doesn't
// replace) the existing week-by-week cards. Tapping a bar segment
// smooth-scrolls to and briefly highlights the matching week card.

type SegStatus = 'done' | 'current' | 'upcoming';
type PhaseName = 'Establish' | 'Accumulation' | 'Intensification' | 'Peak' | 'Deload';

const PHASE_COLOR: Record<PhaseName, string> = {
  Establish: '#7A7269',
  Accumulation: '#E8E4DC',
  Intensification: '#E8651A',
  Peak: '#D4983C',
  Deload: '#5B8FA8',
};

interface WeekRow {
  label: string; // "Wk 1", "Deload"
  weekNum: string; // "1", "D"
  phase: PhaseName;
  rir: string;
  guidance: string;
  loadProg?: string;
  repsProg?: string;
  status: SegStatus;
}

const MESO = {
  number: 7,
  split: 'Push / Pull / Legs',
  totalWeeks: 7,
  sessionsPerWeek: 6,
  weeks: [
    {
      label: 'Wk 1',
      weekNum: '1',
      phase: 'Establish',
      rir: '3 RIR',
      guidance:
        'Establish your baseline. Find a challenging but manageable working weight — no rep targets this week.',
      loadProg: 'Baseline',
      status: 'done',
    },
    {
      label: 'Wk 2',
      weekNum: '2',
      phase: 'Accumulation',
      rir: '2-3 RIR',
      guidance: 'Match weights with better technique. Small adds if easy.',
      loadProg: '+2.5 lb',
      repsProg: '8-12',
      status: 'done',
    },
    {
      label: 'Wk 3',
      weekNum: '3',
      phase: 'Accumulation',
      rir: '2 RIR',
      guidance: '+5 lbs anchors. Push closer to failure on accessories.',
      loadProg: '+5 lb',
      repsProg: '8-12',
      status: 'done',
    },
    {
      label: 'Wk 4',
      weekNum: '4',
      phase: 'Intensification',
      rir: '1-2 RIR',
      guidance: '+5 lbs anchors again. Accessories +2.5–5 lbs.',
      loadProg: '+5 lb',
      repsProg: '6-10',
      status: 'done',
    },
    {
      label: 'Wk 5',
      weekNum: '5',
      phase: 'Intensification',
      rir: '1 RIR',
      guidance: '+5 lbs. One rep from failure. Push hard.',
      loadProg: '+5 lb',
      repsProg: '6-10',
      status: 'done',
    },
    {
      label: 'Wk 6',
      weekNum: '6',
      phase: 'Peak',
      rir: '0-1 RIR',
      guidance: 'PR attempts on anchors. Maximum effort week.',
      loadProg: 'PR',
      repsProg: '4-8',
      status: 'current',
    },
    {
      label: 'Deload',
      weekNum: 'D',
      phase: 'Deload',
      rir: 'N/A',
      guidance: '50–60% of peak weight. 2 sets only. Zero failure. Recover.',
      status: 'upcoming',
    },
  ] as WeekRow[],
};

export default function ScheduleOverviewPreview() {
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);

  const scrollToWeek = (i: number) => {
    const el = cardRefs.current[i];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightIdx(i);
    window.setTimeout(() => setHighlightIdx((cur) => (cur === i ? null : cur)), 1200);
  };

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
      {/* Back affordance (matches SubHeader pattern in live MesoOverview) */}
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginBottom: 14,
          letterSpacing: '0.08em',
          fontWeight: 600,
        }}
      >
        ‹ SCHEDULE · MESO OVERVIEW
      </div>

      {/* Heading */}
      <div
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 32,
          letterSpacing: '0.04em',
          marginBottom: 4,
          lineHeight: 1,
        }}
      >
        MESO 0{MESO.number}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {MESO.split} · {MESO.totalWeeks} weeks · {MESO.sessionsPerWeek} sessions/week
      </div>

      {/* Program card */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 14,
          display: 'flex',
          gap: 12,
        }}
      >
        <ProgramStat label="Split" value={MESO.split} />
        <ProgramStat label="Duration" value={`${MESO.totalWeeks} weeks`} />
        <ProgramStat label="Sessions/wk" value={String(MESO.sessionsPerWeek)} />
      </div>

      {/* Phase-colored segment bar */}
      <SectionLabel>Phase progression</SectionLabel>
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '14px 12px 12px 12px',
          marginBottom: 18,
        }}
      >
        <PhaseBar weeks={MESO.weeks} onTap={scrollToWeek} />
      </div>

      {/* Week-by-week cards */}
      <SectionLabel>Week-by-week breakdown</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MESO.weeks.map((w, i) => (
          <WeekCard
            key={i}
            ref={(el) => { cardRefs.current[i] = el; }}
            week={w}
            highlighted={highlightIdx === i}
          />
        ))}
      </div>

      {/* Volume strategy card */}
      <SectionLabel>Volume strategy</SectionLabel>
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 14,
        }}
      >
        {[
          {
            label: 'MEV',
            color: PHASE_COLOR.Accumulation,
            desc: 'Minimum Effective Volume — early weeks build baseline with fewer sets.',
          },
          {
            label: 'MAV',
            color: PHASE_COLOR.Intensification,
            desc: 'Maximum Adaptive Volume — mid-meso sweet spot for growth stimulus.',
          },
          {
            label: 'MRV',
            color: PHASE_COLOR.Peak,
            desc: 'Maximum Recoverable Volume — peak weeks push volume to the limit.',
          },
        ].map((x) => (
          <div key={x.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '6px 0' }}>
            <div
              style={{
                width: 48,
                fontFamily: 'var(--ff-display)',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: x.color,
                background: `${x.color}15`,
                padding: '4px 0',
                borderRadius: 4,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {x.label}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{x.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Phase bar ============

function PhaseBar({ weeks, onTap }: { weeks: WeekRow[]; onTap: (i: number) => void }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
        gap: 4,
        alignItems: 'end',
      }}
    >
      {weeks.map((w, i) => {
        const color = PHASE_COLOR[w.phase];
        const isDone = w.status === 'done';
        const isCurrent = w.status === 'current';
        const segStyle: CSSProperties = {
          height: 12,
          borderRadius: 3,
          background:
            isDone ? color : isCurrent ? color : `${color}4D`, // 30% opacity for upcoming
          boxShadow: isDone ? `0 0 6px ${color}88` : undefined,
          border: isCurrent ? '1.5px solid var(--text-primary)' : '1px solid transparent',
          transition: 'background 200ms, box-shadow 200ms',
        };
        const weekLabel = isCurrent ? 'var(--text-primary)' : 'var(--text-muted)';
        const phaseLabel = isDone
          ? color
          : isCurrent
          ? 'var(--text-primary)'
          : `${color}B3`;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onTap(i)}
            aria-label={`${w.label} ${w.phase}: ${w.status}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'inherit',
            }}
          >
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  color: weekLabel,
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
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  color: phaseLabel,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {w.phase === 'Intensification'
                  ? 'Intens'
                  : w.phase === 'Accumulation'
                  ? 'Accum'
                  : w.phase === 'Establish'
                  ? 'Est'
                  : w.phase}
              </div>
            </div>
            <div style={segStyle} />
          </button>
        );
      })}
    </div>
  );
}

// ============ Week card (refs so bar can scroll to them) ============

interface WeekCardProps {
  week: WeekRow;
  highlighted: boolean;
}

const WeekCard = forwardRef<HTMLDivElement, WeekCardProps>(function WeekCard(
  { week, highlighted },
  ref,
) {
  const color = PHASE_COLOR[week.phase];
  const isCurrent = week.status === 'current';
  const isDone = week.status === 'done';
  return (
    <div
      ref={ref}
      style={{
        padding: '14px 16px',
        background: isCurrent ? `${color}22` : isDone ? `${color}14` : `${color}0E`,
        border: `1px solid ${isCurrent ? color : `${color}55`}`,
        borderRadius: 12,
        boxShadow: highlighted ? `0 0 0 2px ${color}, 0 0 16px ${color}66` : undefined,
        transition: 'box-shadow 250ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 6,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--ff-display)',
            fontSize: 15,
            fontWeight: 800,
            color: 'var(--text-primary)',
            flexShrink: 0,
          }}
        >
          {week.weekNum}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: 16,
                letterSpacing: '0.04em',
                fontWeight: 700,
                color: 'var(--text-primary)',
                textTransform: 'uppercase',
              }}
            >
              {week.phase}
            </span>
            {isCurrent && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: 'var(--text-primary)',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                CURRENT
              </span>
            )}
            {isDone && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: 'var(--text-muted)',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                ✓ DONE
              </span>
            )}
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
            background: 'rgba(0,0,0,0.35)',
            padding: '4px 10px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {week.rir}
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginLeft: 44 }}>
        {week.guidance}
      </div>
      {(week.loadProg || week.repsProg) && (
        <div style={{ display: 'flex', gap: 8, marginLeft: 44, marginTop: 8 }}>
          {week.loadProg && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.04)',
                padding: '3px 8px',
                borderRadius: 4,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Load: {week.loadProg}
            </span>
          )}
          {week.repsProg && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.04)',
                padding: '3px 8px',
                borderRadius: 4,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Reps: {week.repsProg}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

// ============ shared primitives ============

function ProgramStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 14,
          letterSpacing: '0.02em',
          color: 'var(--text-primary)',
          textTransform: 'uppercase',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
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
