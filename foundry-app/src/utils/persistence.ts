import { store } from './storage';
import { validateDayData } from './validate';
import {
  syncWorkoutToSupabase,
  syncCardioSessionToSupabase,
  syncNotesToSupabase,
  syncCardioPresetToSupabase,
  deleteCardioPresetRemote,
} from './sync';
import type {
  DayData,
  DayDataV2,
  DayDataV2Slice,
  TrainingDay,
  Profile,
  CardioSession,
  CardioPreset,
  WorkoutSet,
} from '../types';

// ─── ACTIVE SESSION (top-of-shell bar) ────────────────────────────────────────
// Persistent marker so the user always sees that a workout/cardio session is
// running even after they navigate away. Separate from the completion-focused
// `foundry:done:*` / `foundry:sessionStart:*` keys — this is *only* for the
// ActiveSessionBar surface.
export type ActiveSession =
  | { kind: 'lifting'; label: string; route: string; startedAt: number; setsDone: number; totalSets: number }
  | { kind: 'cardio'; label: string; route: string; startedAt: number; durationMin: number }
  | { kind: 'mobility'; label: string; route: string; startedAt: number; durationMin?: number };

const ACTIVE_SESSION_KEY = 'foundry:active_session';
const STALE_MS = 6 * 60 * 60 * 1000; // 6h

export function loadActiveSession(): ActiveSession | null {
  try {
    const raw = store.get(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSession;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.kind !== 'lifting' && parsed.kind !== 'cardio' && parsed.kind !== 'mobility') return null;
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
 * Find the slot in `data` that holds sets for `exId`. Each set written by
 * handleUpdateSet stamps `_exId: exercise.id` on the set blob; this walks
 * the slots looking for a match.
 *
 * Used by carryover (loadDayWeekWithCarryover) and the per-exercise
 * "last week" reads in ExerciseCard so that a reorder, superset, or
 * this-session swap that shifts a slot's exIdx between weeks doesn't
 * cause the lookup to attribute the wrong exercise's data.
 *
 * If no slot matches (legacy data without _exId, or brand-new exercise),
 * falls back to `data[fallbackExIdx]` — today's behaviour. Returns an
 * empty object when neither path produces a hit so callers can iterate
 * without null checks.
 */
export function findPrevSlotForExercise(
  data: DayData,
  exId: string | number | undefined,
  fallbackExIdx: number,
): Record<string, Record<string, unknown>> {
  const idStr = exId == null ? null : String(exId);
  if (idStr) {
    for (const slice of Object.values(data)) {
      if (!slice || typeof slice !== 'object') continue;
      for (const set of Object.values(slice as unknown as Record<string, unknown>)) {
        if (
          set &&
          typeof set === 'object' &&
          String((set as Record<string, unknown>)._exId ?? '') === idStr
        ) {
          return slice as unknown as Record<string, Record<string, unknown>>;
        }
      }
    }
  }
  return (
    (data[fallbackExIdx] as unknown as Record<string, Record<string, unknown>>) || {}
  );
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
      // Find prior-week slot whose sets carry _exId === ex.id (set when
      // handleUpdateSet logs a set). Falls back to position-based lookup
      // when no slot matches — covers (a) legacy data written before
      // _exId stamping, and (b) brand-new exercises that have no prior
      // history. The find-by-id path is what immunises carryover from
      // reorder, superset pairing, and this-session swaps that shift
      // exIdx between weeks.
      const prevEx = findPrevSlotForExercise(prev, ex.id, exIdx);
      const repParts = String(ex.reps).split('-');
      const rangeMin = parseInt(repParts[0]) || 1;
      const rangeMax = parseInt(repParts[repParts.length - 1]) || rangeMin;
      const sets = typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets)) || 0;

      // ── Uniform baseline (#12a) ────────────────────────────────────────
      // The working-weight prescription this week is the HEAVIEST weight
      // hit on any working (non-warmup) set last week. If the lifter went
      // 100/100/95, the baseline is 100 — drops on later sets are fatigue,
      // not prescription. baselineReps = the reps achieved AT that
      // baseline weight (best rep performance among sets at the heaviest
      // weight) — this is what the nudge calc compares against.
      type PrevSetShape = { weight?: unknown; reps?: unknown; warmup?: unknown };
      const completedPrevSets: { weight: number; reps: number }[] = [];
      for (let s = 0; s < sets; s++) {
        const psd = (prevEx[s] || {}) as PrevSetShape;
        if (psd.warmup) continue;
        const wRaw = psd.weight;
        const w = wRaw === undefined || wRaw === null || String(wRaw).trim() === ''
          ? NaN
          : parseFloat(String(wRaw));
        const r = parseInt(String(psd.reps ?? '0')) || 0;
        if (Number.isFinite(w) && w > 0) {
          completedPrevSets.push({ weight: w, reps: r });
        }
      }
      const baselineWeight = completedPrevSets.length > 0
        ? Math.max(...completedPrevSets.map((s) => s.weight))
        : 0;
      // Reps achieved at the baseline (heaviest) weight — pick the best
      // rep count among sets matching the baseline weight, so a 100x10 +
      // 100x8 prior week reads as "10 reps at 100" for nudge purposes.
      const baselineReps = baselineWeight > 0
        ? completedPrevSets
            .filter((s) => s.weight === baselineWeight)
            .reduce((best, s) => Math.max(best, s.reps), 0)
        : 0;

      // ── Nudge calc (#12b) ─────────────────────────────────────────────
      // Bumping weight requires the lifter to have hit the TOP of the
      // range at the baseline weight. Earlier behavior compared per-index
      // reps against rangeMax — under uniform-baseline that's still the
      // right idea but evaluated against `baselineReps`, the reps hit at
      // the heaviest weight.
      const allRepsHit = baselineReps >= rangeMax && completedPrevSets.length > 0;
      let nudge = 0;
      let bwRepBump = false;
      if (allRepsHit) {
        const equip = ex.equipment || '';
        if (ex.bw) {
          nudge = 0;
          bwRepBump = true;
        } else if (equip === 'barbell') {
          nudge = 5;
        } else if (equip === 'dumbbell') {
          nudge = baselineWeight < 25 ? 2.5 : 5;
        } else {
          nudge = expKey === 'experienced' ? 2.5 : 5;
        }
      }

      const suggestedWeightStr = baselineWeight > 0
        ? (nudge > 0 ? String(baselineWeight + nudge) : String(baselineWeight))
        : '';

      let suggestedRepsStr: string;
      if (nudge > 0) {
        // Weight went up → reset reps to bottom of range
        suggestedRepsStr = String(rangeMin);
      } else if (bwRepBump && baselineReps > 0) {
        // Bodyweight: no weight to add, so progress reps beyond rangeMax
        suggestedRepsStr = String(baselineReps + 1);
      } else if (baselineReps > 0) {
        suggestedRepsStr = String(Math.min(baselineReps + 1, rangeMax));
      } else {
        suggestedRepsStr = String(rangeMin);
      }

      carried[exIdx] = {};
      for (let s = 0; s < sets; s++) {
        carried[exIdx][s] = {
          weight: suggestedWeightStr,
          reps: suggestedRepsStr,
          suggested: nudge > 0 && suggestedWeightStr !== '',
          repsSuggested: true,
        };
      }
    });
    return carried;
  }
  return current;
}

// ─── DayData v2 (id-keyed) — Big-Big Phase 1 ───────────────────────────────
// Parallel storage that re-keys per-day data from implicit array position to
// `training_day_exercises.id` (uuid). Phase 1 dual-writes only; reads + sync
// wiring come in Phase 3. Default-OFF feature flag; flip with the dev-only
// `window.__foundryEnableDayV2Writes(true)` helper exposed in main.tsx.

const DAY_V2_WRITES_FLAG = 'foundry:flag:day_v2_writes';

/**
 * Whether dual-write of v2 (id-keyed) DayData is enabled. Default OFF.
 * Phase 3 will introduce a separate read-side flag.
 */
export function isDayV2WritesEnabled(): boolean {
  return store.get(DAY_V2_WRITES_FLAG) === '1';
}

function v2KeyFor(dayIdx: number, weekIdx: number): string {
  return `foundry:day_v2:${dayIdx}:${weekIdx}`;
}

/**
 * Load v2-shape DayData for (dayIdx, weekIdx). Returns `{}` for missing keys
 * or malformed JSON. Pure localStorage read — never falls back to v1.
 */
export function loadDayWeekV2(dayIdx: number, weekIdx: number): DayDataV2 {
  const raw = store.get(v2KeyFor(dayIdx, weekIdx));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as DayDataV2;
  } catch (e) {
    console.warn('[Foundry]', 'Failed to parse v2 day data', e);
    return {};
  }
}

/**
 * Persist v2-shape DayData. localStorage only — Phase 3 owns Supabase wiring.
 */
export function saveDayWeekV2(dayIdx: number, weekIdx: number, data: DayDataV2): void {
  store.set(v2KeyFor(dayIdx, weekIdx), JSON.stringify(data));
}

/**
 * Build the v2 shape from the v1 shape using the (mesoId-scoped) tde-id cache.
 * Slots whose tde-id is missing from the cache or whose set blobs lack
 * `_exId` (Med-patch carryover marker) are SKIPPED — Phase 2 migration will
 * backfill them from the program. Pure helper; no I/O.
 */
function buildV2FromV1(
  dayIdx: number,
  data: DayData,
  tdeIds: Record<string, string>,
): DayDataV2 {
  const v2: DayDataV2 = {};
  for (const exIdxStr of Object.keys(data)) {
    const exIdx = parseInt(exIdxStr, 10);
    if (!Number.isFinite(exIdx)) continue;
    const tdeId = tdeIds[`${dayIdx}:${exIdx}`];
    if (!tdeId) continue; // No id mapping yet — Phase 2 will backfill.
    const setsMap = data[exIdxStr] || {};
    // Pull `_exId` from any set in the slice (Med stamps it on every write).
    // Sets are typed as WorkoutSet but allow extras to pass through; treat as
    // Record<string, unknown> for the lookup so we don't widen the public type.
    let exId: string | undefined;
    for (const setKey of Object.keys(setsMap)) {
      const blob = setsMap[setKey] as unknown as Record<string, unknown>;
      const candidate = blob && typeof blob._exId === 'string' ? blob._exId : undefined;
      if (candidate) {
        exId = candidate;
        break;
      }
    }
    if (!exId) {
      // Legacy data written before Med stamped `_exId`. Skip; Phase 2 backfill.
      console.debug('[Foundry] v2 dual-write: skipping slot without _exId', {
        dayIdx,
        exIdx,
      });
      continue;
    }
    const slice: DayDataV2Slice = {
      sortOrder: exIdx,
      exId,
      sets: setsMap as Record<string, WorkoutSet>,
    };
    v2[tdeId] = slice;
  }
  return v2;
}

export function saveDayWeek(dayIdx: number, weekIdx: number, data: DayData): void {
  store.set(`foundry:day${dayIdx}:week${weekIdx}`, JSON.stringify(data));
  syncWorkoutToSupabase(dayIdx, weekIdx, data);

  // Phase 1 dual-write: gated on flag + tde-id cache availability. Wrapped in
  // try/catch so a v2 write failure cannot break the v1 path (which is still
  // the source of truth until Phase 4).
  if (!isDayV2WritesEnabled()) return;
  try {
    const mesoId = store.get('foundry:active_meso_id');
    if (!mesoId) return;
    const tdeRaw = store.get(`foundry:tde_ids:${mesoId}`);
    if (!tdeRaw) return;
    let tdeIds: Record<string, string>;
    try {
      const parsed = JSON.parse(tdeRaw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      tdeIds = parsed as Record<string, string>;
    } catch {
      return;
    }
    const v2 = buildV2FromV1(dayIdx, data, tdeIds);
    if (Object.keys(v2).length === 0) return;
    saveDayWeekV2(dayIdx, weekIdx, v2);
  } catch (e) {
    console.warn('[Foundry]', 'Failed to dual-write v2 day data', e);
  }
}

export type SupersetPair = [string, string];

export function loadSupersets(dayIdx: number, weekIdx: number): SupersetPair[] {
  const raw = store.get(`foundry:supersets:d${dayIdx}:w${weekIdx}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: unknown): p is SupersetPair =>
        Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string',
    );
  } catch {
    return [];
  }
}

export function saveSupersets(
  dayIdx: number,
  weekIdx: number,
  pairs: SupersetPair[],
): void {
  const key = `foundry:supersets:d${dayIdx}:w${weekIdx}`;
  if (!pairs.length) {
    store.remove(key);
    return;
  }
  store.set(key, JSON.stringify(pairs));
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

// ─── CARDIO PRESETS (user-saved 4-axis compositions) ─────────────────────────
// Group D / C2 — local-only persistence today. Each user-saved Designer
// composition lives under a single localStorage key. Built-in CARDIO_WORKOUTS
// are NOT persisted here; they're sourced from src/data/constants.ts.
//
// TODO: Supabase sync via user_cardio_presets table — pattern after
//   user_friendships migration (additive, no schema breaking changes).

const CARDIO_PRESETS_KEY = 'foundry:cardio:user-presets';

export function loadCardioPresets(): CardioPreset[] {
  try {
    const raw = store.get(CARDIO_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: drop entries that don't at minimum carry an id + label so a
    // bad migration / partial write can't crash callers downstream.
    return parsed.filter(
      (p: unknown): p is CardioPreset =>
        !!p && typeof p === 'object' && typeof (p as CardioPreset).id === 'string'
          && typeof (p as CardioPreset).label === 'string',
    );
  } catch (e) {
    console.warn('[Foundry]', 'Failed to load cardio presets', e);
    return [];
  }
}

export function saveCardioPreset(preset: CardioPreset): void {
  const all = loadCardioPresets();
  const idx = all.findIndex((p) => p.id === preset.id);
  if (idx >= 0) all[idx] = preset;
  else all.push(preset);
  store.set(CARDIO_PRESETS_KEY, JSON.stringify(all));
  // Fire-and-forget remote echo. Failures land in reportSyncFailure
  // (not the user's face) so offline saves still feel instant.
  void syncCardioPresetToSupabase(preset);
}

export function deleteCardioPreset(id: string): void {
  const all = loadCardioPresets();
  const next = all.filter((p) => p.id !== id);
  store.set(CARDIO_PRESETS_KEY, JSON.stringify(next));
  void deleteCardioPresetRemote(id);
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
