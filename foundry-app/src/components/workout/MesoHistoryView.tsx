import { useEffect, useMemo, useRef, useState } from 'react';
import { tokens } from '../../styles/tokens';
import { loadDayWeek, findPrevSlotForExercise, loadArchive } from '../../utils/store';
import { store } from '../../utils/store';
import { findLastMesoWeight } from '../../utils/progressAggregation';
import WeekBars from '../shared/WeekBars';
import type { Exercise, WorkoutSet } from '../../types';

export interface MesoHistoryViewProps {
  /** Exercise the user tapped on. Identity is matched by `id` first, then
   *  by name fallback when older logs predated stable IDs. */
  exercise: Exercise;
  dayIdx: number;
  /** Slot index of this exercise within the day. DayData is keyed by
   *  exIdx-as-string, so we read `data[exIdx]` directly. The slot is
   *  stable across the meso (swaps reuse the slot, reorders rewrite the
   *  array). Required — the previous fallback that picked the slice with
   *  the most logged sets attributed another exercise's data to whichever
   *  card was tapped. */
  exIdx: number;
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
 * Set matching: each week is loaded via `loadDayWeek(dayIdx, weekIdx)`
 * and the exercise's slice is found by `_exId` identity via
 * findPrevSlotForExercise (slot-index fallback for legacy data), so
 * reorders/swaps between weeks can't attribute another exercise's sets
 * to this card.
 */
export default function MesoHistoryView({
  exercise,
  dayIdx,
  exIdx,
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
      // Match the exercise by identity (`_exId` stamped on every set by
      // handleUpdateSet), falling back to the slot index for legacy data.
      // A bare `data[exIdx]` read attributed other exercises' sets to this
      // card for any week logged before a reorder/superset/swap shifted
      // the slot order — the same trap ExerciseCard's last-week read and
      // the carryover walk already guard against via this helper.
      const slice = findPrevSlotForExercise(data, exercise.id, exIdx) as unknown as Record<
        string,
        WorkoutSet
      >;

      const sets: SetRow[] = [];
      const setKeys = Object.keys(slice).sort((a, b) => Number(a) - Number(b));
      let bestWeight = 0;
      let bestRepsAtBestWeight = 0;
      setKeys.forEach((k) => {
        const s = slice[k] as WorkoutSet | undefined;
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
  }, [dayIdx, exIdx, exercise.id, currentWeekIdx, mesoWeeks, startDate]);

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

  // Cross-meso reference — the weight last used for this exercise in a
  // previous (possibly unfinished) meso. Matched by `_exId`; pre-stamping
  // archives simply return null and the row is omitted.
  const lastMeso = useMemo(
    () => findLastMesoWeight(loadArchive(), exercise.id),
    [exercise.id],
  );

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

  // ── Derived stats for the header strip and the chart ──
  const deloadIdx = mesoWeeks - 1;
  const chronological = useMemo(() => [...rows].reverse(), [rows]);
  const loggedWeeks = chronological.filter((r) => r.bestWeight > 0);
  const firstBest = loggedWeeks[0]?.bestWeight ?? 0;
  // Gain is measured to the best WORKING week — the deload's lighter bar
  // isn't a loss, and it isn't the peak either.
  const peakBest = loggedWeeks
    .filter((r) => r.weekIdx !== deloadIdx)
    .reduce((m, r) => Math.max(m, r.bestWeight), 0);
  const gain = loggedWeeks.length >= 2 ? peakBest - firstBest : null;

  // Swipe-down to dismiss from the grab handle.
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const onHandleTouchStart = (e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
  };
  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (dragStart.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
  };
  const onHandleTouchEnd = () => {
    const shouldClose = dragY > 90;
    dragStart.current = null;
    setDragY(0);
    if (shouldClose) onClose();
  };

  const bebas = "'Bebas Neue', 'Inter', system-ui, sans-serif";
  const eyebrow: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  };

  const StatTile = ({ label, value, accent, sub }: { label: string; value: string; accent?: boolean; sub?: string }) => (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '10px 12px',
        borderRadius: tokens.radius.md,
        background: accent ? 'rgba(var(--accent-rgb),0.10)' : 'var(--bg-surface)',
        border: `1px solid ${accent ? 'rgba(var(--accent-rgb),0.45)' : 'var(--border)'}`,
      }}
    >
      <div style={eyebrow}>{label}</div>
      <div
        style={{
          fontFamily: bebas,
          fontSize: 28,
          lineHeight: 1.05,
          marginTop: 4,
          letterSpacing: '0.02em',
          color: accent ? 'var(--accent)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meso-history-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: tokens.colors.overlayMed,
        zIndex: 240,
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          margin: '0 auto',
          maxWidth: 480,
          maxHeight: '88vh',
          background: 'var(--bg-card)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: '1px solid rgba(var(--accent-rgb),0.35)',
          boxShadow: '0 -12px 48px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? 'none' : 'transform 0.2s ease',
          animation: 'slideUp 0.22s ease-out',
          fontFamily: 'inherit',
        }}
      >
        {/* Grab handle — also the swipe-down target */}
        <div
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          style={{ padding: '10px 0 6px', touchAction: 'none', flexShrink: 0 }}
        >
          <div
            aria-hidden="true"
            style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border)', margin: '0 auto' }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '4px 20px 14px',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ ...eyebrow, color: 'var(--accent)', marginBottom: 4 }}>Lift history</div>
            <h2
              id="meso-history-title"
              style={{
                fontFamily: bebas,
                fontSize: 30,
                fontWeight: 400,
                letterSpacing: '0.02em',
                color: 'var(--text-primary)',
                lineHeight: 1,
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
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 8px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {!hasAnySets ? (
            <div style={{ padding: '28px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: bebas, fontSize: 22, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                No sets logged yet
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                Log this lift and its history builds here, week by week.
              </div>
            </div>
          ) : (
            <>
              {/* Headline numbers */}
              <div style={{ display: 'flex', gap: 8 }}>
                <StatTile
                  label="Best set"
                  value={prRef ? `${fmtNumber(prRef.weight)} × ${prRef.reps}` : '—'}
                  accent
                />
                <StatTile
                  label="This meso"
                  value={gain == null ? '—' : `${gain >= 0 ? '+' : '−'}${fmtNumber(Math.abs(gain))} lb`}
                  sub={gain == null ? 'Needs 2 weeks' : `from ${fmtNumber(firstBest)}`}
                />
              </div>

              {/* Top weight per week */}
              {loggedWeeks.length >= 2 && (
                <div>
                  <div style={{ ...eyebrow, marginBottom: 10 }}>Top weight by week</div>
                  <WeekBars
                    ariaLabel={`Top weight by week: ${loggedWeeks
                      .map((r) => `week ${r.weekIdx + 1} ${fmtNumber(r.bestWeight)}`)
                      .join(', ')}`}
                    format={fmtNumber}
                    bars={chronological.map((r) => ({
                      key: r.weekIdx,
                      label: r.weekIdx === deloadIdx ? 'DL' : `W${r.weekIdx + 1}`,
                      value: r.bestWeight,
                      highlight: !!prRef && r.bestWeight === prRef.weight && !r.isCurrent,
                      muted: r.weekIdx === deloadIdx,
                      current: r.isCurrent,
                    }))}
                  />
                </div>
              )}

              {/* Week by week, newest first */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map((row) => {
                  const isDeload = row.weekIdx === deloadIdx;
                  return (
                    <div
                      key={row.weekIdx}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: '12px 12px',
                        borderRadius: tokens.radius.md,
                        background: 'var(--bg-surface)',
                        border: `1px solid ${row.isCurrent ? 'rgba(var(--accent-rgb),0.35)' : 'var(--border)'}`,
                      }}
                    >
                      <div style={{ width: 58, flexShrink: 0 }}>
                        <div style={{ fontFamily: bebas, fontSize: 22, lineHeight: 1, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
                          WK {row.weekIdx + 1}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4, color: row.isCurrent ? 'var(--accent)' : 'var(--text-muted)' }}>
                          {row.isCurrent ? 'Today' : isDeload ? 'Deload' : row.dateLabel?.replace(/^\w+,\s*/, '') ?? ''}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'center' }}>
                        {row.sets.filter((s) => s.weight != null || s.reps != null).length === 0 ? (
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Not logged yet</span>
                        ) : (
                          row.sets
                            .filter((s) => s.weight != null || s.reps != null)
                            .map((s) => {
                              const isPr =
                                !row.isCurrent &&
                                !!prRef &&
                                s.weight === prRef.weight &&
                                s.reps === prRef.reps &&
                                !s.warmup;
                              return (
                                <span
                                  key={s.setIdx}
                                  title={`Set ${s.setIdx + 1}${s.warmup ? ' (warmup)' : ''}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '6px 10px',
                                    borderRadius: 999,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums',
                                    color: isPr ? 'var(--accent)' : s.warmup ? 'var(--text-muted)' : 'var(--text-primary)',
                                    background: isPr ? 'rgba(var(--accent-rgb),0.12)' : 'var(--bg-card)',
                                    border: isPr
                                      ? '1px solid var(--accent)'
                                      : s.warmup
                                        ? '1px dashed var(--border)'
                                        : '1px solid var(--border)',
                                  }}
                                >
                                  {s.warmup && <span style={{ fontSize: 10, letterSpacing: '0.08em' }}>WU</span>}
                                  {s.weight != null && s.reps != null
                                    ? `${fmtNumber(s.weight)} × ${s.reps}`
                                    : s.reps != null
                                      ? `${s.reps} reps`
                                      : '—'}
                                  {isPr && (
                                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em' }}>PR</span>
                                  )}
                                </span>
                              );
                            })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Cross-meso reference — last weight used in a previous meso,
              including unfinished ones. Omitted when no archived meso has
              matchable data for this exercise. */}
          {lastMeso && (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                padding: '12px',
                borderRadius: tokens.radius.md,
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
              }}
            >
              <span style={{ ...eyebrow, color: 'var(--amber)' }}>Last meso</span>
              <span style={{ fontFamily: bebas, fontSize: 20, letterSpacing: '0.03em', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtNumber(lastMeso.weight)} × {lastMeso.reps}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                week {lastMeso.weekIdx + 1}
                {lastMeso.mesosAgo > 1 ? ` · ${lastMeso.mesosAgo} mesos back` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Thumb-reach close */}
        <div
          style={{
            flexShrink: 0,
            padding: '10px 20px calc(12px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              minHeight: 52,
              borderRadius: tokens.radius.lg,
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontFamily: bebas,
              fontSize: 20,
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}
