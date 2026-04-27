import React from 'react';
import {
  TAG_ACCENT,
  getMeso,
  DAILY_MOBILITY,
  CARDIO_WORKOUTS,
  FOUNDRY_COOLDOWN,
  MOBILITY_PROTOCOLS,
} from '../../data/constants';
import { tokens } from '../../styles/tokens';
import { findExercise } from '../../data/exerciseDB';
import {
  store,
  loadCardioSession,
  getTimeGreeting,
  getWeekSets,
  buildSessionDateMap,
  computeMobilityStreak,
  saveMobilitySession,
} from '../../utils/store';
import WelcomeRibbon from './WelcomeRibbon';
import AnonLocalBanner from './AnonLocalBanner';
import { useActiveSession } from '../../contexts/ActiveSessionContext';
import { useRestTimer } from '../../contexts/RestTimerContext';
import type { Profile, TrainingDay, Exercise, CardioScheduleSlot } from '../../types';

// ── Warmup protocol picker ────────────────────────────────────────────────
// Select the warmup protocol that matches today's day tag (PUSH/PULL/LEGS/
// UPPER/LOWER). Falls back to `daily_warmup` when no tag-specific match.
function pickWarmupForDay(dayTag?: string | null) {
  const fallback = MOBILITY_PROTOCOLS.find((p) => p.id === 'daily_warmup')!;
  if (!dayTag) return fallback;
  const upper = dayTag.toUpperCase();
  return (
    MOBILITY_PROTOCOLS.find(
      (p) => p.category === 'warmup' && p.dayTags?.includes(upper),
    ) || fallback
  );
}

// ── Cardio recommendation picker ──────────────────────────────────────────
// When the user hasn't scheduled cardio for today, pick a sensible
// recommendation from CARDIO_WORKOUTS based on their training goal.
// Lifting-focused goals prefer low-interference Endurance (Easy Walk).
// Fitness/sport goals prefer the first goal-matched protocol.
function pickRecommendedCardio(goalId?: string | null) {
  const goal = goalId || 'build_muscle';
  const candidates = CARDIO_WORKOUTS.filter((w) => w.recommendedFor?.includes(goal));
  const preferEndurance = goal === 'build_muscle' || goal === 'build_strength';
  if (preferEndurance) {
    const easy = candidates.find((w) => w.category === 'Endurance');
    if (easy) return easy;
  }
  return (
    candidates[0] ||
    CARDIO_WORKOUTS.find((w) => w.id === 'easy_walk') ||
    CARDIO_WORKOUTS[0]
  );
}

// ── Section Divider ───────────────────────────────────────────────────────

function SectionDivider() {
  return (
    <div
      style={{
        height: 1,
        margin: '4px 0',
        background: 'linear-gradient(90deg, transparent, rgba(232,101,26,0.18), transparent)',
      }}
    />
  );
}

// ── RestStateCard ─────────────────────────────────────────────────────────

function RestStateCard({
  displayWeekAllDone,
  calendarSessionDone,
  nextDay,
  nextDayIdx: _nextDayIdx,
  nextDayForCollapse,
  nextDayIdxForCollapse,
  nextSessionDateStr,
  doneLabel,
  activeDays,
  displayWeek,
  completedDays,
  showRecoveryOpen,
  setShowRecoveryOpen,
  showNextSession,
  setShowNextSession,
  activeWeek,
  goBack,
  onSelectDayWeek,
}: {
  displayWeekAllDone: boolean;
  calendarSessionDone: boolean;
  nextDay: TrainingDay | null;
  nextDayIdx: number;
  nextDayForCollapse: TrainingDay | null;
  nextDayIdxForCollapse: number;
  /** ISO date (YYYY-MM-DD) of when the next not-yet-completed session is
   *  scheduled. Surfaced as "Mon · Apr 27" above the workout label. */
  nextSessionDateStr: string | null;
  doneLabel: string;
  activeDays: TrainingDay[];
  displayWeek: number;
  completedDays: Set<string>;
  showRecoveryOpen: boolean;
  setShowRecoveryOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  showNextSession: boolean;
  setShowNextSession: (v: boolean | ((prev: boolean) => boolean)) => void;
  activeWeek: number;
  goBack: () => void;
  onSelectDayWeek: (dayIdx: number, weekIdx: number) => void;
}) {
  // Find last completed day's tag for mobility
  let homeMobilityTag = null;
  if (!calendarSessionDone) {
    outer: for (let w = displayWeek; w >= 0; w--) {
      for (let d = activeDays.length - 1; d >= 0; d--) {
        if (completedDays.has(`${d}:${w}`)) {
          homeMobilityTag = activeDays[d]?.tag || null;
          break outer;
        }
      }
    }
  }
  const homeMobilityMoves: { name: string; cue: string }[] | null =
    homeMobilityTag && (FOUNDRY_COOLDOWN as Record<string, any>)[homeMobilityTag]
      ? (FOUNDRY_COOLDOWN as Record<string, any>)[homeMobilityTag]
      : null;

  const isWeekComplete = displayWeekAllDone && !nextDay;
  const headerLabel = isWeekComplete
    ? 'WEEK COMPLETE'
    : calendarSessionDone
      ? 'TODAY · DONE'
      : 'REST DAY';
  const headerColor = isWeekComplete || calendarSessionDone
    ? 'var(--phase-accum)'
    : 'var(--text-muted)';

  const recoveryItems = isWeekComplete
    ? [
        { title: 'Sauna or Steam', body: 'Even 15–20 minutes of heat exposure improves circulation and helps clear soreness.' },
        { title: 'Easy Cardio', body: 'A 20–30 min easy bike, walk, or swim keeps blood moving. Keep intensity below 6/10.' },
        { title: 'Cold Finish', body: 'End your shower cold for 30–60 seconds. Reduces inflammation and improves recovery.' },
      ]
    : [
        { title: 'Sleep', body: '8+ hours is the only thing that actually repairs muscle tissue. Make sleep the priority.' },
        { title: 'Protein', body: 'Hit your target even without training. Muscle protein synthesis continues in recovery.' },
        { title: 'Walk', body: '20–30 minutes of easy walking clears metabolic waste and keeps blood moving through sore tissue.' },
      ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        data-tour="today-card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            background: calendarSessionDone || isWeekComplete ? 'var(--phase-accum)0d' : 'var(--bg-inset)',
            borderBottom: `1px solid ${calendarSessionDone || isWeekComplete ? 'var(--phase-accum)22' : 'var(--border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(calendarSessionDone || isWeekComplete) && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--phase-accum)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: headerColor }}>
              {headerLabel}
            </span>
          </div>
          {doneLabel && calendarSessionDone && (
            <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
              {doneLabel}
            </span>
          )}
        </div>

        {/* Single collapsible recovery guide */}
        <div style={{ padding: '0' }}>
          <button
            onClick={() => setShowRecoveryOpen((p: boolean) => !p)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: '12px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              {isWeekComplete ? 'Active Recovery Guide' : 'Recovery Guide'}
            </span>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showRecoveryOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {showRecoveryOpen && (
            <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recoveryItems.map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    borderRadius: tokens.radius.md,
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: '3px solid var(--accent)',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {item.body}
                  </div>
                </div>
              ))}
              {/* Mobility section inline */}
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', marginTop: 4 }}>
                DAILY MOBILITY
              </div>
              {DAILY_MOBILITY.map((move, i) => (
                <div key={`dm-${i}`} style={{ padding: '9px 12px', borderRadius: tokens.radius.md, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{move.name}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{move.cue}</div>
                </div>
              ))}
              {homeMobilityMoves && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', marginTop: 4 }}>
                    {homeMobilityTag} COOLDOWN
                  </div>
                  {homeMobilityMoves.map((move, i) => (
                    <div key={`cm-${i}`} style={{ padding: '9px 12px', borderRadius: tokens.radius.md, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{move.name}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{move.cue}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Next session preview — explore-tile aesthetic for the header
          band: dark inset background, orange Bebas title. Brings warmth
          to rest days without leaning on the orange-edge treatment that
          read as "too much." */}
      {nextDayForCollapse && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <button
            onClick={() => setShowNextSession((p: boolean) => !p)}
            style={{
              width: '100%',
              background: 'var(--bg-inset, var(--bg-deep))',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              padding: '14px 16px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Next Session
                </div>
                {nextSessionDateStr && (() => {
                  const [y, m, d] = nextSessionDateStr.split('-').map(Number);
                  const dt = new Date(y, m - 1, d);
                  const today = new Date();
                  const todayY = today.getFullYear();
                  const todayM = today.getMonth();
                  const todayD = today.getDate();
                  const tomorrow = new Date(todayY, todayM, todayD + 1);
                  const isTomorrow =
                    dt.getFullYear() === tomorrow.getFullYear() &&
                    dt.getMonth() === tomorrow.getMonth() &&
                    dt.getDate() === tomorrow.getDate();
                  const label = isTomorrow
                    ? 'Tomorrow'
                    : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      · {label}
                    </div>
                  );
                })()}
              </div>
              <div
                style={{
                  fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                  fontSize: 26,
                  fontWeight: 400,
                  color: 'var(--accent)',
                  letterSpacing: '0.04em',
                  lineHeight: 1.0,
                  textTransform: 'uppercase',
                }}
              >
                {nextDayForCollapse.label}
              </div>
            </div>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showNextSession ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {showNextSession && (
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => { goBack(); onSelectDayWeek(nextDayIdxForCollapse, activeWeek); }}
                style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0' }}
              >
                {nextDayForCollapse.exercises.map((ex: Exercise, ei: number) => {
                  const ovId = store.get(`foundry:exov:d${nextDayIdxForCollapse}:ex${ei}`) || null;
                  const dbEx = ovId ? findExercise(ovId) : null;
                  return (
                    <div key={ei} style={{ display: 'flex', padding: '8px 16px', borderBottom: ei < nextDayForCollapse.exercises.length - 1 ? '1px solid var(--border-subtle)' : 'none', textAlign: 'left' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dbEx ? dbEx.name : ex.name}
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 1 }}>
                          {getWeekSets(Number(ex.sets) || 0, activeWeek, getMeso().totalWeeks)} sets · {ex.reps} reps{ex.rest ? ` · ${ex.rest}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </button>
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => { goBack(); onSelectDayWeek(nextDayIdxForCollapse, activeWeek); }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: tokens.radius.md,
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid var(--accent-border, rgba(232,101,26,0.3))',
                    color: 'var(--accent)',
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  Start {nextDayForCollapse.label} <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── HomeTab ───────────────────────────────────────────────────────────────

interface HomeTabProps {
  profile: Profile;
  activeDays: TrainingDay[];
  completedDays: Set<string>;
  activeWeek: number;
  displayWeek: number;
  phase: string;
  pc: string;
  rir: string | number;
  weekDone: number;
  weekTotal: number;
  weekPct: number;
  mesoPct: number;
  doneSessions: number;
  totalSessions: number;
  showRecoveryMorning: boolean;
  setShowRecoveryMorning: (v: boolean | ((prev: boolean) => boolean)) => void;
  showRecoveryTag: boolean;
  setShowRecoveryTag: (v: boolean) => void;
  showNextSession: boolean;
  setShowNextSession: (v: boolean | ((prev: boolean) => boolean)) => void;
  showMorningMobility: boolean;
  setShowMorningMobility: (v: boolean | ((prev: boolean) => boolean)) => void;
  goTo: (v: string) => void;
  goBack: () => void;
  onSelectDayWeek: (dayIdx: number, weekIdx: number) => void;
  setShowSkipConfirm: (v: { dayIdx: number; weekIdx: number } | null) => void;
  onOpenCardio: (dateStr: string, protocol: string | null) => void;
  onOpenMobility: (v: string) => void;
  setShowPricing: (v: boolean) => void;
}

function HomeTab({
  profile,
  activeDays,
  completedDays,
  activeWeek,
  displayWeek,
  phase,
  pc,
  rir,
  weekDone,
  weekTotal,
  weekPct: _weekPct,
  mesoPct: _mesoPct,
  doneSessions: _doneSessions,
  totalSessions: _totalSessions,
  showRecoveryMorning,
  setShowRecoveryMorning,
  showRecoveryTag: _showRecoveryTag,
  setShowRecoveryTag: _setShowRecoveryTag,
  showNextSession,
  setShowNextSession,
  showMorningMobility,
  setShowMorningMobility,
  goTo,
  goBack,
  onSelectDayWeek,
  setShowSkipConfirm,
  onOpenCardio,
  onOpenMobility: _onOpenMobility,
  setShowPricing: _setShowPricing,
}: HomeTabProps) {
  const { session: activeSession } = useActiveSession();
  const { restTimer } = useRestTimer();
  const todayCardioStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const todayDow = new Date().getDay();
  const cardioSchedule = profile?.cardioSchedule || [];
  const todayCardioSlot = cardioSchedule.find((s: CardioScheduleSlot) => s.dayOfWeek === todayDow) || null;
  const todayCardioSession = loadCardioSession(todayCardioStr);
  const CARDIO_COLOR = TAG_ACCENT['CARDIO'];
  const MOBILITY_COLOR = TAG_ACCENT['MOBILITY'];
  const mobilityStreak = computeMobilityStreak();

  const nextDayIdx = activeDays.findIndex((_, i) => !completedDays.has(`${i}:${activeWeek}`));
  const nextDay = nextDayIdx >= 0 ? activeDays[nextDayIdx] : null;
  const nextDayAccent = nextDay
    ? (TAG_ACCENT as Record<string, string>)[nextDay.tag || ''] || 'var(--accent)'
    : 'var(--accent)';

  // Build sessionDateMap via the shared helper so HomeTab and ScheduleTab
  // agree on which date hosts which session — including per-date overrides
  // that may stack 2 sessions on one day.
  const sessionDateMap = buildSessionDateMap(profile, activeDays.length, getMeso().totalWeeks);

  // Find the calendar date the next not-yet-completed session lands on.
  // Walks sessionDateMap chronologically from today forward and returns
  // the first date whose session-key isn't in completedDays. Surfaces on
  // the rest-state Next Session card so users see "Mon · Apr 27" not
  // just the workout name.
  const nextSessionDateStr = (() => {
    const sortedDates = Object.keys(sessionDateMap).sort();
    for (const d of sortedDates) {
      if (d < todayCardioStr) continue;
      const raw = sessionDateMap[d];
      const keys = Array.isArray(raw) ? raw : [raw];
      const firstUndone = keys.find((k) => !completedDays.has(k));
      if (firstUndone) return d;
    }
    return null;
  })();
  const calendarEntryRaw = sessionDateMap[todayCardioStr];
  const todayKeys: string[] = calendarEntryRaw == null
    ? []
    : Array.isArray(calendarEntryRaw) ? calendarEntryRaw : [calendarEntryRaw];
  // Use the first not-yet-done key as the "primary" today session. The
  // second (if any) renders as a secondary stacked card below.
  const primaryTodayKey = todayKeys.find((k) => !completedDays.has(k)) ?? todayKeys[0] ?? null;
  const secondaryTodayKey = todayKeys.find((k) => k !== primaryTodayKey) ?? null;
  const calendarEntry = primaryTodayKey;
  const isCalendarWorkoutDay = calendarEntry != null;
  const calDayIdx = isCalendarWorkoutDay ? parseInt(calendarEntry.split(':')[0]) : -1;
  const calWeekIdx = isCalendarWorkoutDay ? parseInt(calendarEntry.split(':')[1]) : -1;
  const calendarSessionDone = isCalendarWorkoutDay && todayKeys.every((k) => completedDays.has(k));
  const displayWeekAllDone = activeDays.every((_, i) => completedDays.has(`${i}:${displayWeek}`));
  const isRestState = !isCalendarWorkoutDay || calendarSessionDone || displayWeekAllDone;
  const isRestDay = !isCalendarWorkoutDay && !todayCardioSlot;

  const todayMesoDay = isCalendarWorkoutDay ? activeDays[calDayIdx] : null;
  const showDayWeek = isCalendarWorkoutDay ? calWeekIdx : activeWeek;
  const showDay = !isRestState && todayMesoDay ? todayMesoDay : nextDay;
  const showDayIdx = !isRestState && todayMesoDay ? calDayIdx : nextDayIdx;
  const showDayAccent = showDay
    ? (TAG_ACCENT as Record<string, any>)[showDay.tag || ''] || 'var(--accent)'
    : nextDayAccent;
  const isToday = isCalendarWorkoutDay && !calendarSessionDone;

  const preview = showDay?.exercises || [];
  const lastWeekData: Record<string, any> = (() => {
    for (let w = (isToday ? calWeekIdx : activeWeek) - 1; w >= 0; w--) {
      const raw = store.get(`foundry:day${showDayIdx}:week${w}`);
      if (raw)
        try {
          return JSON.parse(raw);
        } catch { /* JSON parse fallback */ }
    }
    return {};
  })();

  const doneLabel = calendarSessionDone
    ? activeDays[calDayIdx]?.label || ''
    : activeDays[activeDays.length - 1]?.label || '';

  // Onboarding v2: signal that Home mounted so the CoachMarkOrchestrator
  // can arm the 2s dwell timer for the phase-bar mark. The `establish`
  // mark fires from DayView when the user actually opens day 0/week 0 —
  // not here on Home mount.
  React.useEffect(() => {
    window.dispatchEvent(new Event('foundry:home-mounted'));
  }, []);

  return (
    <div
      style={{
        padding: '16px 16px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* ═══ PRIMARY ZONE: Welcome ribbon (first session only) ═══ */}
      <WelcomeRibbon name={profile?.name} />

      {/* ═══ PRIMARY ZONE: Local-only reminder for anonymous users ═══ */}
      <AnonLocalBanner />

      {/* ═══ PRIMARY ZONE: Greeting + Dashboard + Today ═══ */}

      {/* Greeting */}
      {profile?.name && (
        <div
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            letterSpacing: '0.01em',
          }}
        >
          {getTimeGreeting()},{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{profile.name?.split(/\s+/)[0] || profile.name}</span>.
        </div>
      )}

      {/* Unified Dashboard Card — tap opens Progress. Weekly workout bar
          replaces the meso ring and day pills. Subtle neutral chrome —
          the orange weekly-bar segments inside do the visual work. */}
      <button
        onClick={() => goTo('progress')}
        aria-label="Open progress"
        style={{
          width: '100%',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          padding: '16px 16px 14px 16px',
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          color: 'inherit',
          transition: 'border-color 0.15s, transform 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-border, rgba(232,101,26,0.3))'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
      >
        {/* Header row: phase chip · WK · done/total · RIR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span
            style={{
              fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', color: pc,
              background: pc + '18', padding: '2px 8px', borderRadius: tokens.radius.sm,
              textTransform: 'uppercase', lineHeight: 1.2,
            }}
          >
            {phase}
          </span>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>
            WK {displayWeek + 1} / {getMeso().totalWeeks}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
              letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {weekDone}/{weekTotal} · {rir}
          </span>
        </div>

        {/* Weekly workout bar — one segment per training day.
            Convention (matches Focus Mode + Progress):
              done     → phase color + soft glow
              current  → greyish-white (no pulse)
              upcoming → dim grey */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${activeDays.length}, 1fr)`,
            gap: 4,
            alignItems: 'end',
          }}
        >
          {activeDays.map((day, i) => {
            const done = completedDays.has(`${i}:${displayWeek}`);
            const isCurrent = !done && activeDays.slice(0, i).every((_, j) => completedDays.has(`${j}:${displayWeek}`));
            const segStyle: React.CSSProperties = {
              height: 10,
              borderRadius: 3,
              background: 'var(--border-subtle, var(--border))',
              transition: 'background 200ms',
            };
            if (done) {
              segStyle.background = pc;
              segStyle.boxShadow = `0 0 6px ${pc}88`;
            } else if (isCurrent) {
              segStyle.background = 'var(--text-secondary)';
            }
            const tagColor = done
              ? pc
              : isCurrent
              ? 'var(--text-primary)'
              : 'var(--text-muted)';
            const label = day.label || day.tag || `Day ${i + 1}`;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <div style={{ textAlign: 'center', minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: isCurrent ? 800 : 700,
                      letterSpacing: '0.04em',
                      color: tagColor,
                      textTransform: 'uppercase',
                      lineHeight: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </div>
                </div>
                <div style={segStyle} aria-label={`${label}: ${done ? 'done' : isCurrent ? 'current' : 'upcoming'}`} />
              </div>
            );
          })}
        </div>
      </button>

      {/* Mobility streak pill — subtle gold chip, hidden at 0 */}
      {mobilityStreak > 0 && (
        <div
          role="status"
          aria-label={`Mobility streak ${mobilityStreak} day${mobilityStreak === 1 ? '' : 's'}`}
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: MOBILITY_COLOR,
            background: `${MOBILITY_COLOR}18`,
            border: `1px solid ${MOBILITY_COLOR}44`,
            borderRadius: tokens.radius.pill,
            padding: '4px 10px',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={MOBILITY_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
          MOBILITY STREAK · {mobilityStreak} DAY{mobilityStreak === 1 ? '' : 'S'}
        </div>
      )}

      {/* Pre-workout mobility — workout days only, collapsed by default, above the Today Card */}
      {isToday && showDay && (() => {
        const warmupProtocol = pickWarmupForDay(showDay?.tag);
        const startWarmup = () => {
          // Match MobilityProtocolDetail.handleStart: seed today's session
          // with the warmup protocol id (uncompleted), then jump into the
          // mobility session view. MobilitySessionView marks completed:true
          // when the user finishes — that's what increments the streak.
          const today = new Date().toISOString().slice(0, 10);
          saveMobilitySession(today, {
            protocolId: warmupProtocol.id,
            completed: false,
            completedAt: null,
          });
          window.dispatchEvent(
            new CustomEvent('foundry:openMobility', {
              detail: { dateStr: today, protocolId: warmupProtocol.id },
            }),
          );
        };
        return (
          <div
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                width: '100%', background: 'var(--bg-inset)',
                borderBottom: showMorningMobility ? '1px solid var(--border)' : 'none',
                padding: '10px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}
            >
              <button
                onClick={() => setShowMorningMobility((p: boolean) => !p)}
                aria-expanded={showMorningMobility}
                aria-label={showMorningMobility ? 'Hide warmup moves' : 'Show warmup moves'}
                style={{
                  flex: 1, minWidth: 0,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: 0, textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                    BEFORE YOU TRAIN
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.02em', color: 'var(--text-primary)' }}>
                    {warmupProtocol.name.toUpperCase()} · {warmupProtocol.duration.toUpperCase()}
                  </span>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ marginLeft: 'auto', transform: showMorningMobility ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <button
                onClick={startWarmup}
                aria-label={`Start ${warmupProtocol.name} warmup`}
                style={{
                  fontSize: 13, fontWeight: 800, color: showDayAccent,
                  background: showDayAccent + '18', border: `1px solid ${showDayAccent}44`,
                  borderRadius: tokens.radius.md, padding: '6px 12px', letterSpacing: '0.06em',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                START <span aria-hidden="true">▶</span>
              </button>
            </div>
            {showMorningMobility && (
              <div style={{ padding: '12px 16px' }}>
                {warmupProtocol.moves.map((move, i) => (
                  <div key={i} style={{ padding: '9px 12px', borderRadius: tokens.radius.md, background: 'var(--bg-deep)', marginBottom: 5, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{move.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em', flexShrink: 0 }}>{move.reps}</div>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{move.cue}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Today Card — THE HERO. Resume CTA wins regardless of rest-state /
          rest-day, because an in-progress workout is the user's #1 thing
          to act on. Falls through to RestStateCard / TodayCard otherwise. */}
      {activeSession?.kind === 'lifting' ? (
        // ── Active lifting session in progress ─────────────────────────
        // Replaces whatever the today area would normally show with a
        // single big CTA so the user lands on Home, sees instantly that a
        // workout is active, and one tap returns them to it. Resolves the
        // longstanding flagged_continue_workout_cta concern.
        (() => {
          const route = activeSession.route;
          const m = route.match(/^\/day\/(\d+)\/(\d+)$/);
          const resumeDayIdx = m ? parseInt(m[1], 10) : showDayIdx;
          const resumeWeekIdx = m ? parseInt(m[2], 10) : showDayWeek;
          const setsDone = activeSession.setsDone ?? 0;
          const totalSets = activeSession.totalSets ?? 0;
          const pct = totalSets > 0 ? Math.min(1, setsDone / totalSets) : 0;
          return (
            <button
              type="button"
              onClick={() => { goBack(); onSelectDayWeek(resumeDayIdx, resumeWeekIdx); }}
              aria-label={`Resume ${activeSession.label}`}
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                border: '1px solid var(--accent)',
                borderLeft: '4px solid var(--accent)',
                borderRadius: tokens.radius.lg,
                padding: '20px 18px',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                color: 'inherit',
                boxShadow: '0 4px 24px rgba(232,101,26,0.22)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, rgba(232,101,26,0.10) 0%, transparent 60%)',
                  pointerEvents: 'none',
                }}
              />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      boxShadow: '0 0 8px rgba(232,101,26,0.7)',
                      animation: 'resumePulse 1.4s ease-in-out infinite',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'var(--accent)',
                    }}
                  >
                    Workout in progress
                  </span>
                </div>
                {totalSets > 0 && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {setsDone}/{totalSets} sets
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                    fontSize: 30,
                    lineHeight: 1.05,
                    letterSpacing: '0.02em',
                    color: 'var(--text-primary)',
                    fontWeight: 400,
                  }}
                >
                  Resume Workout
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {activeSession.label}
                </div>
              </div>
              {/* Live rest-timer readout — surfaces the countdown on the
                  Home CTA so the lifter sees how long they've got before
                  the next set even from the home tab. */}
              {restTimer && restTimer.remaining > 0 && (
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: tokens.radius.sm,
                    background: 'rgba(232,101,26,0.08)',
                    border: '1px solid rgba(232,101,26,0.22)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.16em',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Rest
                  </span>
                  <span
                    style={{
                      fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                      fontSize: 26,
                      color: 'var(--accent)',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '0.02em',
                      fontWeight: 400,
                      lineHeight: 1,
                    }}
                  >
                    {String(Math.floor(restTimer.remaining / 60)).padStart(2, '0')}:
                    {String(restTimer.remaining % 60).padStart(2, '0')}
                  </span>
                </div>
              )}
              {restTimer && restTimer.remaining === 0 && (
                <div
                  style={{
                    position: 'relative',
                    padding: '10px 12px',
                    borderRadius: tokens.radius.sm,
                    background: 'rgba(232,101,26,0.16)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}
                >
                  Rest complete · Next set
                </div>
              )}
              {totalSets > 0 && (
                <div
                  style={{
                    position: 'relative',
                    height: 4,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct * 100}%`,
                      height: '100%',
                      background: 'var(--accent)',
                      boxShadow: '0 0 6px rgba(232,101,26,0.6)',
                      transition: 'width 200ms',
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                }}
              >
                Get back to it <span aria-hidden="true" style={{ marginLeft: 6 }}>→</span>
              </div>
              <style>{`
                @keyframes resumePulse {
                  0%, 100% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.4); opacity: 0.6; }
                }
              `}</style>
            </button>
          );
        })()
      ) : isRestState || isRestDay ? (
        <RestStateCard
          displayWeekAllDone={displayWeekAllDone}
          calendarSessionDone={calendarSessionDone}
          nextDay={nextDay}
          nextDayIdx={nextDayIdx}
          nextDayForCollapse={nextDay}
          nextDayIdxForCollapse={nextDayIdx}
          nextSessionDateStr={nextSessionDateStr}
          doneLabel={doneLabel}
          activeDays={activeDays}
          displayWeek={displayWeek}
          completedDays={completedDays}
          showRecoveryOpen={showRecoveryMorning}
          setShowRecoveryOpen={setShowRecoveryMorning}
          showNextSession={showNextSession}
          setShowNextSession={setShowNextSession}
          activeWeek={activeWeek}
          goBack={goBack}
          onSelectDayWeek={onSelectDayWeek}
        />
      ) : (
        <>
        {/* Double-booked banner — only when today has 2 scheduled sessions */}
        {todayKeys.length > 1 && (
          <div
            data-testid="today-double-banner"
            role="status"
            style={{
              padding: '10px 14px',
              borderRadius: tokens.radius.md,
              background: 'var(--phase-peak)14',
              border: '1px solid var(--phase-peak)55',
              fontSize: 13,
              color: 'var(--text-primary)',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: 'var(--phase-peak)' }}>2 workouts today.</strong> Tap either
            card to start.
          </div>
        )}
        <div
          data-tour="today-card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); goBack(); onSelectDayWeek(showDayIdx, showDayWeek); }}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle, var(--border))',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <div style={{ fontSize: 14, color: 'var(--phase-accum)', fontWeight: 700, letterSpacing: '0.06em' }}>
                  {isToday ? 'TODAY' : 'NEXT SESSION'}
                </div>
                {isToday && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
                    · {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                  fontSize: 26,
                  fontWeight: 400,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.02em',
                  lineHeight: 1.05,
                }}
              >
                {showDay!.label}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>
                Week {showDayWeek + 1} · Day {showDayIdx + 1}
              </div>
            </div>
            <div
              style={{
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                background: 'transparent',
                border: '1px solid var(--accent-border, rgba(232,101,26,0.3))',
                borderRadius: tokens.radius.md,
                padding: '8px 16px',
              }}
            >
              {/* Continue-vs-Start logic moved upstream — this branch only
                  renders when there's no active lifting session, so the
                  pill is always Start now. Outline-orange treatment matches
                  the REORDER button in Focus Mode (cooler than a filled
                  orange chip). */}
              Start <span aria-hidden="true">→</span>
            </div>
          </button>
          <div style={{ padding: '6px 0 2px' }}>
            {preview.map((ex: Exercise, ei: number) => {
              const prevData = lastWeekData[ei];
              const prevSets = prevData
                ? (Object.values(prevData) as Record<string, unknown>[]).filter((s) => s && s.weight && parseFloat(String(s.weight)) > 0)
                : [];
              const prevWeight = prevSets.length > 0 ? (prevSets[0] as Record<string, unknown>).weight : null;
              const ovId = store.get(`foundry:exov:d${showDayIdx}:ex${ei}`) || null;
              const dbEx = ovId ? findExercise(ovId) : null;
              return (
                <div
                  key={ei}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 16px',
                    borderBottom: ei < preview.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {dbEx ? dbEx.name : ex.name}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 1 }}>
                      {getWeekSets(Number(ex.sets) || 0, showDayWeek, getMeso().totalWeeks)} sets · {ex.reps} reps{ex.rest ? ` · ${ex.rest}` : ''}
                    </div>
                  </div>
                  {!!prevWeight && (
                    <div style={{ flexShrink: 0, marginLeft: 10, textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{String(prevWeight)}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>last wk</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {isToday && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 12px' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowSkipConfirm({ dayIdx: showDayIdx, weekIdx: showDayWeek }); }}
                style={{
                  width: '100%', background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: tokens.radius.md, color: 'var(--text-muted)',
                  fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', padding: '8px', cursor: 'pointer',
                }}
              >
                Skip Today's Session
              </button>
            </div>
          )}
        </div>
        {secondaryTodayKey && (() => {
          const [sdIdxStr, swIdxStr] = secondaryTodayKey.split(':');
          const sdIdx = Number(sdIdxStr);
          const swIdx = Number(swIdxStr);
          const sday = activeDays[sdIdx];
          if (!sday) return null;
          const sAccent = (TAG_ACCENT as Record<string, string>)[sday.tag || ''] || 'var(--accent)';
          const sDone = completedDays.has(secondaryTodayKey);
          return (
            <div
              data-testid="today-secondary-card"
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${sAccent}55`,
                borderLeft: `4px solid ${sAccent}`,
                borderRadius: tokens.radius.lg,
                overflow: 'hidden',
                boxShadow: `0 2px 16px ${sAccent}15`,
                marginTop: 8,
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); goBack(); onSelectDayWeek(sdIdx, swIdx); }}
                style={{
                  width: '100%', background: `linear-gradient(135deg, ${sAccent}0d 0%, transparent 100%)`,
                  border: 'none', cursor: 'pointer', padding: '14px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, color: 'var(--phase-peak)', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 3 }}>
                    {sDone ? 'SECOND WORKOUT · DONE' : 'SECOND WORKOUT · TODAY'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                    {sday.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Week {swIdx + 1} · Day {sdIdx + 1}
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0, fontSize: 14, fontWeight: 800, color: sAccent,
                    background: sAccent + '18', border: `1px solid ${sAccent}44`,
                    borderRadius: tokens.radius.md, padding: '6px 12px', letterSpacing: '0.04em',
                  }}
                >
                  {sDone ? 'View' : 'Start'} <span aria-hidden="true">→</span>
                </div>
              </button>
            </div>
          );
        })()}
        </>
      )}

      {/* ═══ SECTION DIVIDER ═══ */}
      <SectionDivider />

      {/* ═══ SECONDARY ZONE: Supporting actions ═══ */}

      {/* Cardio card */}
      {todayCardioSlot ? (
        <button
          data-tour="cardio-card"
          onClick={() => onOpenCardio(todayCardioStr, todayCardioSlot.protocol)}
          style={{
            width: '100%', background: 'var(--bg-card)',
            border: `1px solid ${todayCardioSession?.completed ? '#D4983C44' : CARDIO_COLOR + '44'}`,
            borderRadius: tokens.radius.lg, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              background: todayCardioSession?.completed ? '#D4983C10' : `${CARDIO_COLOR}0d`,
              borderBottom: `1px solid ${todayCardioSession?.completed ? '#D4983C30' : CARDIO_COLOR + '22'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={todayCardioSession?.completed ? tokens.colors.gold : CARDIO_COLOR}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: todayCardioSession?.completed ? tokens.colors.gold : CARDIO_COLOR }}>
                {todayCardioSession?.completed ? 'CARDIO DONE ✓' : 'CARDIO TODAY'}
              </span>
            </div>
            {!todayCardioSession?.completed && (
              <span style={{
                fontSize: 14, fontWeight: 800, letterSpacing: '0.06em', color: CARDIO_COLOR,
                background: `${CARDIO_COLOR}18`, border: `1px solid ${CARDIO_COLOR}44`,
                borderRadius: tokens.radius.md, padding: '4px 10px',
              }}>
                START <span aria-hidden="true">▶</span>
              </span>
            )}
          </div>
          {(() => {
            const proto = CARDIO_WORKOUTS.find((w) => w.id === todayCardioSlot.protocol);
            return (
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {proto ? proto.label : todayCardioSlot.protocol}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {proto ? (proto.description?.split('.')[0] ?? proto.description) + '.' : 'Cardio session'}
                  </div>
                </div>
                {proto?.intervals && !todayCardioSession?.completed && (
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginLeft: 10 }}>
                    {[
                      { label: 'WORK', val: `${proto.intervals.workSecs}s`, color: tokens.colors.cardioHard },
                      { label: 'REST', val: `${proto.intervals.restSecs}s`, color: tokens.colors.gold },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{
                        fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', color,
                        background: `${color}18`, border: `1px solid ${color}44`,
                        borderRadius: tokens.radius.sm, padding: '2px 6px', whiteSpace: 'nowrap',
                      }}>
                        {label} {val}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </button>
      ) : todayCardioSession?.completed ? (
        <button
          data-tour="cardio-card"
          onClick={() => onOpenCardio(todayCardioStr, null)}
          style={{
            width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg, padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tokens.colors.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: tokens.colors.gold }}>
              Cardio logged today ✓
            </span>
          </div>
          <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 700 }}>›</span>
        </button>
      ) : (() => {
        const rec = pickRecommendedCardio(profile?.goal as string | undefined);
        return (
          <button
            data-tour="cardio-card"
            onClick={() => onOpenCardio(todayCardioStr, rec.id)}
            style={{
              width: '100%', background: 'var(--bg-card)',
              border: `1px solid ${CARDIO_COLOR}44`,
              borderRadius: tokens.radius.lg, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                background: `${CARDIO_COLOR}0d`,
                borderBottom: `1px solid ${CARDIO_COLOR}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={CARDIO_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: CARDIO_COLOR }}>
                  RECOMMENDED CARDIO
                </span>
              </div>
              <span style={{
                fontSize: 14, fontWeight: 800, letterSpacing: '0.06em', color: CARDIO_COLOR,
                background: `${CARDIO_COLOR}18`, border: `1px solid ${CARDIO_COLOR}44`,
                borderRadius: tokens.radius.md, padding: '4px 10px',
              }}>
                START <span aria-hidden="true">▶</span>
              </span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {rec.label}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {(rec.description?.split('.')[0] ?? rec.description) + '.'}
                </div>
              </div>
              {rec.intervals && (
                <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginLeft: 10 }}>
                  {[
                    { label: 'WORK', val: `${rec.intervals.workSecs}s`, color: tokens.colors.cardioHard },
                    { label: 'REST', val: `${rec.intervals.restSecs}s`, color: tokens.colors.gold },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{
                      fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', color,
                      background: `${color}18`, border: `1px solid ${color}44`,
                      borderRadius: tokens.radius.sm, padding: '2px 6px', whiteSpace: 'nowrap',
                    }}>
                      {label} {val}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </button>
        );
      })()}

      <div style={{ height: 8 }} />
    </div>
  );
}

export default React.memo(HomeTab);
