import { useMemo, useState } from 'react';
import { tokens } from '../../styles/tokens';
import HammerIcon from '../shared/HammerIcon';
import SwapMenu from '../workout/SwapMenu';
import { getExerciseDB, type ExerciseEntry } from '../../data/exerciseDB';
import { buildSwapGroups } from '../../utils/swapGroups';
import { useToast } from '../../contexts/ToastContext';
import { store } from '../../utils/store';

/**
 * Exercise entry as it lives inside a day's build list. Only the few
 * fields that affect display + program assembly are tracked here.
 */
export interface DayExercise {
  id: string;     // 'bb_flat_bench' or 'custom:my-exercise'
  name: string;
  muscle: string;
}

export interface DayBuild {
  /** Upper-case tag used to filter exercise swaps (PUSH/PULL/LEGS/UPPER/LOWER/FULL/CUSTOM). */
  tag: string;
  /** Display label ("Push A", "Upper", etc). */
  label: string;
  /** Exercises for this day, ordered as the user will see them. */
  exercises: DayExercise[];
  /** Indices into `exercises` that are marked as anchors (max 2). */
  anchors: number[];
}

interface DayAccordionProps {
  days: DayBuild[];
  onDaysChange: (days: DayBuild[]) => void;
  /** Equipment filter for swap picker. */
  userEquipment?: string[];
}

const MAX_ANCHORS_PER_DAY = 2;

/**
 * DayAccordion — per-day expandable exercise list for Beat 2 preview.
 *
 * Controlled: parent owns the `days` array and receives updates via
 * `onDaysChange`. Anchor toggles enforce a 2-per-day cap with a toast.
 * Swap uses the existing `SwapSheet` (no meso/week scope — setup-time
 * only, single source of truth). Custom exercises flow through
 * `foundry:customExercises` exactly like the DayView swap path.
 */
export default function DayAccordion({
  days,
  onDaysChange,
  userEquipment,
}: DayAccordionProps) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]));
  const [swapTarget, setSwapTarget] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  // When set, the next picker selection appends to that day instead of
  // replacing an existing exercise. Used for the "+ Add exercise" CTA on
  // every day (essential for custom-split days that start empty).
  const [addTarget, setAddTarget] = useState<{ dayIdx: number } | null>(null);

  const db = getExerciseDB();

  /**
   * Exercises grouped by muscle, filtered by the day being swapped in.
   * Computed when a swap is opened — SwapMenu wants Record<muscle, Exercise[]>.
   *
   * Mapping lives in `utils/swapGroups.ts` so this stays in lock-step with
   * DayView's swap path (EXERCISE_DB only uses PUSH / PULL / LEGS / CORE).
   */
  // Active picker target — either a swap (replace existing) or an add
  // (append a new entry). Both share the same SwapMenu UI.
  const activeDayIdx = swapTarget?.dayIdx ?? addTarget?.dayIdx ?? null;
  const swapGroups = useMemo<Record<string, ExerciseEntry[]>>(() => {
    if (activeDayIdx === null) return {};
    const dayTag = days[activeDayIdx]?.tag || '';
    return buildSwapGroups(db, dayTag);
  }, [db, days, activeDayIdx]);

  const autoExpandMuscle = swapTarget
    ? days[swapTarget.dayIdx]?.exercises[swapTarget.exIdx]?.muscle
    : undefined;
  const replacingName = swapTarget
    ? days[swapTarget.dayIdx]?.exercises[swapTarget.exIdx]?.name || ''
    : '';

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(idx)) n.delete(idx);
      else n.add(idx);
      return n;
    });
  };

  const update = (dayIdx: number, mutator: (d: DayBuild) => DayBuild) => {
    const next = days.map((d, i) => (i === dayIdx ? mutator({ ...d }) : d));
    onDaysChange(next);
  };

  const toggleAnchor = (dayIdx: number, exIdx: number) => {
    const day = days[dayIdx];
    const has = day.anchors.includes(exIdx);
    if (has) {
      update(dayIdx, (d) => ({ ...d, anchors: d.anchors.filter((i) => i !== exIdx) }));
      return;
    }
    if (day.anchors.length >= MAX_ANCHORS_PER_DAY) {
      showToast(`Max ${MAX_ANCHORS_PER_DAY} anchor lifts per day`, 'error');
      return;
    }
    update(dayIdx, (d) => ({ ...d, anchors: [...d.anchors, exIdx] }));
  };

  const removeExercise = (dayIdx: number, exIdx: number) => {
    update(dayIdx, (d) => {
      const exercises = d.exercises.filter((_, i) => i !== exIdx);
      const anchors = d.anchors
        .filter((i) => i !== exIdx)
        .map((i) => (i > exIdx ? i - 1 : i));
      return { ...d, exercises, anchors };
    });
  };

  const moveExercise = (dayIdx: number, exIdx: number, dir: -1 | 1) => {
    update(dayIdx, (d) => {
      const swap = exIdx + dir;
      if (swap < 0 || swap >= d.exercises.length) return d;
      const exercises = [...d.exercises];
      [exercises[exIdx], exercises[swap]] = [exercises[swap], exercises[exIdx]];
      const anchors = d.anchors.map((i) => {
        if (i === exIdx) return swap;
        if (i === swap) return exIdx;
        return i;
      });
      return { ...d, exercises, anchors };
    });
  };

  const replaceExercise = (dayIdx: number, exIdx: number, next: DayExercise) => {
    update(dayIdx, (d) => {
      const exercises = d.exercises.map((e, i) => (i === exIdx ? next : e));
      return { ...d, exercises };
    });
  };

  const appendExercise = (dayIdx: number, next: DayExercise) => {
    update(dayIdx, (d) => ({ ...d, exercises: [...d.exercises, next] }));
  };

  const closePicker = () => {
    setSwapTarget(null);
    setAddTarget(null);
  };

  const handleSwapPick = (newExId: string) => {
    if (!swapTarget && !addTarget) return;
    let entry: DayExercise | null = null;
    if (newExId.startsWith('custom:')) {
      // Custom exercise — resolve from localStorage
      try {
        const customs = JSON.parse(store.get('foundry:customExercises') || '{}');
        const record = customs[newExId];
        if (record?.name) {
          entry = { id: newExId, name: record.name, muscle: record.muscle || 'other' };
        }
      } catch { /* custom parse fallback */ }
    } else {
      const match = db.find((e) => e.id === newExId);
      if (match) {
        entry = { id: match.id, name: match.name, muscle: match.muscle };
      }
    }
    if (entry) {
      if (swapTarget) replaceExercise(swapTarget.dayIdx, swapTarget.exIdx, entry);
      else if (addTarget) appendExercise(addTarget.dayIdx, entry);
    }
    closePicker();
  };

  const handleCustomExercise = (name: string) => {
    if (!swapTarget && !addTarget) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `custom:${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const dayIdx = swapTarget?.dayIdx ?? addTarget!.dayIdx;
    const fallbackMuscle = swapTarget
      ? days[swapTarget.dayIdx]?.exercises[swapTarget.exIdx]?.muscle || 'other'
      : 'other';
    // Persist in the same bucket DayView reads from so the ID resolves later.
    try {
      const customs = JSON.parse(store.get('foundry:customExercises') || '{}');
      customs[id] = { name: trimmed, muscle: fallbackMuscle };
      store.set('foundry:customExercises', JSON.stringify(customs));
    } catch { /* store persist fallback */ }
    const entry = { id, name: trimmed, muscle: fallbackMuscle };
    if (swapTarget) replaceExercise(dayIdx, swapTarget.exIdx, entry);
    else appendExercise(dayIdx, entry);
    closePicker();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {days.map((day, dayIdx) => {
        const isOpen = expanded.has(dayIdx);
        const anchorCount = day.anchors.length;
        return (
          <div
            key={dayIdx}
            style={{
              background: tokens.colors.bgCard,
              border: `1px solid ${isOpen ? tokens.colors.accentBorder : 'rgba(255,255,255,0.08)'}`,
              borderRadius: tokens.radius.md,
              overflow: 'hidden',
              transition: 'border-color 180ms ease',
            }}
          >
            {/* Day header — clickable to expand */}
            <button
              type="button"
              onClick={() => toggleExpand(dayIdx)}
              aria-expanded={isOpen}
              aria-label={`${day.label} — ${isOpen ? 'collapse' : 'expand'}`}
              style={{
                width: '100%',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: tokens.colors.accent,
                    background: tokens.colors.accentMuted,
                    border: `1px solid ${tokens.colors.accentBorder}`,
                    borderRadius: tokens.radius.pill,
                    padding: '3px 8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {day.tag}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: tokens.colors.textPrimary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {day.label}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: tokens.colors.textMuted,
                    fontWeight: 600,
                  }}
                >
                  {day.exercises.length} ex · {anchorCount} anchor{anchorCount === 1 ? '' : 's'}
                </div>
                <span
                  aria-hidden="true"
                  style={{
                    color: tokens.colors.textMuted,
                    fontSize: 14,
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 180ms ease',
                    display: 'inline-block',
                  }}
                >
                  ›
                </span>
              </div>
            </button>

            {/* Expanded exercise list */}
            {isOpen && (
              <div
                style={{
                  padding: '0 12px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {day.exercises.length === 0 && (
                  <div
                    style={{
                      padding: '14px 12px 8px',
                      fontSize: 12,
                      color: tokens.colors.textMuted,
                      fontStyle: 'italic',
                      textAlign: 'center',
                    }}
                  >
                    No exercises yet — add your first below.
                  </div>
                )}
                {day.exercises.map((ex, exIdx) => {
                  const isAnchor = day.anchors.includes(exIdx);
                  const canUp = exIdx > 0;
                  const canDown = exIdx < day.exercises.length - 1;
                  return (
                    <div
                      key={`${ex.id}-${exIdx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 12px',
                        background: 'var(--bg-inset)',
                        borderRadius: tokens.radius.sm,
                        border: `1px solid ${isAnchor ? tokens.colors.accentBorder : 'transparent'}`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleAnchor(dayIdx, exIdx)}
                        aria-pressed={isAnchor}
                        aria-label={isAnchor ? `Remove anchor from ${ex.name}` : `Mark ${ex.name} as anchor`}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: isAnchor ? tokens.colors.accentMuted : 'transparent',
                          border: `1px solid ${isAnchor ? tokens.colors.accent : 'rgba(255,255,255,0.12)'}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          padding: 0,
                        }}
                      >
                        <HammerIcon size={14} />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: tokens.colors.textPrimary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ex.name}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: tokens.colors.textMuted,
                          }}
                        >
                          {ex.muscle}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => moveExercise(dayIdx, exIdx, -1)}
                        disabled={!canUp}
                        aria-label={`Move ${ex.name} up`}
                        style={iconBtnStyle(!canUp)}
                      >
                        <span aria-hidden="true">↑</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveExercise(dayIdx, exIdx, 1)}
                        disabled={!canDown}
                        aria-label={`Move ${ex.name} down`}
                        style={iconBtnStyle(!canDown)}
                      >
                        <span aria-hidden="true">↓</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSwapTarget({ dayIdx, exIdx })}
                        aria-label={`Swap ${ex.name}`}
                        style={swapBtnStyle}
                      >
                        SWAP
                      </button>
                      <button
                        type="button"
                        onClick={() => removeExercise(dayIdx, exIdx)}
                        aria-label={`Remove ${ex.name}`}
                        style={iconBtnStyle(false)}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  );
                })}
                {/* Always present so users can fill an empty day (custom
                    splits start with zero exercises) or extend any day. */}
                <button
                  type="button"
                  onClick={() => setAddTarget({ dayIdx })}
                  style={{
                    marginTop: 4,
                    padding: '10px 12px',
                    borderRadius: tokens.radius.sm,
                    background: 'transparent',
                    border: `1px dashed ${tokens.colors.accentBorder}`,
                    color: tokens.colors.accent,
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  + Add exercise
                </button>
              </div>
            )}
          </div>
        );
      })}

      <SwapMenu
        open={swapTarget !== null || addTarget !== null}
        onClose={closePicker}
        replacingName={replacingName}
        exerciseGroups={swapGroups}
        autoExpandMuscle={autoExpandMuscle}
        userEquipment={userEquipment}
        onSelect={handleSwapPick}
        onCustomExercise={handleCustomExercise}
        scopePending={null}
        onScopeMeso={() => {}}
        onScopeWeek={() => {}}
        onScopeCancel={closePicker}
      />
    </div>
  );
}

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.sm,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    color: disabled ? tokens.colors.textDim : tokens.colors.textMuted,
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    opacity: disabled ? 0.4 : 1,
  };
}

const swapBtnStyle: React.CSSProperties = {
  height: 28,
  padding: '0 10px',
  borderRadius: tokens.radius.sm,
  background: 'transparent',
  border: `1px solid ${tokens.colors.accentBorder}`,
  color: tokens.colors.accent,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
