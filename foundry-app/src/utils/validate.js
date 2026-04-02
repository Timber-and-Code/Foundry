// ─── SCHEMA VALIDATORS FOR LOCALSTORAGE READS ────────────────────────────────
// Each validator checks the shape of data after JSON.parse but before the app
// uses it. On failure, logs a warning and returns a safe default.

const VALID_SPLITS = ['ppl', 'upper_lower', 'full_body', 'push_pull'];

// ─── PROFILE ─────────────────────────────────────────────────────────────────
// Expected: { name: string, experience: string, goal: string, days: number,
//             split: string, ... }
// Returns null if invalid so the app falls back to fresh profile creation.

export function validateProfile(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    console.warn('[Foundry] validateProfile: invalid data shape', data);
    return null;
  }
  if (typeof data.experience !== 'string') {
    console.warn('[Foundry] validateProfile: missing required experience field', data);
    return null;
  }
  return data;
}

// ─── DAY DATA ─────────────────────────────────────────────────────────────────
// Expected: { [exerciseIndex]: { [setIndex]: { weight: number, reps: number } } }
// Non-numeric weight/reps are replaced with 0; malformed entries are dropped.
// Returns cleaned data (may be empty object if nothing is salvageable).

export function validateDayData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  const cleaned = {};
  for (const exIdx of Object.keys(data)) {
    const sets = data[exIdx];
    if (!sets || typeof sets !== 'object' || Array.isArray(sets)) continue;
    cleaned[exIdx] = {};
    for (const setIdx of Object.keys(sets)) {
      const s = sets[setIdx];
      if (!s || typeof s !== 'object' || Array.isArray(s)) continue;
      cleaned[exIdx][setIdx] = {
        ...s,
        weight: !isNaN(parseFloat(s.weight)) ? s.weight : 0,
        reps: !isNaN(parseInt(s.reps, 10)) ? s.reps : 0,
      };
    }
  }
  return cleaned;
}

// ─── MESO CONFIG ──────────────────────────────────────────────────────────────
// Expected: { days: number, weeks: number, split: string, ... }
// Out-of-range or missing values are replaced with safe defaults.

export function validateMesoConfig(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    console.warn('[Foundry] validateMesoConfig: invalid data shape', data);
    return { days: 4, weeks: 6, split: 'ppl' };
  }
  const days = Number(data.days);
  const weeks = Number(data.weeks);
  const split = data.split;
  return {
    ...data,
    days: days >= 2 && days <= 6 ? days : 4,
    weeks: weeks >= 4 && weeks <= 8 ? weeks : 6,
    split: VALID_SPLITS.includes(split) ? split : 'ppl',
  };
}

// ─── ARCHIVE ──────────────────────────────────────────────────────────────────
// Expected: array of meso objects, each with at least an id field.
// Non-array input returns []; malformed entries are filtered out.

export function validateArchive(data) {
  if (!Array.isArray(data)) {
    console.warn('[Foundry] validateArchive: expected array', data);
    return [];
  }
  return data.filter((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    if (entry.id == null) return false;
    return true;
  });
}
