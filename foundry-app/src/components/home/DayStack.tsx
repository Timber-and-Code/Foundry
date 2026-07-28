import React from 'react';
import { tokens } from '../../styles/tokens';
import { store, loadCardioSession, isSkipped, setSkipped } from '../../utils/store';
import { syncSkippedToSupabase } from '../../utils/sync';
import { CARDIO_WORKOUTS } from '../../data/constants';
import type { Profile, TrainingDay, Exercise } from '../../types';

export interface DayStackProps {
  dateStr: string;
  profile: Profile;
  activeDays: TrainingDay[];
  /** Session key(s) scheduled for this date — `string | string[]`. */
  sessionEntry: string | string[] | undefined;
  completedDays: Set<string>;
  /** Bump to re-render after a skip toggle (parent owns the counter). */
  skipVersion: number;
  onSkipChanged: () => void;
  /** Preview an active session read-only. Schedule is view-and-manage only —
   * starting a workout happens on Home (same contract as DayActionSheet). */
  onPreviewSession: (dayIdx: number, weekIdx: number) => void;
  /** Open the MoveWorkoutSheet date picker for this session. */
  onMoveSession: (sessionKey: string) => void;
  onViewNotes: (
    arg: { type: 'meso'; dayIdx: number; weekIdx: number } | { type: 'extra'; dateStr: string },
  ) => void;
  onOpenExtra: (dateStr: string) => void;
  onOpenCardio: (dateStr: string, protocolId: string | null) => void;
  onAddWorkout: (dateStr: string) => void;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: tokens.radius.lg,
  padding: '14px 16px',
  boxShadow: 'var(--shadow-xs)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

function ActionChip({
  label,
  onClick,
  accent = false,
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        border: `1px solid ${accent ? 'var(--accent)66' : 'var(--border)'}`,
        background: accent ? 'var(--accent)14' : 'var(--bg-inset)',
        color: accent ? 'var(--accent)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.06em',
        fontFamily: 'inherit',
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}

/**
 * Schedule v2 day stack — the selected day's sessions as full-width cards
 * with inline actions. One card per meso session (double-booked days are
 * two cards — inherently unambiguous), plus cards for extra and cardio
 * sessions. Rest days get an add affordance.
 */
function DayStack({
  dateStr,
  profile: _profile,
  activeDays,
  sessionEntry,
  completedDays,
  skipVersion,
  onSkipChanged,
  onPreviewSession,
  onMoveSession,
  onViewNotes,
  onOpenExtra,
  onOpenCardio,
  onAddWorkout,
}: DayStackProps) {
  void skipVersion; // referenced so a skip toggle re-renders the stack
  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();
  const isPast = dateStr < todayStr;

  const keys: string[] =
    sessionEntry == null ? [] : Array.isArray(sessionEntry) ? sessionEntry : [sessionEntry];

  const extraRaw = store.get(`foundry:extra:${dateStr}`);
  const hasExtra = !!extraRaw;
  const extraDone = store.get(`foundry:extra:done:${dateStr}`) === '1';
  const extraLabel = (() => {
    if (!extraRaw) return 'Extra Session';
    try {
      return (JSON.parse(extraRaw) as { label?: string }).label || 'Extra Session';
    } catch {
      return 'Extra Session';
    }
  })();
  const cardioSession = loadCardioSession(dateStr);
  const cardioName = cardioSession?.protocolId
    ? (CARDIO_WORKOUTS as unknown as { id: string; name: string }[]).find(
        (c) => c.id === cardioSession.protocolId,
      )?.name ?? 'Cardio'
    : 'Cardio';

  const dayTitle = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const isEmpty = keys.length === 0 && !hasExtra && !cardioSession;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 14 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.12em',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
        }}
      >
        {dayTitle}
      </div>

      {/* Meso session cards — one per session, never ambiguous */}
      {keys.map((sk) => {
        const [dStr, wStr] = sk.split(':');
        const dIdx = Number(dStr);
        const wIdx = Number(wStr);
        const day = activeDays[dIdx];
        const done = completedDays.has(sk);
        const skipped = !done && isSkipped(dIdx, wIdx);
        const missed = isPast && !done && !skipped;
        const label = day?.label || `Day ${dIdx + 1}`;
        const exCount = (day?.exercises as Exercise[] | undefined)?.length ?? 0;
        return (
          <div key={sk} style={{ ...cardStyle, opacity: skipped ? 0.55 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', minWidth: 0 }}>
                {label}
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 8 }}>
                  WK {wIdx + 1}
                </span>
              </div>
              {done ? (
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--success, #4ade80)' }}>
                  ✓ DONE
                </span>
              ) : skipped ? (
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                  SKIPPED
                </span>
              ) : missed ? (
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--stalling, #f87171)' }}>
                  MISSED
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {exCount > 0 ? `${exCount} exercises` : 'No exercises'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {done ? (
                <ActionChip label="RECAP" onClick={() => onViewNotes({ type: 'meso', dayIdx: dIdx, weekIdx: wIdx })} />
              ) : (
                <>
                  <ActionChip label="VIEW" onClick={() => onPreviewSession(dIdx, wIdx)} />
                  <ActionChip
                    label={missed ? 'RESCHEDULE' : 'MOVE'}
                    accent
                    onClick={() => onMoveSession(sk)}
                  />
                  <ActionChip
                    label={skipped ? 'UNSKIP' : 'SKIP'}
                    onClick={() => {
                      setSkipped(dIdx, wIdx, !skipped);
                      void syncSkippedToSupabase(dIdx, wIdx, !skipped);
                      onSkipChanged();
                    }}
                  />
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Extra session */}
      {hasExtra && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{extraLabel}</div>
            {extraDone && (
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--success, #4ade80)' }}>
                ✓ DONE
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {extraDone ? (
              <ActionChip label="NOTES" onClick={() => onViewNotes({ type: 'extra', dateStr })} />
            ) : (
              <ActionChip label="OPEN" accent onClick={() => onOpenExtra(dateStr)} />
            )}
          </div>
        </div>
      )}

      {/* Cardio session */}
      {cardioSession && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>♢ {cardioName}</div>
            {cardioSession.completed && (
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: tokens.colors.gold }}>
                ✓ DONE
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionChip
              label={cardioSession.completed ? 'REVIEW' : 'OPEN'}
              accent={!cardioSession.completed}
              onClick={() => onOpenCardio(dateStr, cardioSession.protocolId ?? null)}
            />
          </div>
        </div>
      )}

      {/* Rest day / add affordance */}
      {isEmpty && (
        <div style={{ ...cardStyle, alignItems: 'center', padding: '22px 16px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {isPast ? 'Nothing scheduled — rest day.' : '— rest day —'}
          </div>
          {!isPast && <ActionChip label="+ ADD WORKOUT" accent onClick={() => onAddWorkout(dateStr)} />}
        </div>
      )}
      {!isEmpty && !isPast && keys.length < 2 && (
        <button
          onClick={() => onAddWorkout(dateStr)}
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '4px 2px',
            fontFamily: 'inherit',
          }}
        >
          + add to this day
        </button>
      )}
    </div>
  );
}

export default DayStack;
