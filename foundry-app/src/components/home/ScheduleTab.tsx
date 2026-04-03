import React from 'react';
import { TAG_ACCENT, PHASE_COLOR, getMeso, getWeekPhase } from '../../data/constants';
import Sheet from '../ui/Sheet';
import {
  store,
  loadCardioSession,
  loadNotes,
  loadExNotes,
  loadExtraExNotes,
  hasAnyNotes,
  hasAnyExtraNotes,
  getWorkoutDaysForWeek,
  saveCurrentWeek,
} from '../../utils/store';
import RestDaySheet from './RestDaySheet';
import EditScheduleSheet from './EditScheduleSheet';

// ── Inline icon helpers ────────────────────────────────────────────────────

const scheduleIcon = (color) => (
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
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const overviewIcon = (color) => (
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

// ── WeekSection ────────────────────────────────────────────────────────────

function WeekSection({ weekIdx, isExpanded, onToggle, activeDays, completedDays, onSelectDay }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          padding: '12px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          Week {weekIdx + 1}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isExpanded ? '▼' : '▶'}</span>
      </div>
      {isExpanded && (
        <div
          style={{
            padding: '8px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {activeDays.map((day, i) => {
            const done = completedDays.has(`${i}:${weekIdx}`);
            return (
              <div
                key={i}
                onClick={() => !done && onSelectDay(i, weekIdx)}
                style={{
                  padding: '10px 16px',
                  fontSize: 12,
                  color: done ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: done ? 'default' : 'pointer',
                  background: done ? 'var(--bg-inset)' : 'transparent',
                  borderRadius: 4,
                }}
              >
                {done ? '✓ ' : ''}
                {day.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeloadSection() {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        marginBottom: 8,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-accent)' }}>
        Deload Week
      </span>
    </div>
  );
}

// ── NoteViewer ─────────────────────────────────────────────────────────────

function NoteViewer({ noteViewer, setNoteViewer }) {
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
                fontSize: 12,
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
                fontSize: 16,
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
        {noteViewer.exercises.map((ex, i) => {
          const n = (noteViewer.exNotes || {})[i] || '';
          if (!n.trim()) return null;
          return (
            <div key={i} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 12,
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
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  background: 'var(--bg-inset)',
                  borderRadius: 6,
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
                fontSize: 12,
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
                fontSize: 13,
                color: 'var(--text-primary)',
                lineHeight: 1.6,
                background: 'var(--bg-inset)',
                borderRadius: 6,
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
  profile: any;
  activeDays: any[];
  completedDays: any;
  activeWeek: any;
  currentWeek: any;
  calendarOffset: any;
  setCalendarOffset: (v: any) => void;
  expandedWeek: any;
  setExpandedWeek: (v: any) => void;
  showRestDay: any;
  setShowRestDay: (v: any) => void;
  showEditSchedule: any;
  setShowEditSchedule: (v: any) => void;
  noteViewer: any;
  setNoteViewer: (v: any) => void;
  skipVersion: any;
  setSkipVersion: (v: any) => void;
  goBack: () => void;
  goTo: (v: any) => void;
  onSelectDay: (v: any) => void;
  onSelectDayWeek: (v: any) => void;
  onOpenExtra: (v: any) => void;
  onOpenCardio: (v: any) => void;
  setCurrentWeek: (v: any) => void;
  onProfileUpdate: (v: any) => void;
  setAddWorkoutModal: (v: any) => void;
  setAddWorkoutStep: (v: any) => void;
  setAddWorkoutType: (v: any) => void;
  setAddWorkoutDayType: (v: any) => void;
}

function ScheduleTab({
  profile,
  activeDays,
  completedDays,
  activeWeek,
  currentWeek,
  calendarOffset,
  setCalendarOffset,
  expandedWeek,
  setExpandedWeek,
  showRestDay,
  setShowRestDay,
  showEditSchedule,
  setShowEditSchedule,
  noteViewer,
  setNoteViewer,
  skipVersion,
  setSkipVersion,
  goBack,
  goTo,
  onSelectDay,
  onSelectDayWeek,
  onOpenExtra,
  onOpenCardio,
  setCurrentWeek,
  onProfileUpdate,
  setAddWorkoutModal,
  setAddWorkoutStep,
  setAddWorkoutType,
  setAddWorkoutDayType,
}: ScheduleTabProps) {
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

  // Build sessionDateMap
  const startDate = profile?.startDate ? new Date(profile.startDate + 'T00:00:00') : null;
  const sessionDateMap = {};
  if (startDate && activeDays.length > 0) {
    const totalSessions = (getMeso().weeks + 1) * activeDays.length;
    let sessionCount = 0;
    let cursor = new Date(startDate);
    for (let d = 0; d < 400 && sessionCount < totalSessions; d++) {
      const wkIdx = Math.floor(sessionCount / activeDays.length);
      if (getWorkoutDaysForWeek(profile, wkIdx).includes(cursor.getDay())) {
        sessionDateMap[cursor.toISOString().slice(0, 10)] =
          `${sessionCount % activeDays.length}:${wkIdx}`;
        sessionCount++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayStr = today.toISOString().slice(0, 10);

  const cells = [];
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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 16px 12px',
          background: 'var(--bg-deep)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={goBack}
          className="btn-ghost"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--accent)',
            fontSize: 20,
            lineHeight: 1,
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            minWidth: 44,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          ‹
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
            flex: 1,
          }}
        >
          SCHEDULE
        </span>
        <button
          onClick={() => setShowEditSchedule(true)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            background: 'var(--accent)11',
            border: '1px solid var(--accent)44',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          ⚙ Edit Schedule
        </button>
      </div>

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 5,
                  background: 'var(--phase-intens)15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {scheduleIcon('var(--phase-intens)')}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
                  }}
                >
                  Schedule
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  {monthName}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => canGoBack && setCalendarOffset((o) => o - 1)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-inset)',
                  cursor: canGoBack ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: canGoBack ? 'var(--text-secondary)' : 'var(--text-dim)',
                  fontSize: 16,
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
                    borderRadius: 6,
                    border: '1px solid var(--phase-intens)55',
                    background: 'var(--phase-intens)11',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    color: 'var(--phase-intens)',
                  }}
                >
                  TODAY
                </button>
              )}
              <button
                onClick={() => canGoForward && setCalendarOffset((o) => o + 1)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-inset)',
                  cursor: canGoForward ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: canGoForward ? 'var(--text-secondary)' : 'var(--text-dim)',
                  fontSize: 16,
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
                  fontSize: 12,
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
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 2,
            }}
          >
            {cells.map((day, ci) => {
              if (day === null) return <div key={`b${ci}`} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const sessionKey = sessionDateMap[dateStr];
              const isDone = sessionKey ? completedDays.has(sessionKey) : false;
              const isToday = dateStr === todayStr;
              const isPast = dateStr < todayStr;
              const hasExtra = !!store.get(`foundry:extra:${dateStr}`);
              const cardioSession = loadCardioSession(dateStr);
              const hasCardio = !!cardioSession;
              const cardioDone = cardioSession?.completed === true;

              let hasNotes = false,
                notesMeta = null;
              if (isDone && sessionKey) {
                const [dIdx, wIdx] = sessionKey.split(':').map(Number);
                hasNotes = hasAnyNotes(dIdx, wIdx);
                if (hasNotes) notesMeta = { type: 'meso', dayIdx: dIdx, weekIdx: wIdx };
              } else if (hasExtra && store.get(`foundry:extra:done:${dateStr}`) === '1') {
                hasNotes = hasAnyExtraNotes(dateStr);
                if (hasNotes) notesMeta = { type: 'extra', dateStr };
              }

              const sessionWeekIdx = sessionKey ? parseInt(sessionKey.split(':')[1]) : null;
              const sessionPhase =
                sessionWeekIdx !== null
                  ? getWeekPhase()[sessionWeekIdx] || 'Accumulation'
                  : 'Accumulation';
              const sessionPc =
                sessionWeekIdx !== null
                  ? PHASE_COLOR[sessionPhase] || 'var(--phase-intens)'
                  : 'var(--phase-intens)';

              let bg = 'transparent',
                dateColor = 'var(--text-secondary)',
                borderColor = 'transparent';
              if (sessionKey && !isDone) {
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
                  onClick={() => {
                    if (sessionKey) {
                      const [dIdx, wIdx] = sessionKey.split(':').map(Number);
                      onSelectDayWeek(dIdx, wIdx);
                    } else if (hasExtra) {
                      onOpenExtra(dateStr);
                    } else if (hasCardio) {
                      onOpenCardio(dateStr, cardioSession?.protocolId || null);
                    } else {
                      setShowRestDay({
                        dateStr,
                        isPast: isPast && dateStr !== todayStr,
                      });
                    }
                  }}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 5,
                    background: bg,
                    border: isToday
                      ? `2px solid ${isDone ? sessionPc : sessionKey ? sessionPc : 'var(--phase-intens)'}`
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
                      fontSize: sessionKey ? 13 : 11,
                      fontWeight: isToday || sessionKey ? 800 : 500,
                      color: isToday
                        ? isDone
                          ? sessionPc
                          : sessionKey
                            ? sessionPc
                            : 'var(--phase-intens)'
                        : dateColor,
                      lineHeight: 1,
                    }}
                  >
                    {day}
                  </div>
                  {hasExtra && !hasNotes && (
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
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
                        borderRadius: '50%',
                        background: cardioDone ? '#D4983C' : TAG_ACCENT['CARDIO'],
                        opacity: 0.9,
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                      }}
                    />
                  )}
                  {hasNotes && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (notesMeta.type === 'meso') {
                          const { dayIdx: dIdx, weekIdx: wIdx } = notesMeta;
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
                          const extra = (() => {
                            try {
                              return JSON.parse(
                                store.get(`foundry:extra:${notesMeta.dateStr}`) || 'null'
                              );
                            } catch {
                              return null;
                            }
                          })();
                          setNoteViewer({
                            type: 'extra',
                            dateStr: notesMeta.dateStr,
                            label: extra ? extra.label : 'Extra Session',
                            exercises: extra ? extra.exercises : [],
                            sessionNote:
                              store.get(`foundry:extra:notes:${notesMeta.dateStr}`) || '',
                            exNotes: loadExtraExNotes(notesMeta.dateStr),
                          });
                        }
                      }}
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        fontSize: 12,
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

          {/* Legend */}
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[
                ['Accumulation', 'var(--phase-accum)'],
                ['Intensification', 'var(--phase-intens)'],
                ['Peak', 'var(--phase-peak)'],
                ['Deload', 'var(--phase-deload)'],
              ].map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: color,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    {label.slice(0, 3).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                  }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Extra</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#D4983C',
                  }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cardio</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Meso Overview nav card */}
      <div style={{ padding: '8px 12px 0' }}>
        <button
          onClick={() => goTo('overview')}
          style={{
            width: '100%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
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
                borderRadius: 5,
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
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                }}
              >
                Meso Overview
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginTop: 1,
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
              const wColor = PHASE_COLOR[getWeekPhase()[w]] || 'var(--accent)';
              const isActive = w === activeWeek;
              return (
                <div
                  key={w}
                  style={{
                    width: isActive ? 10 : 6,
                    height: 6,
                    borderRadius: 2,
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

      {/* Weekly sessions */}
      <div style={{ padding: '8px 16px 0' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            padding: '8px 0 10px',
          }}
        >
          SESSIONS BY WEEK
        </div>
      </div>
      <div style={{ padding: '0 16px' }}>
        {Array.from({ length: getMeso().weeks }, (_, w) => (
          <WeekSection
            key={w}
            weekIdx={w}
            currentWeek={activeWeek}
            onSelectDay={(dayIdx, weekIdx) => {
              setCurrentWeek(weekIdx);
              saveCurrentWeek(weekIdx);
              onSelectDay(dayIdx);
            }}
            completedDays={completedDays}
            isExpanded={expandedWeek === w}
            onToggle={() => setExpandedWeek(expandedWeek === w ? null : w)}
            activeDays={activeDays}
          />
        ))}
        <DeloadSection />
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
    </div>
  );
}

export default React.memo(ScheduleTab);
