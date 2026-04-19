import React, { useState, useMemo } from 'react';
import { tokens } from '../../styles/tokens';
import HammerIcon from '../shared/HammerIcon';
import {
  TAG_ACCENT,
  PHASE_COLOR,
  getMeso,
  getWeekPhase,
} from '../../data/constants';
import {
  store,
  loadBwLog,
  loadSessionDuration,
  loadSparklineData,
  loadDayWeek,
} from '../../utils/store';
import { loadCardioSession } from '../../utils/persistence';
import { calcMuscleSetsByTag } from '../../utils/analyticsData';
import type { TrainingDay, Exercise, BodyWeightEntry, WorkoutSet, CardioSession } from '../../types';
import VolumeLandmarksCard from './VolumeLandmarksCard';
// haptic import reserved for future UI feedback

// ── Main ProgressView ────────────────────────────────────────────────────────
interface ProgressViewProps {
  currentWeek: number;
  completedDays: Set<string>;
  activeDays: TrainingDay[];
  goBack: () => void;
  goTo: (n: number | string) => void;
}

export default function ProgressView({ currentWeek, completedDays, activeDays, goBack, goTo }: ProgressViewProps) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [showCardioHistory, setShowCardioHistory] = useState(false);
  const weekByTag = calcMuscleSetsByTag(activeDays, completedDays, currentWeek);

  const workoutsThisWeek = activeDays.filter((_, i) =>
    completedDays.has(`${i}:${currentWeek}`)
  ).length;
  const workoutsTotal = Array.from(completedDays).length;

  const bwLog = useMemo(() => loadBwLog().slice(0, 12).reverse(), []);

  const sessionDurations = useMemo(() => {
    const all: { week: number; day: number; duration: number }[] = [];
    for (let w = 0; w <= (getMeso()?.weeks || 6); w++) {
      for (let d = 0; d < (getMeso()?.days || 6); d++) {
        const dur = loadSessionDuration(d, w);
        if (dur !== null) all.push({ week: w, day: d, duration: dur });
      }
    }
    return all;
  }, []);
  const avgDuration =
    sessionDurations.length > 0
      ? Math.round(sessionDurations.reduce((s, x) => s + x.duration, 0) / sessionDurations.length)
      : null;

  const phase = getWeekPhase()[currentWeek] || 'Accumulation';
  const pc = (PHASE_COLOR as Record<string, string>)[phase];

  const statBox = (label: string, value: string | number, color: string) => (
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
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginTop: 4,
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
    </div>
  );

  // ── BW Chart ───────────────────────────────────────────────────────────────
  const BwChart = () => {
    const [showHistory, setShowHistory] = React.useState(false);
    const [editingGoal, setEditingGoal] = React.useState(false);
    const [goalInput, setGoalInput] = React.useState(() => store.get('foundry:bwGoal') || '');
    const [goalWeight, setGoalWeight] = React.useState<number | null>(() => {
      const v = parseFloat(store.get('foundry:bwGoal') || '');
      return isNaN(v) ? null : v;
    });

    if (bwLog.length === 0) return null;

    const latest = bwLog[bwLog.length - 1];
    const trend = bwLog.length >= 2 ? latest.weight - bwLog[0].weight : null;
    const hasChart = bwLog.length >= 2;

    const W = 280,
      H = 60,
      PX = 8,
      PY = 8;
    let chartMin = 0,
      chartMax = 1;
    if (hasChart) {
      const weights = bwLog.map((e: BodyWeightEntry) => e.weight);
      if (goalWeight !== null) weights.push(goalWeight);
      chartMin = Math.min(...weights);
      chartMax = Math.max(...weights);
    }
    const range = chartMax - chartMin || 1;
    const toX = (i: number) => PX + (i / (bwLog.length - 1)) * (W - PX * 2);
    const toY = (v: number) => H - PY - ((v - chartMin) / range) * (H - PY * 2);
    const pts = hasChart ? bwLog.map((e: BodyWeightEntry, i: number) => `${toX(i)},${toY(e.weight)}`).join(' L ') : '';

    const towardsGoal =
      goalWeight !== null &&
      trend !== null &&
      ((goalWeight < bwLog[0].weight && trend < 0) || (goalWeight > bwLog[0].weight && trend > 0));
    const goalReached =
      goalWeight !== null &&
      (goalWeight < latest.weight
        ? latest.weight <= goalWeight + 2
        : latest.weight >= goalWeight - 2);

    const saveGoal = () => {
      const v = parseFloat(goalInput);
      if (!isNaN(v) && v > 50 && v < 600) {
        store.set('foundry:bwGoal', String(v));
        setGoalWeight(v);
      } else if (goalInput === '') {
        store.set('foundry:bwGoal', '');
        setGoalWeight(null);
      }
      setEditingGoal(false);
    };

    return (
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          marginBottom: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 16px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
            }}
          >
            BODYWEIGHT TREND
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {trend !== null && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    trend < 0
                      ? 'var(--phase-accum)'
                      : trend > 0
                        ? 'var(--danger)'
                        : 'var(--text-muted)',
                }}
              >
                {trend > 0 ? '+' : ''}
                {trend.toFixed(1)} lbs
              </span>
            )}
            <span
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: 'var(--text-primary)',
              }}
            >
              {latest.weight}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>lbs</span>
          </div>
        </div>
        <div style={{ padding: '10px 16px 0' }}>
          {hasChart ? (
            <>
              <svg
                width="100%"
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                style={{ display: 'block', height: H }}
              >
                <path
                  d={`M ${pts} L ${toX(bwLog.length - 1)},${H} L ${toX(0)},${H} Z`}
                  fill="rgba(47,79,111,0.15)"
                />
                <polyline
                  points={pts}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {goalWeight !== null && (
                  <>
                    <line
                      x1={PX}
                      y1={toY(goalWeight)}
                      x2={W - PX}
                      y2={toY(goalWeight)}
                      stroke="#c9a227"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                      opacity="0.8"
                    />
                    <text
                      x={W - PX - 2}
                      y={toY(goalWeight) - 4}
                      fontSize="8"
                      fill="#c9a227"
                      textAnchor="end"
                      fontWeight="700"
                    >
                      GOAL {goalWeight}
                    </text>
                  </>
                )}
                <circle
                  cx={toX(bwLog.length - 1)}
                  cy={toY(latest.weight)}
                  r="4"
                  fill="var(--accent)"
                />
              </svg>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 3,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {bwLog[0]?.date?.slice(5)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {latest.date?.slice(5)}
                </span>
              </div>
            </>
          ) : (
            <div
              style={{
                padding: '6px 0 10px',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              Log at least 2 weeks to see your trend chart.
            </div>
          )}
        </div>
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.03em',
            }}
          >
            {goalWeight !== null ? (
              <span>
                GOAL: <span style={{ color: 'var(--pr-gold)', fontWeight: 800 }}>{goalWeight} lbs</span>
                {goalReached && (
                  <span style={{ marginLeft: 6, color: 'var(--phase-accum)' }}>✓ Reached!</span>
                )}
                {!goalReached && towardsGoal && (
                  <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>↓ On track</span>
                )}
              </span>
            ) : (
              <span style={{ color: 'var(--text-dim)' }}>No goal set</span>
            )}
          </div>
          {editingGoal ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                inputMode="decimal"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="lbs"
                autoFocus
                style={{
                  width: 72,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--accent)',
                  borderRadius: tokens.radius.md,
                  padding: '5px 8px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  outline: 'none',
                  textAlign: 'center',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveGoal();
                  if (e.key === 'Escape') setEditingGoal(false);
                }}
              />
              <button
                onClick={saveGoal}
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'var(--phase-accum)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingGoal(false)}
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setGoalInput(goalWeight !== null ? String(goalWeight) : '');
                setEditingGoal(true);
              }}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--accent)',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.sm,
                cursor: 'pointer',
                padding: '4px 10px',
              }}
            >
              {goalWeight !== null ? 'Edit' : '+ Set Goal'}
            </button>
          )}
        </div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          style={{
            width: '100%',
            padding: '9px 16px',
            background: 'var(--bg-deep)',
            border: 'none',
            borderTop: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            HISTORY ({bwLog.length} {bwLog.length === 1 ? 'entry' : 'entries'})
          </span>
          <span style={{ fontSize: 13 }}>{showHistory ? '▲' : '▼'}</span>
        </button>
        {showHistory && (
          <div
            style={{
              maxHeight: 220,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {[...bwLog].reverse().map((entry, i, arr) => {
              const prev = arr[i + 1];
              const delta = prev ? entry.weight - prev.weight : null;
              return (
                <div
                  key={entry.date}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 16px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    background: i === 0 ? 'var(--bg-inset)' : 'transparent',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {entry.date}
                    </span>
                    {i === 0 && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: '0.07em',
                          color: 'var(--accent)',
                          marginLeft: 8,
                        }}
                      >
                        LATEST
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    {delta !== null && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            delta < 0
                              ? 'var(--phase-accum)'
                              : delta > 0
                                ? 'var(--danger)'
                                : 'var(--text-muted)',
                        }}
                      >
                        {delta > 0 ? '+' : ''}
                        {delta.toFixed(1)}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {entry.weight}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>lbs</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Duration Chart ─────────────────────────────────────────────────────────
  const DurationChart = () => {
    if (sessionDurations.length < 1) return null;
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          padding: '14px 16px',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
            }}
          >
            LIFTING DURATION
          </div>
          <div style={{ textAlign: 'right' }}>
            {avgDuration !== null && (
              <>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                  }}
                >
                  {avgDuration}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginLeft: 3,
                  }}
                >
                  min avg
                </span>
              </>
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 4,
            height: 40,
          }}
        >
          {sessionDurations.slice(-12).map((s, i) => {
            const maxD = Math.max(...sessionDurations.map((x) => x.duration));
            const h = maxD > 0 ? Math.max(4, Math.round((s.duration / maxD) * 36)) : 4;
            const isCur = s.week === currentWeek;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    borderRadius: `${tokens.radius.xs}px ${tokens.radius.xs}px 0 0`,
                    height: h,
                    background: isCur ? 'var(--accent)' : 'var(--border-accent)',
                    transition: 'height 0.3s',
                  }}
                  title={`W${s.week + 1} D${s.day + 1}: ${s.duration}min`}
                />
                <span
                  style={{
                    fontSize: 7,
                    color: 'var(--text-dim)',
                    lineHeight: 1,
                  }}
                >
                  {s.duration}m
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
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
          PROGRESS
        </span>
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {/* Week summary */}
        <div style={{ marginBottom: 16, marginTop: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--accent)',
              marginBottom: 8,
            }}
          >
            WEEK {currentWeek + 1} SUMMARY · {phase.toUpperCase()}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {statBox('THIS WEEK', `${workoutsThisWeek}/${activeDays.length}`, pc)}
            {statBox('TOTAL SESSIONS', workoutsTotal, 'var(--accent)')}
          </div>
          <VolumeLandmarksCard byTag={weekByTag} title="Volume This Week" />
        </div>

        {/* BW trend */}
        <BwChart />

        {/* Session duration */}
        <DurationChart />

        {/* e1RM card */}
        {(() => {
          const anchors: { name: string; tag: string | undefined; e1rm: number; allTimeBest: number; isPR: boolean; load75: number; load85: number; isStalling: boolean }[] = [];
          activeDays.forEach((day: TrainingDay, dayIdx: number) => {
            day.exercises.forEach((ex: Exercise, exIdx: number) => {
              if (!ex.anchor) return;
              const pts = loadSparklineData(dayIdx, exIdx);
              if (!pts.length) return;
              const best = pts.reduce((a, b) => (b.e1rm > a.e1rm ? b : a), pts[0]);
              const latest = pts[pts.length - 1];
              let isStalling = false;
              if (pts.length >= 3) {
                const p1 = pts[pts.length - 1].e1rm;
                const p2 = pts[pts.length - 2].e1rm;
                const p3 = pts[pts.length - 3].e1rm;
                isStalling = p1 <= p2 && p2 <= p3;
              }
              anchors.push({
                name: ex.name,
                tag: day.tag,
                e1rm: latest.e1rm,
                allTimeBest: best.e1rm,
                isPR: latest.e1rm >= best.e1rm && pts.length > 1,
                load75: Math.round(latest.e1rm * 0.75),
                load85: Math.round(latest.e1rm * 0.85),
                isStalling,
              });
            });
          });
          if (!anchors.length) return null;
          return (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--accent)',
                  marginBottom: 8,
                }}
              >
                ESTIMATED 1RM
              </div>
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.lg,
                  overflow: 'hidden',
                }}
              >
                {anchors.map((a, i) => {
                  const ac = (TAG_ACCENT as Record<string, any>)[a.tag || ''] || 'var(--accent)';
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '12px 16px',
                        borderBottom:
                          i < anchors.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 3,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                            }}
                          >
                            <HammerIcon size={14} style={{ marginRight: 4 }} />{a.name}
                          </span>
                          {a.isPR && (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: 'var(--pr-gold)',
                                background: 'var(--pr-gold-subtle)',
                                border: '1px solid #c9a22744',
                                borderRadius: tokens.radius.sm,
                                padding: '1px 5px',
                                letterSpacing: '0.06em',
                              }}
                            >
                              PR
                            </span>
                          )}
                          {a.isStalling && !a.isPR && (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: 'var(--stalling)',
                                background: 'var(--stalling-subtle)',
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
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            75%{' '}
                            <span
                              style={{
                                color: 'var(--text-secondary)',
                                fontWeight: 700,
                              }}
                            >
                              {a.load75} lbs
                            </span>
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            85%{' '}
                            <span
                              style={{
                                color: 'var(--text-secondary)',
                                fontWeight: 700,
                              }}
                            >
                              {a.load85} lbs
                            </span>
                          </span>
                        </div>
                        {a.isStalling && !a.isPR && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--stalling)',
                              marginTop: 5,
                              lineHeight: 1.4,
                            }}
                          >
                            No progress in 2+ weeks — consider a deload or swapping the variation.
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 900,
                            color: a.isPR ? 'var(--pr-gold)' : a.isStalling ? 'var(--stalling)' : ac,
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                          }}
                        >
                          {a.e1rm}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-muted)',
                            marginTop: 2,
                          }}
                        >
                          lbs (Epley)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  marginTop: 6,
                  paddingLeft: 2,
                }}
              >
                Based on best logged set this meso. 75% and 85% loading suggestions shown.
              </div>
            </div>
          );
        })()}

        {/* Current weights by day */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--accent)',
            marginBottom: 8,
          }}
        >
          CURRENT WEIGHTS
        </div>
        {activeDays.map((day, dayIdx) => {
          const accent = (TAG_ACCENT as Record<string, string>)[day.tag || ''];
          const dayLifts = day.exercises.map((ex: Exercise, exIdx: number) => {
            let weight: string | number = '';
            for (let w = currentWeek; w >= 0; w--) {
              const wd = loadDayWeek(dayIdx, w);
              const exData = wd[exIdx] || {};
              const sw = (Object.values(exData) as WorkoutSet[]).find((sv) => sv && sv.weight && sv.weight !== '');
              if (sw) {
                weight = (sw as unknown as Record<string, string | number>).weight;
                break;
              }
            }
            return {
              name: ex.name,
              muscle: ex.muscle,
              weight,
              anchor: ex.anchor,
              sets: ex.sets,
              reps: ex.reps,
            };
          });
          const anyLogged = dayLifts.some((l) => l.weight);
          const isDayExpanded = expandedDay === dayIdx;
          return (
            <div
              key={dayIdx}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${anyLogged ? accent + '44' : 'var(--border)'}`,
                borderRadius: tokens.radius.lg,
                marginBottom: 8,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setExpandedDay(isDayExpanded ? null : dayIdx)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: anyLogged ? accent + '11' : 'var(--bg-deep)',
                  border: 'none',
                  borderBottom: isDayExpanded ? '1px solid var(--border)' : 'none',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    background: accent + '22',
                    color: accent,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: tokens.radius.md,
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}
                >
                  {day.tag}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    flex: 1,
                  }}
                >
                  Day {day.dayNum || dayIdx + 1} — {day.label}
                </span>
                {completedDays.has(`${dayIdx}:${currentWeek}`) && (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--phase-accum)',
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                )}
                <span
                  style={{
                    color: 'var(--text-dim)',
                    fontSize: 20,
                    flexShrink: 0,
                    transform: isDayExpanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                >
                  ›
                </span>
              </button>
              {isDayExpanded && (
                <div>
                  {dayLifts.map((lift, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 16px',
                        borderBottom:
                          i < dayLifts.length - 1 ? '1px solid var(--bg-surface)' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 7,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                            }}
                          >
                            {lift.anchor && <HammerIcon size={13} style={{ marginRight: 4 }} />}
                            {lift.name}
                          </span>
                          {lift.muscle && (
                            <span
                              style={{
                                fontSize: 12,
                                color: 'var(--phase-intens)',
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                              }}
                            >
                              {lift.muscle.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--border-accent)',
                          }}
                        >
                          {lift.sets}×{lift.reps}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: lift.weight ? 'var(--accent)' : 'var(--text-dim)',
                          minWidth: 60,
                          textAlign: 'right',
                        }}
                      >
                        {lift.weight ? `${lift.weight} lbs` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Cardio History */}
        {(() => {
          const cardioKeys = store.keys('foundry:cardio:session:');
          if (cardioKeys.length === 0) return null;
          const sessions: { date: string; session: CardioSession }[] = [];
          if (showCardioHistory) {
            cardioKeys
              .map((k) => k.replace('foundry:cardio:session:', ''))
              .sort((a, b) => b.localeCompare(a))
              .slice(0, 20)
              .forEach((dateStr) => {
                const s = loadCardioSession(dateStr);
                if (s) sessions.push({ date: dateStr, session: s });
              });
          }
          return (
            <div style={{ marginTop: 16, marginBottom: 8 }}>
              <button
                onClick={() => setShowCardioHistory(!showCardioHistory)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.lg,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Cardio History ({cardioKeys.length})
                </span>
                <span style={{
                  color: 'var(--text-dim)',
                  fontSize: 20,
                  transform: showCardioHistory ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.2s',
                }}>
                  ›
                </span>
              </button>
              {showCardioHistory && sessions.length > 0 && (
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderTop: 'none',
                  borderRadius: `0 0 ${tokens.radius.lg}px ${tokens.radius.lg}px`,
                  overflow: 'hidden',
                }}>
                  {sessions.map(({ date, session }) => (
                    <div
                      key={date}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--bg-surface)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {date}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {session.type || 'Cardio'}{session.intensity ? ` · ${session.intensity}` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: tokens.colors.gold, textAlign: 'right' }}>
                        {session.duration ? `${session.duration} min` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Quick links */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => goTo('analytics')}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: tokens.radius.lg,
              cursor: 'pointer',
              background: 'var(--bg-card)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            Analytics Dashboard
          </button>
          <button
            onClick={() => goTo('history')}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: tokens.radius.lg,
              cursor: 'pointer',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            Meso History
          </button>
        </div>
      </div>
    </div>
  );
}
