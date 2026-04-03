import { store } from './storage';
import { getReadinessScore } from './analytics.js';
import { validateArchive } from './validate';

// ─── ARCHIVE HELPERS ─────────────────────────────────────────────────────────

export function loadArchive() {
  try {
    return validateArchive(JSON.parse(store.get('foundry:archive') || '[]'));
  } catch (e) {
    console.warn('[Foundry]', 'Failed to load archive', e);
    return [];
  }
}

export function deleteArchiveEntry(id) {
  const archive = loadArchive().filter((r) => r.id !== id);
  store.set('foundry:archive', JSON.stringify(archive));
}

// ─── CLEAR ALL SKIPS ─────────────────────────────────────────────────────────

export function clearAllSkips(mesoWeeks, mesoDays) {
  const weeks = mesoWeeks || 12;
  const days = mesoDays || 6;
  for (let d = 0; d < days; d++)
    for (let w = 0; w <= weeks; w++)
      try {
        localStorage.removeItem(`foundry:skip:d${d}:w${w}`);
      } catch (e) {
        console.warn('[Foundry]', 'Failed to remove skip key', e);
      }
}

// ─── RESET MESO ──────────────────────────────────────────────────────────────

export function resetMeso(mesoWeeks, mesoDays) {
  const weeks = mesoWeeks || 12;
  const days = mesoDays || 6;
  for (let d = 0; d < days; d++) {
    for (let w = 0; w <= weeks; w++) {
      try {
        localStorage.removeItem(`foundry:day${d}:week${w}`);
      } catch (e) {
        console.warn('[Foundry]', 'Failed to remove day/week data during meso reset', e);
      }
      try {
        localStorage.removeItem(`foundry:notes:d${d}:w${w}`);
      } catch (e) {
        console.warn('[Foundry]', 'Failed to remove notes during meso reset', e);
      }
      try {
        localStorage.removeItem(`foundry:exnotes:d${d}:w${w}`);
      } catch (e) {
        console.warn('[Foundry]', 'Failed to remove exercise notes during meso reset', e);
      }
      try {
        localStorage.removeItem(`foundry:done:d${d}:w${w}`);
      } catch (e) {
        console.warn('[Foundry]', 'Failed to remove completion marker during meso reset', e);
      }
      try {
        localStorage.removeItem(`foundry:cardio:d${d}:w${w}`);
      } catch (e) {
        console.warn('[Foundry]', 'Failed to remove cardio log during meso reset', e);
      }
      try {
        localStorage.removeItem(`foundry:skip:d${d}:w${w}`);
      } catch (e) {
        console.warn('[Foundry]', 'Failed to remove skip marker during meso reset', e);
      }
      try {
        localStorage.removeItem(`foundry:sessionStart:d${d}:w${w}`);
      } catch (e) {
        console.warn('[Foundry]', 'Failed to remove session start during meso reset', e);
      }
      try {
        localStorage.removeItem(`foundry:strengthEnd:d${d}:w${w}`);
      } catch (e) {
        console.warn('[Foundry]', 'Failed to remove strength end during meso reset', e);
      }
      try {
        localStorage.removeItem(`foundry:completedDate:d${d}:w${w}`);
      } catch (e) {
        console.warn('[Foundry]', 'Failed to remove completed date during meso reset', e);
      }
    }
    for (let ex = 0; ex < 10; ex++) {
      try {
        localStorage.removeItem(`foundry:exov:d${d}:ex${ex}`);
      } catch (e) {
        console.warn('[Foundry]', 'Failed to remove exercise override during meso reset', e);
      }
    }
  }
  try {
    localStorage.setItem('foundry:currentWeek', '0');
  } catch (e) {
    console.warn('[Foundry]', 'Failed to reset current week', e);
  }
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
      const raw = store.get(`foundry:day${d}:week${w}`);
      const done = store.get(`foundry:done:d${d}:w${w}`) === '1';
      if (done) completedCount++;
      if (!raw) continue;
      const data = JSON.parse(raw);
      const exOvs = {};
      for (let ex = 0; ex < 8; ex++) {
        const ov =
          store.get(`foundry:exov:d${d}:w${w}:ex${ex}`) || store.get(`foundry:exov:d${d}:ex${ex}`);
        if (ov) exOvs[ex] = ov;
      }
      const cardioRaw = store.get(`foundry:cardio:d${d}:w${w}`);
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
  try {
    archive = validateArchive(JSON.parse(store.get('foundry:archive') || '[]'));
  } catch (e) {
    console.warn('[Foundry]', 'Failed to load archive for meso archival', e);
  }
  archive.unshift(record);
  if (archive.length > 10) archive = archive.slice(0, 10);
  store.set('foundry:archive', JSON.stringify(archive));

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
            const raw = store.get(`foundry:day${d}:week${w}`);
            if (!raw) continue;
            try {
              const wd = JSON.parse(raw);
              Object.values(wd[exIdx] || {}).forEach((s) => {
                const wVal = parseFloat(s?.weight || 0);
                if (wVal > peakWeight) peakWeight = wVal;
              });
            } catch (e) {
              console.warn('[Foundry]', 'Failed to parse week data for anchor peak', e);
            }
          }
          if (peakWeight > 0) anchorPeaks.push({ name: ex.name, id: ex.id, peak: peakWeight });
        });
      });

      const accessoryIds = [];
      prog.forEach((day) => {
        day.exercises.forEach((ex) => {
          if (!ex.anchor && ex.id && !accessoryIds.includes(ex.id)) accessoryIds.push(ex.id);
        });
      });

      const transition = {
        builtBy: profile.autoBuilt ? 'ai' : 'manual',
        anchorPeaks,
        accessoryIds,
        profile: {
          experience: profile.experience,
          equipment: profile.equipment,
          splitType: profile.splitType,
          daysPerWeek: profile.daysPerWeek,
          workoutDays: profile.workoutDays,
          mesoLength: profile.mesoLength,
          sessionDuration: profile.sessionDuration,
          goal: profile.goal,
          name: profile.name,
          age: profile.age,
          gender: profile.gender,
          weight: profile.weight,
        },
      };

      try {
        if (profile.startDate) {
          const start = new Date(profile.startDate + 'T00:00:00');
          const end = new Date();
          let totalScore = 0,
            totalLogged = 0,
            lowDays = 0;
          const cursor = new Date(start);
          while (cursor <= end) {
            const key = `foundry:readiness:${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
            const raw = store.get(key);
            if (raw) {
              try {
                const r = JSON.parse(raw);
                const score = getReadinessScore(r);
                if (score !== null) {
                  totalScore += score;
                  totalLogged++;
                  if (score <= 2) lowDays++;
                }
              } catch (e) {
                console.warn('[Foundry]', 'Failed to parse readiness entry', e);
              }
            }
            cursor.setDate(cursor.getDate() + 1);
          }
          if (totalLogged > 0) {
            transition.readinessSummary = {
              avgScore: Math.round((totalScore / totalLogged) * 10) / 10,
              lowDays,
              totalLogged,
              totalDays: Math.round((end - start) / 86400000) + 1,
            };
          }
        }
      } catch (e) {
        console.warn('[Foundry]', 'Failed to compute readiness summary', e);
      }

      store.set('foundry:meso_transition', JSON.stringify(transition));
    }
  } catch (e) {
    console.warn('[Foundry]', 'Failed to build meso transition context', e);
  }
}
