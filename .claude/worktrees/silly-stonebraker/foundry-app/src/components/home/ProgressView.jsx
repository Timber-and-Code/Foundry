import React, { useState, useMemo } from 'react';
import {
  TAG_ACCENT,
  PHASE_COLOR,
  VOLUME_LANDMARKS,
  getMeso,
  getWeekPhase,
} from '../../data/constants';
import {
  store,
  loadBwLog,
  loadSessionDuration,
  loadDayWeek,
  loadSparklineData,
} from '../../utils/store';
import { haptic } from '../../utils/helpers';

// ── Helpers ──────────────────────────────────────────────────────────────────
function sessionTagToCategory(sessionTag, exTag) {
  if (sessionTag === 'UPPER' || sessionTag === 'LOWER' || sessionTag === 'FULL') return exTag;
  return sessionTag;
}

function flattenMuscleSets(byTag) {
  const result = {};
  Object.values(byTag).forEach((muscleMap) => {
    Object.entries(muscleMap || {}).forEach(([muscle, sets]) => {
      result[muscle] = (result[muscle] || 0) + sets;
    });
  });
  return result;
}

function getLandmarkStatus(sets, lm) {
  if (!lm) return null;
  if (sets < lm.mev)
    return {
      label: 'MV',
      fill: '#8A6030',
      color: '#D4983C',
      bg: 'rgba(138,96,48,0.12)',
      border: 'rgba(138,96,48,0.3)',
    };
  if (sets < lm.mavLow)
    return {
      label: 'Building',
      fill: '#c9a227',
      color: '#d4a83a',
      bg: 'rgba(201,162,39,0.12)',
      border: 'rgba(201,162,39,0.3)',
    };
  if (sets <= lm.mavHigh)
    return {
      label: 'Optimal',
      fill: '#B8901C',
      color: 'var(--phase-accum)',
      bg: 'rgba(45,212,168,0.12)',
      border: 'rgba(45,212,168,0.3)',
    };
  if (sets <= lm.mrv)
    return {
      label: 'High',
      fill: '#c9a227',
      color: '#d4a83a',
      bg: 'rgba(201,162,39,0.12)',
      border: 'rgba(201,162,39,0.3)',
    };
  return {
    label: 'Exceeded',
    fill: '#c0392b',
    color: '#e07070',
    bg: 'rgba(192,57,43,0.12)',
    border: 'rgba(192,57,43,0.3)',
  };
}

function calcMuscleSetsByTag(activeDays, completedDays, weekFilter) {
  const byTag = { PUSH: {}, PULL: {}, LEGS: {} };
  activeDays.forEach((day, dayIdx) => {
    for (let w = 0; w <= getMeso().weeks; w++) {
      if (weekFilter !== null && w !== weekFilter) continue;
      if (!completedDays.has(`${dayIdx}:${w}`)) continue;
      const wd = loadDayWeek(dayIdx, w);
      day.exercises.forEach((ex, exIdx) => {
        const exData = wd[exIdx] || {};
        const filledSets = Object.values(exData).filter((s) => s && s.reps && s.reps !== '').length;
        if (filledSets === 0) return;
        const cat = sessionTagToCategory(day.tag, ex.tag);
        if (!byTag[cat]) byTag[cat] = {};
        let primaryMuscle = ex.muscle || (ex.muscles && ex.muscles[0]);
        if (primaryMuscle === 'Lats') primaryMuscle = 'Back';
        if (primaryMuscle === 'Abductors') primaryMuscle = 'Glutes';
        if (primaryMuscle === 'Adductors') return;
        if (primaryMuscle) {
          byTag[cat][primaryMuscle] = (byTag[cat][primaryMuscle] || 0) + filledSets;
        }
      });
    }
  });
  return byTag;
}

// ── Volume Landmarks Card ────────────────────────────────────────────────────
function VolumeLandmarksCard({ byTag, title }) {
  const muscleSets = flattenMuscleSets(byTag);
  const entries = Object.entries(muscleSets)
    .filter(([m, s]) => s > 0 && VOLUME_LANDMARKS[m])
    .sort((a, b) => {
      const sa = getLandmarkStatus(a[1], VOLUME_LANDMARKS[a[0]]);
      const sb = getLandmarkStatus(b[1], VOLUME_LANDMARKS[b[0]]);
      const priority = (s) =>
        s.label === 'Exceeded' ? 0 : s.label === 'MV' ? 1 : s.label === 'High' ? 2 : 3;
      return priority(sa) - priority(sb) || b[1] - a[1];
    });
  if (entries.length === 0) return null;

  const BAND_DANGER = 'rgba(192,57,43,0.20)';
  const BAND_WARN = 'rgba(201,162,39,0.22)';
  const BAND_OPT = 'rgba(45,212,168,0.25)';
  const TICK = 'rgba(255,255,255,0.22)';
  const lblOpt = 'var(--phase-accum)';

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 10,
          }}
        >
          {title || 'Volume check'}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {[
            ['#8A6030', 'MV'],
            ['#c9a227', 'Building'],
            ['#D4A03C', 'Optimal'],
            ['#c9a227', 'High'],
            ['#c0392b', 'Exceeded'],
          ].map(([c, label], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: c,
                  opacity: 0.75,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 16px 6px' }}>
        {entries.map(([muscle, sets], idx) => {
          const lm = VOLUME_LANDMARKS[muscle];
          const status = getLandmarkStatus(sets, lm);
          const scale = lm.mrv + 5;
          const mevPct = (lm.mev / scale) * 100;
          const mavLPct = (lm.mavLow / scale) * 100;
          const mavHPct = (lm.mavHigh / scale) * 100;
          const mrvPct = (lm.mrv / scale) * 100;
          const fillPct = Math.min((sets / scale) * 100, 99);
          const isLast = idx === entries.length - 1;
          const optMid = (mavLPct + mavHPct) / 2;
          return (
            <div
              key={muscle}
              style={{
                padding: '11px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 7,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
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
                    borderRadius: 4,
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
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: 'var(--bg-inset)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${mevPct}%`,
                    background: BAND_DANGER,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mevPct}%`,
                    top: 0,
                    height: '100%',
                    width: `${mavLPct - mevPct}%`,
                    background: BAND_WARN,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mavLPct}%`,
                    top: 0,
                    height: '100%',
                    width: `${mavHPct - mavLPct}%`,
                    background: BAND_OPT,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mavHPct}%`,
                    top: 0,
                    height: '100%',
                    width: `${mrvPct - mavHPct}%`,
                    background: BAND_WARN,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mrvPct}%`,
                    top: 0,
                    height: '100%',
                    right: 0,
                    background: BAND_DANGER,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mevPct}%`,
                    top: 0,
                    width: 1,
                    height: '100%',
                    background: TICK,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mavLPct}%`,
                    top: 0,
                    width: 1,
                    height: '100%',
                    background: TICK,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mavHPct}%`,
                    top: 0,
                    width: 1,
                    height: '100%',
                    background: TICK,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${mrvPct}%`,
                    top: 0,
                    width: 1,
                    height: '100%',
                    background: TICK,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${fillPct}%`,
                    background: status.fill,
                    opacity: 0.72,
                    borderRadius: '4px 0 0 4px',
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
                    fontSize: 12,
                    color: lblOpt,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lm.mavLow}–{lm.mavHigh} optimal
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ProgressView ────────────────────────────────────────────────────────
export default function ProgressView({ currentWeek, completedDays, activeDays, goBack, goTo }) {
  const [expandedDay, setExpandedDay] = useState(null);
  const weekByTag = calcMuscleSetsByTag(activeDays, completedDays, currentWeek);

  const workoutsThisWeek = activeDays.filter((_, i) =>
    completedDays.has(`${i}:${currentWeek}`)
  ).length;
  const workoutsTotal = Array.from(completedDays).length;

  const bwLog = useMemo(() => loadBwLog().slice(0, 12).reverse(), []);

  const sessionDurations = useMemo(() => {
    const all = [];
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
  const pc = PHASE_COLOR[phase];

  const statBox = (label, value, color) => (
    <div
      style={{
        flex: 1,
        background: 'var(--bg-card)',
        border: `1px solid ${color}33`,
        borderRadius: 8,
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
    const [goalWeight, setGoalWeight] = React.useState(() => {
      const v = parseFloat(store.get('foundry:bwGoal'));
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
      const weights = bwLog.map((e) => e.weight);
      if (goalWeight !== null) weights.push(goalWeight);
      chartMin = Math.min(...weights);
      chartMax = Math.max(...weights);
    }
    const range = chartMax - chartMin || 1;
    const toX = (i) => PX + (i / (bwLog.length - 1)) * (W - PX * 2);
    const toY = (v) => H - PY - ((v - chartMin) / range) * (H - PY * 2);
    const pts = hasChart ? bwLog.map((e, i) => `${toX(i)},${toY(e.weight)}`).join(' L ') : '';

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
          borderRadius: 8,
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
                GOAL: <span style={{ color: '#c9a227', fontWeight: 800 }}>{goalWeight} lbs</span>
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
                  borderRadius: 6,
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
                borderRadius: 5,
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
          borderRadius: 8,
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
                    borderRadius: '3px 3px 0 0',
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
        <button
          onClick={() => goTo('datamgmt')}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--accent)',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 5,
            cursor: 'pointer',
            padding: '5px 10px',
          }}
        >
          Import / Export
        </button>
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
          const anchors = [];
          activeDays.forEach((day, dayIdx) => {
            day.exercises.forEach((ex, exIdx) => {
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
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                {anchors.map((a, i) => {
                  const ac = TAG_ACCENT[a.tag] || 'var(--accent)';
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
                            ⭐ {a.name}
                          </span>
                          {a.isPR && (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: '#c9a227',
                                background: '#c9a22722',
                                border: '1px solid #c9a22744',
                                borderRadius: 4,
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
                                color: '#f87171',
                                background: '#f8717122',
                                border: '1px solid #f8717144',
                                borderRadius: 4,
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
                              color: '#f87171',
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
                            color: a.isPR ? '#c9a227' : a.isStalling ? '#f87171' : ac,
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
          const accent = TAG_ACCENT[day.tag];
          const dayLifts = day.exercises.map((ex, exIdx) => {
            let weight = '';
            for (let w = currentWeek; w >= 0; w--) {
              const wd = loadDayWeek(dayIdx, w);
              const exData = wd[exIdx] || {};
              const sw = Object.values(exData).find((sv) => sv && sv.weight && sv.weight !== '');
              if (sw) {
                weight = sw.weight;
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
                borderRadius: 8,
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
                    borderRadius: 6,
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
                            {lift.anchor && '⭐ '}
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

        {/* Quick links */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => goTo('history')}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 8,
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
