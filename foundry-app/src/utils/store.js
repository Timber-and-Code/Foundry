// localStorage wrapper with error handling
export const store = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, val); } catch {} },
};

// Re-export training utilities so components can import from a single location
export {
  getWeekSets, generateWarmupSteps, getWarmupDetail, shuffle,
  loadBwLog, saveBwLog, addBwEntry, bwLoggedThisWeek, currentWeekSundayStr,
  markBwPromptShown, bwPromptShownThisWeek,
  saveSessionDuration, loadSessionDuration, loadSparklineData,
  loadCurrentWeek, saveCurrentWeek, loadCompleted, markComplete,
  loadProfile, saveProfile,
  isSkipped, setSkipped, getWorkoutDaysForWeek, ensureWorkoutDaysHistory,
  ageFromDob, getTimeGreeting,
} from './training';

// ─── TRAINING DATA PERSISTENCE ────────────────────────────────────────────────

export function loadDayWeek(dayIdx, weekIdx) {
  const raw = store.get(`ppl:day${dayIdx}:week${weekIdx}`);
  return raw ? JSON.parse(raw) : {};
}

/**
 * Load current week data with automatic weight/rep progression hints.
 * Carry-over logic: if lifter completed ALL prescribed reps on every working set
 * last week, suggest an experience-aware weight bump.
 * Barbell min is always 5 lbs (2.5/side floor). DB increments respect real-world sizes.
 * Cable/machine advanced gets smaller jumps.
 */
export function loadDayWeekWithCarryover(dayIdx, weekIdx, day, profile) {
  const expRaw = profile?.experience || "intermediate";
  const expNorm = { new:"beginner", beginner:"beginner", intermediate:"intermediate", advanced:"experienced", experienced:"experienced" };
  const expKey = expNorm[expRaw] || "intermediate";
  const current = loadDayWeek(dayIdx, weekIdx);

  const hasData = Object.values(current).some(exData =>
    Object.values(exData).some(s => s && (s.weight || s.reps))
  );
  if (hasData || weekIdx === 0) return current;

  // Nothing logged yet this week — carry forward weights from the most recent prior week
  for (let w = weekIdx - 1; w >= 0; w--) {
    const prev = loadDayWeek(dayIdx, w);
    const prevHasWeights = Object.values(prev).some(exData =>
      Object.values(exData).some(s => s && s.weight)
    );
    if (!prevHasWeights) continue;

    const carried = {};
    day.exercises.forEach((ex, exIdx) => {
      const prevEx = prev[exIdx] || {};
      const repParts = String(ex.reps).split("-");
      const rangeMin = parseInt(repParts[0]) || 1;
      const rangeMax = parseInt(repParts[repParts.length - 1]) || rangeMin;

      let allRepsHit = true;
      let hasAnyWorkingSet = false;
      for (let s = 0; s < ex.sets; s++) {
        const prevSet = prevEx[s] || {};
        if (prevSet.warmup) continue;
        hasAnyWorkingSet = true;
        const logged = parseInt(prevSet.reps || "0");
        if (!logged || logged < rangeMax) { allRepsHit = false; break; }
      }

      let nudge = 0;
      if (allRepsHit && hasAnyWorkingSet) {
        const equip = ex.equipment || "";
        if (ex.bw) {
          nudge = 0;
        } else if (equip === "barbell") {
          nudge = 5;
        } else if (equip === "dumbbell") {
          const currentWeight = (() => {
            for (let s = 0; s < ex.sets; s++) {
              const w = parseFloat((prevEx[s] || {}).weight || "0");
              if (w > 0) return w;
            }
            return 0;
          })();
          nudge = currentWeight < 25 ? 2.5 : 5;
        } else {
          nudge = expKey === "experienced" ? 2.5 : 5;
        }
      }

      carried[exIdx] = {};
      for (let s = 0; s < ex.sets; s++) {
        const prevSet = prevEx[s] || {};
        let suggestedWeight = prevSet.weight || "";
        if (nudge > 0 && suggestedWeight !== "" && !isNaN(parseFloat(suggestedWeight))) {
          suggestedWeight = String(parseFloat(suggestedWeight) + nudge);
        }

        const prevReps = parseInt(prevSet.reps || "0");
        let suggestedReps;
        if (nudge > 0) {
          suggestedReps = String(rangeMin);
        } else if (prevReps > 0) {
          suggestedReps = String(Math.min(prevReps + 1, rangeMax));
        } else {
          suggestedReps = String(rangeMin);
        }

        carried[exIdx][s] = {
          weight: suggestedWeight,
          reps: suggestedReps,
          suggested: nudge > 0 && suggestedWeight !== "",
          repsSuggested: true,
        };
      }
    });
    return carried;
  }
  return current;
}

export function saveDayWeek(dayIdx, weekIdx, data) {
  store.set(`ppl:day${dayIdx}:week${weekIdx}`, JSON.stringify(data));
}

export function loadCardioLog(dayIdx, weekIdx) {
  const raw = store.get(`ppl:cardio:d${dayIdx}:w${weekIdx}`);
  return raw ? JSON.parse(raw) : null;
}

export function saveCardioLog(dayIdx, weekIdx, data) {
  store.set(`ppl:cardio:d${dayIdx}:w${weekIdx}`, JSON.stringify(data));
}

export function loadCardioSession(dateStr) {
  try { const r = store.get(`ppl:cardio:session:${dateStr}`); return r ? JSON.parse(r) : null; } catch { return null; }
}

export function saveCardioSession(dateStr, data) {
  store.set(`ppl:cardio:session:${dateStr}`, JSON.stringify(data));
}

export function loadMobilitySession(dateStr) {
  try { const r = store.get(`ppl:mobility:session:${dateStr}`); return r ? JSON.parse(r) : null; } catch { return null; }
}

export function saveMobilitySession(dateStr, data) {
  store.set(`ppl:mobility:session:${dateStr}`, JSON.stringify(data));
}

export function parseRestSeconds(restStr) {
  if (!restStr) return 90;
  const s = restStr.toLowerCase();
  const match = s.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 90;
  const val = parseFloat(match[1]);
  if (s.includes('min')) return Math.round(val * 60);
  if (s.includes('sec')) return Math.round(val);
  return 90;
}

export function loadNotes(dayIdx, weekIdx) {
  return store.get(`ppl:notes:d${dayIdx}:w${weekIdx}`) || "";
}

export function saveNotes(dayIdx, weekIdx, text) {
  store.set(`ppl:notes:d${dayIdx}:w${weekIdx}`, text);
}

export function loadExNotes(dayIdx, weekIdx) {
  try { return JSON.parse(store.get(`ppl:exnotes:d${dayIdx}:w${weekIdx}`) || "{}"); } catch { return {}; }
}

export function saveExNotes(dayIdx, weekIdx, obj) {
  store.set(`ppl:exnotes:d${dayIdx}:w${weekIdx}`, JSON.stringify(obj));
}

export function loadExtraExNotes(dateStr) {
  try { return JSON.parse(store.get(`ppl:extra:exnotes:${dateStr}`) || "{}"); } catch { return {}; }
}

export function saveExtraExNotes(dateStr, obj) {
  store.set(`ppl:extra:exnotes:${dateStr}`, JSON.stringify(obj));
}

export function hasAnyNotes(dayIdx, weekIdx) {
  if (loadNotes(dayIdx, weekIdx).trim()) return true;
  return Object.values(loadExNotes(dayIdx, weekIdx)).some(v => v && v.trim());
}

export function hasAnyExtraNotes(dateStr) {
  const sn = store.get(`ppl:extra:notes:${dateStr}`) || "";
  if (sn.trim()) return true;
  return Object.values(loadExtraExNotes(dateStr)).some(v => v && v.trim());
}

export function loadArchive() {
  try { return JSON.parse(store.get("ppl:archive") || "[]"); } catch { return []; }
}

export function deleteArchiveEntry(id) {
  const archive = loadArchive().filter(r => r.id !== id);
  store.set("ppl:archive", JSON.stringify(archive));
}

export function loadExOverride(dayIdx, weekIdx, exIdx) {
  return store.get(`ppl:exov:d${dayIdx}:w${weekIdx}:ex${exIdx}`)
    || store.get(`ppl:exov:d${dayIdx}:ex${exIdx}`)
    || null;
}

export function saveExOverride(dayIdx, weekIdx, exIdx, exId, scope) {
  if (scope === "week") {
    store.set(`ppl:exov:d${dayIdx}:w${weekIdx}:ex${exIdx}`, exId);
  } else {
    store.set(`ppl:exov:d${dayIdx}:ex${exIdx}`, exId);
  }
}

/**
 * Snapshot all ppl: keys into localStorage rolling backup.
 * Keeps the last 3 snapshots automatically.
 */
export function snapshotData() {
  try {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("ppl:") && !key.startsWith("ppl:backup:")) {
        data[key] = localStorage.getItem(key);
      }
    }
    const snap = JSON.stringify({ version:1, snappedAt: new Date().toISOString(), data });
    const b2 = localStorage.getItem("ppl:backup:1");
    if (b2) localStorage.setItem("ppl:backup:2", b2);
    const b1 = localStorage.getItem("ppl:backup:0");
    if (b1) localStorage.setItem("ppl:backup:1", b1);
    localStorage.setItem("ppl:backup:0", snap);
  } catch(e) { /* silent */ }
}

/**
 * Export the most recent backup snapshot as a .json file.
 * User-initiated download only.
 */
export function exportData() {
  try {
    const raw = localStorage.getItem("ppl:backup:0");
    const payload = raw || JSON.stringify({ version:1, snappedAt: new Date().toISOString(), data: (() => {
      const d = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("ppl:") && !k.startsWith("ppl:backup:")) d[k] = localStorage.getItem(k);
      }
      return d;
    })() });
    const blob = new Blob([payload], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ppl-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    store.set("ppl:last_backup_ts", Date.now().toString());
  } catch(e) { alert("Export failed."); }
}

/**
 * Import data from a backup .json file.
 * Restores all ppl: keys from the backup into localStorage.
 */
export function importData(file, onDone) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const data = parsed.data || parsed;
      Object.entries(data).forEach(([k,v]) => {
        if (k.startsWith("ppl:")) localStorage.setItem(k, v);
      });
      onDone(true);
    } catch {
      onDone(false);
    }
  };
  reader.readAsText(file);
}

// ─── READINESS SCORING ───────────────────────────────────────────────────────
export function getReadinessScore(r) {
  if (!r) return null;
  const s = ({ poor:0, ok:1, good:2 }[r.sleep]       ?? null);
  const o = ({ high:0, moderate:1, low:2 }[r.soreness] ?? null);
  const e = ({ low:0, moderate:1, high:2 }[r.energy]   ?? null);
  if (s === null || o === null || e === null) return null;
  return s + o + e;
}

export function getReadinessLabel(score) {
  if (score === null) return null;
  if (score >= 5) return { label:"READY",    color:"var(--phase-accum)", advice:"All systems go. Train as planned.",                                              banner:null };
  if (score >= 3) return { label:"MODERATE", color:"#e0a030",            advice:"Watch intensity. Push where it feels right, back off where it doesn't.",         banner:null };
  return             { label:"LOW",      color:"#e05252",            advice:"Recovery comes first. Consider 10–15% load reduction today.",                    banner:"Low readiness today — consider 10–15% load reduction." };
}

// ─── EXERCISE HISTORY ────────────────────────────────────────────────────────
export function loadExerciseHistory(dayIdx, exIdx, mesoWeeks) {
  const weeks = mesoWeeks || 6;
  const rows = [];
  for (let w = 0; w <= weeks; w++) {
    if (store.get(`ppl:done:d${dayIdx}:w${w}`) !== "1") continue;
    const raw = store.get(`ppl:day${dayIdx}:week${w}`);
    if (!raw) continue;
    const dayData = JSON.parse(raw);
    const exData = dayData[exIdx];
    if (!exData) continue;
    const sets = Object.entries(exData)
      .map(([si, s]) => ({ setNum: parseInt(si)+1, weight: s?.weight || "", reps: s?.reps || "", rpe: s?.rpe || null }))
      .filter(s => s.weight || s.reps);
    if (sets.length > 0) rows.push({ week: w, sets });
  }
  return rows.reverse();
}

// ─── SESSION PR DETECTION ────────────────────────────────────────────────────
export function detectSessionPRs(exercises, weekData, mode, opts) {
  const getBestWeight = (data) => {
    let best = 0;
    Object.values(data || {}).forEach(s => {
      const w = parseFloat(s?.weight);
      if (!isNaN(w) && w > best && (s?.reps || s?.reps === 0)) best = w;
    });
    return best;
  };

  const prs = [];

  if (mode === "meso") {
    const { dayIdx, weekIdx } = opts;
    exercises.forEach((ex, exIdx) => {
      const todayBest = getBestWeight(weekData[exIdx] || {});
      if (todayBest <= 0) return;
      let priorBest = 0;
      for (let w = 0; w < weekIdx; w++) {
        try {
          const raw = store.get(`ppl:day${dayIdx}:week${w}`);
          if (!raw) continue;
          const dd = JSON.parse(raw);
          const b = getBestWeight(dd[exIdx] || {});
          if (b > priorBest) priorBest = b;
        } catch {}
      }
      if (todayBest > priorBest && priorBest > 0) {
        prs.push({ name: ex.name, newBest: todayBest, prevBest: priorBest });
      }
    });
  }

  if (mode === "extra") {
    const { activeDays, currentDateStr } = opts;
    const mesoWeeks = 6;
    exercises.forEach((ex, exIdx) => {
      if (!ex.id) return;
      const todayBest = getBestWeight(weekData[exIdx] || {});
      if (todayBest <= 0) return;
      let priorBest = 0;
      if (activeDays) {
        for (let d = 0; d < activeDays.length; d++) {
          const slot = activeDays[d].exercises.findIndex(e => e.id === ex.id);
          if (slot < 0) continue;
          for (let w = 0; w <= mesoWeeks; w++) {
            try {
              const raw = store.get(`ppl:day${d}:week${w}`);
              if (!raw) continue;
              const dd = JSON.parse(raw);
              const b = getBestWeight(dd[slot] || {});
              if (b > priorBest) priorBest = b;
            } catch {}
          }
        }
      }
      try {
        Object.keys(localStorage).forEach(key => {
          if (!key.startsWith("ppl:extra:data:")) return;
          const dateStr = key.replace("ppl:extra:data:", "");
          if (dateStr === currentDateStr) return;
          const raw = store.get(key);
          if (!raw) return;
          const ed = JSON.parse(raw);
          const sessionRaw = store.get(`ppl:extra:${dateStr}`);
          if (!sessionRaw) return;
          const session = JSON.parse(sessionRaw);
          const exList = session.exercises || [];
          exList.forEach((se, si) => {
            if (se.id !== ex.id) return;
            const b = getBestWeight(ed[si] || {});
            if (b > priorBest) priorBest = b;
          });
        });
      } catch {}
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
      if (store.get(`ppl:done:d${dayIdx}:w${w}`) !== "1") continue;
      const histOvId = store.get(`ppl:exov:d${dayIdx}:w${w}:ex${exIdx}`)
                    || store.get(`ppl:exov:d${dayIdx}:ex${exIdx}`)
                    || null;
      const histName = histOvId
        ? ((EXERCISE_DB.find(e => e.id === histOvId) || {}).name || null)
        : baseExName;
      if (!histName || histName !== ex.name) break;
      try {
        const raw = store.get(`ppl:day${dayIdx}:week${w}`);
        if (!raw) continue;
        const exData = (JSON.parse(raw))[exIdx] || {};
        let heaviest = 0;
        Object.values(exData).forEach(s => {
          if (!s || s.warmup || s.repsSuggested) return;
          const wt = parseFloat(s.weight);
          if (!isNaN(wt) && wt > 0 && s.reps && s.reps !== "") {
            if (wt > heaviest) heaviest = wt;
          }
        });
        if (heaviest > 0) window.push({ w, weight: heaviest });
      } catch { break; }
    }

    if (window.length === 0) return;
    const last = window[window.length - 1];

    if (window.length >= 2) {
      const prev = window[window.length - 2];
      if (last.weight < prev.weight) {
        regressions.push({ name: ex.name, current: last.weight, previous: prev.weight });
        return;
      }
    }

    if (window.length >= 3) {
      const last3 = window.slice(-3);
      if (last3.every(s => s.weight === last3[0].weight)) {
        try {
          const curRaw = store.get(`ppl:day${dayIdx}:week${currentWeekIdx}`);
          if (curRaw) {
            const curExData = (JSON.parse(curRaw))[exIdx] || {};
            let curHeaviest = 0;
            Object.values(curExData).forEach(s => {
              if (!s || s.warmup) return;
              const wt = parseFloat(s.weight);
              if (!isNaN(wt) && wt > curHeaviest) curHeaviest = wt;
            });
            if (curHeaviest > last3[0].weight) return;
          }
        } catch {}

        let isFatigueSignal = false;
        try {
          const today = new Date();
          let readinessTotal = 0, readinessCount = 0;
          for (let d = 0; d < 7; d++) {
            const dt = new Date(today);
            dt.setDate(dt.getDate() - d);
            const key = `foundry:readiness:${dt.toISOString().slice(0,10)}`;
            const raw = store.get(key);
            if (raw) {
              const score = getReadinessScore(JSON.parse(raw));
              if (score !== null) { readinessTotal += score; readinessCount++; }
            }
          }
          if (readinessCount >= 3 && (readinessTotal / readinessCount) <= 2.5) {
            isFatigueSignal = true;
          }
        } catch {}

        if (profile?.goal === "lose_fat" && _loadBwLog) {
          const sessionDates = last3
            .map(entry => store.get(`ppl:completedDate:d${dayIdx}:w${entry.w}`) || null)
            .filter(Boolean)
            .sort();
          if (sessionDates.length >= 2) {
            const earliest = sessionDates[0];
            const latest   = sessionDates[sessionDates.length - 1];
            const bwLog    = _loadBwLog();
            const inWindow = bwLog.filter(e => e.date >= earliest && e.date <= latest);
            if (inWindow.length >= 2) {
              const bwDown = inWindow[0].weight < inWindow[inWindow.length - 1].weight;
              stalls.push({ name: ex.name, weight: last.weight, isProtecting: bwDown, isFatigueSignal });
            } else {
              stalls.push({ name: ex.name, weight: last.weight, isFatigueSignal });
            }
          } else {
            stalls.push({ name: ex.name, weight: last.weight, isFatigueSignal });
          }
        } else {
          stalls.push({ name: ex.name, weight: last.weight, isFatigueSignal });
        }
      }
    }
  });

  return { stalls, regressions };
}

// ─── CLEAR ALL SKIPS ─────────────────────────────────────────────────────────
export function clearAllSkips(mesoWeeks, mesoDays) {
  const weeks = mesoWeeks || 12;
  const days  = mesoDays || 6;
  for (let d = 0; d < days; d++)
    for (let w = 0; w <= weeks; w++)
      try { localStorage.removeItem(`ppl:skip:d${d}:w${w}`); } catch {}
}

// ─── RESET MESO ──────────────────────────────────────────────────────────────
export function resetMeso(mesoWeeks, mesoDays) {
  const weeks = mesoWeeks || 12;
  const days  = mesoDays || 6;
  for (let d = 0; d < days; d++) {
    for (let w = 0; w <= weeks; w++) {
      try { localStorage.removeItem(`ppl:day${d}:week${w}`); } catch {}
      try { localStorage.removeItem(`ppl:notes:d${d}:w${w}`); } catch {}
      try { localStorage.removeItem(`ppl:exnotes:d${d}:w${w}`); } catch {}
      try { localStorage.removeItem(`ppl:done:d${d}:w${w}`); } catch {}
      try { localStorage.removeItem(`ppl:cardio:d${d}:w${w}`); } catch {}
      try { localStorage.removeItem(`ppl:skip:d${d}:w${w}`); } catch {}
      try { localStorage.removeItem(`ppl:sessionStart:d${d}:w${w}`); } catch {}
      try { localStorage.removeItem(`ppl:strengthEnd:d${d}:w${w}`); } catch {}
      try { localStorage.removeItem(`ppl:completedDate:d${d}:w${w}`); } catch {}
    }
    for (let ex = 0; ex < 10; ex++) {
      try { localStorage.removeItem(`ppl:exov:d${d}:ex${ex}`); } catch {}
    }
  }
  try { localStorage.setItem("ppl:currentWeek", "0"); } catch {}
}

// ─── ARCHIVE CURRENT MESO ───────────────────────────────────────────────────
export function archiveCurrentMeso(profile, deps) {
  const { generateProgram: _generateProgram, EXERCISE_DB: _EXERCISE_DB } = deps || {};
  if (!profile) return;
  const mesoWeeks = profile.mesoLength ? profile.mesoLength + 1 : 7;
  const mesoDays = profile.workoutDays?.length || profile.daysPerWeek || 6;

  const sessions = [];
  let completedCount = 0;
  for (let d = 0; d < mesoDays; d++) {
    for (let w = 0; w <= mesoWeeks; w++) {
      const raw  = store.get(`ppl:day${d}:week${w}`);
      const done = store.get(`ppl:done:d${d}:w${w}`) === "1";
      if (done) completedCount++;
      if (!raw) continue;
      const data = JSON.parse(raw);
      const exOvs = {};
      for (let ex = 0; ex < 8; ex++) {
        const ov = store.get(`ppl:exov:d${d}:w${w}:ex${ex}`) || store.get(`ppl:exov:d${d}:ex${ex}`);
        if (ov) exOvs[ex] = ov;
      }
      const cardioRaw = store.get(`ppl:cardio:d${d}:w${w}`);
      const cardioLog = cardioRaw ? JSON.parse(cardioRaw) : null;
      sessions.push({ d, w, data, exOvs, done, cardioLog });
    }
  }

  const record = {
    id: Date.now(),
    archivedAt: new Date().toISOString(),
    profile: { ...profile },
    mesoWeeks,
    mesoDays,
    totalSessions: mesoWeeks * mesoDays,
    completedSessions: completedCount,
    sessions,
  };

  let archive = [];
  try { archive = JSON.parse(store.get("ppl:archive") || "[]"); } catch {}
  archive.unshift(record);
  if (archive.length > 10) archive = archive.slice(0, 10);
  store.set("ppl:archive", JSON.stringify(archive));

  // ── Meso transition context ──
  try {
    if (_generateProgram) {
      const prog = _generateProgram(profile).slice(0, mesoDays);
      const anchorPeaks = [];
      prog.forEach((day, d) => {
        day.exercises.forEach((ex, exIdx) => {
          if (!ex.anchor) return;
          let peakWeight = 0;
          for (let w = 0; w < mesoWeeks - 1; w++) {
            const raw = store.get(`ppl:day${d}:week${w}`);
            if (!raw) continue;
            try {
              const wd = JSON.parse(raw);
              Object.values(wd[exIdx] || {}).forEach(s => {
                const wVal = parseFloat(s?.weight || 0);
                if (wVal > peakWeight) peakWeight = wVal;
              });
            } catch {}
          }
          if (peakWeight > 0) anchorPeaks.push({ name: ex.name, id: ex.id, peak: peakWeight });
        });
      });

      const accessoryIds = [];
      prog.forEach(day => {
        day.exercises.forEach(ex => {
          if (!ex.anchor && ex.id && !accessoryIds.includes(ex.id)) accessoryIds.push(ex.id);
        });
      });

      const transition = {
        builtBy: profile.autoBuilt ? "ai" : "manual",
        anchorPeaks,
        accessoryIds,
        profile: {
          experience: profile.experience,
          equipment:  profile.equipment,
          splitType:  profile.splitType,
          daysPerWeek: profile.daysPerWeek,
          workoutDays: profile.workoutDays,
          mesoLength:  profile.mesoLength,
          sessionDuration: profile.sessionDuration,
          goal: profile.goal,
          name: profile.name,
          age:  profile.age,
          gender: profile.gender,
          weight: profile.weight,
        },
      };

      try {
        if (profile.startDate) {
          const start = new Date(profile.startDate + "T00:00:00");
          const end   = new Date();
          let totalScore = 0, totalLogged = 0, lowDays = 0;
          const cursor = new Date(start);
          while (cursor <= end) {
            const key = `foundry:readiness:${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-${String(cursor.getDate()).padStart(2,"0")}`;
            const raw = store.get(key);
            if (raw) {
              try {
                const r = JSON.parse(raw);
                const score = getReadinessScore(r);
                if (score !== null) { totalScore += score; totalLogged++; if (score <= 2) lowDays++; }
              } catch {}
            }
            cursor.setDate(cursor.getDate() + 1);
          }
          if (totalLogged > 0) {
            transition.readinessSummary = {
              avgScore:    Math.round((totalScore / totalLogged) * 10) / 10,
              lowDays,
              totalLogged,
              totalDays:   Math.round((end - start) / 86400000) + 1,
            };
          }
        }
      } catch {}

      store.set("foundry:meso_transition", JSON.stringify(transition));
    }
  } catch {}
}
