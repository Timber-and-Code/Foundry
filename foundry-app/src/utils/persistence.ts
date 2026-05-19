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
 * Per-exercise carryover math, shared by the v1 (position-keyed) and v2
 * (id-keyed) read paths. Given an exercise spec + the prior-week slice that
 * holds its sets + the experience key, returns the per-set carryover values
 * (suggested weight, reps, flags). Pure function — no I/O.
 *
 * Algorithm:
 *  - Uniform baseline: prescription = heaviest working-weight hit last week.
 *  - Nudge calc: if reps achieved at baseline ≥ rangeMax, bump weight by
 *    equipment- and experience-aware delta. Bodyweight → progress reps.
 *  - Otherwise: hold weight, suggest +1 rep up to rangeMax.
 */
function computeCarryoverForOneExercise(
  ex: TrainingDay['exercises'][number],
  prevEx: Record<string, Record<string, unknown>>,
  expKey: string,
): Record<string, WorkoutSet> {
  const repParts = String(ex.reps).split('-');
  const rangeMin = parseInt(repParts[0]) || 1;
  const rangeMax = parseInt(repParts[repParts.length - 1]) || rangeMin;
  const sets = typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets)) || 0;

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
  const baselineReps = baselineWeight > 0
    ? completedPrevSets
        .filter((s) => s.weight === baselineWeight)
        .reduce((best, s) => Math.max(best, s.reps), 0)
    : 0;

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
    suggestedRepsStr = String(rangeMin);
  } else if (bwRepBump && baselineReps > 0) {
    suggestedRepsStr = String(baselineReps + 1);
  } else if (baselineReps > 0) {
    suggestedRepsStr = String(Math.min(baselineReps + 1, rangeMax));
  } else {
    suggestedRepsStr = String(rangeMin);
  }

  const out: Record<string, WorkoutSet> = {};
  for (let s = 0; s < sets; s++) {
    out[s] = {
      weight: suggestedWeightStr,
      reps: suggestedRepsStr,
      suggested: nudge > 0 && suggestedWeightStr !== '',
      repsSuggested: true,
    };
  }
  return out;
}

function expKeyFromProfile(profile: Profile | null | undefined): string {
  const expRaw = profile?.experience || 'intermediate';
  const expNorm: Record<string, string> = {
    new: 'beginner',
    beginner: 'beginner',
    intermediate: 'intermediate',
    advanced: 'experienced',
    experienced: 'experienced',
  };
  return expNorm[expRaw] || 'intermediate';
}

/**
 * v1 carryover walk — position-keyed storage with `_exId`-stamp lookup
 * (Med-fix). Returns `current` if no prior week has weights. Pre-condition:
 * `current` already known not to have data (caller checks).
 */
function loadDayWeekWithCarryoverV1(
  dayIdx: number,
  weekIdx: number,
  day: TrainingDay,
  profile: Profile | null | undefined,
  current: DayData,
): DayData {
  const expKey = expKeyFromProfile(profile);
  for (let w = weekIdx - 1; w >= 0; w--) {
    const prev = loadDayWeek(dayIdx, w);
    const prevHasWeights = Object.values(prev).some((exData) =>
      Object.values(exData).some((s) => s && s.weight)
    );
    if (!prevHasWeights) continue;

    const carried: DayData = {};
    day.exercises.forEach((ex, exIdx) => {
      // Find prior-week slot whose sets carry _exId === ex.id (Med-fix).
      // Falls back to position-based lookup for legacy data / brand-new
      // exercises with no prior history.
      const prevEx = findPrevSlotForExercise(prev, ex.id, exIdx);
      carried[exIdx] = computeCarryoverForOneExercise(ex, prevEx, expKey);
    });
    return carried;
  }
  return current;
}

/**
 * v2 carryover walk — id-keyed storage. Walks prior weeks looking for v2
 * data with weights. Returns `null` when no v2 prior week is usable, so the
 * caller can fall through to v1. Pre-condition: caller already determined
 * carryover is needed (current week has no data, weekIdx > 0).
 *
 * Per-exercise lookup: tdeIds[`${dayIdx}:${exIdx}`] → tdeId → prevV2[tdeId].
 * Slots without a tde-id mapping (Phase 2 backfill misses) skip carryover
 * for that exercise and yield empty carried sets — the lifter sees no
 * suggestion, same as a brand-new exercise, no inheritance from a stale
 * slot's history.
 */
function loadDayWeekWithCarryoverV2(
  dayIdx: number,
  weekIdx: number,
  day: TrainingDay,
  profile: Profile | null | undefined,
  tdeIds: Record<string, string>,
): DayData | null {
  const expKey = expKeyFromProfile(profile);
  for (let w = weekIdx - 1; w >= 0; w--) {
    const prevV2 = loadDayWeekV2(dayIdx, w);
    if (Object.keys(prevV2).length === 0) continue;
    const prevHasWeights = Object.values(prevV2).some((slice) =>
      Object.values(slice?.sets || {}).some((s) => s && s.weight),
    );
    if (!prevHasWeights) continue;

    const carried: DayData = {};
    day.exercises.forEach((ex, exIdx) => {
      const tdeId = tdeIds[`${dayIdx}:${exIdx}`];
      const prevSlice = tdeId ? prevV2[tdeId]?.sets || {} : {};
      carried[exIdx] = computeCarryoverForOneExercise(
        ex,
        prevSlice as unknown as Record<string, Record<string, unknown>>,
        expKey,
      );
    });
    return carried;
  }
  return null;
}

/**
 * Load current week data with automatic weight/rep progression hints.
 *
 * Reads from v2 (id-keyed) storage when `foundry:flag:day_v2_reads === '1'`
 * AND a tde-id cache is available, falling through to v1 (position-keyed)
 * when v2 has no usable prior data, the flag is off, or the cache is missing.
 * Single public entry point — callers don't need to know which storage is
 * authoritative.
 */
export function loadDayWeekWithCarryover(
  dayIdx: number,
  weekIdx: number,
  day: TrainingDay,
  profile: Profile | null | undefined,
): DayData {
  const current = loadDayWeek(dayIdx, weekIdx);
  const hasData = Object.values(current).some((exData) =>
    Object.values(exData).some((s) => s && (s.weight || s.reps))
  );
  if (hasData || weekIdx === 0) return current;

  if (isDayV2ReadsEnabled()) {
    const tdeIds = loadTdeIdsForActiveMeso();
    if (tdeIds) {
      const v2Result = loadDayWeekWithCarryoverV2(dayIdx, weekIdx, day, profile, tdeIds);
      if (v2Result !== null) return v2Result;
    }
  }
  return loadDayWeekWithCarryoverV1(dayIdx, weekIdx, day, profile, current);
}

/** Load + parse the active meso's tde-id positional→uuid map. Null on any miss. */
function loadTdeIdsForActiveMeso(): Record<string, string> | null {
  const mesoId = store.get('foundry:active_meso_id');
  if (!mesoId) return null;
  const raw = store.get(`foundry:tde_ids:${mesoId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

// ─── DayData v2 (id-keyed) — Big-Big Phase 3 (default ON) ──────────────────
// Parallel storage that re-keys per-day data from implicit array position to
// `training_day_exercises.id` (uuid). Both flags now default ON (Phase 3):
// writes dual-write to v2 so it stays fresh, and reads pull from v2 first
// with a v1 fall-through on miss (covers un-migrated users). Both can be
// force-disabled per device — set the flag to '0' via the dev-only
// `window.__foundryEnableDayV2Writes(false)` / `...Reads(false)` helpers.

const DAY_V2_WRITES_FLAG = 'foundry:flag:day_v2_writes';
const DAY_V2_READS_FLAG = 'foundry:flag:day_v2_reads';

/**
 * Whether dual-write of v2 (id-keyed) DayData is enabled. Default ON —
 * only an explicit '0' disables it. Writes must stay on for reads to be
 * safe: otherwise v2 goes stale and v2-first reads serve stale carryover.
 */
export function isDayV2WritesEnabled(): boolean {
  return store.get(DAY_V2_WRITES_FLAG) !== '0';
}

/**
 * Whether read-from-v2 is enabled. Default ON — only an explicit '0'
 * disables it. When ON the carryover read tries v2 storage first, falling
 * through to v1 on miss (un-migrated users / pre-v2 data).
 */
export function isDayV2ReadsEnabled(): boolean {
  return store.get(DAY_V2_READS_FLAG) !== '0';
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

/**
 * Per-exercise set-count overrides for a given (day, week).
 *
 * The program prescribes a set count, and getWeekSets() week-adjusts it.
 * But when the lifter adds or removes a set mid-workout, that change only
 * lives in component state — `resolveExercises` and the done-exercise calc
 * both rebuild the count from the program on every mount, so the change
 * vanishes on re-entry (a removed set re-appears as an incomplete row).
 *
 * This map records the lifter's actual chosen count. Keyed by EXERCISE_DB
 * id (stable across reorder; no reindexing needed). Same-exercise-in-two-
 * slots shares the override — an accepted edge case, mirroring supersets.
 */
export function loadSetCounts(dayIdx: number, weekIdx: number): Record<string, number> {
  const raw = store.get(`foundry:setcount:d${dayIdx}:w${weekIdx}`);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveSetCount(
  dayIdx: number,
  weekIdx: number,
  exId: string,
  count: number,
): void {
  if (!exId || !Number.isFinite(count) || count < 1) return;
  const current = loadSetCounts(dayIdx, weekIdx);
  current[exId] = count;
  store.set(`foundry:setcount:d${dayIdx}:w${weekIdx}`, JSON.stringify(current));
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
