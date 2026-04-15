import React from 'react';
import { loadArchive, store } from '../../utils/store';
import { tokens } from '../../styles/tokens';
import { getMeso, getWeekPhase, getMesoRows, getProgTargets, PHASE_COLOR } from '../../data/constants';
import type { Profile, TrainingDay } from '../../types';

interface MesoOverviewProps {
  tab: string;
  goBack: () => void;
  goTo: (tab: string | number) => void;
  activeDays: TrainingDay[];
  completedDays: Set<string>;
  profile: Profile;
}

// ── SubHeader ─────────────────────────────────────────────────────────────

function SubHeader({ label, goBack }: { label: string; goBack: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 16px 12px',
        background: 'var(--bg-deep)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <button
        onClick={goBack}
        className="btn-ghost"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--accent)',
          fontSize: 20,
          lineHeight: 1,
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          minWidth: 44,
          minHeight: 44,
          justifyContent: 'center',
        }}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Meso Overview Content ─────────────────────────────────────────────────

function MesoOverviewContent() {
  const meso = getMeso();
  const phases = getWeekPhase();
  const mesoRows = getMesoRows();
  const progTargets = getProgTargets();
  const currentWeek = parseInt(store.get('foundry:currentWeek') || '0');

  const splitLabels: Record<string, string> = {
    ppl: 'Push / Pull / Legs',
    upper_lower: 'Upper / Lower',
    full_body: 'Full Body',
    push_pull: 'Push / Pull',
  };

  // Group weeks by phase for the phase summary
  const phaseGroups: { phase: string; weeks: number[]; color: string }[] = [];
  phases.forEach((phase, idx) => {
    const last = phaseGroups[phaseGroups.length - 1];
    if (last && last.phase === phase) {
      last.weeks.push(idx);
    } else {
      phaseGroups.push({
        phase,
        weeks: [idx],
        color: (PHASE_COLOR as Record<string, string>)[phase] || 'var(--accent)',
      });
    }
  });

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Program summary card */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          padding: '16px',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 10 }}>
          PROGRAM
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Split</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {splitLabels[meso.splitType] || meso.splitType}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Duration</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {meso.weeks} weeks
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Sessions/wk</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {meso.days}
            </div>
          </div>
        </div>
      </div>

      {/* Phase progression bar */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          padding: '16px',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 }}>
          PHASE PROGRESSION
        </div>
        <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
          {phases.map((phase, w) => {
            const color = (PHASE_COLOR as Record<string, string>)[phase] || 'var(--accent)';
            const isCurrent = w === currentWeek;
            return (
              <div
                key={w}
                style={{
                  flex: 1,
                  height: isCurrent ? 8 : 6,
                  borderRadius: tokens.radius.xs,
                  background: color,
                  opacity: w <= currentWeek ? 1 : 0.3,
                  transition: 'all 0.2s',
                  border: isCurrent ? `1px solid ${color}` : 'none',
                  boxShadow: isCurrent ? `0 0 6px ${color}55` : 'none',
                }}
                title={`Week ${w + 1} — ${phase}`}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {phaseGroups.map(({ phase, weeks, color }) => (
            <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: tokens.radius.xs, background: color }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {phase} <span style={{ color: 'var(--text-dim)' }}>W{weeks[0] + 1}–{weeks[weeks.length - 1] + 1}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Week-by-week breakdown */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 16px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
          WEEK-BY-WEEK BREAKDOWN
        </div>
        {mesoRows.map((row, i) => {
          const [weekIdx, rir, phase, guidance] = row;
          const isDeload = weekIdx === null;
          const weekNum = isDeload ? 'D' : weekIdx + 1;
          const color = (PHASE_COLOR as Record<string, string>)[phase] || 'var(--phase-deload)';
          const isCurrent = weekIdx === currentWeek;
          const weightProg = !isDeload && progTargets.weight[weekIdx] ? progTargets.weight[weekIdx] : null;
          const repsProg = !isDeload && progTargets.reps[weekIdx] ? progTargets.reps[weekIdx] : null;

          return (
            <div
              key={i}
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.04))',
                background: isCurrent ? `${color}14` : `${color}06`,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: tokens.radius.sm,
                    background: `${color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    color: color,
                    flexShrink: 0,
                  }}
                >
                  {weekNum}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {isDeload ? 'Deload' : phase}
                    </span>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          color: color,
                          background: `${color}18`,
                          border: `1px solid ${color}33`,
                          borderRadius: tokens.radius.sm,
                          padding: '1px 5px',
                        }}
                      >
                        CURRENT
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: color,
                    background: `${color}12`,
                    padding: '3px 8px',
                    borderRadius: tokens.radius.sm,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {rir}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginLeft: 38 }}>
                {guidance}
              </div>
              {(weightProg || repsProg) && (
                <div style={{ display: 'flex', gap: 8, marginLeft: 38, marginTop: 6 }}>
                  {weightProg && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '2px 6px',
                        borderRadius: tokens.radius.xs,
                      }}
                    >
                      Load: {weightProg}
                    </span>
                  )}
                  {repsProg && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '2px 6px',
                        borderRadius: tokens.radius.xs,
                      }}
                    >
                      Reps: {repsProg}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Volume philosophy card */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          padding: '16px',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 10 }}>
          VOLUME STRATEGY
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'MEV', desc: 'Minimum Effective Volume — early weeks build baseline with fewer sets', color: 'var(--phase-accum)' },
            { label: 'MAV', desc: 'Maximum Adaptive Volume — mid-meso sweet spot for growth stimulus', color: 'var(--phase-intens)' },
            { label: 'MRV', desc: 'Maximum Recoverable Volume — peak weeks push volume to the limit', color: 'var(--phase-peak)' },
          ].map(({ label, desc, color }) => (
            <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 36,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: color,
                  background: `${color}15`,
                  padding: '3px 0',
                  borderRadius: tokens.radius.xs,
                  textAlign: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {label}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Meso History ──────────────────────────────────────────────────────────

function MesoHistory({ goBack }: { goBack: () => void }) {
  const archive = loadArchive?.() || [];
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px',
        }}
      >
        <button
          onClick={goBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-accent)',
            fontSize: 18,
            cursor: 'pointer',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span aria-hidden="true">←</span>
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
          Meso History
        </span>
      </div>
      {archive.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No archived mesocycles yet
        </div>
      ) : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {archive.map((entry, idx) => (
            <div
              key={idx}
              style={{
                padding: 16,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {String(entry.profile?.split || 'Program')} — {String(entry.profile?.weeks || '?')} weeks
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Archived {String(entry.date || 'unknown date')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Weekly Summary ────────────────────────────────────────────────────────

function WeeklySummary({ goBack }: { activeDays: TrainingDay[]; completedDays: Set<string>; goBack: () => void; profile: Profile }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px' }}>
        <button
          onClick={goBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-accent)',
            fontSize: 18,
            cursor: 'pointer',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span aria-hidden="true">←</span>
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
          Weekly Summary
        </span>
      </div>
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Weekly summary view coming soon
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────

function MesoOverview({ tab, goBack, goTo: _goTo, activeDays, completedDays, profile }: MesoOverviewProps) {
  if (tab === 'overview') {
    return (
      <div style={{ animation: 'tabFadeIn 0.15s ease-out' }}>
        <SubHeader label="MESO OVERVIEW" goBack={goBack} />
        <MesoOverviewContent />
      </div>
    );
  }

  if (tab === 'history') {
    return <MesoHistory goBack={goBack} />;
  }

  if (tab === 'weekly') {
    return (
      <WeeklySummary
        activeDays={activeDays}
        completedDays={completedDays}
        goBack={goBack}
        profile={profile}
      />
    );
  }

  return null;
}

export default React.memo(MesoOverview);
