import React, { useState, useMemo, useEffect } from 'react';
import { tokens } from '../../styles/tokens';

// Data
import { getProgTargets } from '../../data/constants';

// Utils
import {
  store,
  getWarmupDetail,
  generateWarmupSteps,
  loadArchive,
} from '../../utils/store';
import HammerIcon from '../shared/HammerIcon';
import type { Exercise, DayData } from '../../types';
import type { WarmupStep, WarmupDetail } from '../../utils/training';

interface HistoryRow {
  w: number;
  maxW: number;
  maxR: number;
  sets: number;
}

interface StallTarget {
  w: number;
  r: number;
}

interface SetData {
  weight?: string | number;
  reps?: string | number;
  rpe?: string | number;
  warmup?: boolean;
  confirmed?: boolean;
  repsSuggested?: boolean;
  [key: string]: unknown;
}

interface ArchiveSession {
  w: number;
  d: number;
  data: Record<string, Record<string, SetData>>;
  exOvs?: Record<number, string>;
  [key: string]: unknown;
}

interface ArchiveRecord {
  mesoWeeks: number;
  sessions: ArchiveSession[];
  [key: string]: unknown;
}

interface ExerciseCardProps {
  exercise: Exercise;
  exIdx: number;
  dayIdx: number;
  weekIdx: number;
  weekData: DayData;
  onUpdateSet: (exIdx: number, setIdx: number, field: string, value: string | number | boolean) => void;
  onWeightAutoFill: (exIdx: number, value: string, sets: number | string | undefined) => void;
  onLastSetFilled: (exIdx: number, setIdx: number) => void;
  expanded: boolean;
  onToggle: () => void;
  done: boolean;
  readOnly: boolean;
  onSwapClick: (exIdx: number) => void;
  onSetLogged: (restStr: string, exName: string, setIdx: number, isLastSet?: boolean) => void;
  bodyweight: number | string | undefined;
  note: string;
  onNoteChange: (exIdx: number, value: string) => void;
  onAddSet?: (exIdx: number) => void;
  onRemoveSet?: (exIdx: number, setIdx: number) => void;
  onMoveUp?: (exIdx: number) => void;
  onMoveDown?: (exIdx: number) => void;
  isFirst?: boolean;
  isLast?: boolean;
  active?: boolean;
  supersetPartnerName?: string;
}

function ExerciseCard({
  exercise,
  exIdx,
  dayIdx,
  weekIdx,
  weekData,
  onUpdateSet,
  onWeightAutoFill,
  onLastSetFilled,
  expanded,
  onToggle,
  done,
  readOnly,
  onSwapClick,
  onSetLogged,
  bodyweight: _bodyweight,
  note,
  onNoteChange,
  onAddSet,
  onRemoveSet,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  active,
  supersetPartnerName,
}: ExerciseCardProps) {
  const goal = (getProgTargets() as Record<string, string[]>)[exercise.progression ?? '']?.[weekIdx];
  const goalColor =
    weekIdx < 2
      ? 'var(--text-muted)'
      : weekIdx < 4
        ? 'var(--phase-accum)'
        : weekIdx < 5
          ? 'var(--phase-intens)'
          : 'var(--danger)';
  const [showHistory, setShowHistory] = useState(false);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showWarmupModal, setShowWarmupModal] = useState(false);
  const [rpePrompt, setRpePrompt] = useState<number | null>(null);
  const [removeSetPrompt, setRemoveSetPrompt] = useState<number | null>(null);
  const [noteOpen, _setNoteOpen] = useState(!!(note && note.trim()));

  // Load prev week raw data for "Last session" context hints
  const prevWeekRaw = useMemo(() => {
    if (weekIdx === 0) return {};
    try {
      const raw = store.get(`foundry:day${dayIdx}:week${weekIdx - 1}`);
      return raw ? JSON.parse(raw) : {};
    } catch { /* JSON parse fallback */
      return {};
    }
  }, [dayIdx, weekIdx]);

  // Cross-meso context note — week 0 only
  // Finds the same exercise in the most recent archived meso's last working week
  const crossMesoNote = useMemo(() => {
    if (weekIdx !== 0) return null;
    try {
      const archive = loadArchive() as unknown as ArchiveRecord[];
      if (!archive.length) return null;
      const recent = archive[0];
      // Last working week = mesoWeeks - 1 (skip deload which is index mesoWeeks)
      const lastWorkingWeek = recent.mesoWeeks - 1;
      // Find sessions for this exercise name in the last working week
      let bestWeight = 0,
        bestReps = 0;
      recent.sessions.forEach((sess: ArchiveSession) => {
        if (sess.w !== lastWorkingWeek) return;
        const exData = sess.data;
        // Check all exercise slots in that session
        Object.values(exData).forEach((exSets: Record<string, SetData>, idx: number) => {
          // We don't have the exercise name easily — match by finding the best set
          // with meaningful weight across the session and compare to current exercise
          // Simple approach: look for data under same exIdx in same day position
          if (idx === exIdx) {
            Object.values(exSets || {}).forEach((sd: SetData) => {
              if (!sd || !sd.weight || !sd.reps || sd.warmup) return;
              const w = parseFloat(String(sd.weight));
              const r = parseInt(String(sd.reps));
              if (w > bestWeight || (w === bestWeight && r > bestReps)) {
                bestWeight = w;
                bestReps = r;
              }
            });
          }
        });
      });
      if (bestWeight > 0 && bestReps > 0) {
        return `Last meso: ${bestWeight} lbs × ${bestReps}`;
      }
      return null;
    } catch { /* archive read fallback */
      return null;
    }
  }, [weekIdx, exIdx, exercise.name]);

  const [doneSets, setDoneSets] = React.useState(() => {
    const exData = weekData[exIdx] || {};
    const restored = new Set();
    for (let s = 0; s < Number(exercise.sets ?? 0); s++) {
      const sd = exData[s] || {};
      // Only restore as done if user explicitly confirmed — not from suggested reps
      if (sd.confirmed === true) restored.add(s);
    }
    return restored;
  });
  const handleWeightBlur = (s: number, value: string) => {
    if (s === 0 && value.trim() !== '' && !isNaN(parseFloat(value))) {
      onWeightAutoFill(exIdx, value, exercise.sets);
    }
  };

  const handleRepsChange = (s: number, value: string) => {
    onUpdateSet(exIdx, s, 'reps', value);
    // Un-done the set if user edits it
    setDoneSets((prev) => {
      const n = new Set(prev);
      n.delete(s);
      return n;
    });
  };

  const handleRepsBlur = (_s: number, _value: string) => {
    // No-op: set completion now driven by explicit checkmark tap
  };

  const handleSetCheckmark = (s: number) => {
    if (doneSets.has(s)) {
      // Uncheck — re-enable editing, clear confirmed flag
      setDoneSets((prev) => {
        const n = new Set(prev);
        n.delete(s);
        return n;
      });
      onUpdateSet(exIdx, s, 'confirmed', false);
      return;
    }
    const setData = (weekData[exIdx] || {})[s] || { weight: '', reps: '' };
    // Only allow check if reps are entered
    if (!setData.reps || setData.reps === '') return;
    const totalSets = Number(exercise.sets) || 0;
    const isLastSet = s === totalSets - 1;
    if (isLastSet) {
      // Open RPE prompt only on the final set — user picks Easy/Good/Hard
      setRpePrompt(s);
      return;
    }
    // Non-final set: confirm directly, no RPE prompt
    onUpdateSet(exIdx, s, 'confirmed', true);
    setDoneSets((prev) => new Set([...prev, s]));
    onLastSetFilled(exIdx, s);
    onSetLogged(exercise.rest || '2 min', exercise.name, s, false);
  };

  const handleRpeSelect = (s: number, rpeLabel: string) => {
    onUpdateSet(exIdx, s, 'rpe', rpeLabel);
    onUpdateSet(exIdx, s, 'confirmed', true);
    setDoneSets((prev) => new Set([...prev, s]));
    onLastSetFilled(exIdx, s);
    // Kick off rest timer for this set
    const totalSets = Number(exercise.sets) || 0;
    const isLastSet = s === totalSets - 1;
    onSetLogged(exercise.rest || '2 min', exercise.name, s, isLastSet);
    setRpePrompt(null);
  };

  // Progression hint — derived from whether set 0 has suggested flags
  const progressionBanner = useMemo(() => {
    if (weekIdx === 0) return null; // No progression on first week
    const set0 = (weekData[exIdx] || {})[0];
    if (!set0) return null;
    // Only show banner if set 0 still carries suggestion flags (user hasn't edited yet)
    if (!set0.suggested && !set0.repsSuggested) return null;

    const prevData = prevWeekRaw[exIdx] || {};
    const prevWeight = parseFloat(String((prevData[0] || {}).weight || '0'));
    const currWeight = parseFloat(String(set0.weight || '0'));

    if (set0.suggested && currWeight > prevWeight) {
      const bump = Math.round((currWeight - prevWeight) * 10) / 10;
      return { text: `+${bump} lbs — you hit all reps last week`, color: 'var(--success)' };
    }
    if (exercise.bw && set0.repsSuggested) {
      return { text: '+1 rep — bodyweight progression', color: 'var(--text-accent)' };
    }
    if (set0.repsSuggested && !set0.suggested) {
      return { text: 'Same weight, +1 rep — building toward top of range', color: 'var(--text-accent)' };
    }
    return null;
  }, [weekData, exIdx, weekIdx, prevWeekRaw, exercise.bw]);

  // Compute stall detection based on previous week's set data and this week's input
  const { stallWarning, stallTarget } = useMemo(() => {
    const curr = (weekData[exIdx] || {})[0] || {};
    const reps = parseInt(String(curr.reps || 0));
    const weight = parseFloat(String(curr.weight || 0));
    const prevData = prevWeekRaw[exIdx] || {};
    // Default: match prev week's best
    let stallTarget: StallTarget | null = null,
      stallWarning = false;
    for (let ps = 0; ps < (Number(exercise.sets) || 4); ps++) {
      const psd = prevData[ps] || {};
      if (!psd.reps || !psd.weight || psd.warmup) continue;
      const pw = parseFloat(String(psd.weight));
      const pr = parseInt(String(psd.reps));
      if (!stallTarget || pw > stallTarget.w || (pw === stallTarget.w && pr > stallTarget.r)) {
        stallTarget = { w: pw, r: pr };
      }
    }
    // Stall if weight drops and reps don't increase enough to compensate
    if (stallTarget && weight > 0) {
      const prevRepsEquiv = stallTarget.r * (stallTarget.w / weight); // Reps equivalent at new weight
      if (weight < stallTarget.w - 2 && reps < prevRepsEquiv) {
        stallWarning = true;
      }
    }
    return { stallTarget, stallWarning };
  }, [weekData, exIdx, prevWeekRaw, exercise.sets]);

  // Load history sparkline on expanded
  useEffect(() => {
    if (!expanded) return;
    try {
      const rows: HistoryRow[] = [];
      // Last 3 weeks in current meso
      for (let w = weekIdx - 1; w >= Math.max(0, weekIdx - 3); w--) {
        const rawData = store.get(`foundry:day${dayIdx}:week${w}`);
        if (!rawData) continue;
        const parsed = JSON.parse(rawData);
        const exData = parsed[exIdx] || {};
        const weights: number[] = [],
          reps: number[] = [];
        for (const [_setIdx, sd] of Object.entries(exData) as [string, SetData][]) {
          if (!sd.weight || !sd.reps || sd.warmup) continue;
          weights.push(parseFloat(String(sd.weight)));
          reps.push(parseInt(String(sd.reps)));
        }
        if (weights.length > 0) {
          rows.push({
            w: w,
            maxW: Math.max(...weights),
            maxR: Math.max(...reps),
            sets: weights.length,
          });
        }
      }
      setHistoryRows(rows);
    } catch { /* history load fallback */ }
  }, [expanded, weekIdx, exIdx, dayIdx]);

  const handleHistoryClick = () => {
    setShowHistory(!showHistory);
  };

  const handleHowToClick = () => {
    setShowHowTo(!showHowTo);
  };

  const handleWarmupClick = () => {
    setShowWarmupModal(!showWarmupModal);
  };

  const workingWeight = useMemo(() => {
    const exData = weekData[exIdx] || {};
    for (let s = 0; s < Number(exercise.sets ?? 0); s++) {
      const w = exData[s]?.weight;
      if (w && !isNaN(parseFloat(String(w)))) {
        return parseFloat(String(w));
      }
    }
    // Fall back to previous week
    const psd = prevWeekRaw[exIdx] || {};
    for (let s = 0; s < Number(exercise.sets ?? 0); s++) {
      const w = psd[s]?.weight;
      if (w && !isNaN(parseFloat(String(w)))) {
        return parseFloat(String(w));
      }
    }
    return 0; // No weight data — signals generic warmup
  }, [weekData, exIdx, prevWeekRaw, exercise.sets]);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: active ? '1px solid var(--accent, #D4A03C)' : '1px solid var(--border)',
        borderLeft: active ? '4px solid var(--accent, #D4A03C)' : '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        marginBottom: 12,
        overflow: 'hidden',
        transition: 'border-color 0.25s, border-left 0.25s',
      }}
    >
      {/* ── HEADER (clickable to expand) ── */}
      <button
        onClick={() => onToggle()}
        aria-expanded={expanded}
        aria-label={`${exercise.name} — ${expanded ? 'collapse' : 'expand'}`}
        style={{
          width: '100%',
          padding: '14px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card-hover)',
          border: 'none',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Icon / Status */}
          {(done || exercise.cardio) && (
            <div
              style={{
                fontSize: 18,
                width: 24,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {done ? '✓' : '♪'}
            </div>
          )}

          {/* Title + Badge + Subtitle */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {exercise.name}
              </span>
              {exercise.anchor && <HammerIcon size={16} style={{ marginTop: 1 }} />}
              {exercise.modifier && (
                <span
                  style={{
                    fontSize: 11,
                    background: 'var(--bg-inset)',
                    color: 'var(--text-muted)',
                    padding: '2px 6px',
                    borderRadius: tokens.radius.xs,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {exercise.modifier}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {exercise.reps} reps{exercise.rest ? ` · ${exercise.rest}` : ''}
            </div>
            {supersetPartnerName && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  background: 'rgba(var(--accent-rgb),0.10)',
                  padding: '2px 8px',
                  borderRadius: tokens.radius.xs,
                }}
              >
                Superset with {supersetPartnerName}
              </div>
            )}
          </div>
        </div>

        {/* Goal + Expand arrow */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: goalColor }}>{goal}</div>
          <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </button>

      {/* ── EXPANDED CONTENT ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
          {/* Warmup & How To buttons */}
          {!done && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              {exercise.warmup && (
                <button
                  onClick={handleWarmupClick}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '10px 12px',
                    borderRadius: tokens.radius.md,
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-accent)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  Warmup Guide
                </button>
              )}
              <button
                onClick={handleHowToClick}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '10px 12px',
                  borderRadius: tokens.radius.md,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-accent)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                How To
              </button>
            </div>
          )}

          {/* Stall warning */}
          {stallWarning && (
            <div
              style={{
                background: tokens.colors.amberHighlight,
                border: '1px solid var(--danger)',
                borderRadius: tokens.radius.md,
                padding: 10,
                marginBottom: 12,
                fontSize: 12,
                color: 'var(--danger)',
                lineHeight: 1.5,
              }}
            >
              ⚠ Weight drop detected. Last week: {stallTarget?.w} × {stallTarget?.r}
            </div>
          )}

          {/* Progression suggestion banner */}
          {progressionBanner && !done && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: progressionBanner.color,
                marginBottom: 12,
                padding: '8px 10px',
                background: 'var(--bg-inset)',
                borderRadius: tokens.radius.sm,
                borderLeft: `3px solid ${progressionBanner.color}`,
              }}
            >
              {progressionBanner.text}
            </div>
          )}

          {/* Previous week hint */}
          {prevWeekRaw[exIdx] && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginBottom: 12,
                padding: '8px',
                background: 'var(--bg-inset)',
                borderRadius: tokens.radius.sm,
              }}
            >
              Last session:{' '}
              {(Object.values(prevWeekRaw[exIdx] || {}) as SetData[]).find(
                (sd: SetData) => sd.weight && sd.reps && !sd.warmup
              )
                ? `${(Object.values(prevWeekRaw[exIdx]) as SetData[])[0]?.weight} × ${(Object.values(prevWeekRaw[exIdx]) as SetData[])[0]?.reps}`
                : '—'}
            </div>
          )}

          {/* Cross-meso note */}
          {crossMesoNote && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-accent)',
                marginBottom: 12,
                padding: '8px',
                background: 'var(--bg-inset)',
                borderRadius: tokens.radius.sm,
              }}
            >
              {crossMesoNote}
            </div>
          )}

          {/* Set logging grid */}
          {!done && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 28px',
                  gap: 8,
                  marginBottom: 8,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}
                aria-hidden="true"
              >
                <div>Weight (lbs)</div>
                <div>Reps</div>
                <div style={{ textAlign: 'center' }}>Done</div>
                <div />
              </div>
              {Array.from({ length: Number(exercise.sets ?? 0) }).map((_, s) => {
                const sd = (weekData[exIdx] || {})[s] || {};
                const isDone = doneSets.has(s);
                const isSuggestedWeight = !!sd.suggested;
                const isSuggestedReps = !!sd.repsSuggested;
                const totalSets = Number(exercise.sets ?? 0);
                const canRemove = !isDone && !readOnly && !!onRemoveSet && totalSets > 1;
                return (
                  <div
                    key={s}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr 28px',
                      gap: 8,
                      marginBottom: 6,
                      opacity: isDone ? 0.6 : 1,
                    }}
                  >
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="—"
                      value={sd.weight || ''}
                      aria-label={`Set ${s + 1} weight in pounds`}
                      onChange={(e) => onUpdateSet(exIdx, s, 'weight', e.target.value)}
                      onBlur={(e) => handleWeightBlur(s, e.target.value)}
                      disabled={isDone || readOnly}
                      style={{
                        minWidth: 0,
                        width: '100%',
                        background: 'var(--bg-inset)',
                        border: isSuggestedWeight ? '1.5px solid var(--text-accent)' : '1px solid var(--border)',
                        borderRadius: tokens.radius.sm,
                        padding: '8px 6px',
                        fontSize: 14,
                        color: isSuggestedWeight ? 'var(--text-accent)' : 'var(--text-primary)',
                        fontStyle: isSuggestedWeight ? 'italic' : 'normal',
                        outline: 'none',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                      }}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="—"
                      value={sd.reps || ''}
                      aria-label={`Set ${s + 1} reps`}
                      onChange={(e) => handleRepsChange(s, e.target.value)}
                      onBlur={(e) => handleRepsBlur(s, e.target.value)}
                      disabled={isDone || readOnly}
                      style={{
                        minWidth: 0,
                        width: '100%',
                        background: 'var(--bg-inset)',
                        border: isSuggestedReps ? '1.5px solid var(--text-accent)' : '1px solid var(--border)',
                        borderRadius: tokens.radius.sm,
                        padding: '8px 6px',
                        fontSize: 14,
                        color: isSuggestedReps ? 'var(--text-accent)' : 'var(--text-primary)',
                        fontStyle: isSuggestedReps ? 'italic' : 'normal',
                        outline: 'none',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => handleSetCheckmark(s)}
                      disabled={readOnly}
                      aria-pressed={isDone}
                      aria-label={isDone ? `Set ${s + 1} complete — tap to undo` : `Mark set ${s + 1} complete`}
                      style={{
                        minWidth: 0,
                        width: '100%',
                        border: isDone ? '2px solid var(--success)' : '1px solid var(--border)',
                        borderRadius: tokens.radius.sm,
                        padding: '8px 6px',
                        background: isDone ? 'var(--success)' : 'var(--bg-inset)',
                        color: isDone ? 'white' : 'var(--text-muted)',
                        cursor: readOnly ? 'default' : 'pointer',
                        fontSize: 18,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span aria-hidden="true">{isDone ? '✓' : ''}</span>
                    </button>
                    {canRemove ? (
                      <button
                        onClick={() => setRemoveSetPrompt(s)}
                        aria-label={`Remove set ${s + 1}`}
                        style={{
                          width: 28,
                          height: '100%',
                          padding: 0,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span aria-hidden="true">🗑</span>
                      </button>
                    ) : (
                      <div aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Remove set confirmation dialog */}
          {removeSetPrompt !== null && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 300,
                padding: 24,
              }}
              onClick={() => setRemoveSetPrompt(null)}
            >
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="remove-set-title"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.xxl,
                  padding: '24px 20px',
                  width: '100%',
                  maxWidth: 320,
                }}
              >
                <div
                  id="remove-set-title"
                  style={{ fontSize: 16, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}
                >
                  Remove set {removeSetPrompt + 1}?
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    textAlign: 'center',
                    marginBottom: 18,
                    lineHeight: 1.5,
                  }}
                >
                  Any data you've entered for this set will be deleted.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setRemoveSetPrompt(null)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: tokens.radius.md,
                      background: 'var(--bg-inset)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const s = removeSetPrompt;
                      setRemoveSetPrompt(null);
                      setDoneSets((prev) => {
                        const next = new Set<number>();
                        (prev as Set<number>).forEach((d: number) => {
                          if (d < s) next.add(d);
                          else if (d > s) next.add(d - 1);
                        });
                        return next;
                      });
                      onRemoveSet?.(exIdx, s);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: tokens.radius.md,
                      background: 'var(--danger, #C0392B)',
                      border: '1px solid var(--danger, #C0392B)',
                      color: 'white',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Set button */}
          {!done && !readOnly && onAddSet && (
            <button
              onClick={() => onAddSet(exIdx)}
              style={{
                width: '100%',
                fontSize: 12,
                fontWeight: 600,
                padding: '8px',
                marginBottom: 12,
                borderRadius: tokens.radius.sm,
                background: 'transparent',
                border: '1px dashed var(--border)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              + Add Set
            </button>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleHistoryClick}
              style={{
                flex: 1,
                minWidth: 70,
                fontSize: 12,
                padding: '8px 12px',
                borderRadius: tokens.radius.sm,
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                color: 'var(--text-accent)',
                cursor: 'pointer',
              }}
            >
              History
            </button>
            {!done && !readOnly && (
              <button
                onClick={() => onSwapClick(exIdx)}
                style={{
                  flex: 1,
                  minWidth: 70,
                  fontSize: 12,
                  padding: '8px 12px',
                  borderRadius: tokens.radius.sm,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-accent)',
                  cursor: 'pointer',
                }}
              >
                Swap
              </button>
            )}
            {!done && !readOnly && onMoveUp && !isFirst && (
              <button
                onClick={() => onMoveUp(exIdx)}
                aria-label="Move exercise up"
                style={{
                  fontSize: 14,
                  padding: '8px 12px',
                  borderRadius: tokens.radius.sm,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                ↑
              </button>
            )}
            {!done && !readOnly && onMoveDown && !isLast && (
              <button
                onClick={() => onMoveDown(exIdx)}
                aria-label="Move exercise down"
                style={{
                  fontSize: 14,
                  padding: '8px 12px',
                  borderRadius: tokens.radius.sm,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                ↓
              </button>
            )}
          </div>

          {/* Notes section */}
          {noteOpen && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
              }}
            >
              <textarea
                placeholder="Add notes..."
                aria-label="Exercise notes"
                value={note || ''}
                onChange={(e) => onNoteChange(exIdx, e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: '8px',
                  borderRadius: tokens.radius.sm,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-inset)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* RPE Prompt */}
          {rpePrompt !== null && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="rpe-prompt-title"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => setRpePrompt(null)}
            >
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.lg,
                  padding: 20,
                  maxWidth: 320,
                  width: '90%',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  id="rpe-prompt-title"
                  style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}
                >
                  How did that feel?
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    marginBottom: 16,
                  }}
                >
                  SET {rpePrompt + 1} — RPE
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Easy', hint: 'Could do 3+ more reps', color: 'var(--success)' },
                    { label: 'Good', hint: '1–2 reps in reserve', color: 'var(--text-accent)' },
                    { label: 'Hard', hint: 'At or near failure', color: 'var(--danger)' },
                  ].map(({ label, hint, color }) => (
                    <button
                      key={label}
                      onClick={() => handleRpeSelect(rpePrompt, label)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: tokens.radius.md,
                        background: 'var(--bg-inset)',
                        border: `1px solid ${color}`,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, color }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setRpePrompt(null)}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    padding: '8px',
                    borderRadius: tokens.radius.sm,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* History Modal */}
          {showHistory && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="history-modal-title"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => setShowHistory(false)}
            >
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.lg,
                  padding: 20,
                  maxWidth: 400,
                  width: '90%',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div id="history-modal-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                  {exercise.name} - History
                </div>
                {historyRows.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {historyRows.map((row, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 10,
                          background: 'var(--bg-inset)',
                          borderRadius: tokens.radius.sm,
                          fontSize: 12,
                        }}
                      >
                        Week {row.w}: {row.maxW} lbs × {row.maxR} reps ({row.sets} sets)
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    No history available
                  </div>
                )}
                <button
                  onClick={() => setShowHistory(false)}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    padding: '10px',
                    borderRadius: tokens.radius.sm,
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-accent)',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* How-To Modal */}
          {showHowTo && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="howto-modal-title"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => setShowHowTo(false)}
            >
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.lg,
                  padding: 20,
                  maxWidth: 400,
                  width: '90%',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div id="howto-modal-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  {exercise.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    marginBottom: 16,
                  }}
                >
                  HOW TO PERFORM
                </div>
                {exercise.description ? (
                  <div
                    style={{
                      fontSize: 14,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.7,
                      marginBottom: 16,
                    }}
                  >
                    {exercise.description.split(/(?<=\.)\s+/).map((sentence: string, idx: number) => (
                      <p key={idx} style={{ margin: '0 0 8px 0' }}>{sentence}</p>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: 'var(--text-muted)',
                      lineHeight: 1.7,
                      marginBottom: 16,
                    }}
                  >
                    No description available yet.
                  </div>
                )}
                {exercise.videoUrl && (
                  <a
                    href={exercise.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px',
                      borderRadius: tokens.radius.sm,
                      background: 'rgba(255,0,0,0.1)',
                      border: '1px solid rgba(255,0,0,0.3)',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      textAlign: 'center',
                      textDecoration: 'none',
                      marginBottom: 12,
                    }}
                  >
                    Watch on YouTube
                  </a>
                )}
                <button
                  onClick={() => setShowHowTo(false)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: tokens.radius.sm,
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-accent)',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Warmup Modal */}
          {showWarmupModal && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="warmup-modal-title"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => setShowWarmupModal(false)}
            >
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.lg,
                  padding: 20,
                  maxWidth: 400,
                  width: '90%',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div id="warmup-modal-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  Warmup Guide
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    marginBottom: 16,
                  }}
                >
                  {(getWarmupDetail(exercise.warmup, exercise.name) as WarmupDetail)?.title || exercise.warmup}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    marginBottom: 16,
                  }}
                >
                  {(getWarmupDetail(exercise.warmup, exercise.name) as WarmupDetail)?.rationale}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text-accent)',
                    marginBottom: 8,
                  }}
                >
                  Ramp-Up Sets
                </div>
                <ol
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    marginBottom: 16,
                    paddingLeft: 20,
                  }}
                >
                  {generateWarmupSteps(exercise, workingWeight, weekIdx)?.map((step: WarmupStep, idx: number) => (
                    <li key={idx} style={{ marginBottom: 6 }}>
                      <strong>{step.label}</strong> — {step.reps}{step.detail ? `: ${step.detail}` : ''}
                    </li>
                  ))}
                </ol>
                <button
                  onClick={() => setShowWarmupModal(false)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: tokens.radius.sm,
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-accent)',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function areExerciseCardsEqual(prev: ExerciseCardProps, next: ExerciseCardProps) {
  // Cheap primitive checks first
  if (
    prev.exIdx !== next.exIdx ||
    prev.dayIdx !== next.dayIdx ||
    prev.weekIdx !== next.weekIdx ||
    prev.expanded !== next.expanded ||
    prev.done !== next.done ||
    prev.readOnly !== next.readOnly ||
    prev.bodyweight !== next.bodyweight ||
    prev.note !== next.note ||
    prev.active !== next.active
  )
    return false;

  // exercise object — check identity, then key fields that affect render
  if (prev.exercise !== next.exercise) {
    if (
      prev.exercise.name !== next.exercise.name ||
      prev.exercise.sets !== next.exercise.sets ||
      prev.exercise.progression !== next.exercise.progression ||
      prev.exercise.warmup !== next.exercise.warmup ||
      prev.exercise.anchor !== next.exercise.anchor ||
      prev.exercise.modifier !== next.exercise.modifier ||
      prev.exercise.cardio !== next.exercise.cardio
    )
      return false;
  }

  // weekData: only the slice for this card matters — ignore sibling exercise updates
  const prevSlice = prev.weekData[prev.exIdx];
  const nextSlice = next.weekData[next.exIdx];
  if (prevSlice !== nextSlice) {
    if (JSON.stringify(prevSlice) !== JSON.stringify(nextSlice)) return false;
  }

  // Callbacks — parent should memoize with useCallback; compare by reference
  if (
    prev.onUpdateSet !== next.onUpdateSet ||
    prev.onWeightAutoFill !== next.onWeightAutoFill ||
    prev.onLastSetFilled !== next.onLastSetFilled ||
    prev.onToggle !== next.onToggle ||
    prev.onSwapClick !== next.onSwapClick ||
    prev.onSetLogged !== next.onSetLogged ||
    prev.onNoteChange !== next.onNoteChange
  )
    return false;

  return true;
}

export default React.memo(ExerciseCard, areExerciseCardsEqual);
