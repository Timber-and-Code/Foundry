import { useState, useMemo } from 'react';
import { tokens } from '../../styles/tokens';
import SetRow from './SetRow';
import MesoHistoryView from './MesoHistoryView';
import { store } from '../../utils/store';
import { haptic } from '../../utils/helpers';
import { getMeso } from '../../data/constants';
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
}: SupersetRoundViewProps) {
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

  // Position letter in the group: 0 → A, 1 → B, etc. Used as the row label
  // prefix in each round block.
  const positionLetter = (gi: number): string => String.fromCharCode(65 + gi);

  // Short-form name for the row label — uppercase, truncated to ~12 chars.
  const shortName = (name: string): string => {
    const upper = name.toUpperCase();
    return upper.length > 12 ? upper.slice(0, 12) + '…' : upper;
  };

  return (
    <div data-testid="superset-round-view">
      {/* Header strip — one line per exercise, name + last-week stat + swap. */}
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
          const stat = lastWeekStatFor(exIdx);
          const repsRange = String(ex.reps ?? '');
          return (
            <div
              key={exIdx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minWidth: 0,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                  fontSize: 18,
                  fontWeight: 400,
                  color: 'var(--accent)',
                  letterSpacing: '0.04em',
                  width: 18,
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                {positionLetter(gi)}
              </span>
              <button
                type="button"
                onClick={() => setHistoryExIdx(exIdx)}
                aria-label={`${ex.name} — view history`}
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
                  {ex.name}
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
                  {stat || repsRange}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSwapClick(exIdx)}
                disabled={readOnly}
                aria-label={`Swap ${ex.name}`}
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
            ROUND {r + 1}
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
                  {positionLetter(gi)} · {shortName(ex.name)} — rest
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
              <SetRow
                key={`${exIdx}-${r}`}
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
                rowNumber={positionLetter(gi)}
                rowLabel={shortName(ex.name)}
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
