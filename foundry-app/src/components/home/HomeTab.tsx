import React from 'react';
import {
  TAG_ACCENT,
  getMeso,
  DAILY_MOBILITY,
  CARDIO_WORKOUTS,
  FOUNDRY_COOLDOWN,
} from '../../data/constants';
import { tokens } from '../../styles/tokens';
import { findExercise } from '../../data/exerciseDB';
import {
  store,
  loadCardioSession,
  getTimeGreeting,
  getWeekSets,
  buildSessionDateMap,
} from '../../utils/store';
import WelcomeRibbon from './WelcomeRibbon';
import AnonLocalBanner from './AnonLocalBanner';
import MobilityCard from './MobilityCard';
import type { Profile, TrainingDay, Exercise, CardioScheduleSlot } from '../../types';

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

      {/* Next session preview */}
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
              background: 'transparent',
              border: 'none',
              padding: '12px 16px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>
                NEXT SESSION
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
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
                          {getWeekSets(Number(ex.sets) || 0, activeWeek, getMeso().weeks)} sets · {ex.reps} reps{ex.rest ? ` · ${ex.rest}` : ''}
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
                    width: '100%', padding: '10px', borderRadius: tokens.radius.md, cursor: 'pointer',
                    background: 'var(--btn-primary-bg)', border: '1px solid var(--btn-primary-border)',
                    color: 'var(--btn-primary-text)', fontSize: 14, fontWeight: 700, letterSpacing: '0.04em',
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
  weekPct,
  mesoPct,
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
  onOpenMobility,
  setShowPricing: _setShowPricing,
}: HomeTabProps) {
  const todayCardioStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const todayDow = new Date().getDay();
  const cardioSchedule = profile?.cardioSchedule || [];
  const todayCardioSlot = cardioSchedule.find((s: CardioScheduleSlot) => s.dayOfWeek === todayDow) || null;
  const todayCardioSession = loadCardioSession(todayCardioStr);
  const CARDIO_COLOR = TAG_ACCENT['CARDIO'];

  const nextDayIdx = activeDays.findIndex((_, i) => !completedDays.has(`${i}:${activeWeek}`));
  const nextDay = nextDayIdx >= 0 ? activeDays[nextDayIdx] : null;
  const nextDayAccent = nextDay ? (TAG_ACCENT as Record<string, string>)[nextDay.tag || ''] : 'var(--accent)';

  // Build sessionDateMap via the shared helper so HomeTab and ScheduleTab
  // agree on which date hosts which session — including per-date overrides
  // that may stack 2 sessions on one day.
  const sessionDateMap = buildSessionDateMap(profile, activeDays.length, getMeso().weeks);

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
  const showDayAccent = showDay ? (TAG_ACCENT as Record<string, any>)[showDay.tag || ''] : nextDayAccent;
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

      {/* Unified Dashboard Card — meso ring + week status merged */}
      <button
        onClick={() => goTo('progress')}
        style={{
          width: '100%',
          background: 'var(--bg-card)',
          border: `1px solid ${pc}44`,
          borderRadius: tokens.radius.lg,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: `0 2px 10px ${pc}12`,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.15s, transform 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = pc; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = pc + '44'; e.currentTarget.style.transform = 'none'; }}
      >
        {/* Meso ring — compact inline */}
        {(() => {
          const r = 22, circ = 2 * Math.PI * r;
          const dash = circ * (mesoPct / 100);
          return (
            <svg width="54" height="54" viewBox="0 0 54 54" style={{ overflow: 'visible', flexShrink: 0 }}>
              <circle cx="27" cy="27" r={r} fill="none" stroke="var(--bg-inset)" strokeWidth="4" />
              <circle cx="27" cy="27" r={r} fill="none" stroke={pc} strokeWidth="4"
                strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ * 0.25} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)' }}
              />
              <text x="27" y="30" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text-primary)" fontFamily="inherit">
                {mesoPct}%
              </text>
            </svg>
          );
        })()}

        {/* Week info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', color: pc,
                background: pc + '18', padding: '2px 7px', borderRadius: tokens.radius.sm,
              }}
            >
              {phase.toUpperCase()}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>
              WK {displayWeek + 1}/{getMeso().weeks}
            </span>
            {phase !== 'Accumulation' && (
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 'auto' }}>
                {rir}
              </span>
            )}
          </div>

          {/* Day pills */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
            {activeDays.map((day, i) => {
              const done = completedDays.has(`${i}:${displayWeek}`);
              const isNext = !done && activeDays.slice(0, i).every((_, j) => completedDays.has(`${j}:${displayWeek}`));
              const tc = (TAG_ACCENT as Record<string, any>)[day.tag || ''];
              const accent = '#E8651A';
              return (
                <div
                  key={i}
                  onClick={(e) => { e.stopPropagation(); goBack(); onSelectDayWeek(i, activeWeek); }}
                  style={{
                    flex: 1, minWidth: 0, padding: '4px 2px', borderRadius: tokens.radius.xs,
                    border: `1px solid ${done ? tc + '60' : isNext ? accent : pc + '44'}`,
                    background: done ? tc + '1a' : isNext ? accent + '18' : 'transparent',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', color: done ? tc : isNext ? accent : 'var(--text-muted)' }}>
                    {({ PUSH: 'Push', PULL: 'Pull', LEGS: 'Legs', UPPER: 'Upper', LOWER: 'Lower', FULL: 'Full' } as Record<string, any>)[day.tag || ''] || day.tag}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1 }}>
                    {done ? <span style={{ color: tc }}>✓</span> : isNext ? <span style={{ color: accent }}>●</span> : <span style={{ color: 'var(--text-dim)' }}>·</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Week progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: tokens.radius.xs, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${weekPct}%`, background: pc, borderRadius: tokens.radius.xs, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
              {weekDone}/{weekTotal}
            </div>
          </div>
        </div>
      </button>

      {/* Today Card — THE HERO */}
      {isRestState || isRestDay ? (
        <RestStateCard
          displayWeekAllDone={displayWeekAllDone}
          calendarSessionDone={calendarSessionDone}
          nextDay={nextDay}
          nextDayIdx={nextDayIdx}
          nextDayForCollapse={nextDay}
          nextDayIdxForCollapse={nextDayIdx}
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
            border: `1px solid ${showDayAccent}55`,
            borderLeft: `4px solid ${showDayAccent}`,
            borderRadius: tokens.radius.lg,
            overflow: 'hidden',
            boxShadow: `0 2px 16px ${showDayAccent}15`,
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); goBack(); onSelectDayWeek(showDayIdx, showDayWeek); }}
            style={{
              width: '100%', background: `linear-gradient(135deg, ${showDayAccent}0d 0%, transparent 100%)`,
              border: 'none', cursor: 'pointer', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${showDayAccent}18`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = showDayAccent + '14')}
            onMouseLeave={(e) => (e.currentTarget.style.background = `linear-gradient(135deg, ${showDayAccent}0d 0%, transparent 100%)`)}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, color: 'var(--phase-accum)', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 3 }}>
                {isToday ? 'TODAY' : 'NEXT SESSION'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                {showDay!.label}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>
                Week {showDayWeek + 1} · Day {showDayIdx + 1}
              </div>
            </div>
            <div
              style={{
                flexShrink: 0, fontSize: 16, fontWeight: 800, color: showDayAccent,
                background: showDayAccent + '18', border: `1px solid ${showDayAccent}44`,
                borderRadius: tokens.radius.md, padding: '6px 14px', letterSpacing: '0.04em',
              }}
            >
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
                      {getWeekSets(Number(ex.sets) || 0, showDayWeek, getMeso().weeks)} sets · {ex.reps} reps{ex.rest ? ` · ${ex.rest}` : ''}
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
      ) : (
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={CARDIO_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {todayCardioSession?.completed ? 'Cardio logged today ✓' : 'Add a cardio session'}
            </span>
          </div>
          <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 700 }}>+</span>
        </button>
      )}

      {/* Pre-workout mobility — workout days only */}
      {isToday && showDay && (
        <div
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
          }}
        >
          <button
            onClick={() => setShowMorningMobility((p: boolean) => !p)}
            style={{
              width: '100%', background: 'var(--bg-inset)', border: 'none',
              borderBottom: '1px solid var(--border)', padding: '10px 16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                BEFORE YOU TRAIN
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {showDay.tag && (
                <span style={{
                  fontSize: 14, fontWeight: 700, color: showDayAccent,
                  background: showDayAccent + '18', border: `1px solid ${showDayAccent}33`,
                  borderRadius: tokens.radius.sm, padding: '2px 8px', letterSpacing: '0.06em',
                }}>
                  {showDay.tag}
                </span>
              )}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: showMorningMobility ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </button>
          {showMorningMobility && (
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
                DAILY MOBILITY · {DAILY_MOBILITY.length} MOVES
              </div>
              {DAILY_MOBILITY.map((move, i) => (
                <div key={i} style={{ padding: '9px 12px', borderRadius: tokens.radius.md, background: 'var(--bg-deep)', marginBottom: 5, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{move.name}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{move.cue}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobility soft CTA */}
      <MobilityCard todayCardioStr={todayCardioStr} onOpenMobility={onOpenMobility} />

      <div style={{ height: 8 }} />
    </div>
  );
}

export default React.memo(HomeTab);
