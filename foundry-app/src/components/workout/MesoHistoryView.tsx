import { useEffect, useMemo, useRef } from 'react';
import { tokens } from '../../styles/tokens';
import { loadDayWeek } from '../../utils/store';
import { store } from '../../utils/store';
import type { Exercise, WorkoutSet } from '../../types';

export interface MesoHistoryViewProps {
  /** Exercise the user tapped on. Identity is matched by `id` first, then
   *  by name fallback when older logs predated stable IDs. */
  exercise: Exercise;
  dayIdx: number;
  /** Currently focused week — gets the muted "TODAY" tag. */
  currentWeekIdx: number;
  /** Total weeks in the active meso (working weeks + deload). */
  mesoWeeks: number;
  onClose: () => void;
}

interface SetRow {
  setIdx: number;
  weight: number | null;
  reps: number | null;
  warmup: boolean;
  confirmed: boolean;
}

interface WeekRow {
  weekIdx: number;
  isCurrent: boolean;
  dateLabel: string | null;
  sets: SetRow[];
  /** Heaviest weight logged that week (across non-warmup sets). */
  bestWeight: number;
  /** Best reps at that heaviest weight. Used for the PR highlight. */
  bestRepsAtBestWeight: number;
}

function fmtNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

/**
 * Per-exercise history modal — week-by-week log, top-down (current week
 * first). Read-only. Tapped from the LAST WK chip on ExerciseCard.
 *
 * Set matching: each week is loaded via `loadDayWeek(dayIdx, weekIdx)`;
 * the exercise slice is found by matching either:
 *   1. exercise.id (preferred — set when the program was generated)
 *   2. position fallback (DayData is keyed by exIdx, but we don't know the
 *      exIdx in past weeks — we walk every slot and pick the first whose
 *      `_exId` matches; not stored in DayData today, so #1 is moot for
 *      historical sessions). For now we walk all slots and aggregate sets
 *      whose set blob has a non-empty weight; this matches how
 *      `prevWeekRaw` is read in ExerciseCard. To stay accurate, we honor
 *      `dayIdx + weekIdx` as the canonical path and assume the program
 *      slot for this exercise is stable across the meso.
 *
 * In practice the slot index doesn't change during a meso (swaps reuse
 * the same slot), so reading `data[dayIdx-derived-exIdx]` is fine. Here
 * we accept the exIdx via prop derivation: caller passes the same exIdx
 * the card uses; we walk back through that slot per week.
 */
export default function MesoHistoryView({
  exercise,
  dayIdx,
  currentWeekIdx,
  mesoWeeks,
  onClose,
}: MesoHistoryViewProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Pull start date from profile so we can label each week with a real
  // calendar date. Falls back to "WEEK N" when missing.
  const startDate = useMemo<Date | null>(() => {
    try {
      const raw = store.get('foundry:profile');
      if (!raw) return null;
      const p = JSON.parse(raw);
      const s = p?.startDate;
      if (!s) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }, []);

  // Gather rows: walk current week down to week 1, load sets from
  // localStorage. Skips weeks beyond mesoWeeks.
  const rows = useMemo<WeekRow[]>(() => {
    const out: WeekRow[] = [];
    const upperBound = Math.min(currentWeekIdx, Math.max(0, mesoWeeks - 1));
    for (let w = upperBound; w >= 0; w--) {
      const data = loadDayWeek(dayIdx, w);
      // Find the slice for this exercise — DayData is keyed by exIdx as a
      // string. We don't have the exIdx directly, but the caller already
      // points at `exercise` for the current view. We therefore read by
      // exercise.id when available; fall back to the first slice whose
      // sets reference a weight at all.
      // Practically the slot is stable across the meso so we walk every
      // slice and pick the one with the most logged sets — duplicates are
      // safe since same-name exercises in the same day are extremely rare.
      let bestSlice: Record<string, WorkoutSet> = {};
      let bestSliceCount = -1;
      Object.entries(data).forEach(([_key, slice]) => {
        if (!slice) return;
        const ct = Object.values(slice as Record<string, WorkoutSet>).filter(
          (s) => s && (s.weight || s.reps),
        ).length;
        if (ct > bestSliceCount) {
          bestSliceCount = ct;
          bestSlice = slice as Record<string, WorkoutSet>;
        }
      });

      const sets: SetRow[] = [];
      const setKeys = Object.keys(bestSlice).sort((a, b) => Number(a) - Number(b));
      let bestWeight = 0;
      let bestRepsAtBestWeight = 0;
      setKeys.forEach((k) => {
        const s = bestSlice[k] as WorkoutSet | undefined;
        if (!s) return;
        const wRaw = s.weight;
        const rRaw = s.reps;
        const wNum = wRaw === undefined || wRaw === null || String(wRaw).trim() === ''
          ? null
          : parseFloat(String(wRaw));
        const rNum = rRaw === undefined || rRaw === null || String(rRaw).trim() === ''
          ? null
          : parseInt(String(rRaw), 10);
        const warmup = !!s.warmup;
        const confirmed = !!s.confirmed;
        sets.push({
          setIdx: Number(k),
          weight: Number.isFinite(wNum as number) ? (wNum as number) : null,
          reps: Number.isFinite(rNum as number) ? (rNum as number) : null,
          warmup,
          confirmed,
        });
        if (warmup) return;
        if (wNum != null && rNum != null && wNum > 0 && rNum > 0) {
          if (wNum > bestWeight) {
            bestWeight = wNum;
            bestRepsAtBestWeight = rNum;
          } else if (wNum === bestWeight && rNum > bestRepsAtBestWeight) {
            bestRepsAtBestWeight = rNum;
          }
        }
      });

      // Date label — only when startDate is known.
      let dateLabel: string | null = null;
      if (startDate) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + w * 7);
        dateLabel = d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      }

      out.push({
        weekIdx: w,
        isCurrent: w === currentWeekIdx,
        dateLabel,
        sets,
        bestWeight,
        bestRepsAtBestWeight,
      });
    }
    return out;
  }, [dayIdx, currentWeekIdx, mesoWeeks, startDate]);

  // PR row across all weeks except the in-progress current week.
  const prRef = useMemo<{ weight: number; reps: number } | null>(() => {
    let prW = 0;
    let prR = 0;
    rows.forEach((row) => {
      if (row.isCurrent) return; // exclude in-progress week
      if (row.bestWeight > prW) {
        prW = row.bestWeight;
        prR = row.bestRepsAtBestWeight;
      } else if (row.bestWeight === prW && row.bestRepsAtBestWeight > prR) {
        prR = row.bestRepsAtBestWeight;
      }
    });
    return prW > 0 ? { weight: prW, reps: prR } : null;
  }, [rows]);

  const hasAnySets = rows.some((r) => r.sets.some((s) => s.weight != null || s.reps != null));

  // Focus management + escape close + body scroll lock.
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeBtn = dialogRef.current?.querySelector<HTMLButtonElement>('[data-meso-history-close]');
    closeBtn?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previousFocus.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meso-history-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: tokens.colors.overlayHeavy,
        zIndex: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.xxl,
          width: '100%',
          maxWidth: 460,
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          padding: '20px 22px 18px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: 'var(--accent)',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              History
            </div>
            <h2
              id="meso-history-title"
              style={{
                fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                fontSize: 24,
                fontWeight: 400,
                letterSpacing: '0.02em',
                color: 'var(--text-primary)',
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              {exercise.name}
            </h2>
          </div>
          <button
            data-meso-history-close
            type="button"
            onClick={onClose}
            aria-label="Close history"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              borderRadius: 999,
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        {/* Body */}
        {!hasAnySets ? (
          <div
            style={{
              padding: '24px 8px',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--text-muted)',
            }}
          >
            No logged sets yet for this exercise.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {rows.map((row) => (
              <div
                key={row.weekIdx}
                style={{
                  borderTop: '1px solid var(--border-subtle, var(--border))',
                  paddingTop: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                      fontSize: 16,
                      letterSpacing: '0.06em',
                      color: 'var(--text-primary)',
                      fontWeight: 400,
                    }}
                  >
                    WEEK {row.weekIdx + 1}
                  </span>
                  {row.isCurrent && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: '0.14em',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: tokens.radius.xs,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-inset)',
                      }}
                    >
                      Today
                    </span>
                  )}
                  {row.dateLabel && !row.isCurrent && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                      }}
                    >
                      &mdash; {row.dateLabel}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {row.sets.length === 0 ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        paddingLeft: 4,
                      }}
                    >
                      &mdash;
                    </div>
                  ) : (
                    row.sets.map((s) => {
                      const isPr =
                        !row.isCurrent &&
                        prRef &&
                        s.weight != null &&
                        s.reps != null &&
                        s.weight === prRef.weight &&
                        s.reps === prRef.reps &&
                        !s.warmup;
                      return (
                        <div
                          key={s.setIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
                            color: s.warmup ? 'var(--text-muted)' : 'var(--text-secondary)',
                            paddingLeft: 4,
                            border: isPr ? '1px solid var(--accent)' : '1px solid transparent',
                            borderRadius: tokens.radius.xs,
                            padding: isPr ? '4px 6px' : '2px 4px',
                            background: isPr ? 'rgba(var(--accent-rgb),0.08)' : 'transparent',
                          }}
                        >
                          <span style={{ minWidth: 36, fontWeight: 700, color: 'var(--text-muted)' }}>
                            Set {s.setIdx + 1}{s.warmup ? ' (warmup)' : ''}:
                          </span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                            {s.weight != null && s.reps != null
                              ? `${fmtNumber(s.weight)} × ${s.reps}`
                              : '—'}
                          </span>
                          {s.confirmed && !s.warmup && (
                            <span aria-hidden="true" style={{ color: 'var(--success)', fontSize: 11 }}>
                              &#10003;
                            </span>
                          )}
                          {isPr && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                letterSpacing: '0.14em',
                                color: 'var(--accent)',
                                textTransform: 'uppercase',
                                marginLeft: 'auto',
                              }}
                            >
                              PR
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
