import React from 'react';
import { REST_QUOTES, FOUNDRY_MOBILITY, FOUNDRY_COOLDOWN, getMeso } from '../../data/constants';
import { getWorkoutDaysForWeek } from '../../utils/store';
import Sheet from '../ui/Sheet';

function RestDaySheet({ showRestDay, setShowRestDay, profile, activeDays, setAddWorkoutModal, setAddWorkoutStep, setAddWorkoutType, setAddWorkoutDayType }) {
  if (!showRestDay) return null;

  const dateHash = showRestDay.dateStr.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const restQuote = REST_QUOTES[dateHash % REST_QUOTES.length];

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = showRestDay.dateStr === todayStr;
  const displayLabel = isToday ? 'Today · Rest Day' : showRestDay.dateStr;

  let mobilityTag = null;
  let mobilityMoves = [];
  if (profile?.startDate && activeDays.length > 0) {
    const yesterday = new Date(showRestDay.dateStr + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    const startDate = new Date(profile.startDate + 'T00:00:00');
    let sc = 0;
    let cursor = new Date(startDate);
    const total = (getMeso().weeks + 1) * activeDays.length;
    for (let d = 0; d < 400 && sc < total; d++) {
      const wkIdx = Math.floor(sc / activeDays.length);
      if (getWorkoutDaysForWeek(profile, wkIdx).includes(cursor.getDay())) {
        if (cursor.toISOString().slice(0, 10) === yStr) {
          mobilityTag = activeDays[sc % activeDays.length]?.tag || null;
          break;
        }
        sc++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  if (mobilityTag && FOUNDRY_COOLDOWN[mobilityTag]) {
    mobilityMoves = FOUNDRY_COOLDOWN[mobilityTag];
  } else {
    mobilityMoves = [FOUNDRY_MOBILITY.PUSH[0], FOUNDRY_MOBILITY.PULL[0], FOUNDRY_MOBILITY.LEGS[0]];
  }

  let nextSessionLabel = null;
  if (profile?.startDate && activeDays.length > 0) {
    const startDate3 = new Date(profile.startDate + 'T00:00:00');
    let sc3 = 0;
    let cursor3 = new Date(startDate3);
    const total3 = (getMeso().weeks + 1) * activeDays.length;
    const fromDate = new Date(showRestDay.dateStr + 'T00:00:00');
    fromDate.setDate(fromDate.getDate() + 1);
    for (let d = 0; d < 400 && sc3 < total3; d++) {
      const wkIdx3 = Math.floor(sc3 / activeDays.length);
      if (getWorkoutDaysForWeek(profile, wkIdx3).includes(cursor3.getDay())) {
        if (cursor3 >= fromDate) {
          const nd = activeDays[sc3 % activeDays.length];
          if (nd) nextSessionLabel = `${nd.label} · W${wkIdx3 + 1} · ${nd.exercises?.length || 0} exercises`;
          break;
        }
        sc3++;
      }
      cursor3.setDate(cursor3.getDate() + 1);
    }
  }

  const recoveryItems = [
    { title: 'Sleep', body: '8+ hours is the only thing that actually repairs muscle tissue. No supplement replaces it. Tonight, make sleep the priority.' },
    { title: 'Protein', body: 'Hit your target today even without training. Muscle protein synthesis continues in recovery — shortchanging protein now blunts your gains from yesterday.' },
    { title: 'Walk', body: '20–30 minutes of easy walking clears metabolic waste and keeps blood moving through sore tissue. Low intensity, high return.' },
  ];

  return (
    <Sheet open={!!showRestDay} onClose={() => setShowRestDay(null)} zIndex={300}>
        <div style={{ padding: '8px 20px 36px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4 }}>REST DAY</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{displayLabel}</div>
            </div>
            <button onClick={() => setShowRestDay(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, lineHeight: 1, padding: '2px 6px', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>

          <div style={{ background: 'var(--bg-inset)', borderRadius: 8, padding: '14px 16px', marginBottom: 16, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.7, fontStyle: 'italic', marginBottom: 6 }}>"{restQuote.text}"</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textAlign: 'right' }}>— {restQuote.author}</div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>RECOVERY ESSENTIALS</div>
          {recoveryItems.map((item, i) => (
            <div key={i} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-deep)', marginBottom: 8, border: '1px solid var(--border-subtle)', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.body}</div>
            </div>
          ))}

          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', marginTop: 16, marginBottom: 10 }}>
            MOBILITY{mobilityTag ? ` · POST-${mobilityTag}` : ''}
          </div>
          {mobilityMoves.map((move, i) => (
            <div key={i} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-deep)', marginBottom: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 3 }}>{move.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{move.cue}</div>
            </div>
          ))}

          {nextSessionLabel && (
            <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 8, background: 'var(--accent)0d', border: '1px solid var(--accent)33' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.07em', color: 'var(--accent)', marginBottom: 4 }}>UP NEXT</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{nextSessionLabel}</div>
            </div>
          )}

          {!showRestDay.isPast && (
            <button onClick={() => { setShowRestDay(null); setAddWorkoutModal({ dateStr: showRestDay.dateStr }); setAddWorkoutStep('type'); setAddWorkoutType(null); setAddWorkoutDayType(null); }} style={{ width: '100%', marginTop: 20, padding: '14px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.03em' }}>+ Add Extra Session</button>
          )}
        </div>
    </Sheet>
  );
}

export default RestDaySheet;
