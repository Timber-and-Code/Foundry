import { useState, useMemo } from 'react';
import { tokens } from '../../styles/tokens';
import SetRow from './SetRow';
import MesoHistoryView from './MesoHistoryView';
import { store } from '../../utils/store';
import { haptic } from '../../utils/helpers';
import { getMeso } from '../../data/constants';
import { useExerciseProgression } from '../../hooks/useExerciseProgression';
import type { Exercise, DayData } from '../../types';

interface SetData {
  weight?: string | number;
  reps?: string | number;
  rpe?: string | number;
  warmup?: boolean;
  confirmed?: boolean;
  suggested?: boolean;
  repsSuggested?: boolean;
  [key: string]: unknown;
}

export interface SupersetRoundViewProps {
  /** Members of the superset group, in render order. */
  exercises: Exercise[];
  /** Indexes in DayView's full exercises array, parallel to `exercises`. */
  exIdxs: number[];
  weekData: DayData;
  dayIdx: number;
  weekIdx: number;
  readOnly: boolean;
  onUpdateSet: (
    exIdx: number,
    setIdx: number,
    field: string,
    value: string | number | boolean,
  ) => void;
  onWeightAutoFill: (
    exIdx: number,
    value: string,
    sets: number | string | undefined,
  ) => void;
  onLastSetFilled: (exIdx: number, setIdx: number) => void;
  onSetLogged: (
    restStr: string,
    exName: string,
    setIdx: number,
    isLastSet?: boolean,
  ) => void;
  onAddSet?: (exIdx: number) => void;
  onRemoveSet?: (exIdx: number, setIdx: number) => void;
  onSwapClick: (exIdx: number) => void;
  /** Per-exercise notes keyed by exIdx — same shape DayView passes to
   *  ExerciseCard. Optional so older render paths still compile. */
  notes?: Record<number, string>;
  /** Note edit callback — DayView merges into its exNotes map and persists. */
  onNoteChange?: (exIdx: number, value: string) => void;
}

/**
 * Round-grouped (interleaved) layout for a superset block. Replaces the
 * prior FLAT layout where each ExerciseCard's full set list was stacked
 * vertically — the new layout exposes the round semantics already enforced
 * by the rest-timer logic (commit 0acb589: rest fires when every paired
 * exercise has its same-index set confirmed).
 *
 * Visual structure:
 *
 *   ┌───────────────────────────────┐
 *   │ Bench Press · 3-30×12  [swap] │  ← header strip
 *   │ Bent Row    · 3-25×10  [swap] │
 *   ├───────────────────────────────┤
 *   │ ROUND 1                       │
 *   │   01 · BENCH  __ × __  ☐      │
 *   │   01 · ROW    __ × __  ☐      │
 *   ├───────────────────────────────┤
 *   │ ROUND 2 …                     │
 *
 * Round count = max(ex.sets) across the group. Rounds are emitted up to
 * that max; exercises with fewer sets render an empty placeholder for the
 * extra round so the visual columns stay aligned.
 *
 * DEV-flagged at the call site (SUPERSETS_ENABLED in DayView).
 */
export default function SupersetRoundView({
  exercises,
  exIdxs,
  weekData,
  dayIdx,
  weekIdx,
  readOnly,
  onUpdateSet,
  onWeightAutoFill,
  onLastSetFilled,
  onSetLogged,
  onAddSet,
  onRemoveSet,
  onSwapClick,
  notes,
  onNoteChange,
}: SupersetRoundViewProps) {
  // Open-note tracking — set of exIdxs whose notes textarea is expanded.
  // Seeded with any exercise that already has saved note text so the
  // textarea is visible on mount when notes exist.
  const [openNoteIdxs, setOpenNoteIdxs] = useState<Set<number>>(() => {
    const open = new Set<number>();
    if (notes) {
      exIdxs.forEach((idx) => {
        const v = notes[idx];
        if (v && v.trim()) open.add(idx);
      });
    }
    return open;
  });
  const toggleNote = (exIdx: number) => {
    setOpenNoteIdxs((prev) => {
      const next = new Set(prev);
      if (next.has(exIdx)) next.delete(exIdx);
      else next.add(exIdx);
      return next;
    });
  };
  // Per-exercise done sets — one entry per exIdx in the group.
  // Restored from weekData on mount so the round view recovers state across
  // unmounts (e.g. user scrolls away and back). Keeps the same restore rule
  // as ExerciseCard: only `confirmed === true` counts.
  const [doneSetsMap, setDoneSetsMap] = useState<Map<number, Set<number>>>(() => {
    const map = new Map<number, Set<number>>();
    exIdxs.forEach((exIdx, gi) => {
      const ex = exercises[gi];
      const exData = weekData[exIdx] || {};
      const restored = new Set<number>();
      for (let s = 0; s < Number(ex.sets ?? 0); s++) {
        const sd = (exData[s] || {}) as SetData;
        if (sd.confirmed === true) restored.add(s);
      }
      map.set(exIdx, restored);
    });
    return map;
  });

  // History modal — opened by tapping a header-strip last-week chip. Per-
  // exercise so the modal can show that one exercise's full week-by-week
  // log without conflating the pair.
  const [historyExIdx, setHistoryExIdx] = useState<number | null>(null);

  // Remove-set confirm — { exIdx, setIdx }. Round view delegates to the
  // shared dialog at the bottom of the block; per-exercise SetRow only
  // emits intent.
  const [removePrompt, setRemovePrompt] = useState<{ exIdx: number; setIdx: number } | null>(
    null,
  );

  // "Record 0 reps?" gate — same semantics as ExerciseCard. Empty-reps tap
  // on the checkmark goes through this prompt.
  const [pendingZeroSet, setPendingZeroSet] = useState<{ exIdx: number; setIdx: number } | null>(
    null,
  );

  const maxRounds = useMemo(() => {
    let m = 0;
    exercises.forEach((ex) => {
      const n = Number(ex.sets ?? 0);
      if (n > m) m = n;
    });
    return m;
  }, [exercises]);

  // Last-week stat — same format as ExerciseCard's lastWeekStat memo, one
  // per exercise. Rendered inline in the header strip.
  const prevWeekRaw = useMemo(() => {
    if (weekIdx === 0) return {} as Record<number, Record<string, SetData>>;
    try {
      const raw = store.get(`foundry:day${dayIdx}:week${weekIdx - 1}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {} as Record<number, Record<string, SetData>>;
    }
  }, [dayIdx, weekIdx]);

  const lastWeekStatFor = (exIdx: number): string => {
    const prev = (prevWeekRaw as Record<number, Record<string, SetData>>)[exIdx] || {};
    let bestW = 0,
      bestR = 0,
      setsCount = 0;
    Object.values(prev).forEach((sd) => {
      if (!sd || sd.warmup) return;
      const w = parseFloat(String(sd.weight ?? 0));
      const r = parseInt(String(sd.reps ?? 0), 10);
      if (!w || !r) return;
      setsCount += 1;
      if (w > bestW || (w === bestW && r > bestR)) {
        bestW = w;
        bestR = r;
      }
    });
    if (setsCount === 0 || bestW === 0 || bestR === 0) return '';
    const wTrim = Number.isInteger(bestW) ? String(bestW) : bestW.toFixed(1).replace(/\.0$/, '');
    return `${setsCount}-${wTrim}×${bestR}`;
  };

  // Per-exercise rep-min derivation — used to flag missed rows (reps <
  // target) so the SetRow can surface a coach-mark hook.
  const repsMinFor = (ex: Exercise): number => {
    const raw = String(ex.reps || '');
    const first = raw.split('-')[0];
    const n = parseInt(first, 10);
    return Number.isFinite(n) ? n : 0;
  };

  // Mirrors ExerciseCard.handleSetCheckmark — kept inline so the round view
  // doesn't need to lift this state into DayView (DayView already owns
  // weekData; the doneSets map is purely UI state).
  const handleCheckmark = (exIdx: number, setIdx: number, ex: Exercise) => {
    const isDone = doneSetsMap.get(exIdx)?.has(setIdx) ?? false;
    if (isDone) {
      setDoneSetsMap((prev) => {
        const next = new Map(prev);
        const s = new Set(next.get(exIdx) ?? []);
        s.delete(setIdx);
        next.set(exIdx, s);
        return next;
      });
      onUpdateSet(exIdx, setIdx, 'confirmed', false);
      return;
    }
    const setData = ((weekData[exIdx] || {}) as Record<string, SetData>)[setIdx] || {
      weight: '',
      reps: '',
    };
    if (!setData.reps || setData.reps === '') {
      setPendingZeroSet({ exIdx, setIdx });
      return;
    }
    const repsMin = repsMinFor(ex);
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
    const totalSets = Number(ex.sets) || 0;
    const isLastSet = setIdx === totalSets - 1;
    onUpdateSet(exIdx, setIdx, 'confirmed', true);
    setDoneSetsMap((prev) => {
      const next = new Map(prev);
      const s = new Set(next.get(exIdx) ?? []);
      s.add(setIdx);
      next.set(exIdx, s);
      return next;
    });
    onLastSetFilled(exIdx, setIdx);
    onSetLogged(ex.rest || '2 min', ex.name, setIdx, isLastSet);
  };

  const handleConfirmZeroReps = () => {
    if (!pendingZeroSet) return;
    const { exIdx, setIdx } = pendingZeroSet;
    setPendingZeroSet(null);
    const ex = exercises[exIdxs.indexOf(exIdx)];
    if (!ex) return;
    onUpdateSet(exIdx, setIdx, 'reps', '0');
    onUpdateSet(exIdx, setIdx, 'weight', '0');
    onUpdateSet(exIdx, setIdx, 'confirmed', true);
    setDoneSetsMap((prev) => {
      const next = new Map(prev);
      const s = new Set(next.get(exIdx) ?? []);
      s.add(setIdx);
      next.set(exIdx, s);
      return next;
    });
    onLastSetFilled(exIdx, setIdx);
    onSetLogged(ex.rest || '0', ex.name, setIdx, true);
    try {
      haptic('tap');
    } catch {
      /* haptic unavailable */
    }
  };

  const handleConfirmRemove = () => {
    if (!removePrompt) return;
    const { exIdx, setIdx } = removePrompt;
    setRemovePrompt(null);
    setDoneSetsMap((prev) => {
      const next = new Map(prev);
      const set = new Set<number>();
      (prev.get(exIdx) ?? new Set<number>()).forEach((d: number) => {
        if (d < setIdx) set.add(d);
        else if (d > setIdx) set.add(d - 1);
      });
      next.set(exIdx, set);
      return next;
    });
    onRemoveSet?.(exIdx, setIdx);
  };

  return (
    <div data-testid="superset-round-view">
      {/* Header strip — one line per exercise, name + last-week stat +
          progression / stall chips + swap. Each row is a subcomponent so
          it can call useExerciseProgression internally — calling the hook
          inside this map directly would violate the rules-of-hooks
          stable-order requirement. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '8px 4px 12px',
        }}
      >
        {exercises.map((ex, gi) => {
          const exIdx = exIdxs[gi];
          return (
            <SupersetMemberHeader
              key={exIdx}
              exercise={ex}
              exIdx={exIdx}
              lastWeekStat={lastWeekStatFor(exIdx)}
              weekData={weekData}
              prevWeekRaw={prevWeekRaw as Record<number, Record<string, SetData>>}
              weekIdx={weekIdx}
              readOnly={readOnly}
              onHistoryClick={() => setHistoryExIdx(exIdx)}
              onSwapClick={() => onSwapClick(exIdx)}
              noteValue={notes ? notes[exIdx] : undefined}
              noteOpen={openNoteIdxs.has(exIdx)}
              onNoteToggle={onNoteChange ? () => toggleNote(exIdx) : undefined}
              onNoteChange={
                onNoteChange ? (val: string) => onNoteChange(exIdx, val) : undefined
              }
            />
          );
        })}
      </div>

      {/* Per-round blocks */}
      {Array.from({ length: maxRounds }).map((_, r) => (
        <div
          key={r}
          data-testid={`round-${r}`}
          style={{
            borderTop: '1px solid var(--border)',
            padding: '8px 0 4px',
          }}
        >
          <div
            style={{
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--accent)',
              letterSpacing: '0.18em',
              padding: '4px 4px 6px',
            }}
          >
            SET {r + 1}
          </div>
          {exercises.map((ex, gi) => {
            const exIdx = exIdxs[gi];
            const totalSets = Number(ex.sets ?? 0);
            // If this exercise has fewer sets than maxRounds, render a
            // placeholder so the round columns visually align. Lifter
            // shouldn't see an empty input — we render a muted "—" line.
            if (r >= totalSets) {
              return (
                <div
                  key={exIdx}
                  style={{
                    padding: '12px 8px',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    opacity: 0.5,
                  }}
                >
                  {ex.name.toUpperCase()} — rest
                </div>
              );
            }
            const sd = ((weekData[exIdx] || {}) as Record<string, SetData>)[r] || {};
            const isDone = doneSetsMap.get(exIdx)?.has(r) ?? false;
            const isSuggestedWeight = !!sd.suggested;
            const isSuggestedReps = !!sd.repsSuggested;
            const repsMin = repsMinFor(ex);
            const confirmedReps = parseInt(String(sd.reps || 0), 10);
            const isMissedRow =
              isDone && repsMin > 0 && confirmedReps > 0 && confirmedReps < repsMin;
            // First incomplete set across this exercise's set list — drives
            // the active-row tint. We honor the per-exercise sequence
            // (matches solo behavior) rather than a group-wide cursor.
            const firstActiveIdx = (() => {
              const done = doneSetsMap.get(exIdx) ?? new Set<number>();
              for (let i = 0; i < totalSets; i++) {
                if (!done.has(i)) return i;
              }
              return -1;
            })();
            const isActive = r === firstActiveIdx;
            const canRemove =
              !isDone && !readOnly && !!onRemoveSet && totalSets > 1;
            return (
              <div key={`${exIdx}-${r}`} style={{ marginBottom: 4 }}>
                <div
                  style={{
                    // Match the 22px Bebas baseline used for the weight/reps
                    // inputs (and the solo-card "01" badge) so the name reads
                    // as part of the same typographic system, not a small
                    // label tacked above.
                    fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                    fontSize: 22,
                    fontWeight: 400,
                    letterSpacing: '0.02em',
                    color: isDone
                      ? 'var(--accent)'
                      : isActive
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    padding: '4px 0 2px',
                    lineHeight: 1.0,
                  }}
                >
                  {ex.name.toUpperCase()}
                </div>
              <SetRow
                exIdx={exIdx}
                setIdx={r}
                weight={(sd.weight ?? '') as string | number}
                reps={(sd.reps ?? '') as string | number}
                isDone={isDone}
                isActive={isActive}
                isSuggestedWeight={isSuggestedWeight}
                isSuggestedReps={isSuggestedReps}
                isMissedRow={isMissedRow}
                canRemove={canRemove}
                readOnly={readOnly}
                exerciseName={ex.name}
                noLeadingColumn
                onUpdateWeight={(value) => {
                  onUpdateSet(exIdx, r, 'weight', value);
                  // Edit unconfirms the row, mirroring ExerciseCard.
                  setDoneSetsMap((prev) => {
                    const next = new Map(prev);
                    const s = new Set(next.get(exIdx) ?? []);
                    s.delete(r);
                    next.set(exIdx, s);
                    return next;
                  });
                }}
                onUpdateReps={(value) => {
                  onUpdateSet(exIdx, r, 'reps', value);
                  setDoneSetsMap((prev) => {
                    const next = new Map(prev);
                    const s = new Set(next.get(exIdx) ?? []);
                    s.delete(r);
                    next.set(exIdx, s);
                    return next;
                  });
                }}
                onWeightBlur={(value) => {
                  if (
                    r === 0 &&
                    value.trim() !== '' &&
                    !isNaN(parseFloat(value))
                  ) {
                    onWeightAutoFill(exIdx, value, ex.sets);
                  }
                }}
                onCheckmark={() => handleCheckmark(exIdx, r, ex)}
                onRequestRemove={
                  canRemove ? () => setRemovePrompt({ exIdx, setIdx: r }) : undefined
                }
                variant="editorial"
              />
              </div>
            );
          })}
        </div>
      ))}

      {/* Add round — adds one set to every exercise in the group so
          maxRounds advances by 1. Disabled in readOnly. */}
      {onAddSet && !readOnly && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 4px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              exIdxs.forEach((exIdx) => onAddSet(exIdx));
            }}
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.18em',
              color: 'var(--text-muted)',
              background: 'transparent',
              border: '1px dashed var(--border)',
              borderRadius: tokens.radius.sm,
              padding: '8px 16px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontFamily: 'inherit',
            }}
          >
            + Add Round
          </button>
        </div>
      )}

      {/* History modal — per-exercise, opened by tapping a header chip. */}
      {historyExIdx !== null && (() => {
        const ex = exercises[exIdxs.indexOf(historyExIdx)];
        if (!ex) return null;
        return (
          <MesoHistoryView
            exercise={ex}
            dayIdx={dayIdx}
            exIdx={historyExIdx}
            currentWeekIdx={weekIdx}
            mesoWeeks={getMeso().totalWeeks}
            onClose={() => setHistoryExIdx(null)}
          />
        );
      })()}

      {/* Remove-set confirm dialog */}
      {removePrompt !== null && (
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
          onClick={() => setRemovePrompt(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="superset-remove-set-title"
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
              id="superset-remove-set-title"
              style={{ fontSize: 16, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}
            >
              Remove set {removePrompt.setIdx + 1}?
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
                onClick={() => setRemovePrompt(null)}
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
                onClick={handleConfirmRemove}
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

      {/* Empty-reps confirm */}
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
            aria-labelledby="superset-zero-reps-title"
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
              id="superset-zero-reps-title"
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
              Move past this exercise without logging any reps.
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
                onClick={handleConfirmZeroReps}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: tokens.radius.md,
                  background: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SupersetMemberHeader                                                      */
/*                                                                            */
/*  One row in the header strip. Carved out of SupersetRoundView so we can    */
/*  call useExerciseProgression() per member without violating the            */
/*  rules-of-hooks stable-order requirement (the map() in the parent emits    */
/*  N members, but the hook order inside this child stays fixed at one).      */
/*                                                                            */
/*  Layout (left → right): [name + last-week stat] [+5 LBS chip?]            */
/*  [⚠ DROP chip?] [SWAP button]. Per-exercise A/B letters were dropped       */
/*  from the strip — the names themselves identify each member of the pair.   */
/* -------------------------------------------------------------------------- */

interface SupersetMemberHeaderProps {
  exercise: Exercise;
  exIdx: number;
  lastWeekStat: string;
  weekData: DayData;
  prevWeekRaw: Record<number, Record<string, SetData>>;
  weekIdx: number;
  readOnly: boolean;
  onHistoryClick: () => void;
  onSwapClick: () => void;
  /** Note text + open state + handlers — wired only when DayView passes
   *  the parent `notes` + `onNoteChange` props. The textarea renders
   *  inline below the header row when the user taps NOTE. */
  noteValue?: string;
  noteOpen?: boolean;
  onNoteToggle?: () => void;
  onNoteChange?: (value: string) => void;
}

function SupersetMemberHeader({
  exercise,
  exIdx,
  lastWeekStat,
  weekData,
  prevWeekRaw,
  weekIdx,
  readOnly,
  onHistoryClick,
  onSwapClick,
  noteValue,
  noteOpen,
  onNoteToggle,
  onNoteChange,
}: SupersetMemberHeaderProps) {
  const { progressionBanner, stallWarning, stallTarget } = useExerciseProgression({
    exIdx,
    exercise,
    weekData,
    prevWeekRaw,
    weekIdx,
  });

  const repsRange = String(exercise.reps ?? '');

  // Compact chip text. The progression banner's full copy lives on the
  // tooltip — the chip itself surfaces just the headline number so the
  // header row stays single-line at iPhone widths. Match the leading
  // "+X" / "+1 rep" segment.
  const progressionChipText = (() => {
    if (!progressionBanner) return null;
    const m = progressionBanner.text.match(/^\+([\d.]+)\s*lbs/i);
    if (m) return `+${m[1]} LBS`;
    if (/\+1\s*rep/i.test(progressionBanner.text)) return '+1 REP';
    return null;
  })();

  const noteWired = typeof onNoteToggle === 'function' && typeof onNoteChange === 'function';
  const hasNoteText = !!(noteValue && noteValue.trim());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          // Allow the chips + swap button to wrap below the name on
          // narrow screens (e.g. iPhone SE, side-by-side iPad split). The
          // name button keeps flex: 1 so it fills row 1 alone when chips
          // are shoved to row 2; rowGap gives the wrap a clean spacer.
          flexWrap: 'wrap',
          rowGap: 6,
          minWidth: 0,
        }}
      >
      <button
        type="button"
        onClick={onHistoryClick}
        aria-label={`${exercise.name} — view history`}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'inherit',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {exercise.name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {lastWeekStat || repsRange}
        </span>
      </button>
      {progressionChipText && progressionBanner && (
        <span
          data-testid={`progression-chip-${exIdx}`}
          title={progressionBanner.text}
          style={{
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: '0.12em',
            color: progressionBanner.color,
            border: `1px solid ${progressionBanner.color}`,
            borderRadius: tokens.radius.sm,
            padding: '2px 6px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            textTransform: 'uppercase',
          }}
        >
          {progressionChipText}
        </span>
      )}
      {stallWarning && stallTarget && (
        <span
          data-testid={`stall-chip-${exIdx}`}
          title={`Last week: ${stallTarget.w} × ${stallTarget.r}`}
          style={{
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: '0.12em',
            color: 'var(--danger)',
            border: '1px solid var(--danger)',
            borderRadius: tokens.radius.sm,
            padding: '2px 6px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            textTransform: 'uppercase',
          }}
        >
          ⚠ Drop
        </span>
      )}
      {noteWired && (
        <button
          type="button"
          onClick={onNoteToggle}
          aria-label={`${noteOpen ? 'Hide' : 'Add'} note for ${exercise.name}`}
          aria-pressed={!!noteOpen}
          data-testid={`note-toggle-${exIdx}`}
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: hasNoteText ? 'var(--accent)' : 'var(--text-muted)',
            background: 'transparent',
            border: `1px solid ${hasNoteText ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: tokens.radius.sm,
            padding: '4px 8px',
            cursor: 'pointer',
            textTransform: 'uppercase',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          Note
        </button>
      )}
      <button
        type="button"
        onClick={onSwapClick}
        disabled={readOnly}
        aria-label={`Swap ${exercise.name}`}
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.sm,
          padding: '4px 8px',
          cursor: readOnly ? 'default' : 'pointer',
          textTransform: 'uppercase',
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >
        Swap
      </button>
      </div>
      {noteWired && noteOpen && (
        <textarea
          value={noteValue || ''}
          onChange={(e) => onNoteChange?.(e.target.value)}
          placeholder={`Note for ${exercise.name}…`}
          aria-label={`Note for ${exercise.name}`}
          data-testid={`note-textarea-${exIdx}`}
          rows={2}
          style={{
            width: '100%',
            background: 'var(--bg-inset)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.sm,
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'inherit',
            lineHeight: 1.4,
            padding: '6px 8px',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}
