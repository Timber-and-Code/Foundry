import React, { useMemo } from 'react';
import { tokens } from '../../styles/tokens';
import HammerIcon from '../shared/HammerIcon';
import {
  TAG_ACCENT,
  VOLUME_LANDMARKS,
  getMeso,
  getWeekPhase,
} from '../../data/constants';
import {
  calcMuscleSetsByTag,
  flattenMuscleSets,
  getLandmarkStatus,
  calcSessionStats,
  buildPRTimeline,
  loadAnchorCharts,
  VOLUME_LEGEND,
  BAND_MV,
  BAND_OPT,
  BAND_EXCEED,
  TICK_COLOR,
} from '../../utils/analyticsData';
import type { TrainingDay } from '../../types';
import type { AnchorChartData, PRTimelineEntry } from '../../utils/analyticsData';

// ── Props ───────────────────────────────────────────────────────────────────

interface AnalyticsViewProps {
  completedDays: Set<string>;
  activeDays: TrainingDay[];
  goBack: () => void;
}

// ── Stat box helper ─────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--bg-card)',
        border: `1px solid ${color}33`,
        borderRadius: tokens.radius.lg,
        padding: '16px 12px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          marginTop: 4,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Section header helper ───────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: 'var(--accent)',
        marginBottom: 8,
        marginTop: 24,
      }}
    >
      {title}
    </div>
  );
}

// ── Strength Chart (SVG) ────────────────────────────────────────────────────

function StrengthChart({ chart }: { chart: AnchorChartData }) {
  const phases = getWeekPhase();
  const phaseColors: Record<string, string> = {
    Accumulation: 'rgba(232,228,220,0.06)',
    Intensification: 'rgba(232,101,26,0.08)',
    Peak: 'rgba(212,152,60,0.08)',
    Deload: 'rgba(91,143,168,0.08)',
  };

  const pts = chart.points;
  if (pts.length < 1) return null;

  const ac = (TAG_ACCENT as Record<string, string>)[chart.tag || ''] || 'var(--accent)';

  // Chart dimensions
  const W = 320;
  const H = 140;
  const padL = 44;
  const padR = 12;
  const padT = 16;
  const padB = 26;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const values = pts.map((p) => p.e1rm);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 10;
  const yMin = Math.floor(minV - range * 0.15);
  const yMax = Math.ceil(maxV + range * 0.15);
  const yRange = yMax - yMin || 1;

  const xScale = (i: number) => padL + (pts.length > 1 ? (i / (pts.length - 1)) * chartW : chartW / 2);
  const yScale = (v: number) => padT + chartH - ((v - yMin) / yRange) * chartH;

  // Y-axis ticks (3-4)
  const yTicks: number[] = [];
  const step = Math.ceil(yRange / 3 / 5) * 5;
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
    yTicks.push(v);
  }

  // Line path
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(p.e1rm).toFixed(1)}`).join(' ');

  // Detect PRs: each point that exceeds all prior points
  const prWeeks = new Set<number>();
  let bestSoFar = 0;
  pts.forEach((p) => {
    if (bestSoFar > 0 && p.e1rm > bestSoFar) prWeeks.add(p.week);
    if (p.e1rm > bestSoFar) bestSoFar = p.e1rm;
  });

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <HammerIcon size={14} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {chart.name}
          </span>
          {chart.isPR && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#c9a227',
                background: '#c9a22722',
                border: '1px solid #c9a22744',
                borderRadius: tokens.radius.sm,
                padding: '1px 5px',
                letterSpacing: '0.06em',
              }}
            >
              PR
            </span>
          )}
          {chart.isStalling && !chart.isPR && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#f87171',
                background: '#f8717122',
                border: '1px solid #f8717144',
                borderRadius: tokens.radius.sm,
                padding: '1px 5px',
                letterSpacing: '0.06em',
              }}
            >
              STALLING
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: chart.isPR ? '#c9a227' : chart.isStalling ? '#f87171' : ac,
              letterSpacing: '-0.02em',
            }}
          >
            {chart.current}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>lbs</span>
        </div>
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Phase background bands */}
        {pts.map((p, i) => {
          const phase = phases[p.week] || 'Accumulation';
          const bandColor = phaseColors[phase] || phaseColors.Accumulation;
          const x1 = i === 0 ? padL : (xScale(i - 1) + xScale(i)) / 2;
          const x2 = i === pts.length - 1 ? padL + chartW : (xScale(i) + xScale(i + 1)) / 2;
          return (
            <rect
              key={`phase-${i}`}
              x={x1}
              y={padT}
              width={x2 - x1}
              height={chartH}
              fill={bandColor}
            />
          );
        })}

        {/* Y-axis ticks and grid lines */}
        {yTicks.map((v) => (
          <g key={`ytick-${v}`}>
            <line
              x1={padL}
              x2={padL + chartW}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="var(--border)"
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
            <text
              x={padL - 6}
              y={yScale(v) + 3.5}
              textAnchor="end"
              fill="var(--text-dim)"
              fontSize={9}
              fontWeight={600}
            >
              {v}
            </text>
          </g>
        ))}

        {/* All-time best dashed line */}
        <line
          x1={padL}
          x2={padL + chartW}
          y1={yScale(chart.allTimeBest)}
          y2={yScale(chart.allTimeBest)}
          stroke="#c9a227"
          strokeWidth={0.75}
          strokeDasharray="4,3"
          opacity={0.5}
        />

        {/* Data line */}
        <path d={linePath} fill="none" stroke={ac} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {pts.map((p, i) => {
          const isPRWeek = prWeeks.has(p.week);
          return (
            <circle
              key={`pt-${i}`}
              cx={xScale(i)}
              cy={yScale(p.e1rm)}
              r={isPRWeek ? 4.5 : 3}
              fill={isPRWeek ? '#c9a227' : ac}
              stroke={isPRWeek ? '#c9a22744' : 'none'}
              strokeWidth={isPRWeek ? 2 : 0}
            />
          );
        })}

        {/* PR labels */}
        {pts.map((p, i) =>
          prWeeks.has(p.week) ? (
            <text
              key={`pr-${i}`}
              x={xScale(i)}
              y={yScale(p.e1rm) - 8}
              textAnchor="middle"
              fill="#c9a227"
              fontSize={8}
              fontWeight={800}
            >
              PR
            </text>
          ) : null,
        )}

        {/* X-axis labels */}
        {pts.map((p, i) => (
          <text
            key={`x-${i}`}
            x={xScale(i)}
            y={H - 4}
            textAnchor="middle"
            fill="var(--text-dim)"
            fontSize={9}
            fontWeight={600}
          >
            W{p.week + 1}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Volume Card ─────────────────────────────────────────────────────────────

function VolumeCard({
  activeDays,
  completedDays,
}: {
  activeDays: TrainingDay[];
  completedDays: Set<string>;
}) {
  const [weekFilter, setWeekFilter] = React.useState<number | null>(null);
  const byTag = useMemo(
    () => calcMuscleSetsByTag(activeDays, completedDays, weekFilter),
    [activeDays, completedDays, weekFilter],
  );
  const muscleSets = flattenMuscleSets(byTag);
  const entries = Object.entries(muscleSets)
    .filter(
      ([m, s]) =>
        s > 0 && (VOLUME_LANDMARKS as Record<string, { mev: number; mavLow: number; mavHigh: number; mrv: number }>)[m],
    )
    .sort((a, b) => {
      const sa = getLandmarkStatus(
        a[1],
        (VOLUME_LANDMARKS as Record<string, { mev: number; mavLow: number; mavHigh: number; mrv: number }>)[a[0]],
      );
      const sb = getLandmarkStatus(
        b[1],
        (VOLUME_LANDMARKS as Record<string, { mev: number; mavLow: number; mavHigh: number; mrv: number }>)[b[0]],
      );
      const priority = (s: NonNullable<ReturnType<typeof getLandmarkStatus>>) =>
        s.label === 'Exceeding' ? 0 : s.label === 'MV' ? 1 : 2;
      return priority(sa!) - priority(sb!) || b[1] - a[1];
    });

  if (entries.length === 0)
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          padding: 24,
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}
      >
        Complete a workout to see volume data.
      </div>
    );

  const meso = getMeso();

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
      }}
    >
      {/* Header + filter */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Muscle Volume</div>
          <select
            value={weekFilter === null ? 'all' : String(weekFilter)}
            onChange={(e) => setWeekFilter(e.target.value === 'all' ? null : Number(e.target.value))}
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.sm,
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Weeks</option>
            {Array.from({ length: meso.weeks + 1 }, (_, i) => (
              <option key={i} value={i}>
                Week {i + 1}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {VOLUME_LEGEND.map(([c, label], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: tokens.radius.xs,
                  background: c,
                  opacity: 0.75,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bars */}
      <div style={{ padding: '0 16px 6px' }}>
        {entries.map(([muscle, sets], idx) => {
          const lm = (VOLUME_LANDMARKS as Record<string, { mev: number; mavLow: number; mavHigh: number; mrv: number }>)[muscle];
          const status = getLandmarkStatus(sets, lm)!;
          const scale = lm.mrv + 5;
          const mevPct = (lm.mev / scale) * 100;
          const mrvPct = (lm.mrv / scale) * 100;
          const fillPct = Math.min((sets / scale) * 100, 99);
          const isLast = idx === entries.length - 1;
          const optMid = (mevPct + mrvPct) / 2;

          return (
            <div
              key={muscle}
              style={{
                padding: '11px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
                  {muscle}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: status.color,
                    minWidth: 20,
                    textAlign: 'right',
                    lineHeight: 1,
                  }}
                >
                  {sets}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: status.color,
                    background: status.bg,
                    border: `1px solid ${status.border}`,
                    padding: '3px 9px',
                    borderRadius: tokens.radius.sm,
                    minWidth: 64,
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                >
                  {status.label}
                </div>
              </div>
              <div
                style={{
                  position: 'relative',
                  height: 14,
                  borderRadius: tokens.radius.sm,
                  overflow: 'hidden',
                  background: 'var(--bg-inset)',
                }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${mevPct}%`, background: BAND_MV }} />
                <div style={{ position: 'absolute', left: `${mevPct}%`, top: 0, height: '100%', width: `${mrvPct - mevPct}%`, background: BAND_OPT }} />
                <div style={{ position: 'absolute', left: `${mrvPct}%`, top: 0, height: '100%', right: 0, background: BAND_EXCEED }} />
                <div style={{ position: 'absolute', left: `${mevPct}%`, top: 0, width: 1, height: '100%', background: TICK_COLOR }} />
                <div style={{ position: 'absolute', left: `${mrvPct}%`, top: 0, width: 1, height: '100%', background: TICK_COLOR }} />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${fillPct}%`,
                    background: status.fill,
                    opacity: 0.72,
                    borderRadius: `${tokens.radius.sm}px 0 0 ${tokens.radius.sm}px`,
                    transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
                  }}
                />
              </div>
              <div style={{ position: 'relative', height: 14, marginTop: 3 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: `${optMid}%`,
                    transform: 'translateX(-50%)',
                    fontSize: 11,
                    color: 'var(--phase-accum)',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lm.mev}–{lm.mrv} optimal
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PR Timeline ─────────────────────────────────────────────────────────────

function PRTimelineCard({ entries }: { entries: PRTimelineEntry[] }) {
  if (entries.length === 0)
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          padding: 24,
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}
      >
        Keep pushing — PRs will appear here as you progress.
      </div>
    );

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        padding: '16px 16px 12px',
      }}
    >
      <div style={{ position: 'relative', paddingLeft: 28 }}>
        {/* Vertical line */}
        <div
          style={{
            position: 'absolute',
            left: 4,
            top: 4,
            bottom: 4,
            width: 2,
            background: 'var(--border)',
            borderRadius: 1,
          }}
        />

        {entries.map((pr, i) => {
          const ac = (TAG_ACCENT as Record<string, string>)[pr.tag || ''] || 'var(--accent)';
          return (
            <div key={i} style={{ marginBottom: i < entries.length - 1 ? 18 : 0, position: 'relative' }}>
              {/* Gold dot on timeline */}
              <div
                style={{
                  position: 'absolute',
                  left: -28,
                  top: 2,
                  width: 10,
                  height: 10,
                  borderRadius: tokens.radius.full,
                  background: '#c9a227',
                  border: '2px solid var(--bg-card)',
                  marginLeft: 0,
                }}
              />
              {/* Week label */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.04em', marginBottom: 2 }}>
                WEEK {pr.week + 1}
              </div>
              {/* Exercise name */}
              <div style={{ fontSize: 13, fontWeight: 700, color: ac }}>
                {pr.exerciseName}
              </div>
              {/* Weight + delta */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: '#c9a227', letterSpacing: '-0.02em' }}>
                  {pr.weight} lbs
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--phase-accum)' }}>
                  +{pr.delta} lbs
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main AnalyticsView ──────────────────────────────────────────────────────

export default function AnalyticsView({ completedDays, activeDays, goBack }: AnalyticsViewProps) {
  const stats = useMemo(() => calcSessionStats(activeDays, completedDays), [activeDays, completedDays]);
  const anchors = useMemo(() => loadAnchorCharts(activeDays), [activeDays]);
  const prTimeline = useMemo(() => buildPRTimeline(activeDays), [activeDays]);

  const formatTonnage = (t: number) => {
    if (t >= 1000000) return `${(t / 1000000).toFixed(1)}M`;
    if (t >= 1000) return `${(t / 1000).toFixed(1)}K`;
    return String(t);
  };

  return (
    <div>
      {/* Header */}
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
          ‹
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
            flex: 1,
          }}
        >
          ANALYTICS
        </span>
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {/* ── Session Stats ── */}
        <SectionHeader title="SESSION STATS" />
        <div style={{ display: 'flex', gap: 8 }}>
          <StatBox
            label="Tonnage"
            value={`${formatTonnage(stats.tonnage)} lbs`}
            color="var(--accent)"
          />
          <StatBox
            label="Completion"
            value={`${Math.round(stats.completionRate * 100)}%`}
            color="var(--phase-accum)"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <StatBox
            label="Avg Duration"
            value={stats.avgDuration ? `${stats.avgDuration} min` : '—'}
            color={tokens.colors.gold}
          />
          <StatBox
            label="Total Sets"
            value={stats.totalSets}
            color="var(--text-primary)"
          />
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            marginTop: 6,
            textAlign: 'center',
          }}
        >
          {stats.completedSessions}/{stats.totalSessions} sessions completed
        </div>

        {/* ── Muscle Volume ── */}
        <SectionHeader title="MUSCLE VOLUME" />
        <VolumeCard activeDays={activeDays} completedDays={completedDays} />

        {/* ── Strength Progression ── */}
        {anchors.length > 0 && (
          <>
            <SectionHeader title="STRENGTH PROGRESSION" />
            {anchors.map((chart, i) => (
              <StrengthChart key={i} chart={chart} />
            ))}
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              Estimated 1RM (Epley formula) across mesocycle weeks.
            </div>
          </>
        )}

        {/* ── PR Timeline ── */}
        <SectionHeader title="PR TIMELINE" />
        <PRTimelineCard entries={prTimeline} />
      </div>
    </div>
  );
}
