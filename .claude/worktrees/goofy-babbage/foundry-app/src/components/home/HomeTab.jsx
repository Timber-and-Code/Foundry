import React from 'react';
import {
  TAG_ACCENT, getMeso,
  DAILY_MOBILITY, CARDIO_WORKOUTS, FOUNDRY_COOLDOWN,
} from '../../data/constants';
import { EXERCISE_DB } from '../../data/exercises';
import {
  store,
  loadCardioSession, loadMobilitySession,
  getWorkoutDaysForWeek, getReadinessScore, getReadinessLabel, getTimeGreeting,
} from '../../utils/store';

// ── ReadinessCard ──────────────────────────────────────────────────────────

function ReadinessCard({ readiness, readinessOpen, setReadinessOpen, updateReadiness }) {
  const score = getReadinessScore(readiness);
  const rl    = getReadinessLabel(score);
  const SIGNALS = [
    { key: 'sleep',    label: 'Sleep',    opts: [{ val: 'poor', label: 'Poor' }, { val: 'ok', label: 'OK' }, { val: 'good', label: 'Good' }] },
    { key: 'soreness', label: 'Soreness', opts: [{ val: 'high', label: 'High' }, { val: 'moderate', label: 'Moderate' }, { val: 'low', label: 'Low' }] },
    { key: 'energy',   label: 'Energy',   opts: [{ val: 'low', label: 'Low' }, { val: 'moderate', label: 'Moderate' }, { val: 'high', label: 'High' }] },
  ];
  const allFilled = readiness?.sleep && readiness?.soreness && readiness?.energy;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <button onClick={() => setReadinessOpen(o => !o)} style={{ width: '100%', background: 'var(--bg-inset)', border: 'none', borderBottom: readinessOpen ? '1px solid var(--border)' : 'none', padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--phase-accum)' }}>READINESS</span>
          {allFilled && rl && (
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: rl.color, background: rl.color + '22', border: `1px solid ${rl.color}44`, borderRadius: 4, padding: '2px 7px' }}>{rl.label}</span>
          )}
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: readinessOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      {readinessOpen && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SIGNALS.map(sig => (
            <div key={sig.key}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', color: '#F29A52', marginBottom: 6 }}>{sig.label.toUpperCase()}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {sig.opts.map(opt => {
                  const sel = readiness?.[sig.key] === opt.val;
                  return (
                    <button key={opt.val} onClick={() => updateReadiness(sig.key, opt.val)} style={{ flex: 1, padding: '9px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', background: sel ? 'rgba(var(--accent-rgb),0.18)' : 'var(--bg-deep,#0e0c0a)', border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-accent)'}`, color: sel ? 'var(--accent)' : 'var(--text-primary)', transition: 'all 0.12s' }}>{opt.label}</button>
                  );
                })}
              </div>
            </div>
          ))}
          {allFilled && rl && (
            <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 6, background: rl.color + '18', border: `1px solid ${rl.color}44`, borderLeft: `3px solid ${rl.color}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: rl.color, marginBottom: 2 }}>{rl.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{rl.advice}</div>
            </div>
          )}
        </div>
      )}
      {!readinessOpen && allFilled && rl && (
        <div style={{ padding: '8px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rl.advice}</div>
        </div>
      )}
    </div>
  );
}

// ── RestStateCard ──────────────────────────────────────────────────────────

function RestStateCard({
  displayWeekAllDone, calendarSessionDone, nextDay, nextDayIdx, nextDayForCollapse,
  nextDayIdxForCollapse, doneLabel, activeDays, displayWeek, completedDays,
  showRecoveryMorning, setShowRecoveryMorning, showRecoveryTag, setShowRecoveryTag,
  showNextSession, setShowNextSession, activeWeek, goBack, setCurrentWeek, onSelectDay,
}) {
  // Shared mobility tag
  let homeMobilityTag = null;
  if (calendarSessionDone) {
    // handled by caller via displayWeek logic
  } else {
    outer: for (let w = displayWeek; w >= 0; w--) {
      for (let d = activeDays.length - 1; d >= 0; d--) {
        if (completedDays.has(`${d}:${w}`)) {
          homeMobilityTag = activeDays[d]?.tag || null;
          break outer;
        }
      }
    }
  }
  const homeMobilityMoves = homeMobilityTag && FOUNDRY_COOLDOWN[homeMobilityTag] ? FOUNDRY_COOLDOWN[homeMobilityTag] : null;

  const recoveryItems = [
    { title: 'Sleep', body: '8+ hours is the only thing that actually repairs muscle tissue. No supplement replaces it. Tonight, make sleep the priority.' },
    { title: 'Protein', body: 'Hit your target today even without training. Muscle protein synthesis continues in recovery — shortchanging protein now blunts your gains.' },
    { title: 'Walk', body: '20–30 minutes of easy walking clears metabolic waste and keeps blood moving through sore tissue. Low intensity, high return.' },
  ];

  // Week complete state
  if (displayWeekAllDone && !nextDay) {
    const lastDayTag = (() => {
      for (let d = activeDays.length - 1; d >= 0; d--) {
        if (completedDays.has(`${d}:${displayWeek}`)) return activeDays[d]?.tag || null;
      }
      return null;
    })();
    const weekCompleteMoves = lastDayTag && FOUNDRY_COOLDOWN[lastDayTag] ? FOUNDRY_COOLDOWN[lastDayTag] : null;
    const activeRecoveryItems = [
      { title: 'Sauna or Steam', body: 'Even 15–20 minutes of heat exposure improves circulation and helps clear soreness. If you have access, this is one of the best week-end recovery tools available.' },
      { title: 'Easy Cardio', body: 'A 20–30 min easy bike, walk, or swim keeps blood moving without adding stress. Keep intensity below 6/10 — this is recovery, not training.' },
      { title: 'Cold Finish', body: 'End your shower cold for 30–60 seconds. Reduces inflammation, improves mood, and signals your nervous system that it\'s time to recover.' },
    ];
    return (
      <div data-tour="today-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '12px 16px', background: 'var(--phase-accum)0d', borderBottom: '1px solid var(--phase-accum)22', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--phase-accum)' }}>WEEK COMPLETE</span>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>ACTIVE RECOVERY</div>
          {activeRecoveryItems.map((item, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg-deep)', marginBottom: 6, border: '1px solid var(--border-subtle)', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.body}</div>
            </div>
          ))}
          <button onClick={() => setShowRecoveryMorning(p => !p)} style={{ width: '100%', background: 'transparent', border: 'none', borderTop: '1px solid var(--border-subtle)', padding: '10px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>DAILY MOBILITY · 3 MOVES</div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showRecoveryMorning ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          {showRecoveryMorning && DAILY_MOBILITY.map((move, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg-deep)', marginBottom: 6, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{move.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{move.cue}</div>
            </div>
          ))}
          {weekCompleteMoves && (
            <>
              <button onClick={() => setShowRecoveryTag(p => !p)} style={{ width: '100%', background: 'transparent', border: 'none', borderTop: '1px solid var(--border-subtle)', padding: '10px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{lastDayTag} MOBILITY · 3 MOVES</div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showRecoveryTag ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              {showRecoveryTag && weekCompleteMoves.map((move, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg-deep)', marginBottom: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{move.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{move.cue}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  // Rest / recovery card (rest day or session done)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '12px 16px', background: calendarSessionDone ? 'var(--phase-accum)0d' : 'var(--bg-inset)', borderBottom: calendarSessionDone ? '1px solid var(--phase-accum)22' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {calendarSessionDone && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--phase-accum)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: calendarSessionDone ? 'var(--phase-accum)' : 'var(--text-muted)' }}>{calendarSessionDone ? 'TODAY · DONE' : 'REST DAY'}</span>
          </div>
          {doneLabel && calendarSessionDone && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{doneLabel}</span>}
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>RECOVERY ESSENTIALS</div>
          {recoveryItems.map((item, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg-deep)', marginBottom: 6, border: '1px solid var(--border-subtle)', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.body}</div>
            </div>
          ))}
          <button onClick={() => setShowRecoveryMorning(p => !p)} style={{ width: '100%', background: 'transparent', border: 'none', borderTop: '1px solid var(--border-subtle)', padding: '10px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>DAILY MOBILITY · 3 MOVES</div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showRecoveryMorning ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          {showRecoveryMorning && DAILY_MOBILITY.map((move, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg-deep)', marginBottom: 6, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{move.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{move.cue}</div>
            </div>
          ))}
          {homeMobilityMoves && (
            <>
              <button onClick={() => setShowRecoveryTag(p => !p)} style={{ width: '100%', background: 'transparent', border: 'none', borderTop: '1px solid var(--border-subtle)', padding: '10px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{homeMobilityTag} MOBILITY · 3 MOVES</div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showRecoveryTag ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              {showRecoveryTag && homeMobilityMoves.map((move, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg-deep)', marginBottom: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{move.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{move.cue}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      {nextDayForCollapse && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <button onClick={() => setShowNextSession(p => !p)} style={{ width: '100%', background: 'transparent', border: 'none', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>NEXT SESSION</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{nextDayForCollapse.label}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showNextSession ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          {showNextSession && (
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => { goBack(); setCurrentWeek(activeWeek); onSelectDay(nextDayIdxForCollapse); }} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0' }}>
                {nextDayForCollapse.exercises.map((ex, ei) => {
                  const ovId = store.get(`foundry:exov:d${nextDayIdxForCollapse}:ex${ei}`) || null;
                  const dbEx = ovId ? EXERCISE_DB.find(e => e.id === ovId) : null;
                  return (
                    <div key={ei} style={{ display: 'flex', padding: '8px 16px', borderBottom: ei < nextDayForCollapse.exercises.length - 1 ? '1px solid var(--border-subtle)' : 'none', textAlign: 'left' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dbEx ? dbEx.name : ex.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{ex.sets} sets · {ex.reps} reps{ex.rest ? ` · ${ex.rest}` : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </button>
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                <button onClick={() => { goBack(); setCurrentWeek(activeWeek); onSelectDay(nextDayIdxForCollapse); }} style={{ width: '100%', padding: '10px', borderRadius: 6, cursor: 'pointer', background: 'var(--btn-primary-bg)', border: '1px solid var(--btn-primary-border)', color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>Start {nextDayForCollapse.label} →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── HomeTab ────────────────────────────────────────────────────────────────

function HomeTab({
  profile, activeDays, completedDays,
  activeWeek, displayWeek,
  phase, pc, rir,
  weekDone, weekTotal, weekPct,
  mesoPct, doneSessions, totalSessions,
  readiness, readinessOpen, setReadinessOpen, updateReadiness,
  showRecoveryMorning, setShowRecoveryMorning,
  showRecoveryTag, setShowRecoveryTag,
  showNextSession, setShowNextSession,
  showMorningMobility, setShowMorningMobility,
  goTo, goBack, onSelectDay, onSelectDayWeek, setCurrentWeek,
  setShowSkipConfirm,
  onOpenCardio, onOpenMobility,
  setShowPricing,
}) {
  const todayCardioStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const todayDow = new Date().getDay();
  const cardioSchedule = profile?.cardioSchedule || [];
  const todayCardioSlot = cardioSchedule.find(s => s.dayOfWeek === todayDow) || null;
  const todayCardioSession = loadCardioSession(todayCardioStr);
  const CARDIO_COLOR = TAG_ACCENT['CARDIO'];

  const nextDayIdx = activeDays.findIndex((_, i) => !completedDays.has(`${i}:${activeWeek}`));
  const nextDay = nextDayIdx >= 0 ? activeDays[nextDayIdx] : null;
  const nextDayAccent = nextDay ? TAG_ACCENT[nextDay.tag] : 'var(--accent)';

  // Build sessionDateMap
  const startDate = profile?.startDate ? new Date(profile.startDate + 'T00:00:00') : null;
  const sessionDateMap = {};
  if (startDate && activeDays.length > 0) {
    const total = (getMeso().weeks + 1) * activeDays.length;
    let sc = 0, cursor = new Date(startDate);
    for (let d = 0; d < 400 && sc < total; d++) {
      const wkIdx = Math.floor(sc / activeDays.length);
      if (getWorkoutDaysForWeek(profile, wkIdx).includes(cursor.getDay())) {
        sessionDateMap[cursor.toISOString().slice(0, 10)] = `${sc % activeDays.length}:${wkIdx}`;
        sc++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const calendarEntry          = sessionDateMap[todayCardioStr];
  const isCalendarWorkoutDay   = calendarEntry != null;
  const calDayIdx              = isCalendarWorkoutDay ? parseInt(calendarEntry.split(':')[0]) : -1;
  const calWeekIdx             = isCalendarWorkoutDay ? parseInt(calendarEntry.split(':')[1]) : -1;
  const calendarSessionDone    = isCalendarWorkoutDay && completedDays.has(calendarEntry);
  const displayWeekAllDone     = activeDays.every((_, i) => completedDays.has(`${i}:${displayWeek}`));
  const isRestState            = !isCalendarWorkoutDay || calendarSessionDone || displayWeekAllDone;
  const isRestDay              = !isCalendarWorkoutDay && !todayCardioSlot;

  const todayMesoDay   = isCalendarWorkoutDay ? activeDays[calDayIdx] : null;
  const showDayWeek    = isCalendarWorkoutDay ? calWeekIdx : activeWeek;
  const showDay        = (!isRestState && todayMesoDay) ? todayMesoDay : nextDay;
  const showDayIdx     = (!isRestState && todayMesoDay) ? calDayIdx : nextDayIdx;
  const showDayAccent  = showDay ? TAG_ACCENT[showDay.tag] : nextDayAccent;
  const isToday        = isCalendarWorkoutDay && !calendarSessionDone;

  // Detect if today is a workout day (for readiness display)
  let _isWorkoutToday = false;
  if (startDate && activeDays.length > 0) {
    const _total = (getMeso().weeks + 1) * activeDays.length;
    let _sc = 0, _cursor = new Date(startDate);
    for (let _d = 0; _d < 400 && _sc < _total; _d++) {
      const _wkIdx = Math.floor(_sc / activeDays.length);
      if (getWorkoutDaysForWeek(profile, _wkIdx).includes(_cursor.getDay())) {
        if (_cursor.toISOString().slice(0, 10) === todayCardioStr) {
          const _dIdx = _sc % activeDays.length;
          if (!completedDays.has(`${_dIdx}:${_wkIdx}`)) _isWorkoutToday = true;
        }
        _sc++;
      }
      _cursor.setDate(_cursor.getDate() + 1);
    }
  }

  const preview = showDay?.exercises || [];
  const lastWeekData = (() => {
    for (let w = (isToday ? calWeekIdx : activeWeek) - 1; w >= 0; w--) {
      const raw = store.get(`foundry:day${showDayIdx}:week${w}`);
      if (raw) try { return JSON.parse(raw); } catch {}
    }
    return {};
  })();

  const doneLabel = calendarSessionDone ? (activeDays[calDayIdx]?.label || '') : (activeDays[activeDays.length - 1]?.label || '');

  return (
    <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Greeting */}
      {profile?.name && (
        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.01em', paddingBottom: 6 }}>
          {getTimeGreeting()}, <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{profile.name}</span>.
        </div>
      )}

      {/* Dashboard */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Top row: meso ring + week status */}
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Meso progress ring */}
          <button onClick={() => goTo('progress')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0, width: 104, boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = pc; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          >
            {(() => {
              const r = 26, circ = 2 * Math.PI * r;
              const dash = circ * (mesoPct / 100);
              return (
                <svg width="64" height="64" viewBox="0 0 64 64" style={{ overflow: 'visible' }}>
                  <circle cx="32" cy="32" r={r} fill="none" stroke="var(--bg-inset)" strokeWidth="5"/>
                  <circle cx="32" cy="32" r={r} fill="none" stroke={pc} strokeWidth="5" strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)' }}/>
                  <text x="32" y="35" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text-primary)" fontFamily="inherit">{mesoPct}%</text>
                </svg>
              );
            })()}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--phase-accum)' }}>MESO PROGRESS</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{doneSessions}/{totalSessions}</div>
            </div>
          </button>

          {/* Current week card */}
          <div style={{ flex: 1, background: 'var(--bg-card)', border: `1px solid ${pc}55`, borderRadius: 8, padding: '14px 14px', boxShadow: `0 2px 10px ${pc}18`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', color: pc, background: pc + '18', padding: '3px 7px', borderRadius: 4 }}>{phase.toUpperCase()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>WK {displayWeek + 1}/{getMeso().weeks}</div>
              </div>
              {phase !== 'Accumulation' && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{rir}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {activeDays.map((day, i) => {
                const done  = completedDays.has(`${i}:${displayWeek}`);
                const isNext = !done && activeDays.slice(0, i).every((_, j) => completedDays.has(`${j}:${displayWeek}`));
                const tc = TAG_ACCENT[day.tag];
                return (
                  <button key={i} onClick={(e) => { e.stopPropagation(); goBack(); onSelectDayWeek(i, activeWeek); }} style={{ flex: 1, minWidth: 0, padding: '6px 4px', borderRadius: 5, border: '1px solid', borderColor: done ? tc + '60' : isNext ? tc : pc + '55', background: done ? tc + '1a' : isNext ? tc + '12' : pc + '08', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', color: done ? tc : isNext ? tc : 'var(--text-muted)' }}>{{ PUSH: 'PU', PULL: 'PL', LEGS: 'LE', UPPER: 'UP', LOWER: 'LO', FULL: 'FB' }[day.tag] || day.tag.slice(0, 2)}</div>
                    <div style={{ fontSize: 12, lineHeight: 1 }}>
                      {done ? <span style={{ color: tc }}>✓</span> : isNext ? <span style={{ color: tc, fontSize: 12 }}>●</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>·</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${weekPct}%`, background: pc, borderRadius: 3, transition: 'width 0.5s ease' }}/>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>{weekDone}/{weekTotal}</div>
            </div>
          </div>
        </div>

        {/* Readiness card — only on non-workout days */}
        {!_isWorkoutToday && (
          <ReadinessCard
            readiness={readiness}
            readinessOpen={readinessOpen}
            setReadinessOpen={setReadinessOpen}
            updateReadiness={updateReadiness}
          />
        )}

        {/* Today card */}
        {(isRestState || isRestDay) ? (
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
            showRecoveryMorning={showRecoveryMorning}
            setShowRecoveryMorning={setShowRecoveryMorning}
            showRecoveryTag={showRecoveryTag}
            setShowRecoveryTag={setShowRecoveryTag}
            showNextSession={showNextSession}
            setShowNextSession={setShowNextSession}
            activeWeek={activeWeek}
            goBack={goBack}
            setCurrentWeek={setCurrentWeek}
            onSelectDay={onSelectDay}
          />
        ) : (
          <div data-tour="today-card" style={{ background: 'var(--bg-card)', border: `1px solid ${showDayAccent}30`, borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <button
              onClick={(e) => { e.stopPropagation(); goBack(); setCurrentWeek(showDayWeek); onSelectDay(showDayIdx); }}
              style={{ width: '100%', background: `linear-gradient(135deg, ${showDayAccent}0d 0%, transparent 100%)`, border: 'none', cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${showDayAccent}18` }}
              onMouseEnter={e => e.currentTarget.style.background = showDayAccent + '14'}
              onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${showDayAccent}0d 0%, transparent 100%)`}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, color: 'var(--phase-accum)', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 2 }}>{isToday ? 'TODAY' : 'NEXT SESSION'}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Week {showDayWeek + 1} · Day {showDayIdx + 1}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{showDay.label}</div>
              </div>
              <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: showDayAccent, letterSpacing: '0.02em' }}>Start →</div>
            </button>
            <div style={{ padding: '8px 0 4px' }}>
              {preview.map((ex, ei) => {
                const prevData = lastWeekData[ei];
                const prevSets = prevData ? Object.values(prevData).filter(s => s && s.weight && parseFloat(s.weight) > 0) : [];
                const prevWeight = prevSets.length > 0 ? prevSets[0].weight : null;
                const ovId = store.get(`foundry:exov:d${showDayIdx}:ex${ei}`) || null;
                const dbEx = ovId ? EXERCISE_DB.find(e => e.id === ovId) : null;
                return (
                  <div key={ei} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: ei < preview.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dbEx ? dbEx.name : ex.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{ex.sets} sets · {ex.reps} reps{ex.rest ? ` · ${ex.rest}` : ''}</div>
                    </div>
                    {prevWeight && (
                      <div style={{ flexShrink: 0, marginLeft: 10, textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{prevWeight}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>last wk</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {isToday && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 12px' }}>
                <button
                  onClick={e => { e.stopPropagation(); setShowSkipConfirm({ dayIdx: showDayIdx, weekIdx: showDayWeek }); }}
                  style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', padding: '8px', cursor: 'pointer' }}
                >Skip Today's Session</button>
              </div>
            )}
          </div>
        )}

        {/* Cardio card */}
        {todayCardioSlot ? (
          <button data-tour="cardio-card" onClick={() => onOpenCardio(todayCardioStr, todayCardioSlot.protocol)} style={{ width: '100%', background: 'var(--bg-card)', border: `1px solid ${todayCardioSession?.completed ? '#D4983C44' : CARDIO_COLOR + '44'}`, borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ padding: '12px 16px', background: todayCardioSession?.completed ? '#D4983C10' : `${CARDIO_COLOR}0d`, borderBottom: `1px solid ${todayCardioSession?.completed ? '#D4983C30' : CARDIO_COLOR + '22'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={todayCardioSession?.completed ? '#D4983C' : CARDIO_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: todayCardioSession?.completed ? '#D4983C' : CARDIO_COLOR }}>{todayCardioSession?.completed ? 'CARDIO DONE ✓' : 'CARDIO TODAY'}</span>
              </div>
              {!todayCardioSession?.completed && (
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: CARDIO_COLOR, background: `${CARDIO_COLOR}18`, border: `1px solid ${CARDIO_COLOR}44`, borderRadius: 6, padding: '4px 10px' }}>START ▶</span>
              )}
            </div>
            {(() => {
              const proto = CARDIO_WORKOUTS.find(w => w.id === todayCardioSlot.protocol);
              return (
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{proto ? proto.label : todayCardioSlot.protocol}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{proto ? (proto.description?.split('.')[0] ?? proto.description) + '.' : 'Cardio session'}</div>
                  </div>
                  {proto?.intervals && !todayCardioSession?.completed && (
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginLeft: 10 }}>
                      {[{ label: 'WORK', val: `${proto.intervals.workSecs}s`, color: '#E75831' }, { label: 'REST', val: `${proto.intervals.restSecs}s`, color: '#D4983C' }].map(({ label, val, color }) => (
                        <div key={label} style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>{label} {val}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </button>
        ) : (
          <button data-tour="cardio-card" onClick={() => onOpenCardio(todayCardioStr, null)} style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-xs)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={CARDIO_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{todayCardioSession?.completed ? 'Cardio logged today ✓' : 'Add a cardio session'}</span>
            </div>
            <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>+</span>
          </button>
        )}

        {/* Pre-workout mobility card — only on today's workout */}
        {isToday && showDay && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <button onClick={() => setShowMorningMobility(p => !p)} style={{ width: '100%', background: 'var(--bg-inset)', border: 'none', borderBottom: '1px solid var(--border)', padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>BEFORE YOU TRAIN</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {showDay.tag && <span style={{ fontSize: 11, fontWeight: 700, color: showDayAccent, background: showDayAccent + '18', border: `1px solid ${showDayAccent}33`, borderRadius: 4, padding: '2px 8px', letterSpacing: '0.06em' }}>{showDay.tag}</span>}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showMorningMobility ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
            {showMorningMobility && (
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>DAILY MOBILITY · 3 MOVES</div>
                {DAILY_MOBILITY.map((move, i) => (
                  <div key={i} style={{ padding: '9px 12px', borderRadius: 7, background: 'var(--bg-deep)', marginBottom: 5, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{move.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{move.cue}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mobility soft CTA */}
        {(() => {
          const MOBILITY_COLOR = '#D4983C';
          const todayMobilitySession = loadMobilitySession(todayCardioStr);
          return (
            <button onClick={() => onOpenMobility(todayCardioStr)} style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={MOBILITY_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2"/><path d="M12 8v4l3 3"/></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{todayMobilitySession?.completed ? 'Mobility done today ✓' : 'Add a mobility session'}</span>
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>+</span>
            </button>
          );
        })()}

        {/* Data management shortcut */}
        <button onClick={() => goTo('datamgmt')} style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Import / Export Data</span>
          </div>
          <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>›</span>
        </button>

        {/* Go Pro banner */}
        <button onClick={() => setShowPricing(true)} style={{ width: '100%', background: 'linear-gradient(135deg, #1A1410 0%, #221C14 50%, #2E2418 100%)', border: '1px solid var(--phase-peak)55', borderRadius: 8, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 16px rgba(212,152,60,0.15)', transition: 'transform 0.12s, border-color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--phase-peak)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--phase-peak)55'; e.currentTarget.style.transform = 'none'; }}
        >
          <div style={{ width: 42, height: 42, borderRadius: 8, flexShrink: 0, background: 'var(--phase-peak)22', border: '1px solid var(--phase-peak)44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--phase-peak)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>The Foundry Pro</span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--phase-peak)', background: 'var(--phase-peak)22', border: '1px solid var(--phase-peak)44', borderRadius: 4, padding: '1px 6px' }}>GET EARLY ACCESS</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>The Foundry builds your program · coaching intelligence · full history</div>
          </div>
          <div style={{ fontSize: 20, color: 'var(--phase-peak)', flexShrink: 0 }}>›</div>
        </button>

        <div style={{ height: 8 }}/>
      </div>
    </div>
  );
}

export default HomeTab;
