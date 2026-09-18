import { useState, useEffect } from 'react';
import { tokens } from '../../styles/tokens';
import { emit, on } from '../../utils/events';
import { formatSplitName, dayDisplayName } from '../../utils/splitLabel';
import { loadNextMesoDraft } from '../../utils/nextMeso';

/**
 * Deload-week card on Home: plan the next meso while this one winds down.
 *
 * No plan yet → one CTA into the planner. A plan saved → its summary, a
 * preview of the days, Edit, and Start now. Starting early ends the current
 * meso, so it asks first — inline, never a browser dialog.
 *
 * The draft is re-read on every render: saving it happens in the planner,
 * which unmounts Home, so a fresh mount always sees the latest.
 */
export default function NextMesoCard() {
  const draft = loadNextMesoDraft();
  const [showPreview, setShowPreview] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [starting, setStarting] = useState(false);
  // On success Home remounts with the new meso; only a failure needs the
  // button handed back.
  useEffect(() => on('foundry:start-planned-meso-failed', () => setStarting(false)), []);

  const eyebrow: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.16em',
    color: 'var(--accent)',
    textTransform: 'uppercase',
    marginBottom: 6,
  };
  const title: React.CSSProperties = {
    fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
    fontSize: 28,
    lineHeight: 1.05,
    letterSpacing: '0.02em',
    color: 'var(--text-primary)',
    fontWeight: 400,
  };
  const body: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    marginTop: 6,
  };
  const primaryBtn: React.CSSProperties = {
    flex: 1,
    minHeight: 48,
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: '0.04em',
    borderRadius: tokens.radius.lg,
    background: 'var(--btn-primary-bg)',
    border: '1px solid var(--btn-primary-border)',
    color: 'var(--btn-primary-text)',
    cursor: 'pointer',
  };
  const secondaryBtn: React.CSSProperties = {
    flex: 1,
    minHeight: 48,
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 700,
    borderRadius: tokens.radius.lg,
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  };

  const card: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--accent-border, rgba(232,101,26,0.3))',
    borderRadius: tokens.radius.lg,
    padding: 16,
    boxShadow: 'var(--shadow-sm)',
  };

  if (!draft) {
    return (
      <section style={card} aria-labelledby="next-meso-title">
        <div style={eyebrow}>Deload week</div>
        <div id="next-meso-title" style={title}>Plan your next meso</div>
        <p style={{ ...body, margin: '6px 0 14px' }}>
          Decide what's next while you recover. Nothing changes until you start it — it's ready
          the moment you finish this week.
        </p>
        <button type="button" style={{ ...primaryBtn, width: '100%' }} onClick={() => emit('foundry:plan-next-meso')}>
          Plan next meso <span aria-hidden="true">→</span>
        </button>
      </section>
    );
  }

  const { profile, program } = draft;
  // Days per week is the lifter's schedule, not however many days the
  // program happens to hold.
  const daysPerWeek = profile.workoutDays?.length || profile.daysPerWeek || program.length;
  const days = program.slice(0, daysPerWeek);
  const summary = [
    formatSplitName(profile.splitType),
    `${daysPerWeek} days/wk`,
    profile.mesoLength ? `${profile.mesoLength} weeks + deload` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section style={card} aria-labelledby="next-meso-title">
      <div style={eyebrow}>Next meso planned</div>
      <div id="next-meso-title" style={title}>{summary}</div>
      <p style={{ ...body, margin: '6px 0 12px' }}>
        Starts when you finish your deload. Feeling recovered sooner? Start it now.
      </p>

      <button
        type="button"
        aria-expanded={showPreview}
        aria-controls="next-meso-preview"
        onClick={() => setShowPreview((v) => !v)}
        style={{
          ...secondaryBtn,
          width: '100%',
          minHeight: 44,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span>{showPreview ? 'Hide days' : 'Preview days'}</span>
        <span aria-hidden="true">{showPreview ? '▴' : '▾'}</span>
      </button>

      {showPreview && (
        <div id="next-meso-preview" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {days.map((day, i) => (
            <div
              key={i}
              style={{
                padding: '10px 12px',
                borderRadius: tokens.radius.md,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle, var(--border))',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-primary)', marginBottom: 4 }}>
                {dayDisplayName(day, i).toUpperCase()}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {(day.exercises || []).map((ex) => ex.name).join(' · ') || 'No exercises'}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmStart ? (
        <div role="group" aria-labelledby="next-meso-confirm">
          <p id="next-meso-confirm" style={{ ...body, margin: '0 0 10px', color: 'var(--text-primary)' }}>
            End this meso now? Deload sessions you haven't done won't be logged. Everything you've
            logged is saved to your history.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={secondaryBtn} onClick={() => setConfirmStart(false)} disabled={starting}>
              Cancel
            </button>
            <button
              type="button"
              style={{ ...primaryBtn, opacity: starting ? 0.6 : 1 }}
              disabled={starting}
              onClick={() => {
                setStarting(true);
                emit('foundry:start-planned-meso');
              }}
            >
              {starting ? 'Starting…' : 'Start next meso'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={secondaryBtn} onClick={() => emit('foundry:plan-next-meso')}>
            Edit plan
          </button>
          <button type="button" style={primaryBtn} onClick={() => setConfirmStart(true)}>
            Start now
          </button>
        </div>
      )}
    </section>
  );
}
