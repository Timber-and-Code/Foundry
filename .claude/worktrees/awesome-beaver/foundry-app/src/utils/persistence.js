import { store } from './storage.js';
import { validateDayData } from './validate.js';
import {
  syncWorkoutToSupabase,
  syncCardioSessionToSupabase,
  syncNotesToSupabase,
} from './sync.js';

// ─── TRAINING DATA PERSISTENCE ────────────────────────────────────────────────

export function loadDayWeek(dayIdx, weekIdx) {
  const raw = store.get(`foundry:day${dayIdx}:week${weekIdx}`);
  return raw ? validateDayData(JSON.parse(raw)) : {};
}

/**
 * Load current week data with automatic weight/rep progression hints.
 * Carry-over logic: if lifter completed ALL prescribed reps on every working set
 * last week, suggest an experience-aware weight bump.
 * Barbell min is always 5 lbs (2.5/side floor). DB increments respect real-world sizes.
 * Cable/machine advanced gets smaller jumps.
 */
export function loadDayWeekWithCarryover(dayIdx, weekIdx, day, profile) {
  const expRaw = profile?.experience || 'intermediate';
  const expNorm = {
    new: 'beginner',
    beginner: 'beginner',
    intermediate: 'intermediate',
    advanced: 'experienced',
    experienced: 'experienced',
  };
  const expKey = expNorm[expRaw] || 'intermediate';
  const current = loadDayWeek(dayIdx, weekIdx);

  const hasData = Object.values(current).some((exData) =>
    Object.values(exData).some((s) => s && (s.weight || s.reps))
  );
  if (hasData || weekIdx === 0) return current;

  // Nothing logged yet this week — carry forward weights from the most recent prior week
  for (let w = weekIdx - 1; w >= 0; w--) {
    const prev = loadDayWeek(dayIdx, w);
    const prevHasWeights = Object.values(prev).some((exData) =>
      Object.values(exData).some((s) => s && s.weight)
    );
    if (!prevHasWeights) continue;

    const carried = {};
    day.exercises.forEach((ex, exIdx) => {
      const prevEx = prev[exIdx] || {};
      const repParts = String(ex.reps).split('-');
      const rangeMin = parseInt(repParts[0]) || 1;
      const rangeMax = parseInt(repParts[repParts.length - 1]) || rangeMin;

      let allRepsHit = true;
      let hasAnyWorkingSet = false;
      for (let s = 0; s < ex.sets; s++) {
        const prevSet = prevEx[s] || {};
        if (prevSet.warmup) continue;
        hasAnyWorkingSet = true;
        const logged = parseInt(prevSet.reps || '0');
        if (!logged || logged < rangeMax) {
          allRepsHit = false;
          break;
        }
      }

      let nudge = 0;
      if (allRepsHit && hasAnyWorkingSet) {
        const equip = ex.equipment || '';
        if (ex.bw) {
          nudge = 0;
        } else if (equip === 'barbell') {
          nudge = 5;
        } else if (equip === 'dumbbell') {
          const currentWeight = (() => {
            for (let s = 0; s < ex.sets; s++) {
              const w = parseFloat((prevEx[s] || {}).weight || '0');
              if (w > 0) return w;
            }
            return 0;
          })();
          nudge = currentWeight < 25 ? 2.5 : 5;
        } else {
          nudge = expKey === 'experienced' ? 2.5 : 5;
        }
      }

      carried[exIdx] = {};
      for (let s = 0; s < ex.sets; s++) {
        const prevSet = prevEx[s] || {};
        let suggestedWeight = prevSet.weight || '';
        if (nudge > 0 && suggestedWeight !== '' && !isNaN(parseFloat(suggestedWeight))) {
          suggestedWeight = String(parseFloat(suggestedWeight) + nudge);
        }

        const prevReps = parseInt(prevSet.reps || '0');
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
          suggested: nudge > 0 && suggestedWeight !== '',
          repsSuggested: true,
        };
      }
    });
    return carried;
  }
  return current;
}

export function saveDayWeek(dayIdx, weekIdx, data) {
  store.set(`foundry:day${dayIdx}:week${weekIdx}`, JSON.stringify(data));
  syncWorkoutToSupabase(dayIdx, weekIdx, data);
}

export function loadCardioLog(dayIdx, weekIdx) {
  const raw = store.get(`foundry:cardio:d${dayIdx}:w${weekIdx}`);
  return raw ? JSON.parse(raw) : null;
}

export function saveCardioLog(dayIdx, weekIdx, data) {
  store.set(`foundry:cardio:d${dayIdx}:w${weekIdx}`, JSON.stringify(data));
}

export function loadCardioSession(dateStr) {
  try {
    const r = store.get(`foundry:cardio:session:${dateStr}`);
    return r ? JSON.parse(r) : null;
  } catch (e) {
    console.warn('[Foundry]', 'Failed to load cardio session', e);
    return null;
  }
}

export function saveCardioSession(dateStr, data) {
  store.set(`foundry:cardio:session:${dateStr}`, JSON.stringify(data));
  syncCardioSessionToSupabase(dateStr, data);
}

export function loadMobilitySession(dateStr) {
  try {
    const r = store.get(`foundry:mobility:session:${dateStr}`);
    return r ? JSON.parse(r) : null;
  } catch (e) {
    console.warn('[Foundry]', 'Failed to load mobility session', e);
    return null;
  }
}

export function saveMobilitySession(dateStr, data) {
  store.set(`foundry:mobility:session:${dateStr}`, JSON.stringify(data));
}

export function loadNotes(dayIdx, weekIdx) {
  return store.get(`foundry:notes:d${dayIdx}:w${weekIdx}`) || '';
}

export function saveNotes(dayIdx, weekIdx, text) {
  store.set(`foundry:notes:d${dayIdx}:w${weekIdx}`, text);
  syncNotesToSupabase(dayIdx, weekIdx, text, loadExNotes(dayIdx, weekIdx));
}

export function loadExNotes(dayIdx, weekIdx) {
  try {
    return JSON.parse(store.get(`foundry:exnotes:d${dayIdx}:w${weekIdx}`) || '{}');
  } catch (e) {
    console.warn('[Foundry]', 'Failed to parse exercise notes', e);
    return {};
  }
}

export function saveExNotes(dayIdx, weekIdx, obj) {
  store.set(`foundry:exnotes:d${dayIdx}:w${weekIdx}`, JSON.stringify(obj));
  syncNotesToSupabase(dayIdx, weekIdx, loadNotes(dayIdx, weekIdx), obj);
}

export function loadExtraExNotes(dateStr) {
  try {
    return JSON.parse(store.get(`foundry:extra:exnotes:${dateStr}`) || '{}');
  } catch (e) {
    console.warn('[Foundry]', 'Failed to parse extra exercise notes', e);
    return {};
  }
}

export function saveExtraExNotes(dateStr, obj) {
  store.set(`foundry:extra:exnotes:${dateStr}`, JSON.stringify(obj));
}

export function hasAnyNotes(dayIdx, weekIdx) {
  if (loadNotes(dayIdx, weekIdx).trim()) return true;
  return Object.values(loadExNotes(dayIdx, weekIdx)).some((v) => v && v.trim());
}

export function hasAnyExtraNotes(dateStr) {
  const sn = store.get(`foundry:extra:notes:${dateStr}`) || '';
  if (sn.trim()) return true;
  return Object.values(loadExtraExNotes(dateStr)).some((v) => v && v.trim());
}

export function loadExOverride(dayIdx, weekIdx, exIdx) {
  return (
    store.get(`foundry:exov:d${dayIdx}:w${weekIdx}:ex${exIdx}`) ||
    store.get(`foundry:exov:d${dayIdx}:ex${exIdx}`) ||
    null
  );
}

export function saveExOverride(dayIdx, weekIdx, exIdx, exId, scope) {
  if (scope === 'week') {
    store.set(`foundry:exov:d${dayIdx}:w${weekIdx}:ex${exIdx}`, exId);
  } else {
    store.set(`foundry:exov:d${dayIdx}:ex${exIdx}`, exId);
  }
}

/**
 * Snapshot all foundry: keys into localStorage rolling backup.
 * Keeps the last 3 snapshots automatically.
 */
export function snapshotData() {
  try {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('foundry:') && !key.startsWith('foundry:backup:')) {
        data[key] = localStorage.getItem(key);
      }
    }
    const snap = JSON.stringify({
      version: 1,
      snappedAt: new Date().toISOString(),
      data,
    });
    const b2 = localStorage.getItem('foundry:backup:1');
    if (b2) localStorage.setItem('foundry:backup:2', b2);
    const b1 = localStorage.getItem('foundry:backup:0');
    if (b1) localStorage.setItem('foundry:backup:1', b1);
    localStorage.setItem('foundry:backup:0', snap);
  } catch (e) {
    console.warn('[Foundry]', 'Failed to snapshot data', e);
  }
}

/**
 * Export the most recent backup snapshot as a .json file.
 * User-initiated download only.
 */
export function exportData() {
  try {
    const raw = localStorage.getItem('foundry:backup:0');
    const payload =
      raw ||
      JSON.stringify({
        version: 1,
        snappedAt: new Date().toISOString(),
        data: (() => {
          const d = {};
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('foundry:') && !k.startsWith('foundry:backup:'))
              d[k] = localStorage.getItem(k);
          }
          return d;
        })(),
      });
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foundry-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
    store.set('foundry:last_backup_ts', Date.now().toString());
  } catch (e) {
    alert('Export failed.');
  }
}

/**
 * Import data from a backup .json file.
 * Accepts both old ppl: keys (auto-migrates to foundry:) and new foundry: keys.
 */
export function importData(file, onDone) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const data = parsed.data || parsed;
      let imported = 0;
      Object.entries(data).forEach(([k, v]) => {
        if (k.startsWith('foundry:')) {
          localStorage.setItem(k, v);
          imported++;
        } else if (k.startsWith('ppl:')) {
          // Migrate old ppl: keys to foundry: on import
          const newKey = 'foundry:' + k.slice(4);
          localStorage.setItem(newKey, v);
          imported++;
        }
      });
      console.log(`[Foundry] Imported ${imported} keys`);
      onDone(true);
    } catch (e) {
      console.warn('[Foundry]', 'Failed to parse import file', e);
      onDone(false);
    }
  };
  reader.readAsText(file);
}
