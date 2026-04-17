import React from 'react';
import { loadArchive } from '../../utils/store';
import { tokens } from '../../styles/tokens';
import { getMeso, getMesoRows, getProgTargets, PHASE_COLOR } from '../../data/constants';
import type { Profile, TrainingDay } from '../../types';

interface MesoOverviewProps {
  tab: string;
  goBack: () => void;
  goTo: (tab: string | number) => void;
  activeDays: TrainingDay[];
  completedDays: Set<string>;
  profile: Profile;
  currentWeek: number;
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
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Meso Overview Content ─────────────────────────────────────────────────

function MesoOverviewContent({ activeDays, currentWeek }: { activeDays: TrainingDay[]; currentWeek: number }) {
  const meso = getMeso();
  const mesoRows = getMesoRows();
  const progTargets = getProgTargets();

  const splitLabels: Record<string, string> = {
    ppl: 'Push / Pull / Legs',
    upper_lower: 'Upper / Lower',
    full_body: 'Full Body',
    push_pull: 'Push / Pull',
  };

  const tags = [...new Set(activeDays.map((d) => d.tag).filter(Boolean))];
  const splitDisplay =
    tags.length > 0
      ? tags.join(' / ')
      : splitLabels[meso.splitType] || meso.splitType;

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
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 }}>
          PROGRAM
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 4 }}>Split</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {splitDisplay}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 4 }}>Duration</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {meso.weeks} weeks
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 4 }}>Sessions/wk</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {meso.days}
            </div>
          </div>
        </div>
      </div>

      {/* Week-by-week breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
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
                padding: '14px 16px',
                background: isCurrent ? `${color}14` : 'var(--bg-card)',
                border: `1px solid ${color}${isCurrent ? '88' : '55'}`,
                borderRadius: tokens.radius.lg,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: tokens.radius.sm,
                    background: `${color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    color: color,
                    flexShrink: 0,
                  }}
                >
                  {weekNum}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {isDeload ? 'Deload' : phase}
                    </span>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          color: color,
                          background: `${color}18`,
                          border: `1px solid ${color}33`,
                          borderRadius: tokens.radius.sm,
                          padding: '2px 6px',
                        }}
                      >
                        CURRENT
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: color,
                    background: `${color}12`,
                    padding: '4px 10px',
                    borderRadius: tokens.radius.sm,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {rir}
                </div>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginLeft: 44 }}>
                {guidance}
              </div>
              {(weightProg || repsProg) && (
                <div style={{ display: 'flex', gap: 8, marginLeft: 44, marginTop: 8 }}>
                  {weightProg && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '3px 8px',
                        borderRadius: tokens.radius.xs,
                      }}
                    >
                      Load: {weightProg}
                    </span>
                  )}
                  {repsProg && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '3px 8px',
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
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 }}>
          VOLUME STRATEGY
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'MEV', desc: 'Minimum Effective Volume — early weeks build baseline with fewer sets', color: 'var(--phase-accum)' },
            { label: 'MAV', desc: 'Maximum Adaptive Volume — mid-meso sweet spot for growth stimulus', color: 'var(--phase-intens)' },
            { label: 'MRV', desc: 'Maximum Recoverable Volume — peak weeks push volume to the limit', color: 'var(--phase-peak)' },
          ].map(({ label, desc, color }) => (
            <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 44,
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: color,
                  background: `${color}15`,
                  padding: '4px 0',
                  borderRadius: tokens.radius.xs,
                  textAlign: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {label}
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
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
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
          Meso History
        </span>
      </div>
      {archive.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
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
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {String(entry.profile?.split || 'Program')} — {String(entry.profile?.weeks || '?')} weeks
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
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
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
          Weekly Summary
        </span>
      </div>
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Weekly summary view coming soon
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────

function MesoOverview({ tab, goBack, goTo: _goTo, activeDays, completedDays, profile, currentWeek }: MesoOverviewProps) {
  if (tab === 'overview') {
    return (
      <div style={{ animation: 'tabFadeIn 0.15s ease-out' }}>
        <SubHeader label="MESO OVERVIEW" goBack={goBack} />
        <MesoOverviewContent activeDays={activeDays} currentWeek={currentWeek} />
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
