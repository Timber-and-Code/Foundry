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
} from '../../utils/store';
import RestDaySheet from './RestDaySheet';
import EditScheduleSheet from './EditScheduleSheet';
import DayActionSheet from './DayActionSheet';
import WorkoutSplash from '../workout/WorkoutSplash';
import MoveWorkoutSheet from './MoveWorkoutSheet';

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
  skipVersion: _skipVersion,
  setSkipVersion: _setSkipVersion,
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
    () => buildSessionDateMap(profile, activeDays.length, getMeso().weeks),
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
  const totalDays = ((getMeso().weeks || 6) + 1) * 7 + 30;
  const endD = startD ? new Date(startD.getTime() + totalDays * 86400000) : null;
  const maxOffset = endD
    ? (endD.getFullYear() - today.getFullYear()) * 12 + (endD.getMonth() - today.getMonth())
    : 6;
  const canGoBack = calendarOffset > minOffset;
  const canGoForward = calendarOffset < maxOffset;

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
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
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
            </div>
          </div>

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

              return (
                <div
                  key={day}
                  role="button"
                  tabIndex={0}
                  aria-label={`${dateStr}${hasDouble ? ' (2 workouts)' : ''}`}
                  onClick={() => setActiveDate(dateStr)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveDate(dateStr);
                    }
                  }}
                  style={{
                    aspectRatio: '1',
                    borderRadius: tokens.radius.sm,
                    background: bg,
                    border: isToday
                      ? `2px solid ${isDone ? sessionPc : primaryKey ? sessionPc : 'var(--phase-intens)'}`
                      : `1px solid ${borderColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    position: 'relative',
                    cursor: 'pointer',
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

      {/* Meso Overview nav card */}
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
            alignItems: 'center',
            justifyContent: 'space-between',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: tokens.radius.sm,
                background: 'var(--phase-deload)18',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {overviewIcon('var(--phase-deload)')}
            </div>
            <div>
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
          <div
            style={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              marginLeft: 12,
            }}
          >
            {Array.from({ length: getMeso().weeks }, (_, w) => {
              const wColor = (PHASE_COLOR as Record<string, any>)[getWeekPhase()[w]] || 'var(--accent)';
              const isActive = w === activeWeek;
              return (
                <div
                  key={w}
                  style={{
                    width: isActive ? 10 : 6,
                    height: 6,
                    borderRadius: tokens.radius.xs,
                    background: wColor,
                    opacity: isActive ? 1 : 0.45,
                    transition: 'width 0.2s',
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
