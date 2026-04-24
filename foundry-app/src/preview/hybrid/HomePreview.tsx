import { useState, type CSSProperties } from 'react';
import { PHASE_COLORS, type Phase } from '../forge-v2/fixtures';

type WorkoutStatus = 'done' | 'current' | 'upcoming';

// Preview-only fixture for the Home dashboard. Meso 07, week 4 of 7,
// Intensification phase, PPL x2 split (6 training days). Mon–Wed done,
// Thu is today, Fri/Sat ahead, Sun rest (not on the workout bar).
const HOME_FIXTURE = {
  name: 'Timber',
  mesoNumber: 7,
  totalWeeks: 7,
  currentWeekIdx: 3,
  phase: 'Intensification' as Phase,
  rir: '1–2 RIR',
  workouts: [
    { label: 'Mon', tag: 'Push A', status: 'done' as WorkoutStatus },
    { label: 'Tue', tag: 'Pull A', status: 'done' as WorkoutStatus },
    { label: 'Wed', tag: 'Legs A', status: 'done' as WorkoutStatus },
    { label: 'Thu', tag: 'Push B', status: 'current' as WorkoutStatus },
    { label: 'Fri', tag: 'Pull B', status: 'upcoming' as WorkoutStatus },
    { label: 'Sat', tag: 'Legs B', status: 'upcoming' as WorkoutStatus },
  ],
};

export default function HomePreview() {
  const [toast, setToast] = useState<string | null>(null);
  const phaseColor = PHASE_COLORS[HOME_FIXTURE.phase];

  const goToProgress = () => {
    // Sandbox stub — real app routes to `/progress` tab. The entire card
    // is one tappable target so tap target never confuses the user.
    setToast('→ Progress tab (sandbox stub)');
    window.setTimeout(() => setToast(null), 1200);
  };

  const doneCount = HOME_FIXTURE.workouts.filter((w) => w.status === 'done').length;
  const totalCount = HOME_FIXTURE.workouts.length;

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
      {/* Greeting */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: '0.01em',
          marginBottom: 14,
        }}
      >
        Good afternoon,{' '}
        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{HOME_FIXTURE.name}</span>.
      </div>

      {/* Unified dashboard card — redesigned. Entire card is one tap
          target. Replaces SVG progress ring with the week-segment bar
          used in Focus Mode's session progress. */}
      <button
        onClick={goToProgress}
        aria-label="Open progress"
        style={{
          width: '100%',
          background: 'var(--bg-card)',
          border: `1px solid ${phaseColor}44`,
          borderRadius: 12,
          padding: '16px 16px 14px 16px',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          color: 'inherit',
          transition: 'border-color 150ms, transform 120ms',
          boxShadow: `0 2px 12px ${phaseColor}14`,
          marginBottom: 14,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = phaseColor;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = `${phaseColor}44`;
          e.currentTarget.style.transform = 'none';
        }}
      >
        {/* Header row: phase chip + week text + week completion + RIR */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 16,
              letterSpacing: '0.12em',
              color: phaseColor,
              background: `${phaseColor}18`,
              padding: '3px 10px',
              borderRadius: 6,
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}
          >
            {HOME_FIXTURE.phase}
          </span>
          <span
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 16,
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)',
            }}
          >
            WK {HOME_FIXTURE.currentWeekIdx + 1} / {HOME_FIXTURE.totalWeeks}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {doneCount}/{totalCount} · {HOME_FIXTURE.rir}
          </span>
        </div>

        {/* Weekly workout bar — one segment per training day of this week
            (rest days excluded). Convention:
              done     → accent orange with soft glow
              current  → greyish-white (no pulse)
              upcoming → darker grey
            Each segment is captioned above with the day + workout tag so
            the whole bar reads as a status-with-labels glance. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${HOME_FIXTURE.workouts.length}, 1fr)`,
            gap: 4,
            alignItems: 'end',
          }}
        >
          {HOME_FIXTURE.workouts.map((w, i) => {
            const isDone = w.status === 'done';
            const isCurrent = w.status === 'current';
            const segStyle: CSSProperties = {
              height: 10,
              borderRadius: 3,
              background: 'var(--border-subtle)',
              transition: 'background 200ms',
            };
            if (isDone) {
              segStyle.background = phaseColor;
              segStyle.boxShadow = `0 0 6px ${phaseColor}88`;
            } else if (isCurrent) {
              segStyle.background = 'var(--text-secondary)';
            }
            const tagColor = isDone
              ? phaseColor
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
                    {w.tag}
                  </div>
                </div>
                <div style={segStyle} aria-label={`${w.label} ${w.tag}: ${w.status}`} />
              </div>
            );
          })}
        </div>
      </button>

      {/* Today block (CTA placeholder for start workout) */}
      <div style={{ marginTop: 22 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.25em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Today · Push B
        </div>
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-card)',
            border: `1px solid ${phaseColor}33`,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: 26,
                letterSpacing: '0.04em',
                color: 'var(--text-primary)',
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              PUSH B
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              6 exercises · ~65 min
            </div>
          </div>
          <a
            href="/preview/hybrid/focus"
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              background: phaseColor,
              color: 'var(--bg-root)',
              fontFamily: 'var(--ff-body)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              boxShadow: `0 4px 14px ${phaseColor}3a`,
            }}
          >
            Start
          </a>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 40,
            left: 20,
            right: 20,
            margin: '0 auto',
            maxWidth: 320,
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            border: `1px solid ${phaseColor}`,
            borderRadius: 10,
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textAlign: 'center',
            boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
            animation: 'hl-slide-up 220ms ease-out',
            zIndex: 30,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

