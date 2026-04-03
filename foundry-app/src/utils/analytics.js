import { store } from './storage';
import { validateDayData } from './validate';

// ─── READINESS SCORING ───────────────────────────────────────────────────────

export function getReadinessScore(r) {
  if (!r) return null;
  const s = { poor: 0, ok: 1, good: 2 }[r.sleep] ?? null;
  const o = { high: 0, moderate: 1, low: 2 }[r.soreness] ?? null;
  const e = { low: 0, moderate: 1, high: 2 }[r.energy] ?? null;
  if (s === null || o === null || e === null) return null;
  return s + o + e;
}

export function getReadinessLabel(score) {
  if (score === null) return null;
  if (score >= 5)
    return {
      label: 'READY',
      color: 'var(--phase-accum)',
      advice: 'All systems go. Train as planned.',
      banner: null,
    };
  if (score >= 3)
    return {
      label: 'MODERATE',
      color: '#e0a030',
      advice: "Watch intensity. Push where it feels right, back off where it doesn't.",
      banner: null,
    };
  return {
    label: 'LOW',
    color: '#e05252',
    advice: 'Recovery comes first. Consider 10–15% load reduction today.',
    banner: 'Low readiness today — consider 10–15% load reduction.',
  };
}

// ─── EXERCISE HISTORY ────────────────────────────────────────────────────────

export function loadExerciseHistory(dayIdx, exIdx, mesoWeeks) {
  const weeks = mesoWeeks || 6;
  const rows = [];
  for (let w = 0; w <= weeks; w++) {
    if (store.get(`foundry:done:d${dayIdx}:w${w}`) !== '1') continue;
    const raw = store.get(`foundry:day${dayIdx}:week${w}`);
    if (!raw) continue;
    const dayData = validateDayData(JSON.parse(raw));
    const exData = dayData[exIdx];
    if (!exData) continue;
    const sets = Object.entries(exData)
      .map(([si, s]) => ({
        setNum: parseInt(si) + 1,
        weight: s?.weight || '',
        reps: s?.reps || '',
        rpe: s?.rpe || null,
      }))
      .filter((s) => s.weight || s.reps);
    if (sets.length > 0) rows.push({ week: w, sets });
  }
  return rows.reverse();
}

// ─── SESSION PR DETECTION ────────────────────────────────────────────────────

export function detectSessionPRs(exercises, weekData, mode, opts) {
  const getBestWeight = (data) => {
    let best = 0;
    Object.values(data || {}).forEach((s) => {
      const w = parseFloat(s?.weight);
      if (!isNaN(w) && w > best && (s?.reps || s?.reps === 0)) best = w;
    });
    return best;
  };

  const prs = [];

  if (mode === 'meso') {
    const { dayIdx, weekIdx } = opts;
    exercises.forEach((ex, exIdx) => {
      const todayBest = getBestWeight(weekData[exIdx] || {});
      if (todayBest <= 0) return;
      let priorBest = 0;
      for (let w = 0; w < weekIdx; w++) {
        try {
          const raw = store.get(`foundry:day${dayIdx}:week${w}`);
          if (!raw) continue;
          const dd = validateDayData(JSON.parse(raw));
          const b = getBestWeight(dd[exIdx] || {});
          if (b > priorBest) priorBest = b;
        } catch (e) {
          console.warn('[Foundry]', 'Failed to read prior week data for PR detection', e);
        }
      }
      if (todayBest > priorBest && priorBest > 0) {
        prs.push({ name: ex.name, newBest: todayBest, prevBest: priorBest });
      }
    });
  }

  if (mode === 'extra') {
    const { activeDays, currentDateStr } = opts;
    const mesoWeeks = 6;
    exercises.forEach((ex, exIdx) => {
      if (!ex.id) return;
      const todayBest = getBestWeight(weekData[exIdx] || {});
      if (todayBest <= 0) return;
      let priorBest = 0;
      if (activeDays) {
        for (let d = 0; d < activeDays.length; d++) {
          const slot = activeDays[d].exercises.findIndex((e) => e.id === ex.id);
          if (slot < 0) continue;
          for (let w = 0; w <= mesoWeeks; w++) {
            try {
              const raw = store.get(`foundry:day${d}:week${w}`);
              if (!raw) continue;
              const dd = validateDayData(JSON.parse(raw));
              const b = getBestWeight(dd[slot] || {});
              if (b > priorBest) priorBest = b;
            } catch (e) {
              console.warn('[Foundry]', 'Failed to read meso data for PR detection', e);
            }
          }
        }
      }
      try {
        Object.keys(localStorage).forEach((key) => {
          if (!key.startsWith('foundry:extra:data:')) return;
          const dateStr = key.replace('foundry:extra:data:', '');
          if (dateStr === currentDateStr) return;
          const raw = store.get(key);
          if (!raw) return;
          const ed = JSON.parse(raw);
          const sessionRaw = store.get(`foundry:extra:${dateStr}`);
          if (!sessionRaw) return;
          const session = JSON.parse(sessionRaw);
          const exList = session.exercises || [];
          exList.forEach((se, si) => {
            if (se.id !== ex.id) return;
            const b = getBestWeight(ed[si] || {});
            if (b > priorBest) priorBest = b;
          });
        });
      } catch (e) {
        console.warn('[Foundry]', 'Failed to scan extra sessions for PR detection', e);
      }
      if (todayBest > priorBest && priorBest > 0) {
        prs.push({ name: ex.name, newBest: todayBest, prevBest: priorBest });
      }
    });
  }

  return prs;
}

// ─── STALLING DETECTION ──────────────────────────────────────────────────────

export function detectStallingLifts(dayIdx, day, resolvedExercises, currentWeekIdx, profile, deps) {
  const { EXERCISE_DB = [], loadBwLog: _loadBwLog } = deps || {};
  const stalls = [];
  const regressions = [];

  resolvedExercises.forEach((ex, exIdx) => {
    const baseExName = (day.exercises[exIdx] || {}).name || ex.name;
    const window = [];

    for (let w = 0; w < currentWeekIdx; w++) {
      if (store.get(`foundry:done:d${dayIdx}:w${w}`) !== '1') continue;
      const histOvId =
        store.get(`foundry:exov:d${dayIdx}:w${w}:ex${exIdx}`) ||
        store.get(`foundry:exov:d${dayIdx}:ex${exIdx}`) ||
        null;
      const histName = histOvId
        ? (EXERCISE_DB.find((e) => e.id === histOvId) || {}).name || null
        : baseExName;
      if (!histName || histName !== ex.name) break;
      try {
        const raw = store.get(`foundry:day${dayIdx}:week${w}`);
        if (!raw) continue;
        const exData = validateDayData(JSON.parse(raw))[exIdx] || {};
        let heaviest = 0;
        Object.values(exData).forEach((s) => {
          if (!s || s.warmup || s.repsSuggested) return;
          const wt = parseFloat(s.weight);
          if (!isNaN(wt) && wt > 0 && s.reps && s.reps !== '') {
            if (wt > heaviest) heaviest = wt;
          }
        });
        if (heaviest > 0) window.push({ w, weight: heaviest });
      } catch (e) {
        console.warn('[Foundry]', 'Failed to read week data for stall detection', e);
        break;
      }
    }

    if (window.length === 0) return;
    const last = window[window.length - 1];

    if (window.length >= 2) {
      const prev = window[window.length - 2];
      if (last.weight < prev.weight) {
        regressions.push({
          name: ex.name,
          current: last.weight,
          previous: prev.weight,
        });
        return;
      }
    }

    if (window.length >= 3) {
      const last3 = window.slice(-3);
      if (last3.every((s) => s.weight === last3[0].weight)) {
        try {
          const curRaw = store.get(`foundry:day${dayIdx}:week${currentWeekIdx}`);
          if (curRaw) {
            const curExData = validateDayData(JSON.parse(curRaw))[exIdx] || {};
            let curHeaviest = 0;
            Object.values(curExData).forEach((s) => {
              if (!s || s.warmup) return;
              const wt = parseFloat(s.weight);
              if (!isNaN(wt) && wt > curHeaviest) curHeaviest = wt;
            });
            if (curHeaviest > last3[0].weight) return;
          }
        } catch (e) {
          console.warn('[Foundry]', 'Failed to read current week for stall detection', e);
        }

        let isFatigueSignal = false;
        try {
          const today = new Date();
          let readinessTotal = 0,
            readinessCount = 0;
          for (let d = 0; d < 7; d++) {
            const dt = new Date(today);
            dt.setDate(dt.getDate() - d);
            const key = `foundry:readiness:${dt.toISOString().slice(0, 10)}`;
            const raw = store.get(key);
            if (raw) {
              const score = getReadinessScore(JSON.parse(raw));
              if (score !== null) {
                readinessTotal += score;
                readinessCount++;
              }
            }
          }
          if (readinessCount >= 3 && readinessTotal / readinessCount <= 2.5) {
            isFatigueSignal = true;
          }
        } catch (e) {
          console.warn('[Foundry]', 'Failed to compute fatigue signal', e);
        }

        if (profile?.goal === 'lose_fat' && _loadBwLog) {
          const sessionDates = last3
            .map((entry) => store.get(`foundry:completedDate:d${dayIdx}:w${entry.w}`) || null)
            .filter(Boolean)
            .sort();
          if (sessionDates.length >= 2) {
            const earliest = sessionDates[0];
            const latest = sessionDates[sessionDates.length - 1];
            const bwLog = _loadBwLog();
            const inWindow = bwLog.filter((e) => e.date >= earliest && e.date <= latest);
            if (inWindow.length >= 2) {
              const bwDown = inWindow[0].weight > inWindow[inWindow.length - 1].weight;
              stalls.push({
                name: ex.name,
                weight: last.weight,
                isProtecting: bwDown,
                isFatigueSignal,
              });
            } else {
              stalls.push({
                name: ex.name,
                weight: last.weight,
                isFatigueSignal,
              });
            }
          } else {
            stalls.push({
              name: ex.name,
              weight: last.weight,
              isFatigueSignal,
            });
          }
        } else {
          stalls.push({ name: ex.name, weight: last.weight, isFatigueSignal });
        }
      }
    }
  });

  return { stalls, regressions };
}
