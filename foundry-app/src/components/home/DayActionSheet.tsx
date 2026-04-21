import React from 'react';
import { tokens } from '../../styles/tokens';
import Sheet from '../ui/Sheet';
import { CARDIO_WORKOUTS, MOBILITY_PROTOCOLS, TAG_ACCENT } from '../../data/constants';
import { store, loadCardioSession } from '../../utils/store';
import type { Profile, TrainingDay } from '../../types';

export interface DayActionSheetProps {
  /** Open state driven by parent. */
  open: boolean;
  /** Close callback (caller clears activeDate). */
  onClose: () => void;
  /** YYYY-MM-DD date the user tapped. */
  dateStr: string | null;
  profile: Profile;
  activeDays: TrainingDay[];
  /** Session key(s) scheduled for this date — `string | string[]`. */
  sessionEntry: string | string[] | undefined;
  completedDays: Set<string>;
  /** Preview an active (not-completed) session read-only (exercises/sets/reps).
   * Schedule tab is view-and-manage only — starting a workout happens on Home.
   * Completed sessions open the notes/recap viewer via onViewNotes instead. */
  onPreviewSession: (dayIdx: number, weekIdx: number) => void;
  /** Open an already-created extra session for this date. */
  onOpenExtra: (dateStr: string) => void;
  /** Open an already-scheduled/logged cardio session. */
  onOpenCardio: (dateStr: string, protocolId: string | null) => void;
  /** Open or pre-seed a mobility session for this date with the chosen protocol. */
  onOpenMobility: (dateStr: string, protocolId: string) => void;
  /** Kick off the existing AddWorkoutModal wizard for this date. */
  onAddWorkout: (dateStr: string) => void;
  /** Open the move sheet for the given sessionKey (only passed when movable). */
  onMoveSession: (sessionKey: string) => void;
  /** Open the "view notes / recap" viewer — optional. */
  onViewNotes?: (args: { type: 'meso'; dayIdx: number; weekIdx: number } | { type: 'extra'; dateStr: string }) => void;
}

const CARDIO_COLOR = TAG_ACCENT['CARDIO'];
const MOBILITY_COLOR = TAG_ACCENT['MOBILITY'];

function formatDate(dateStr: string): string {
  const dt = new Date(dateStr + 'T00:00:00');
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function ActionButton({
  label,
  description,
  onClick,
  tone = 'default',
  disabled,
}: {
  label: string;
  description?: string;
  onClick: () => void;
  tone?: 'default' | 'accent' | 'danger';
  disabled?: boolean;
}) {
  const accent =
    tone === 'accent' ? 'var(--accent)' : tone === 'danger' ? 'var(--danger)' : 'var(--text-primary)';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '14px 16px',
        borderRadius: tokens.radius.lg,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: tone === 'accent' ? 'var(--accent)11' : 'var(--bg-surface)',
        border: `1px solid ${tone === 'accent' ? 'var(--accent)55' : 'var(--border)'}`,
        color: 'var(--text-primary)',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: accent, marginBottom: description ? 2 : 0 }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {description}
          </div>
        )}
      </div>
      <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 18, fontWeight: 700 }}>
        ›
      </span>
    </button>
  );
}

/**
 * DayActionSheet — context-aware bottom sheet that opens when the user taps
 * a day in the Schedule calendar. The action set depends on whether the day
 * has 0, 1, or 2 scheduled sessions, and whether any are completed.
 */
function DayActionSheet(props: DayActionSheetProps) {
  const {
    open,
    onClose,
    dateStr,
    activeDays,
    sessionEntry,
    completedDays,
    onPreviewSession,
    onOpenExtra,
    onOpenCardio,
    onOpenMobility,
    onAddWorkout,
    onMoveSession,
    onViewNotes,
  } = props;

  const [cardioOpen, setCardioOpen] = React.useState(false);
  const [mobilityOpen, setMobilityOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setCardioOpen(false);
      setMobilityOpen(false);
    }
  }, [open]);

  if (!open || !dateStr) return null;

  const keys = sessionEntry == null
    ? []
    : Array.isArray(sessionEntry)
      ? sessionEntry
      : [sessionEntry];

  const todayStr = new Date().toISOString().slice(0, 10);
  const isPast = dateStr < todayStr;
  const extraRaw = store.get(`foundry:extra:${dateStr}`);
  const hasExtra = !!extraRaw;
  const extraDone = store.get(`foundry:extra:done:${dateStr}`) === '1';
  const cardioSession = loadCardioSession(dateStr);

  const completedKeys = keys.filter((k) => completedDays.has(k));
  const activeKeys = keys.filter((k) => !completedDays.has(k));
  const allCompleted = keys.length > 0 && activeKeys.length === 0;

  const title =
    keys.length === 2
      ? '2 workouts scheduled'
      : keys.length === 1
        ? 'Scheduled workout'
        : hasExtra
          ? 'Extra workout'
          : 'Rest day';

  return (
    <Sheet open={open} onClose={onClose} zIndex={320}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-action-title"
        style={{ padding: '8px 20px 28px' }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
                marginBottom: 4,
              }}
            >
              {title.toUpperCase()}
            </div>
            <div
              id="day-action-title"
              style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}
            >
              {formatDate(dateStr)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 22,
              lineHeight: 1,
              padding: '2px 6px',
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Banner when 2 sessions scheduled */}
        {keys.length === 2 && (
          <div
            role="status"
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: tokens.radius.md,
              background: 'var(--phase-peak)14',
              border: '1px solid var(--phase-peak)55',
              color: 'var(--text-primary)',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: 'var(--phase-peak)' }}>2 workouts scheduled</strong> on this day.
            Tap one below to open it.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Existing session rows — "start" is home-tab only. From schedule:
              - Completed session: View notes/recap
              - Active session:    View preview (exercises, sets, reps) read-only */}
          {keys.map((key) => {
            const [dIdxStr, wIdxStr] = key.split(':');
            const dIdx = Number(dIdxStr);
            const wIdx = Number(wIdxStr);
            const day = activeDays[dIdx];
            const done = completedDays.has(key);
            const label = day ? `${day.label} — Week ${wIdx + 1}` : `Day ${dIdx + 1} · Week ${wIdx + 1}`;
            return (
              <ActionButton
                key={key}
                label={`View ${label}`}
                description={
                  done
                    ? 'Completed — review sets, notes, and recap.'
                    : day?.exercises?.length
                      ? `${day.exercises.length} exercises — preview`
                      : 'Preview this session'
                }
                onClick={() => {
                  onClose();
                  if (done && onViewNotes) {
                    onViewNotes({ type: 'meso', dayIdx: dIdx, weekIdx: wIdx });
                  } else {
                    onPreviewSession(dIdx, wIdx);
                  }
                }}
              />
            );
          })}

          {/* Move — only if exactly 1 active (not completed) session and not past */}
          {activeKeys.length === 1 && !isPast && (
            <ActionButton
              label="Move this workout"
              description="Shift ±7 days. The session keeps its progression — only the date changes."
              onClick={() => {
                onClose();
                onMoveSession(activeKeys[0]);
              }}
            />
          )}

          {/* Extra (non-meso) session — viewable only when already completed */}
          {hasExtra && extraDone && (
            <ActionButton
              label="View extra workout"
              description="Completed — review your logged session."
              onClick={() => {
                onClose();
                onOpenExtra(dateStr);
              }}
            />
          )}

          {/* Cardio — viewable only when already completed */}
          {cardioSession && cardioSession.completed && (
            <ActionButton
              label="View cardio"
              description="Logged cardio session"
              onClick={() => {
                onClose();
                onOpenCardio(dateStr, cardioSession.protocolId ?? null);
              }}
            />
          )}

          {/* Add-additional actions — allowed unless day is already past and all done */}
          {keys.length < 2 && !isPast && !allCompleted && (
            <ActionButton
              label="Add additional workout"
              description={keys.length === 1 ? 'Stack a second workout on this day.' : 'Generate or log a session for this day.'}
              onClick={() => {
                onClose();
                onAddWorkout(dateStr);
              }}
            />
          )}

          {!isPast && !cardioSession && (
            <ActionButton
              label="Add additional cardio"
              description="Pick a protocol for this day."
              onClick={() => setCardioOpen((v) => !v)}
            />
          )}

          {/* Cardio picker — inline list (not a second sheet, per design) */}
          {cardioOpen && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '8px 10px',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  padding: '2px 4px',
                }}
              >
                CARDIO PROTOCOL
              </div>
              {CARDIO_WORKOUTS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCardio(dateStr, w.id);
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: tokens.radius.md,
                    cursor: 'pointer',
                    background: 'var(--bg-surface)',
                    border: `1px solid ${CARDIO_COLOR}33`,
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: CARDIO_COLOR }}>{w.label}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {w.description?.split('.')[0]}
                    </div>
                  </div>
                  <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>›</span>
                </button>
              ))}
            </div>
          )}

          {/* Add mobility — inline picker, grouped by category */}
          {!isPast && (
            <ActionButton
              label="Add mobility session"
              description="Warmup, recovery, or targeted protocol."
              onClick={() => setMobilityOpen((v) => !v)}
            />
          )}

          {mobilityOpen && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '8px 10px',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
              }}
            >
              {(['warmup', 'recovery', 'targeted'] as const).map((cat) => {
                const group = MOBILITY_PROTOCOLS.filter((p) => p.category === cat);
                if (group.length === 0) return null;
                return (
                  <React.Fragment key={cat}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        color: 'var(--text-muted)',
                        padding: '6px 4px 2px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {cat}
                    </div>
                    {group.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenMobility(dateStr, p.id);
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: tokens.radius.md,
                          cursor: 'pointer',
                          background: 'var(--bg-surface)',
                          border: `1px solid ${MOBILITY_COLOR}33`,
                          color: 'var(--text-primary)',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: MOBILITY_COLOR }}>
                            {p.name} · {p.duration}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--text-secondary)',
                              lineHeight: 1.4,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {p.description}
                          </div>
                        </div>
                        <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>›</span>
                      </button>
                    ))}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* View notes on fully-completed days */}
          {allCompleted && onViewNotes && completedKeys.length > 0 && (
            <ActionButton
              label="View session recap"
              description="See sets, reps, and notes from this day."
              onClick={() => {
                const first = completedKeys[0];
                const [dIdxStr, wIdxStr] = first.split(':');
                onClose();
                onViewNotes({ type: 'meso', dayIdx: Number(dIdxStr), weekIdx: Number(wIdxStr) });
              }}
            />
          )}

          {isPast && !keys.length && !hasExtra && !cardioSession && (
            <div
              style={{
                padding: '14px',
                borderRadius: tokens.radius.md,
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Nothing was scheduled on this day, and it's in the past.
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export default DayActionSheet;
