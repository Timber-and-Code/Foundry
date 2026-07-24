import React from 'react';
import { tokens } from '../../styles/tokens';
import { TAG_ACCENT, PHASE_COLOR, getMeso, getWeekPhase } from '../../data/constants';
import type { Profile, TrainingDay, Exercise } from '../../types';
import Sheet from '../ui/Sheet';
import {
  store,
  loadCardioSession,
  loadNotes,
  loadExNotes,
  loadExtraExNotes,
  hasAnyNotes,
  hasAnyExtraNotes,
  buildSessionDateMap,
  setScheduleOverride,
} from '../../utils/store';
import { haptic } from '../../utils/helpers';
import { useToast } from '../../contexts/ToastContext';
import RestDaySheet from './RestDaySheet';
import EditScheduleSheet from './EditScheduleSheet';
import DayActionSheet from './DayActionSheet';
import WorkoutSplash from '../workout/WorkoutSplash';
import MoveWorkoutSheet from './MoveWorkoutSheet';
import WeekStrip, { type WeekStripDayMeta } from './WeekStrip';
import DayStack from './DayStack';
import { isSkipped } from '../../utils/store';

/** Local YYYY-MM-DD (avoids the toISOString UTC shift). */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The Sunday that starts the week containing `d`. */
function sundayOf(d: Date): string {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - c.getDay());
  return toLocalDateStr(c);
}

// ── Inline icon helpers ────────────────────────────────────────────────────

const overviewIcon = (color: string) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// ── NoteViewer ─────────────────────────────────────────────────────────────

export interface NoteViewerData {
  label: string;
  exercises: Exercise[];
  exNotes?: Record<number, string>;
  sessionNote?: string;
  type?: string;
  dayIdx?: number;
  weekIdx?: number;
  dateStr?: string;
}

function NoteViewer({ noteViewer, setNoteViewer }: { noteViewer: NoteViewerData | null; setNoteViewer: (v: NoteViewerData | null) => void }) {
  if (!noteViewer) return null;
  return (
    <Sheet open={!!noteViewer} onClose={() => setNoteViewer(null)} zIndex={300}>
      <div style={{ padding: '8px 20px 40px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
                marginBottom: 4,
              }}
            >
              SESSION NOTES
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: 'var(--text-primary)',
              }}
            >
              {noteViewer.label}
            </div>
          </div>
          <button
            onClick={() => setNoteViewer(null)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 20,
              lineHeight: 1,
              padding: '2px 4px',
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
        {noteViewer.exercises.map((ex: Exercise, i: number) => {
          const n = (noteViewer.exNotes || {})[i] || '';
          if (!n.trim()) return null;
          return (
            <div key={i} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.04em',
                  marginBottom: 4,
                }}
              >
                {ex.name}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  background: 'var(--bg-inset)',
                  borderRadius: tokens.radius.md,
                  padding: '10px 12px',
                }}
              >
                {n}
              </div>
            </div>
          );
        })}
        {noteViewer.sessionNote && noteViewer.sessionNote.trim() && (
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                letterSpacing: '0.04em',
                marginBottom: 4,
              }}
            >
              SESSION
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--text-primary)',
                lineHeight: 1.6,
                background: 'var(--bg-inset)',
                borderRadius: tokens.radius.md,
                padding: '10px 12px',
              }}
            >
              {noteViewer.sessionNote}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ── Main ScheduleTab ───────────────────────────────────────────────────────

interface ScheduleTabProps {
  profile: Profile;
  activeDays: TrainingDay[];
  completedDays: Set<string>;
  activeWeek: number;
  currentWeek: number;
  calendarOffset: number;
  setCalendarOffset: (v: number | ((prev: number) => number)) => void;
  expandedWeek?: number | null;
  setExpandedWeek?: (v: number | null) => void;
  showRestDay: { dateStr: string; isPast?: boolean } | null;
  setShowRestDay: (v: { dateStr: string; isPast?: boolean } | null) => void;
  showEditSchedule: boolean;
  setShowEditSchedule: (v: boolean) => void;
  noteViewer: NoteViewerData | null;
  setNoteViewer: (v: NoteViewerData | null) => void;
  skipVersion: number;
  setSkipVersion: (v: number) => void;
  goTo: (v: string) => void;
  onSelectDay?: (v: number) => void;
  onSelectDayWeek: (dayIdx: number, weekIdx: number) => void;
  onOpenExtra: (v: string) => void;
  onOpenCardio: (dateStr: string, protocolId: string | null) => void;
  setCurrentWeek: (v: number) => void;
  onProfileUpdate: (updates: Partial<Profile>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setAddWorkoutModal: (v: any) => void;
  setAddWorkoutStep: (v: string) => void;
  setAddWorkoutType: (v: string | null) => void;
  setAddWorkoutDayType: (v: string | null) => void;
}

function ScheduleTab({
  profile,
  activeDays,
  completedDays,
  activeWeek,
  currentWeek,
  calendarOffset,
  setCalendarOffset,
  expandedWeek: _expandedWeek,
  setExpandedWeek: _setExpandedWeek,
  showRestDay,
  setShowRestDay,
  showEditSchedule,
  setShowEditSchedule,
  noteViewer,
  setNoteViewer,
  skipVersion,
  setSkipVersion,
  goTo,
  onSelectDay: _onSelectDay,
  onSelectDayWeek: _onSelectDayWeek,
  onOpenExtra,
  onOpenCardio,
  setCurrentWeek: _setCurrentWeek,
  onProfileUpdate,
  setAddWorkoutModal,
  setAddWorkoutStep,
  setAddWorkoutType,
  setAddWorkoutDayType,
}: ScheduleTabProps) {
  // Onboarding v2: emit schedule-tab-opened once per user the first time
  // ScheduleTab mounts after onboarding. CoachMarkOrchestrator explains
  // that the calendar is tappable for rescheduling.
  React.useEffect(() => {
    if (
      store.get('foundry:onboarded') === '1' &&
      !store.get('foundry:first_schedule_emitted')
    ) {
      store.set('foundry:first_schedule_emitted', '1');
      window.dispatchEvent(new Event('foundry:schedule-tab-opened'));
    }
  }, []);

  // Day action sheet (tap-a-day) + move-workout picker state.
  const [activeDate, setActiveDate] = React.useState<string | null>(null);
  const [moveState, setMoveState] = React.useState<{ sourceDateStr: string; sessionKey: string } | null>(null);
  const [previewState, setPreviewState] = React.useState<{ dayIdx: number; weekIdx: number } | null>(null);

  // Schedule v2: week pager is the primary surface; the month grid is the
  // zoomed-out secondary view behind the ▦ toggle.
  const [scheduleView, setScheduleView] = React.useState<'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = React.useState<string>(() => toLocalDateStr(new Date()));
  const [weekAnchor, setWeekAnchor] = React.useState<string>(() => sundayOf(new Date()));

  // Move mode — tap MOVE, tap the workout to pick it up, tap a day to place
  // it. Past/present/future sources all work; a banner always names the
  // session in hand so double-booked days are never ambiguous.
  const [moveMode, setMoveMode] = React.useState<
    | null
    | { phase: 'pick' }
    | { phase: 'place'; sessionKey: string; sourceDateStr: string; label: string }
  >(null);
  // Double-booked source day — mini chooser for WHICH workout to pick up.
  const [movePicker, setMovePicker] = React.useState<{ dateStr: string; keys: string[] } | null>(null);
  const { showToast } = useToast();

  const sessionKeyLabel = React.useCallback(
    (sk: string): string => {
      const [dStr, wStr] = sk.split(':');
      const d = activeDays[Number(dStr)];
      return `${d?.label || `Day ${Number(dStr) + 1}`} · Wk ${Number(wStr) + 1}`;
    },
    [activeDays],
  );

  const pickUpSession = React.useCallback(
    (dateStr: string, sk: string) => {
      haptic('tap');
      setMovePicker(null);
      setMoveMode({ phase: 'place', sessionKey: sk, sourceDateStr: dateStr, label: sessionKeyLabel(sk) });
    },
    [sessionKeyLabel],
  );

  const placeSession = React.useCallback(
    (targetDateStr: string) => {
      if (!moveMode || moveMode.phase !== 'place') return;
      const next = setScheduleOverride(
        profile,
        moveMode.sourceDateStr,
        targetDateStr,
        moveMode.sessionKey,
      );
      onProfileUpdate({ scheduleOverrides: next.scheduleOverrides });
      haptic('done');
      const dt = new Date(targetDateStr + 'T00:00:00');
      const dayLabel = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      showToast(`${moveMode.label} → ${dayLabel}`, 'success');
      setMoveMode(null);
    },
    [moveMode, profile, onProfileUpdate, showToast],
  );

  const today = new Date();
  const displayDate = new Date(today.getFullYear(), today.getMonth() + calendarOffset, 1);
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const monthName = displayDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build sessionDateMap via the shared helper so the Home tab and this tab
  // agree on which date hosts which session — including per-date overrides
  // that may double-book a day. Values are `string | string[]`.
  const sessionDateMap: Record<string, string | string[]> = React.useMemo(
    () => buildSessionDateMap(profile, activeDays.length, getMeso().totalWeeks),
    [profile, activeDays.length],
  );

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayStr = today.toISOString().slice(0, 10);

  const cells: (number | null)[] = [];
  for (let b = 0; b < firstDay; b++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Month nav clamp
  const startD = profile?.startDate ? new Date(profile.startDate + 'T00:00:00') : null;
  const minOffset = startD
    ? (startD.getFullYear() - today.getFullYear()) * 12 + (startD.getMonth() - today.getMonth())
    : -6;
  const totalDays = ((getMeso().totalWeeks || 6) + 1) * 7 + 30;
  const endD = startD ? new Date(startD.getTime() + totalDays * 86400000) : null;
  const maxOffset = endD
    ? (endD.getFullYear() - today.getFullYear()) * 12 + (endD.getMonth() - today.getMonth())
    : 6;
  const canGoBack = calendarOffset > minOffset;
  const canGoForward = calendarOffset < maxOffset;

  // ── Week view derivations ────────────────────────────────────────────────
  const weekDates = React.useMemo(() => {
    const anchor = new Date(weekAnchor + 'T00:00:00');
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(d.getDate() + i);
      return toLocalDateStr(d);
    });
  }, [weekAnchor]);

  // Per-day signals for the strip. skipVersion is referenced so a skip
  // toggle recomputes the missed markers.
  const weekMeta = React.useMemo(() => {
    void skipVersion;
    const meta: Record<string, WeekStripDayMeta> = {};
    for (const ds of weekDates) {
      const entry = sessionDateMap[ds];
      const keys: string[] = entry == null ? [] : Array.isArray(entry) ? entry : [entry];
      const primaryKey = keys.find((k) => !completedDays.has(k)) ?? keys[0] ?? null;
      const allDone = keys.length > 0 && keys.every((k) => completedDays.has(k));
      const isPastDay = ds < todayStr;
      const missed =
        isPastDay &&
        keys.some((k) => {
          if (completedDays.has(k)) return false;
          const [dIdx, wIdx] = k.split(':').map(Number);
          return !isSkipped(dIdx, wIdx);
        });
      let sessionColor: string | null = null;
      if (primaryKey) {
        const wIdx = parseInt(primaryKey.split(':')[1], 10);
        const phase = getWeekPhase()[wIdx] || 'Accumulation';
        sessionColor = (PHASE_COLOR as Record<string, string>)[phase] || 'var(--phase-intens)';
      }
      meta[ds] = {
        sessionColor,
        allDone,
        missed,
        double: keys.length > 1,
        hasCardio: !!loadCardioSession(ds),
        hasExtra: !!store.get(`foundry:extra:${ds}`),
      };
    }
    return meta;
  }, [weekDates, sessionDateMap, completedDays, todayStr, skipVersion]);

  // Phase identity for the strip header — from the first meso session in
  // the visible week, falling back to the lifter's current week.
  const { weekPhaseLabel, weekPhaseColor } = React.useMemo(() => {
    let wIdx: number | null = null;
    for (const ds of weekDates) {
      const entry = sessionDateMap[ds];
      const keys: string[] = entry == null ? [] : Array.isArray(entry) ? entry : [entry];
      if (keys.length > 0) {
        wIdx = parseInt(keys[0].split(':')[1], 10);
        break;
      }
    }
    if (wIdx === null) wIdx = currentWeek;
    const phase = getWeekPhase()[wIdx] || 'Accumulation';
    return {
      weekPhaseLabel: `WK ${wIdx + 1} · ${String(phase).toUpperCase()}`,
      weekPhaseColor: (PHASE_COLOR as Record<string, string>)[phase] || 'var(--phase-intens)',
    };
  }, [weekDates, sessionDateMap, currentWeek]);

  // Clamp week paging to the same window as the month nav.
  const weekCanPrev = !startD || weekAnchor > toLocalDateStr(new Date(startD.getTime() - 7 * 86400000));
  const weekCanNext = !endD || weekAnchor < toLocalDateStr(endD);

  const shiftWeek = (dir: -1 | 1) => {
    const anchor = new Date(weekAnchor + 'T00:00:00');
    anchor.setDate(anchor.getDate() + dir * 7);
    setWeekAnchor(toLocalDateStr(anchor));
    // Keep the selection on the same DOW in the new week.
    const sel = new Date(selectedDate + 'T00:00:00');
    sel.setDate(sel.getDate() + dir * 7);
    setSelectedDate(toLocalDateStr(sel));
  };

  const goToToday = () => {
    setWeekAnchor(sundayOf(new Date()));
    setSelectedDate(toLocalDateStr(new Date()));
  };

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out' }}>
      {/* Calendar */}
      <div style={{ padding: '12px 0 0' }}>
        <div
          style={{
            width: '100%',
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            padding: '14px 12px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {scheduleView === 'week' ? (
            <>
              <WeekStrip
                weekDates={weekDates}
                selectedDate={selectedDate}
                todayStr={todayStr}
                meta={weekMeta}
                phaseLabel={weekPhaseLabel}
                phaseColor={weekPhaseColor}
                canPrev={weekCanPrev}
                canNext={weekCanNext}
                onShiftWeek={shiftWeek}
                onSelectDate={setSelectedDate}
                onToday={goToToday}
                onShowMonth={() => setScheduleView('month')}
              />
              <DayStack
                dateStr={selectedDate}
                profile={profile}
                activeDays={activeDays}
                sessionEntry={sessionDateMap[selectedDate]}
                completedDays={completedDays}
                skipVersion={skipVersion}
                onSkipChanged={() => setSkipVersion(skipVersion + 1)}
                onPreviewSession={(dIdx, wIdx) => setPreviewState({ dayIdx: dIdx, weekIdx: wIdx })}
                onMoveSession={(sk) => setMoveState({ sourceDateStr: selectedDate, sessionKey: sk })}
                onViewNotes={(arg) => {
                  if (arg.type === 'meso') {
                    const d = activeDays[arg.dayIdx];
                    setNoteViewer({
                      type: 'meso',
                      dayIdx: arg.dayIdx,
                      weekIdx: arg.weekIdx,
                      label: d ? `${d.label} — W${arg.weekIdx + 1}` : `Day ${arg.dayIdx + 1} W${arg.weekIdx + 1}`,
                      exercises: d ? d.exercises : [],
                      sessionNote: loadNotes(arg.dayIdx, arg.weekIdx),
                      exNotes: loadExNotes(arg.dayIdx, arg.weekIdx),
                    });
                  } else {
                    const extraDateStr = arg.dateStr;
                    let extra: { label?: string; exercises?: Exercise[] } | null = null;
                    try {
                      extra = JSON.parse(store.get(`foundry:extra:${extraDateStr}`) || 'null');
                    } catch { /* ignore */ }
                    setNoteViewer({
                      type: 'extra',
                      dateStr: extraDateStr,
                      label: extra?.label ?? 'Extra Session',
                      exercises: extra?.exercises ?? [],
                      sessionNote: store.get(`foundry:extra:notes:${extraDateStr}`) || '',
                      exNotes: loadExtraExNotes(extraDateStr),
                    });
                  }
                }}
                onOpenExtra={onOpenExtra}
                onOpenCardio={onOpenCardio}
                onAddWorkout={(ds) => {
                  setAddWorkoutModal(ds);
                  setAddWorkoutStep('type');
                  setAddWorkoutType(null);
                  setAddWorkoutDayType(null);
                }}
              />
            </>
          ) : (
          <>
          {/* Calendar header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                fontSize: 28,
                fontWeight: 400,
                letterSpacing: '0.04em',
                color: 'var(--text-primary)',
                lineHeight: 1.0,
              }}
            >
              {monthName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => canGoBack && setCalendarOffset((o: number) => o - 1)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: tokens.radius.md,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-inset)',
                  cursor: canGoBack ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: canGoBack ? 'var(--text-secondary)' : 'var(--text-dim)',
                  fontSize: 18,
                  fontWeight: 700,
                  opacity: canGoBack ? 1 : 0.3,
                }}
              >
                ‹
              </button>
              {calendarOffset !== 0 && (
                <button
                  onClick={() => setCalendarOffset(0)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: tokens.radius.md,
                    border: '1px solid var(--phase-intens)55',
                    background: 'var(--phase-intens)11',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    color: 'var(--phase-intens)',
                  }}
                >
                  TODAY
                </button>
              )}
              <button
                onClick={() => canGoForward && setCalendarOffset((o: number) => o + 1)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: tokens.radius.md,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-inset)',
                  cursor: canGoForward ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: canGoForward ? 'var(--text-secondary)' : 'var(--text-dim)',
                  fontSize: 18,
                  fontWeight: 700,
                  opacity: canGoForward ? 1 : 0.3,
                }}
              >
                ›
              </button>
              <button
                onClick={() => {
                  if (moveMode) {
                    setMoveMode(null);
                    setMovePicker(null);
                  } else {
                    haptic('tap');
                    setMoveMode({ phase: 'pick' });
                  }
                }}
                aria-pressed={!!moveMode}
                aria-label={moveMode ? 'Exit move mode' : 'Move a workout'}
                style={{
                  padding: '4px 10px',
                  height: 32,
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${moveMode ? 'var(--accent)' : 'var(--border)'}`,
                  background: moveMode ? 'var(--accent)22' : 'var(--bg-inset)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: moveMode ? 'var(--accent)' : 'var(--text-secondary)',
                  marginLeft: 4,
                }}
              >
                MOVE
              </button>
              <button
                aria-label="Show week view"
                onClick={() => setScheduleView('week')}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: tokens.radius.md,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-inset)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  fontWeight: 700,
                  marginLeft: 4,
                }}
              >
                ▤
              </button>
            </div>
          </div>

          {/* Move-mode banner — always names the session in hand */}
          {moveMode && (
            <div
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 10,
                padding: '10px 12px',
                borderRadius: tokens.radius.md,
                background: 'var(--accent)14',
                border: '1px dashed var(--accent)88',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    color: 'var(--accent)',
                  }}
                >
                  {moveMode.phase === 'pick' ? 'MOVE A WORKOUT' : `MOVING: ${moveMode.label.toUpperCase()}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {moveMode.phase === 'pick'
                    ? 'Tap the workout you want to move — past days included.'
                    : 'Tap a day to place it. Progression is preserved.'}
                </div>
              </div>
              <button
                onClick={() => {
                  setMoveMode(null);
                  setMovePicker(null);
                }}
                style={{
                  flexShrink: 0,
                  padding: '6px 10px',
                  borderRadius: tokens.radius.md,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* DOW headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 2,
              marginBottom: 4,
            }}
          >
            {DOW.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  color: 'var(--text-secondary)',
                  paddingBottom: 4,
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            data-coach="schedule-calendar"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 2,
            }}
          >
            {cells.map((day, ci) => {
              if (day === null) return <div key={`b${ci}`} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const entry = sessionDateMap[dateStr];
              const sessionKeys: string[] = entry == null ? [] : Array.isArray(entry) ? entry : [entry];
              // Primary session key for colouring — use the first that isn't
              // completed (so a half-done double-booked day still shows the
              // next session's accent).
              const primaryKey =
                sessionKeys.find((k) => !completedDays.has(k)) ?? sessionKeys[0] ?? null;
              const hasDouble = sessionKeys.length > 1;
              const allDone = sessionKeys.length > 0 && sessionKeys.every((k) => completedDays.has(k));
              const isDone = allDone;
              const isToday = dateStr === todayStr;
              const isPast = dateStr < todayStr;
              const hasExtra = !!store.get(`foundry:extra:${dateStr}`);
              const cardioSession = loadCardioSession(dateStr);
              const hasCardio = !!cardioSession;
              const cardioDone = cardioSession?.completed === true;

              let hasNotes = false,
                notesMeta: { type: string; dayIdx?: number; weekIdx?: number; dateStr?: string } | null = null;
              if (isDone && primaryKey) {
                const [dIdx, wIdx] = primaryKey.split(':').map(Number);
                hasNotes = hasAnyNotes(dIdx, wIdx);
                if (hasNotes) notesMeta = { type: 'meso', dayIdx: dIdx, weekIdx: wIdx };
              } else if (hasExtra && store.get(`foundry:extra:done:${dateStr}`) === '1') {
                hasNotes = hasAnyExtraNotes(dateStr);
                if (hasNotes) notesMeta = { type: 'extra', dateStr };
              }

              const sessionWeekIdx = primaryKey ? parseInt(primaryKey.split(':')[1]) : null;
              const sessionPhase =
                sessionWeekIdx !== null
                  ? getWeekPhase()[sessionWeekIdx] || 'Accumulation'
                  : 'Accumulation';
              const sessionPc =
                sessionWeekIdx !== null
                  ? (PHASE_COLOR as Record<string, any>)[sessionPhase] || 'var(--phase-intens)'
                  : 'var(--phase-intens)';

              let bg = 'transparent',
                dateColor = 'var(--text-secondary)',
                borderColor = 'transparent';
              if (primaryKey && !isDone) {
                bg = isPast ? sessionPc + '28' : sessionPc + '30';
                dateColor = isPast ? sessionPc + 'cc' : sessionPc;
                borderColor = isPast ? sessionPc + '55' : sessionPc + '88';
              }
              if (isDone) {
                bg = sessionPc + '44';
                dateColor = sessionPc;
                borderColor = sessionPc + '99';
              }

              // ── Move mode overlays ──────────────────────────────────────
              // pick: highlight days with movable (not-completed) sessions,
              // dim the rest. place: highlight valid targets, mark the
              // source, dim past/completed-occupied days.
              const movableKeys = sessionKeys.filter((k) => !completedDays.has(k));
              const occupantCompleted = sessionKeys.some((k) => completedDays.has(k));
              let moveDimmed = false;
              let moveBorder: string | null = null;
              if (moveMode?.phase === 'pick') {
                if (movableKeys.length > 0) moveBorder = '1.5px dashed var(--accent)';
                else moveDimmed = true;
              } else if (moveMode?.phase === 'place') {
                const isSource = dateStr === moveMode.sourceDateStr;
                const validTarget = !isSource && !isPast && !occupantCompleted;
                if (isSource) moveBorder = '2px dashed var(--accent)';
                else if (validTarget) moveBorder = '1.5px solid var(--accent)66';
                else moveDimmed = true;
              }

              const handleCellTap = () => {
                if (!moveMode) {
                  setActiveDate(dateStr);
                  return;
                }
                if (moveMode.phase === 'pick') {
                  if (movableKeys.length === 0) {
                    showToast('No movable workout on this day', 'info');
                    return;
                  }
                  if (movableKeys.length === 1) {
                    pickUpSession(dateStr, movableKeys[0]);
                    return;
                  }
                  setMovePicker({ dateStr, keys: movableKeys });
                  return;
                }
                // place phase
                if (dateStr === moveMode.sourceDateStr) {
                  showToast('Already on this day — tap another date', 'info');
                  return;
                }
                if (isPast) {
                  showToast("Can't move a workout into the past", 'warning');
                  return;
                }
                if (occupantCompleted) {
                  showToast('That day already has a completed workout', 'warning');
                  return;
                }
                if (movableKeys.length > 0) {
                  showToast('Heads up: that day now has 2 workouts', 'info');
                }
                placeSession(dateStr);
              };

              return (
                <div
                  key={day}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    moveMode
                      ? `${dateStr}${movableKeys.length ? ` — ${movableKeys.map(sessionKeyLabel).join(', ')}` : ''}`
                      : `${dateStr}${hasDouble ? ' (2 workouts)' : ''}`
                  }
                  onClick={handleCellTap}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCellTap();
                    }
                  }}
                  style={{
                    aspectRatio: '1',
                    borderRadius: tokens.radius.sm,
                    background: bg,
                    border:
                      moveBorder ??
                      (isToday
                        ? `2px solid ${isDone ? sessionPc : primaryKey ? sessionPc : 'var(--phase-intens)'}`
                        : `1px solid ${borderColor}`),
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    position: 'relative',
                    cursor: 'pointer',
                    opacity: moveDimmed ? 0.35 : 1,
                    transition: 'opacity 0.15s, border-color 0.15s',
                  }}
                >
                  <div
                    style={{
                      fontSize: primaryKey ? 15 : 13,
                      fontWeight: isToday || primaryKey ? 800 : 500,
                      color: isToday
                        ? isDone
                          ? sessionPc
                          : primaryKey
                            ? sessionPc
                            : 'var(--phase-intens)'
                        : dateColor,
                      lineHeight: 1,
                    }}
                  >
                    {day}
                  </div>
                  {hasDouble && (
                    <div
                      aria-hidden="true"
                      data-testid={`double-badge-${dateStr}`}
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        left: 2,
                        fontSize: 10,
                        fontWeight: 800,
                        color: 'var(--phase-peak)',
                        background: 'var(--phase-peak)22',
                        border: '1px solid var(--phase-peak)55',
                        borderRadius: tokens.radius.xs,
                        padding: '1px 4px',
                        lineHeight: 1,
                      }}
                    >
                      ×2
                    </div>
                  )}
                  {hasExtra && !hasNotes && (
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: tokens.radius.full,
                        background: 'var(--accent)',
                        opacity: 0.9,
                        position: 'absolute',
                        top: 2,
                        right: 2,
                      }}
                    />
                  )}
                  {hasCardio && (
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: tokens.radius.full,
                        background: cardioDone ? tokens.colors.gold : TAG_ACCENT['CARDIO'],
                        opacity: 0.9,
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                      }}
                    />
                  )}
                  {hasNotes && notesMeta && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (notesMeta.type === 'meso') {
                          const dIdx = notesMeta.dayIdx!;
                          const wIdx = notesMeta.weekIdx!;
                          const d = activeDays[dIdx];
                          setNoteViewer({
                            type: 'meso',
                            dayIdx: dIdx,
                            weekIdx: wIdx,
                            label: d ? `${d.label} — W${wIdx + 1}` : `Day ${dIdx + 1} W${wIdx + 1}`,
                            exercises: d ? d.exercises : [],
                            sessionNote: loadNotes(dIdx, wIdx),
                            exNotes: loadExNotes(dIdx, wIdx),
                          });
                        } else {
                          const extraDateStr = notesMeta.dateStr!;
                          const extra = (() => {
                            try {
                              return JSON.parse(
                                store.get(`foundry:extra:${extraDateStr}`) || 'null'
                              );
                            } catch {
                              return null;
                            }
                          })();
                          setNoteViewer({
                            type: 'extra',
                            dateStr: extraDateStr,
                            label: extra ? extra.label : 'Extra Session',
                            exercises: extra ? extra.exercises : [],
                            sessionNote:
                              store.get(`foundry:extra:notes:${extraDateStr}`) || '',
                            exNotes: loadExtraExNotes(extraDateStr),
                          });
                        }
                      }}
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        fontSize: 13,
                        lineHeight: 1,
                        cursor: 'pointer',
                        filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.4))',
                      }}
                      title="View notes"
                    >
                      📝
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
          )}

        </div>
      </div>

      {/* Edit Schedule action */}
      <div style={{ padding: '12px 12px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowEditSchedule(true)}
          style={{
            padding: '8px 14px',
            borderRadius: tokens.radius.md,
            cursor: 'pointer',
            background: 'var(--accent)11',
            border: '1px solid var(--accent)44',
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          ⚙ Edit Schedule
        </button>
      </div>

      {/* Meso Overview nav card. Full-width phase progression bar below
          the title — matches the look of MesoOverview's own
          PhaseProgression card so tapping in feels like a zoom rather
          than a context switch. */}
      <div style={{ padding: '8px 12px 0' }}>
        <button
          onClick={() => goTo('overview')}
          data-coach="meso-overview"
          style={{
            width: '100%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            padding: '14px 16px',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: 'var(--shadow-sm)',
            transition: 'border-color 0.15s, transform 0.12s',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--phase-deload)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'none';
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.99)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: tokens.radius.sm,
                  background: 'var(--phase-deload)18',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {overviewIcon('var(--phase-deload)')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
                  }}
                >
                  Meso Overview
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--text-muted)',
                    marginTop: 2,
                  }}
                >
                  Phases & session breakdown
                </div>
              </div>
            </div>
            <span
              aria-hidden="true"
              style={{ color: 'var(--text-muted)', fontSize: 16, flexShrink: 0 }}
            >
              ›
            </span>
          </div>
          {/* Full-width phase progression bar.
              done = full color + glow; current = full color + primary border;
              upcoming = 30% color (matches MesoOverview's PhaseProgression
              card so the visual carries through on tap-in). */}
          <div
            aria-label="Phase progression preview"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${getMeso().totalWeeks}, 1fr)`,
              gap: 4,
            }}
          >
            {Array.from({ length: getMeso().totalWeeks }, (_, w) => {
              const wColor = (PHASE_COLOR as Record<string, any>)[getWeekPhase()[w]] || 'var(--accent)';
              const isCurrent = w === activeWeek;
              const isDone = w < activeWeek;
              return (
                <div
                  key={w}
                  style={{
                    height: 8,
                    borderRadius: 3,
                    background: isDone || isCurrent ? wColor : `${wColor}4D`,
                    boxShadow: isDone ? `0 0 6px ${wColor}88` : undefined,
                    border: isCurrent ? '1.5px solid var(--text-primary)' : '1px solid transparent',
                    transition: 'background 200ms, box-shadow 200ms',
                  }}
                />
              );
            })}
          </div>
        </button>
      </div>

      {/* Sheet overlays */}
      <RestDaySheet
        showRestDay={showRestDay}
        setShowRestDay={setShowRestDay}
        profile={profile}
        activeDays={activeDays}
        setAddWorkoutModal={setAddWorkoutModal}
        setAddWorkoutStep={setAddWorkoutStep}
        setAddWorkoutType={setAddWorkoutType}
        setAddWorkoutDayType={setAddWorkoutDayType}
      />
      <EditScheduleSheet
        showEditSchedule={showEditSchedule}
        setShowEditSchedule={setShowEditSchedule}
        profile={profile}
        currentWeek={currentWeek}
        onProfileUpdate={onProfileUpdate}
      />
      <NoteViewer noteViewer={noteViewer} setNoteViewer={setNoteViewer} />
      <DayActionSheet
        open={!!activeDate}
        onClose={() => setActiveDate(null)}
        dateStr={activeDate}
        profile={profile}
        activeDays={activeDays}
        sessionEntry={activeDate ? sessionDateMap[activeDate] : undefined}
        completedDays={completedDays}
        onSkipChanged={() => setSkipVersion(skipVersion + 1)}
        onPreviewSession={(dIdx, wIdx) => setPreviewState({ dayIdx: dIdx, weekIdx: wIdx })}
        onOpenExtra={onOpenExtra}
        onOpenCardio={onOpenCardio}
        onOpenMobility={(ds, protocolId) => {
          window.dispatchEvent(
            new CustomEvent('foundry:openMobility', { detail: { dateStr: ds, protocolId } })
          );
        }}
        onAddWorkout={(ds) => {
          setAddWorkoutModal(ds);
          setAddWorkoutStep('type');
          setAddWorkoutType(null);
          setAddWorkoutDayType(null);
        }}
        onMoveSession={(sk) => {
          if (!activeDate) return;
          setMoveState({ sourceDateStr: activeDate, sessionKey: sk });
        }}
        onViewNotes={(arg) => {
          if (arg.type === 'meso') {
            const d = activeDays[arg.dayIdx];
            setNoteViewer({
              type: 'meso',
              dayIdx: arg.dayIdx,
              weekIdx: arg.weekIdx,
              label: d ? `${d.label} — W${arg.weekIdx + 1}` : `Day ${arg.dayIdx + 1} W${arg.weekIdx + 1}`,
              exercises: d ? d.exercises : [],
              sessionNote: loadNotes(arg.dayIdx, arg.weekIdx),
              exNotes: loadExNotes(arg.dayIdx, arg.weekIdx),
            });
          } else {
            const extraDateStr = arg.dateStr;
            let extra: { label?: string; exercises?: Exercise[] } | null = null;
            try {
              extra = JSON.parse(store.get(`foundry:extra:${extraDateStr}`) || 'null');
            } catch { /* ignore */ }
            setNoteViewer({
              type: 'extra',
              dateStr: extraDateStr,
              label: extra?.label ?? 'Extra Session',
              exercises: extra?.exercises ?? [],
              sessionNote: store.get(`foundry:extra:notes:${extraDateStr}`) || '',
              exNotes: loadExtraExNotes(extraDateStr),
            });
          }
        }}
      />
      {moveState && (
        <MoveWorkoutSheet
          open={!!moveState}
          onClose={() => setMoveState(null)}
          profile={profile}
          sourceDateStr={moveState.sourceDateStr}
          sessionKey={moveState.sessionKey}
          sessionDateMap={sessionDateMap}
          completedDays={completedDays}
          onProfileUpdate={onProfileUpdate}
          sessionLabel={(() => {
            const [dIdxStr, wIdxStr] = moveState.sessionKey.split(':');
            const day = activeDays[Number(dIdxStr)];
            return day ? `${day.label} — Week ${Number(wIdxStr) + 1}` : undefined;
          })()}
        />
      )}
      {/* Move mode: double-booked day — choose WHICH workout to pick up */}
      {movePicker && (
        <Sheet open={!!movePicker} onClose={() => setMovePicker(null)} zIndex={360}>
          <div style={{ padding: '8px 20px 24px' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'var(--accent)',
                marginBottom: 4,
              }}
            >
              WHICH WORKOUT?
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                marginBottom: 14,
              }}
            >
              This day has {movePicker.keys.length} workouts — tap the one to move.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {movePicker.keys.map((sk) => (
                <button
                  key={sk}
                  onClick={() => pickUpSession(movePicker.dateStr, sk)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: tokens.radius.lg,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 15,
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                  }}
                >
                  {sessionKeyLabel(sk)}
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      )}
      {previewState && activeDays[previewState.dayIdx] && (
        <WorkoutSplash
          previewOnly
          dayName={activeDays[previewState.dayIdx].label || `Day ${previewState.dayIdx + 1}`}
          dayIdx={previewState.dayIdx}
          weekIdx={previewState.weekIdx}
          exercises={activeDays[previewState.dayIdx].exercises}
          onBack={() => setPreviewState(null)}
        />
      )}
    </div>
  );
}

export default React.memo(ScheduleTab);
