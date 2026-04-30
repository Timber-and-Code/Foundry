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
import { haptic } from '../../utils/helpers';
import type { Exercise, DayData } from '../../types';
import type { WarmupStep, WarmupDetail } from '../../utils/training';

// Editorial Focus Mode chip pill (How to / Swap). 13/700, padded — matches
// the preview at /preview/hybrid/focus.
const editorialChipStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.02em',
  cursor: 'pointer',
  lineHeight: 1,
};

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
  /** When true, render the editorial Focus Mode layout: large display
   *  name, sets·reps meta, How To + Swap chip pills, Target / Last week
   *  reference card. The compact accordion header is hidden. */
  editorial?: boolean;
  /** Total exercises in the session — shown as "Exercise N of M" only in
   *  editorial mode. */
  totalExercises?: number;
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
  editorial = false,
  totalExercises,
}: ExerciseCardProps) {
  const goal = (getProgTargets() as Record<string, string[]>)[exercise.progression ?? '']?.[weekIdx];

  // Onboarding v2: the anchor coach tip used to fire on row mount, which
  // could surface the popup during the last-set RPE prompt — confusing,
  // because the user is mid-decision and the hammer is no longer the
  // focus. Emission is now deferred to the moment a non-final anchor set
  // is confirmed (see handleSetCheckmark below) so the user is always in
  // a calm rest-period state when they read it.

  // Min rep target derived from the exercise's rep range (e.g. "8-12" -> 8).
  // Used to detect a "miss" (reps < target) for the rep-progression coach mark.
  const repsMin = useMemo(() => {
    const raw = String(exercise.reps || '');
    const first = raw.split('-')[0];
    const n = parseInt(first, 10);
    return Number.isFinite(n) ? n : 0;
  }, [exercise.reps]);
  const goalColor =
    weekIdx < 2
      ? 'var(--text-muted)'
      : weekIdx < 4
        ? 'var(--phase-accum)'
        : weekIdx < 5
          ? 'var(--phase-intens)'
          : 'var(--danger)';
  const [showHowTo, setShowHowTo] = useState(false);
  const [showWarmupModal, setShowWarmupModal] = useState(false);
  // Per-set RPE prompt removed 2026-04-29 — RPE moved to end-of-workout breath card.
  const [removeSetPrompt, setRemoveSetPrompt] = useState<number | null>(null);
  // "Record 0 reps for this set?" gate — opened when the lifter taps the
  // check on a row with no reps entered. On confirm we log 0/0, suppress
  // the rest timer, and let DayView auto-advance to the next exercise via
  // onSetLogged(isLastSet=true). Cancel = no change.
  const [pendingZeroSet, setPendingZeroSet] = useState<number | null>(null);
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

  // Compact "last week" header stat — replaces the phase word ("Establish",
  // "+5 lbs", etc) in the card's top-right with the previous week's best
  // working set so users see a hard reference target instead of jargon.
  // History modal was removed alongside this — the stat is the reference now.
  const lastWeekStat = useMemo<string>(() => {
    const fmt = (w: number, r: number): string => {
      const wTrim = Number.isInteger(w) ? String(w) : w.toFixed(1).replace(/\.0$/, '');
      return `${wTrim} × ${r}`;
    };
    // Same-meso prior week — preferred.
    const prev = prevWeekRaw[exIdx] || {};
    let bestW = 0,
      bestR = 0;
    Object.values(prev as Record<string, SetData>).forEach((sd) => {
      if (!sd || sd.warmup) return;
      const w = parseFloat(String(sd.weight ?? 0));
      const r = parseInt(String(sd.reps ?? 0), 10);
      if (!w || !r) return;
      if (w > bestW || (w === bestW && r > bestR)) {
        bestW = w;
        bestR = r;
      }
    });
    if (bestW > 0 && bestR > 0) return fmt(bestW, bestR);
    // Week 0 fallback — pull last meso's best for this slot if available.
    if (crossMesoNote) {
      const m = crossMesoNote.match(/(\d+(?:\.\d+)?)\s*lbs\s*×\s*(\d+)/i);
      if (m) return fmt(parseFloat(m[1]), parseInt(m[2], 10));
    }
    return '';
  }, [prevWeekRaw, exIdx, crossMesoNote]);

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
    // Empty reps → ask "Record 0 reps?" instead of silently no-op'ing.
    // Confirmed-zero is handled by handleConfirmZeroReps below.
    if (!setData.reps || setData.reps === '') {
      setPendingZeroSet(s);
      return;
    }
    // Onboarding v2: if this confirmation is a rep miss, emit first-miss once
    // per user so the CoachMarkOrchestrator can explain what happens next.
    const confirmedReps = parseInt(String(setData.reps || 0), 10);
    if (
      repsMin > 0 &&
      confirmedReps > 0 &&
      confirmedReps < repsMin &&
      !store.get('foundry:first_rep_progression_emitted')
    ) {
      store.set('foundry:first_rep_progression_emitted', '1');
      window.dispatchEvent(new Event('foundry:first-miss'));
    }
    const totalSets = Number(exercise.sets) || 0;
    const isLastSet = s === totalSets - 1;
    // Confirm directly — per-exercise RPE prompt removed 2026-04-29.
    // RPE is now collected once at end of workout (WorkoutBreathCard).
    onUpdateSet(exIdx, s, 'confirmed', true);
    setDoneSets((prev) => new Set([...prev, s]));
    onLastSetFilled(exIdx, s);
    // Pass isLastSet=true on the final set so DayView's handleSetLogged
    // suppresses the rest timer (between-exercise transition is the
    // NextUpCard, not a rest beep).
    onSetLogged(exercise.rest || '2 min', exercise.name, s, isLastSet);
    // Anchor coach tip — fires only on a non-final set confirm so the
    // hammer icon is visible during rest between sets.
    if (!isLastSet && exercise.anchor && !store.get('foundry:first_anchor_emitted')) {
      store.set('foundry:first_anchor_emitted', '1');
      window.dispatchEvent(new Event('foundry:first-anchor-visible'));
    }
  };

  const handleConfirmZeroReps = (s: number) => {
    setPendingZeroSet(null);
    // Log set as 0/0 + confirmed. Skip the rest timer and trigger
    // DayView's "advance to next exercise" path by passing
    // isLastSet=true — semantically the lifter is bailing on this exercise.
    onUpdateSet(exIdx, s, 'reps', '0');
    onUpdateSet(exIdx, s, 'weight', '0');
    onUpdateSet(exIdx, s, 'confirmed', true);
    setDoneSets((prev) => new Set([...prev, s]));
    onLastSetFilled(exIdx, s);
    onSetLogged(exercise.rest || '0', exercise.name, s, true);
    // Tactile ack for the skip — rest timer's own haptic won't fire here
    // because we deliberately bypass it.
    try { haptic('tap'); } catch { /* haptic unavailable on this platform */ }
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

  // Onboarding v2: emit first-stall once per user when the stall warning
  // first becomes truthy. CoachMarkOrchestrator explains what a stall means.
  useEffect(() => {
    if (stallWarning && !store.get('foundry:first_stall_emitted')) {
      store.set('foundry:first_stall_emitted', '1');
      window.dispatchEvent(new Event('foundry:first-stall'));
    }
  }, [stallWarning]);

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
      data-coach={exercise.anchor ? 'anchor-row' : undefined}
      style={{
        background: 'var(--bg-card)',
        // Editorial Focus Mode is already orange inside (row tints, chips,
        // accent check, accent chip pills, ProgressStrip done segments) —
        // adding an outer accent border pushes it into "too much orange."
        // Use a neutral border there. Legacy/accordion path keeps the
        // original active accent treatment.
        border: editorial
          ? '1px solid var(--border)'
          : active
          ? '1px solid var(--accent, #D4A03C)'
          : '1px solid var(--border)',
        borderLeft: editorial
          ? '1px solid var(--border)'
          : active
          ? '4px solid var(--accent, #D4A03C)'
          : '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        marginBottom: 12,
        overflow: 'hidden',
        transition: 'border-color 0.25s, border-left 0.25s',
      }}
    >
      {/* ── EDITORIAL HEADER (Focus Mode) ──────────────────────────────
          Big display name, sets·reps meta, How To + Swap chip pills, and
          a Target / Last week reference card. Replaces the compact
          accordion header during a live workout where the card is
          always expanded. */}
      {editorial && (
        <div style={{ padding: '18px 18px 8px' }}>
          {totalExercises != null && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}
            >
              Exercise {exIdx + 1} of {totalExercises}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 6,
              flexWrap: 'wrap',
            }}
          >
            <h2
              style={{
                fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                fontSize: 36,
                fontWeight: 400,
                lineHeight: 1.0,
                letterSpacing: '0.02em',
                color: 'var(--text-primary)',
                margin: 0,
                flex: '1 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {exercise.name}
            </h2>
            {exercise.anchor && (
              <span data-coach="anchor-hammer" style={{ display: 'inline-flex', flexShrink: 0 }}>
                <HammerIcon size={20} />
              </span>
            )}
            {exercise.modifier && (
              <span
                style={{
                  fontSize: 11,
                  background: 'var(--bg-inset)',
                  color: 'var(--text-muted)',
                  padding: '3px 8px',
                  borderRadius: tokens.radius.xs,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {exercise.modifier}
              </span>
            )}
          </div>
          {supersetPartnerName && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--accent)',
                background: 'rgba(var(--accent-rgb),0.10)',
                padding: '3px 9px',
                borderRadius: tokens.radius.xs,
                textTransform: 'uppercase',
              }}
            >
              Superset with {supersetPartnerName}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1, minWidth: 0 }}>
              {exercise.sets ?? '?'} sets · {exercise.reps ?? '?'} reps
              {exercise.rest ? ` · ${exercise.rest}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={handleHowToClick}
                style={editorialChipStyle}
              >
                How to
              </button>
              {!done && !readOnly && (
                <button
                  onClick={() => onSwapClick(exIdx)}
                  style={editorialChipStyle}
                >
                  Swap
                </button>
              )}
            </div>
          </div>
          {/* Target / Last week reference card. Target uses the goal label
              ("Establish", "+5 lbs"); Last week pulls best set from the
              prior week (or cross-meso archive on week 0). */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.md,
              background: 'var(--bg-inset)',
              overflow: 'hidden',
              marginBottom: 4,
            }}
          >
            <div style={{ padding: '12px 14px' }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: 3,
                }}
              >
                Target
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: goalColor }}>
                {goal || '—'}
              </div>
            </div>
            <div style={{ padding: '12px 14px', borderLeft: '1px solid var(--border)' }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: 3,
                }}
              >
                Last week
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                {lastWeekStat || '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER (clickable to expand) ──────────────────────────────
          Pre-workout / non-Focus modes only. Editorial header above
          replaces this during a live workout. */}
      {!editorial && (
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
              {exercise.anchor && (
                <span data-coach="anchor-hammer" style={{ display: 'inline-flex' }}>
                  <HammerIcon size={16} style={{ marginTop: 1 }} />
                </span>
              )}
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

        {/* Last week's best set + Expand arrow. The phase word ("Establish",
            "+5 lbs") used to live here but it was jargon that didn't help
            mid-set — the previous-week reference is what lifters actually
            chase. Falls back to the goal label only when no history exists. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          {lastWeekStat ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: 'var(--text-muted)',
                }}
              >
                LAST WK
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                {lastWeekStat}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, fontWeight: 600, color: goalColor }}>{goal}</div>
          )}
          <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </button>
      )}

      {/* ── EXPANDED CONTENT ── */}
      {expanded && (
        <div
          style={{
            borderTop: editorial ? 'none' : '1px solid var(--border)',
            padding: editorial ? '12px 18px' : '12px 16px',
          }}
        >
          {/* Warmup & How To buttons. In editorial mode, How To is in the
              header chips so we hide the standalone button there. */}
          {!done && (exercise.warmup || !editorial) && (
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
              {!editorial && (
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
              )}
            </div>
          )}

          {/* Stall warning */}
          {stallWarning && (
            <div
              data-coach="stall-chip"
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

          {/* Set logging grid. Two layouts:
              - editorial (Focus Mode): 32px # / 1fr Lbs / 1fr Reps / 44px ✓
                with orange-gradient row tint and underline-only inputs.
                Matches /preview/hybrid/focus.
              - non-editorial (pre-workout accordion): legacy 4-col grid
                with bordered inputs + minus button. */}
          {!done && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: editorial
                    ? '32px 1fr 1fr 44px'
                    : '1fr 1fr 1fr 28px',
                  gap: editorial ? 10 : 8,
                  marginBottom: editorial ? 0 : 8,
                  padding: editorial ? '6px 0' : 0,
                  borderBottom: editorial ? '1px solid var(--border-subtle, var(--border))' : 'none',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  letterSpacing: editorial ? '0.06em' : 'normal',
                  textTransform: editorial ? 'uppercase' : 'none',
                }}
                aria-hidden="true"
              >
                {editorial ? (
                  <>
                    <span>#</span>
                    <span style={{ textAlign: 'center' }}>Lbs</span>
                    <span style={{ textAlign: 'center' }}>Reps</span>
                    <span />
                  </>
                ) : (
                  <>
                    <div>Weight (lbs)</div>
                    <div>Reps</div>
                    <div style={{ textAlign: 'center' }}>Done</div>
                    <div />
                  </>
                )}
              </div>
              {Array.from({ length: Number(exercise.sets ?? 0) }).map((_, s) => {
                const sd = (weekData[exIdx] || {})[s] || {};
                const isDone = doneSets.has(s);
                const isSuggestedWeight = !!sd.suggested;
                const isSuggestedReps = !!sd.repsSuggested;
                const totalSets = Number(exercise.sets ?? 0);
                const canRemove = !isDone && !readOnly && !!onRemoveSet && totalSets > 1;
                const confirmedReps = parseInt(String(sd.reps || 0), 10);
                const isMissedRow =
                  isDone && repsMin > 0 && confirmedReps > 0 && confirmedReps < repsMin;
                // First not-done row is "active" — picks up a slightly
                // brighter orange tint so the lifter knows where to type.
                const firstActiveIdx = (() => {
                  for (let i = 0; i < totalSets; i++) {
                    if (!doneSets.has(i)) return i;
                  }
                  return -1;
                })();
                const isActive = editorial && s === firstActiveIdx;
                const rowBg = editorial
                  ? isDone
                    ? 'linear-gradient(90deg, rgba(232,101,26,0.08) 0%, transparent 100%)'
                    : isActive
                    ? 'linear-gradient(90deg, rgba(232,101,26,0.12) 0%, transparent 100%)'
                    : 'transparent'
                  : undefined;
                // Editorial input: fully borderless, Bebas display font for
                // the numerals. Matches the preview's editorial typography
                // — set values read as headlines, not form fields.
                const editorialInputStyle = (suggested: boolean): React.CSSProperties => ({
                  width: '100%',
                  textAlign: 'center',
                  fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                  fontSize: 22,
                  fontWeight: 400,
                  letterSpacing: '0.02em',
                  padding: '6px 0',
                  color: isDone
                    ? 'var(--text-secondary)'
                    : suggested
                    ? 'var(--text-accent)'
                    : 'var(--text-primary)',
                  fontStyle: suggested ? 'italic' : 'normal',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontVariantNumeric: 'tabular-nums',
                  boxSizing: 'border-box',
                });
                // Legacy bordered input (pre-workout accordion mode).
                const legacyInputStyle = (suggested: boolean): React.CSSProperties => ({
                  minWidth: 0,
                  width: '100%',
                  background: 'var(--bg-inset)',
                  border: suggested ? '1.5px solid var(--text-accent)' : '1px solid var(--border)',
                  borderRadius: tokens.radius.sm,
                  padding: '8px 6px',
                  fontSize: 14,
                  color: suggested ? 'var(--text-accent)' : 'var(--text-primary)',
                  fontStyle: suggested ? 'italic' : 'normal',
                  outline: 'none',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                });
                return (
                  <div
                    key={s}
                    data-coach={isMissedRow ? 'missed-row' : undefined}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: editorial
                        ? '32px 1fr 1fr 44px'
                        : '1fr 1fr 1fr 28px',
                      gap: editorial ? 10 : 8,
                      alignItems: 'center',
                      padding: editorial ? '12px 0' : 0,
                      marginBottom: editorial ? 0 : 6,
                      borderBottom: editorial ? '1px solid var(--border-subtle, var(--border))' : 'none',
                      background: rowBg,
                      opacity: !editorial && isDone ? 0.6 : 1,
                    }}
                  >
                    {editorial && (
                      <span
                        style={{
                          fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                          fontSize: 22,
                          fontWeight: 400,
                          color: isDone
                            ? 'var(--accent)'
                            : isActive
                            ? 'var(--text-primary)'
                            : 'var(--text-muted)',
                          letterSpacing: '0.04em',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {String(s + 1).padStart(2, '0')}
                      </span>
                    )}
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="—"
                      value={sd.weight || ''}
                      aria-label={`Set ${s + 1} weight in pounds`}
                      onChange={(e) => onUpdateSet(exIdx, s, 'weight', e.target.value)}
                      onBlur={(e) => handleWeightBlur(s, e.target.value)}
                      disabled={isDone || readOnly}
                      style={editorial ? editorialInputStyle(isSuggestedWeight) : legacyInputStyle(isSuggestedWeight)}
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
                      style={editorial ? editorialInputStyle(isSuggestedReps) : legacyInputStyle(isSuggestedReps)}
                    />
                    <button
                      onClick={() => handleSetCheckmark(s)}
                      disabled={readOnly}
                      aria-pressed={isDone}
                      aria-label={isDone ? `Set ${s + 1} complete — tap to undo` : `Mark set ${s + 1} complete`}
                      style={editorial ? {
                        width: 36,
                        height: 36,
                        justifySelf: 'end',
                        border: isDone ? 'none' : '1px solid var(--border)',
                        borderRadius: 8,
                        background: isDone ? 'var(--accent)' : 'transparent',
                        color: isDone ? 'var(--bg-root, #0A0A0C)' : 'var(--text-muted)',
                        cursor: readOnly ? 'default' : 'pointer',
                        fontSize: 16,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                      } : {
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
                    {/* Editorial mode drops the minus button entirely — the
                        empty-reps check tap now opens the 0-reps confirm,
                        which doubles as the "I'm skipping" path. Legacy
                        accordion mode keeps the minus for explicit removal. */}
                    {!editorial && (canRemove ? (
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
                          fontSize: 22,
                          fontWeight: 700,
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span aria-hidden="true">−</span>
                      </button>
                    ) : (
                      <div aria-hidden="true" />
                    ))}
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

          {/* Empty-reps confirm — "Record 0 reps for this set?" Lifter chose
              to skip; we log 0/0, suppress the rest timer (no work, no
              recovery owed), and jump to the next unfinished exercise. */}
          {pendingZeroSet !== null && (
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
              onClick={() => setPendingZeroSet(null)}
            >
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="zero-reps-title"
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
                  id="zero-reps-title"
                  style={{ fontSize: 16, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}
                >
                  Record 0 reps for this set?
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
                  We'll log it and jump to the next exercise. No rest timer.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setPendingZeroSet(null)}
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
                    onClick={() => handleConfirmZeroReps(pendingZeroSet)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: tokens.radius.md,
                      background: 'var(--btn-primary-bg)',
                      border: '1px solid var(--btn-primary-border)',
                      color: 'var(--btn-primary-text)',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Record 0
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

          {/* Action buttons. In editorial mode (Focus Mode), Swap lives in
              the header chip pills and reorder is handled by the bottom-nav
              REORDER sheet — so we hide all of these. In non-editorial
              accordion mode they remain available. */}
          {!editorial && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          )}

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
