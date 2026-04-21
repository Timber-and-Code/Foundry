import { store } from './storage';
import { validateDayData } from './validate';
import {
  syncWorkoutToSupabase,
  syncCardioSessionToSupabase,
  syncNotesToSupabase,
} from './sync';
import type { DayData, TrainingDay, Profile, CardioSession } from '../types';

// ─── ACTIVE SESSION (top-of-shell bar) ────────────────────────────────────────
// Persistent marker so the user always sees that a workout/cardio session is
// running even after they navigate away. Separate from the completion-focused
// `foundry:done:*` / `foundry:sessionStart:*` keys — this is *only* for the
// ActiveSessionBar surface.
export type ActiveSession =
  | { kind: 'lifting'; label: string; route: string; startedAt: number; setsDone: number; totalSets: number }
  | { kind: 'cardio'; label: string; route: string; startedAt: number; durationMin: number };

const ACTIVE_SESSION_KEY = 'foundry:active_session';
const STALE_MS = 6 * 60 * 60 * 1000; // 6h

export function loadActiveSession(): ActiveSession | null {
  try {
    const raw = store.get(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSession;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.kind !== 'lifting' && parsed.kind !== 'cardio') return null;
    if (typeof parsed.startedAt !== 'number') return null;
    // Stale-session guard — drop anything older than 6h rather than showing
    // a zombie bar from a prior day.
    if (Date.now() - parsed.startedAt > STALE_MS) {
      store.remove(ACTIVE_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveSession(session: ActiveSession): void {
  try {
    store.set(ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('[Foundry]', 'Failed to save active session', e);
  }
}

export function clearActiveSession(): void {
  store.remove(ACTIVE_SESSION_KEY);
}

// ─── TRAINING DATA PERSISTENCE ────────────────────────────────────────────────

export function loadDayWeek(dayIdx: number, weekIdx: number): DayData {
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
export function loadDayWeekWithCarryover(
  dayIdx: number,
  weekIdx: number,
  day: TrainingDay,
  profile: Profile | null | undefined,
): DayData {
  const expRaw = profile?.experience || 'intermediate';
  const expNorm: Record<string, string> = {
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

    const carried: DayData = {};
    day.exercises.forEach((ex, exIdx) => {
      const prevEx = prev[exIdx] || {};
      const repParts = String(ex.reps).split('-');
      const rangeMin = parseInt(repParts[0]) || 1;
      const rangeMax = parseInt(repParts[repParts.length - 1]) || rangeMin;

      let allRepsHit = true;
      let hasAnyWorkingSet = false;
      const sets = typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets)) || 0;
      for (let s = 0; s < sets; s++) {
        const prevSet = prevEx[s] || {};
        if (prevSet.warmup) continue;
        hasAnyWorkingSet = true;
        const logged = parseInt(String(prevSet.reps || '0'));
        if (!logged || logged < rangeMax) {
          allRepsHit = false;
          break;
        }
      }

      let nudge = 0;
      let bwRepBump = false; // bodyweight: progress reps beyond rangeMax
      if (allRepsHit && hasAnyWorkingSet) {
        const equip = ex.equipment || '';
        if (ex.bw) {
          nudge = 0;
          bwRepBump = true; // signal to add reps instead of weight
        } else if (equip === 'barbell') {
          nudge = 5;
        } else if (equip === 'dumbbell') {
          const currentWeight = (() => {
            for (let s = 0; s < sets; s++) {
              const wVal = parseFloat(String((prevEx[s] || {}).weight || '0'));
              if (wVal > 0) return wVal;
            }
            return 0;
          })();
          nudge = currentWeight < 25 ? 2.5 : 5;
        } else {
          nudge = expKey === 'experienced' ? 2.5 : 5;
        }
      }

      carried[exIdx] = {};
      for (let s = 0; s < sets; s++) {
        const prevSet = prevEx[s] || {};
        let suggestedWeight = String(prevSet.weight ?? '');
        if (nudge > 0 && suggestedWeight !== '' && !isNaN(parseFloat(suggestedWeight))) {
          suggestedWeight = String(parseFloat(suggestedWeight) + nudge);
        }

        const prevReps = parseInt(String(prevSet.reps || '0'));
        let suggestedReps: string;
        if (nudge > 0) {
          // Weight went up → reset reps to bottom of range
          suggestedReps = String(rangeMin);
        } else if (bwRepBump && prevReps > 0) {
          // Bodyweight: no weight to add, so progress reps beyond rangeMax
          suggestedReps = String(prevReps + 1);
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

export function saveDayWeek(dayIdx: number, weekIdx: number, data: DayData): void {
  store.set(`foundry:day${dayIdx}:week${weekIdx}`, JSON.stringify(data));
  syncWorkoutToSupabase(dayIdx, weekIdx, data);
}

export function loadCardioLog(dayIdx: number, weekIdx: number): unknown {
  const raw = store.get(`foundry:cardio:d${dayIdx}:w${weekIdx}`);
  return raw ? JSON.parse(raw) : null;
}

export function saveCardioLog(dayIdx: number, weekIdx: number, data: unknown): void {
  store.set(`foundry:cardio:d${dayIdx}:w${weekIdx}`, JSON.stringify(data));
}

export function loadCardioSession(dateStr: string): CardioSession | null {
  try {
    const r = store.get(`foundry:cardio:session:${dateStr}`);
    return r ? (JSON.parse(r) as CardioSession) : null;
  } catch (e) {
    console.warn('[Foundry]', 'Failed to load cardio session', e);
    return null;
  }
}

export function saveCardioSession(dateStr: string, data: CardioSession): void {
  store.set(`foundry:cardio:session:${dateStr}`, JSON.stringify(data));
  syncCardioSessionToSupabase(dateStr, data);
}

export function loadMobilitySession(dateStr: string): { protocolId?: string | null; completed?: boolean; completedAt?: string | null; [key: string]: unknown } | null {
  try {
    const r = store.get(`foundry:mobility:session:${dateStr}`);
    return r ? JSON.parse(r) : null;
  } catch (e) {
    console.warn('[Foundry]', 'Failed to load mobility session', e);
    return null;
  }
}

export function saveMobilitySession(dateStr: string, data: unknown): void {
  store.set(`foundry:mobility:session:${dateStr}`, JSON.stringify(data));
}

export function loadNotes(dayIdx: number, weekIdx: number): string {
  return store.get(`foundry:notes:d${dayIdx}:w${weekIdx}`) || '';
}

export function saveNotes(dayIdx: number, weekIdx: number, text: string): void {
  store.set(`foundry:notes:d${dayIdx}:w${weekIdx}`, text);
  syncNotesToSupabase(dayIdx, weekIdx, text, loadExNotes(dayIdx, weekIdx));
}

export function loadExNotes(dayIdx: number, weekIdx: number): Record<string, string> {
  try {
    return JSON.parse(store.get(`foundry:exnotes:d${dayIdx}:w${weekIdx}`) || '{}') as Record<string, string>;
  } catch (e) {
    console.warn('[Foundry]', 'Failed to parse exercise notes', e);
    return {};
  }
}

export function saveExNotes(dayIdx: number, weekIdx: number, obj: Record<string, string>): void {
  store.set(`foundry:exnotes:d${dayIdx}:w${weekIdx}`, JSON.stringify(obj));
  syncNotesToSupabase(dayIdx, weekIdx, loadNotes(dayIdx, weekIdx), obj);
}

export function loadExtraExNotes(dateStr: string): Record<string, string> {
  try {
    return JSON.parse(store.get(`foundry:extra:exnotes:${dateStr}`) || '{}') as Record<string, string>;
  } catch (e) {
    console.warn('[Foundry]', 'Failed to parse extra exercise notes', e);
    return {};
  }
}

export function saveExtraExNotes(dateStr: string, obj: Record<string, string>): void {
  store.set(`foundry:extra:exnotes:${dateStr}`, JSON.stringify(obj));
}

export function hasAnyNotes(dayIdx: number, weekIdx: number): boolean {
  if (loadNotes(dayIdx, weekIdx).trim()) return true;
  return Object.values(loadExNotes(dayIdx, weekIdx)).some((v) => v && v.trim());
}

export function hasAnyExtraNotes(dateStr: string): boolean {
  const sn = store.get(`foundry:extra:notes:${dateStr}`) || '';
  if (sn.trim()) return true;
  return Object.values(loadExtraExNotes(dateStr)).some((v) => v && v.trim());
}

export function loadExOverride(dayIdx: number, weekIdx: number, exIdx: number): string | null {
  return (
    store.get(`foundry:exov:d${dayIdx}:w${weekIdx}:ex${exIdx}`) ||
    store.get(`foundry:exov:d${dayIdx}:ex${exIdx}`) ||
    null
  );
}

export function saveExOverride(
  dayIdx: number,
  weekIdx: number,
  exIdx: number,
  exId: string,
  scope: 'week' | 'meso',
): void {
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
export function snapshotData(): void {
  try {
    const data: Record<string, string | null> = {};
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
export function exportData(): void {
  try {
    const raw = localStorage.getItem('foundry:backup:0');
    const payload =
      raw ||
      JSON.stringify({
        version: 1,
        snappedAt: new Date().toISOString(),
        data: (() => {
          const d: Record<string, string | null> = {};
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
export function importData(file: File, onDone: (success: boolean) => void): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse((e.target as FileReader).result as string);
      const data = parsed.data || parsed;
      let imported = 0;
      Object.entries(data).forEach(([k, v]) => {
        if (k.startsWith('foundry:')) {
          localStorage.setItem(k, v as string);
          imported++;
        } else if (k.startsWith('ppl:')) {
          // Migrate old ppl: keys to foundry: on import
          const newKey = 'foundry:' + k.slice(4);
          localStorage.setItem(newKey, v as string);
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
