import * as Sentry from '@sentry/react';
import { supabase } from './supabase.js';
import { store } from './storage.js';
import type { Profile, ReadinessEntry, DayData, MesoMember, FriendWorkoutData } from '../types';
// validateDayData + validateProfile are imported by other modules; sync.ts
// will use them again once workouts/readiness chunks migrate to the
// normalized schema. For chunk 1 (profile only), neither is needed here.

// ─── NORMALIZED SCHEMA MIGRATION STATE ──────────────────────────────────────
// The Supabase schema is normalized (mesocycles, training_days, workout_sets,
// etc.) — see ARCHITECTURE.md. Sync is being migrated table-by-table to use
// the normalized columns. Tables marked `true` here have been migrated; the
// others early-return without trying to sync, so users aren't spammed with
// "Cloud sync failed" toasts for features that are still pending migration.
const MIGRATED = {
  profile: true,            // Chunk 1
  mesocycles: true,         // Chunk 2
  training_structure: true, // Chunk 3
  workouts: true,           // Chunk 4
  readiness: true,          // Chunk 5b
  bodyweight: true,         // Chunk 5a
  cardio: true,             // Chunk 5c
  notes: true,              // Chunk 5d
};

// ─── PROFILE FIELD MAPPERS (app <-> normalized user_profiles) ───────────────
// App-side Profile has a mix of identity fields (name, experience, goal...)
// and meso-config fields (workoutDays, mesoLength, startDate, sessionDuration).
// The normalized user_profiles table only stores identity + high-level
// preferences. Meso-specific fields will migrate to the mesocycles table in
// chunk 2 and remain localStorage-only until then.

type SupabaseExperience = 'beginner' | 'intermediate' | 'advanced';
type SupabasePrimaryGoal =
  | 'build_muscle'
  | 'build_strength'
  | 'lose_fat'
  | 'general_fitness'
  // Legacy — kept so appGoalToEnum can read old DB rows and remap them
  | 'improve_fitness'
  | 'sport_conditioning';
type SupabaseSplitType = 'PPL' | 'UL' | 'FB' | 'PP';

interface SupabaseProfileRow {
  id: string;
  name: string;
  experience: SupabaseExperience;
  primary_goal: SupabasePrimaryGoal;
  days_per_week: number;
  preferred_split: SupabaseSplitType;
  equipment: string[];
  gender: string | null;
  date_of_birth: string | null;
  weight_lbs: number | null;
  additional_notes: string | null;
  workout_days: number[];        // chunk 2 — days of week [0-6]
  session_duration_min: number;  // chunk 2
  active_meso_id: string | null; // chunk 2 — FK to mesocycles.id
  updated_at?: string;
}

// ─── MESOCYCLE TYPES (chunk 2) ──────────────────────────────────────────────
type SupabaseMesoStatus = 'active' | 'completed' | 'abandoned';

interface SupabaseMesocycleRow {
  id: string;
  user_id: string;
  name: string;
  status: SupabaseMesoStatus;
  weeks_count: number;
  days_per_week: number;
  split_type: SupabaseSplitType;
  started_at: string | null;
  completed_at: string | null;
  updated_at?: string;
}

function appExperienceToEnum(exp: unknown): SupabaseExperience {
  // OnboardingFlow uses 'new' as the beginner option; other flows use
  // 'beginner'. Normalize both to the enum value.
  if (exp === 'new' || exp === 'beginner') return 'beginner';
  if (exp === 'advanced') return 'advanced';
  return 'intermediate';
}

function appGoalToEnum(goal: unknown): SupabasePrimaryGoal {
  if (typeof goal !== 'string') return 'build_muscle';
  // Remap legacy values to general_fitness
  if (goal === 'improve_fitness' || goal === 'sport_conditioning') {
    return 'general_fitness';
  }
  const valid: SupabasePrimaryGoal[] = [
    'build_muscle',
    'build_strength',
    'lose_fat',
    'general_fitness',
  ];
  if ((valid as string[]).includes(goal)) {
    return goal as SupabasePrimaryGoal;
  }
  return 'build_muscle';
}

function appSplitToEnum(split: unknown): SupabaseSplitType {
  const upper = String(split || 'PPL').toUpperCase();
  if (upper === 'PPL' || upper === 'UL' || upper === 'FB' || upper === 'PP') {
    return upper;
  }
  return 'PPL';
}

function appProfileToSupabaseRow(
  profile: Profile,
  userId: string,
): Omit<SupabaseProfileRow, 'updated_at'> {
  const p = profile as unknown as Record<string, unknown>;
  // Equipment: app setup stores as string[], older profiles may have a single
  // string. Normalize to string[] for the text[] column.
  let equipment: string[];
  const rawEq = p.equipment;
  if (Array.isArray(rawEq)) {
    equipment = rawEq.map(String).filter(Boolean);
  } else if (typeof rawEq === 'string' && rawEq) {
    equipment = [rawEq];
  } else {
    equipment = ['full_gym'];
  }
  if (equipment.length === 0) equipment = ['full_gym'];

  const weightNum =
    p.weight != null && p.weight !== ''
      ? parseFloat(String(p.weight))
      : null;

  // workout_days: smallint[] of day-of-week numbers 0-6 (Sun-Sat)
  let workoutDays: number[];
  const rawWd = p.workoutDays;
  if (Array.isArray(rawWd)) {
    workoutDays = rawWd
      .map((d) => Number(d))
      .filter((d) => !isNaN(d) && d >= 0 && d <= 6);
  } else {
    workoutDays = [1, 3, 5]; // sensible default: Mon/Wed/Fri
  }
  if (workoutDays.length === 0) workoutDays = [1, 3, 5];

  const sessionDuration = Number(p.sessionDuration);

  // Active meso id: tracks which mesocycle row is currently loaded. Written
  // locally as foundry:active_meso_id, mirrored here as the FK column.
  const activeMesoId = typeof window !== 'undefined'
    ? (localStorage.getItem('foundry:active_meso_id') || null)
    : null;

  return {
    id: userId,
    name: (typeof p.name === 'string' && p.name) || 'User',
    experience: appExperienceToEnum(p.experience),
    primary_goal: appGoalToEnum(p.goal),
    days_per_week: Number(p.daysPerWeek) || 3,
    preferred_split: appSplitToEnum(p.splitType),
    equipment,
    gender: typeof p.gender === 'string' ? p.gender : null,
    date_of_birth: typeof p.birthdate === 'string' ? p.birthdate : null,
    weight_lbs: weightNum && !isNaN(weightNum) ? weightNum : null,
    additional_notes: null,
    workout_days: workoutDays,
    session_duration_min: sessionDuration && !isNaN(sessionDuration) ? sessionDuration : 60,
    active_meso_id: activeMesoId,
  };
}

function supabaseRowToAppProfileFields(row: SupabaseProfileRow): Record<string, unknown> {
  // Returns identity fields AND user-level preferences (workoutDays,
  // sessionDuration). Meso-specific fields (mesoLength, startDate) come
  // from the mesocycles row via supabaseMesoRowToAppFields — not here.
  return {
    name: row.name,
    experience: row.experience,
    goal:
      row.primary_goal === 'improve_fitness' || row.primary_goal === 'sport_conditioning'
        ? 'general_fitness'
        : row.primary_goal,
    splitType: row.preferred_split.toLowerCase(),
    daysPerWeek: row.days_per_week,
    equipment: Array.isArray(row.equipment) ? row.equipment : [],
    gender: row.gender ?? undefined,
    birthdate: row.date_of_birth ?? undefined,
    weight: row.weight_lbs != null ? String(row.weight_lbs) : undefined,
    workoutDays: Array.isArray(row.workout_days) ? row.workout_days : [1, 3, 5],
    sessionDuration: row.session_duration_min ?? 60,
  };
}

// ─── MESOCYCLE MAPPERS (chunk 2) ────────────────────────────────────────────

function generateMesoName(weeksCount: number, splitType: SupabaseSplitType, startedAt: string | null): string {
  const date = startedAt ? new Date(startedAt) : new Date();
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${weeksCount} Week ${splitType} — ${month} ${year}`;
}

function appProfileToMesocycleRow(
  profile: Profile,
  userId: string,
  mesoId: string,
): Omit<SupabaseMesocycleRow, 'updated_at'> {
  const p = profile as unknown as Record<string, unknown>;
  const weeksCount = Number(p.mesoLength) || 6;
  const splitType = appSplitToEnum(p.splitType);
  const startedAt = typeof p.startDate === 'string' ? p.startDate : null;

  return {
    id: mesoId,
    user_id: userId,
    name: generateMesoName(weeksCount, splitType, startedAt),
    status: 'active',
    weeks_count: weeksCount,
    days_per_week: Number(p.daysPerWeek) || 3,
    split_type: splitType,
    started_at: startedAt,
    completed_at: null,
  };
}

function supabaseMesoRowToAppFields(row: SupabaseMesocycleRow): Record<string, unknown> {
  // Returns ONLY the meso-specific fields. Identity fields come from
  // supabaseRowToAppProfileFields separately.
  return {
    splitType: row.split_type.toLowerCase(),
    mesoLength: row.weeks_count,
    daysPerWeek: row.days_per_week,
    startDate: row.started_at ?? undefined,
  };
}

function getOrCreateActiveMesoId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID();
  const existing = localStorage.getItem('foundry:active_meso_id');
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem('foundry:active_meso_id', fresh);
  return fresh;
}

// ─── TRAINING STRUCTURE TYPES (chunk 3) ─────────────────────────────────────
// training_days: one row per day slot in a meso (e.g. Push Day, Pull Day)
// training_day_exercises: one row per exercise in a day (the program details)

type SupabaseProgressionType =
  | 'double_progression'
  | 'linear'
  | 'rpe_based'
  | 'wave'
  | 'maintenance';

interface SupabaseTrainingDayRow {
  id: string;
  meso_id: string;
  user_id: string;
  day_index: number;
  label: string;
}

interface SupabaseTrainingDayExerciseRow {
  id: string;
  training_day_id: string;
  user_id: string;
  exercise_id: string;
  sort_order: number;
  sets: number;
  rep_min: number;
  rep_max: number;
  progression: SupabaseProgressionType;
  is_warmup: boolean;
  is_anchor: boolean;
  modifier: string | null;
}

// Parse the app's rep-range string ("6-10", "8", "12-15") into min/max integers.
function parseRepRange(reps: unknown): { min: number; max: number } {
  if (typeof reps === 'number') return { min: reps, max: reps };
  if (typeof reps !== 'string') return { min: 8, max: 12 };
  const trimmed = reps.trim();
  const match = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (match) {
    return { min: parseInt(match[1], 10), max: parseInt(match[2], 10) };
  }
  const single = parseInt(trimmed, 10);
  if (!isNaN(single)) return { min: single, max: single };
  return { min: 8, max: 12 };
}

// Map the app's binary 'weight'/'reps' progression to the normalized enum.
// Compound lifts and anchors use double_progression (hit rep target, add
// weight). Accessory 'reps' exercises use linear (add reps within a fixed
// weight). This is a pragmatic mapping — chunk 3 TODO: revisit once we have
// real user data to validate the mapping makes sense in practice.
function mapProgressionType(exercise: { progression?: unknown; anchor?: unknown }): SupabaseProgressionType {
  if (exercise.progression === 'reps') return 'linear';
  return 'double_progression';
}

// Chunk 3: ensure the training_days + training_day_exercises rows exist for
// the given meso. Idempotent — checks if rows already exist and early-returns
// if so. Called from saveProfile after the mesocycle row is upserted.
//
// Uses dynamic import() to break the static circular dependency chain
// (sync → program → training → sync). At runtime this resolves fine.
export async function ensureTrainingStructureRemote(
  mesoId: string,
  profile: Profile,
): Promise<void> {
  if (!MIGRATED.training_structure) return;
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;

    // Skip if the structure already exists for this meso.
    const { data: existing, error: checkError } = await supabase
      .from('training_days')
      .select('id')
      .eq('meso_id', mesoId)
      .eq('user_id', user.id)
      .limit(1);

    if (checkError) throw checkError;
    if (existing && existing.length > 0) return; // already populated

    // Dynamic imports to avoid static circular dependency.
    const [programMod, exercisesMod] = await Promise.all([
      import('./program'),
      import('../data/exercises'),
    ]);
    const { generateProgram } = programMod;
    const EXERCISE_DB = (exercisesMod as { EXERCISE_DB: unknown[] }).EXERCISE_DB;

    const program = generateProgram(
      profile,
      EXERCISE_DB as Parameters<typeof generateProgram>[1],
    );
    if (!Array.isArray(program) || program.length === 0) return;

    // Build training_days rows — generate uuids up front so we can reference
    // them from the child training_day_exercises rows in a single round trip.
    const trainingDayRows: SupabaseTrainingDayRow[] = program.map((day, idx) => {
      const d = day as { label?: unknown; tag?: unknown };
      const label =
        (typeof d.label === 'string' && d.label) ||
        (typeof d.tag === 'string' && d.tag) ||
        `Day ${idx + 1}`;
      return {
        id: crypto.randomUUID(),
        meso_id: mesoId,
        user_id: user.id,
        day_index: idx,
        label,
      };
    });

    const { error: tdError } = await supabase
      .from('training_days')
      .insert(trainingDayRows);
    if (tdError) throw tdError;

    // Cache the training_day ids locally, keyed by day_index, so chunk 4a
    // workout_sessions writes can look up the training_day_id FK without
    // a round-trip. Key shape: foundry:td_ids:{mesoId} = {"0": uuid, "1": uuid, ...}
    writeTrainingDayIdCache(mesoId, trainingDayRows);

    // Build training_day_exercises rows referencing the training_day ids.
    // Generate uuids client-side so we can cache the (dayIdx, exIdx) → tde.id
    // map for chunk 5d notes sync without a round-trip select.
    const tdeRows: SupabaseTrainingDayExerciseRow[] = [];
    const tdeIdMap: Record<string, string> = {};
    program.forEach((day, dayIdx) => {
      const exercises = (day as { exercises?: unknown[] }).exercises || [];
      exercises.forEach((ex, exIdx) => {
        const e = ex as {
          id?: unknown;
          sets?: unknown;
          reps?: unknown;
          progression?: unknown;
          anchor?: unknown;
          modifier?: unknown;
        };
        const { min, max } = parseRepRange(e.reps);
        const setsNum = Number(e.sets);
        const tdeId = crypto.randomUUID();
        tdeIdMap[`${dayIdx}:${exIdx}`] = tdeId;
        tdeRows.push({
          id: tdeId,
          training_day_id: trainingDayRows[dayIdx].id,
          user_id: user.id,
          exercise_id: String(e.id ?? `unknown_${exIdx}`),
          sort_order: exIdx,
          sets: !isNaN(setsNum) && setsNum > 0 ? setsNum : 3,
          rep_min: min,
          rep_max: max,
          progression: mapProgressionType({
            progression: e.progression,
            anchor: e.anchor,
          }),
          is_warmup: false,
          is_anchor: !!e.anchor,
          modifier: typeof e.modifier === 'string' ? e.modifier : null,
        });
      });
    });

    if (tdeRows.length > 0) {
      const { error: tdeError } = await supabase
        .from('training_day_exercises')
        .insert(tdeRows);
      if (tdeError) throw tdeError;
      writeTdeIdCache(mesoId, tdeIdMap);
    }
  } catch (e) {
    reportSyncFailure('training_structure', e);
  } finally {
    syncEnd();
  }
}

// Chunk 3: pull the training structure for a meso and rebuild
// foundry:storedProgram locally. Also clears any stale exOv override keys
// since the reconstructed program already has the user's swaps baked in
// (exercise_id reflects the current assigned exercise, swap or default).
async function pullTrainingStructure(mesoId: string, _userId?: string): Promise<void> {
  try {
    // Don't filter by user_id — training_days belong to the meso owner but
    // are shared with members via RLS. meso_id is sufficient.
    const { data: tdRows, error: tdError } = await supabase
      .from('training_days')
      .select('id, day_index, label')
      .eq('meso_id', mesoId)
      .order('day_index', { ascending: true });

    if (tdError) throw tdError;
    if (!tdRows || tdRows.length === 0) return;

    // Cache training_day ids locally for chunk 4a workout_sessions writes
    writeTrainingDayIdCache(mesoId, tdRows as { id: string; day_index: number }[]);

    const dayIds = (tdRows as { id: string; day_index: number; label: string }[]).map((r) => r.id);
    const { data: tdeRows, error: tdeError } = await supabase
      .from('training_day_exercises')
      .select('id, training_day_id, exercise_id, sort_order, sets, rep_min, rep_max, progression, is_warmup, is_anchor, modifier')
      .in('training_day_id', dayIds)
      .order('sort_order', { ascending: true });

    if (tdeError) throw tdeError;
    if (!tdeRows) return;

    // Populate the tde_id cache for chunk 5d notes sync. Map is
    // "dayIdx:exIdx" → training_day_exercises.id. Uses day_index from the
    // training_days join (looked up via training_day_id).
    const dayIdxByDayId = new Map<string, number>();
    (tdRows as { id: string; day_index: number; label: string }[]).forEach((td) => {
      dayIdxByDayId.set(td.id, td.day_index);
    });
    const tdeIdMap: Record<string, string> = {};
    (tdeRows as { id: string; training_day_id: string; sort_order: number }[]).forEach((tde) => {
      const dayIdx = dayIdxByDayId.get(tde.training_day_id);
      if (dayIdx != null) {
        tdeIdMap[`${dayIdx}:${tde.sort_order}`] = tde.id;
      }
    });
    writeTdeIdCache(mesoId, tdeIdMap);

    // Dynamic import to avoid static circular dep
    const exercisesMod = await import('../data/exercises');
    const EXERCISE_DB = (exercisesMod as { EXERCISE_DB: Array<Record<string, unknown>> }).EXERCISE_DB;
    const dbById = new Map(EXERCISE_DB.map((e) => [String(e.id), e]));

    // Group exercises by training_day_id
    type TdeRow = {
      training_day_id: string;
      exercise_id: string;
      sort_order: number;
      sets: number;
      rep_min: number;
      rep_max: number;
      progression: SupabaseProgressionType;
      is_warmup: boolean;
      is_anchor: boolean;
      modifier: string | null;
    };
    const exercisesByDay = new Map<string, TdeRow[]>();
    (tdeRows as TdeRow[]).forEach((row) => {
      const existing = exercisesByDay.get(row.training_day_id) || [];
      existing.push(row);
      exercisesByDay.set(row.training_day_id, existing);
    });

    // Reconstruct the program shape (matches generateProgram output)
    const program = (tdRows as { id: string; day_index: number; label: string }[]).map((td) => {
      const rows = (exercisesByDay.get(td.id) || []).sort((a, b) => a.sort_order - b.sort_order);
      const exercises = rows.map((row) => {
        const dbEx = dbById.get(row.exercise_id) || {};
        const repRange =
          row.rep_min === row.rep_max ? String(row.rep_min) : `${row.rep_min}-${row.rep_max}`;
        return {
          id: row.exercise_id,
          name: (dbEx.name as string) || row.exercise_id,
          muscle: (dbEx.muscle as string) || '',
          muscles: (dbEx.muscles as string[]) || [],
          equipment: (dbEx.equipment as string) || '',
          tag: (dbEx.tag as string) || '',
          anchor: row.is_anchor,
          sets: row.sets,
          reps: repRange,
          rest: (dbEx.rest as string) || '2 min',
          warmup: (dbEx.warmup as string) || '1 feeler set',
          progression: row.progression === 'linear' ? 'reps' : 'weight',
          description: (dbEx.description as string) || '',
          videoUrl: (dbEx.videoUrl as string) || '',
          bw: !!dbEx.bw,
          modifier: row.modifier || undefined,
        };
      });
      return {
        dayNum: td.day_index + 1,
        label: td.label,
        tag: (exercises[0]?.tag as string) || '',
        muscles: '',
        note: '',
        cardio: null,
        exercises,
      };
    });

    // Persist to localStorage. Use direct set (not setFromRemote) because
    // storedProgram isn't in SYNC_TRACKED — it's a derived cache of the
    // training_days + training_day_exercises rows we just pulled.
    try {
      localStorage.setItem('foundry:storedProgram', JSON.stringify(program));
      // Clear any stale exOv keys — the swaps are now baked into storedProgram
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('foundry:exov:')) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[Foundry Sync] Failed to write reconstructed storedProgram', e);
    }
  } catch (e) {
    reportSyncFailure('training_structure_pull', e);
  }
}

// Chunk 3/4 shared helper: writes a local cache of training_day_id keyed by
// day_index for a given meso. Used by workout_sessions writes (chunk 4a) to
// resolve the training_day_id FK without a round trip.
function writeTrainingDayIdCache(
  mesoId: string,
  rows: Array<{ id: string; day_index: number }>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const map: Record<string, string> = {};
    rows.forEach((r) => {
      map[String(r.day_index)] = r.id;
    });
    localStorage.setItem(`foundry:td_ids:${mesoId}`, JSON.stringify(map));
  } catch (e) {
    console.warn('[Foundry Sync] Failed to write training_day_id cache', e);
  }
}

function getTrainingDayIdLocal(mesoId: string, dayIdx: number): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`foundry:td_ids:${mesoId}`);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[String(dayIdx)] ?? null;
  } catch {
    return null;
  }
}

// Chunk 5d: training_day_exercises id cache keyed by "dayIdx:exIdx".
// Written by ensureTrainingStructureRemote and pullTrainingStructure.
// Read by syncNotesToSupabase to resolve the target_id for exercise notes.
function writeTdeIdCache(mesoId: string, map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`foundry:tde_ids:${mesoId}`, JSON.stringify(map));
  } catch (e) {
    console.warn('[Foundry Sync] Failed to write tde_id cache', e);
  }
}

function getTdeIdMapLocal(mesoId: string): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`foundry:tde_ids:${mesoId}`);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

// ─── WORKOUT SESSIONS + SETS (chunk 4a — writes only) ───────────────────────
// Pull path is chunk 4b (next session). Until that ships, workout data
// reliably writes to Supabase but doesn't restore from Supabase on sign-in.
// Users will still see their local data on the device they worked out on.

interface WorkoutSessionPayload {
  id: string;
  user_id: string;
  meso_id: string;
  training_day_id: string;
  week_number: number;
  day_number: number;
  started_at: string | null;
  completed_at: string | null;
  is_complete: boolean;
}

// Generates or retrieves the stable uuid for a (dayIdx, weekIdx) session.
// Cached in localStorage so set upserts all reference the same session row.
export function getOrCreateWorkoutSessionId(dayIdx: number, weekIdx: number): string {
  if (typeof window === 'undefined') return crypto.randomUUID();
  const key = `foundry:ws_id:d${dayIdx}:w${weekIdx}`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem(key, fresh);
  return fresh;
}

export async function upsertWorkoutSessionRemote(
  dayIdx: number,
  weekIdx: number,
  opts: {
    sessionId?: string;
    startedAt?: string | null;
    completedAt?: string | null;
    isComplete?: boolean;
  } = {},
): Promise<void> {
  if (!MIGRATED.workouts) return;
  if (typeof window === 'undefined') return;
  const mesoId = localStorage.getItem('foundry:active_meso_id');
  if (!mesoId) return;
  const trainingDayId = getTrainingDayIdLocal(mesoId, dayIdx);
  if (!trainingDayId) {
    // Training structure hasn't been written yet for this meso (e.g.,
    // offline setup). Skip silently — next sync cycle will populate it.
    return;
  }

  syncStart();
  try {
    const user = await getUser();
    if (!user) return;

    const sessionId = opts.sessionId || getOrCreateWorkoutSessionId(dayIdx, weekIdx);

    // Read current known values from localStorage so we don't clobber
    // started_at when only completing, etc. We upsert the full row each time.
    const savedStart = localStorage.getItem(`foundry:sessionStart:d${dayIdx}:w${weekIdx}`);
    const startedAt = opts.startedAt
      ?? (savedStart ? new Date(parseInt(savedStart, 10)).toISOString() : null);

    const row: WorkoutSessionPayload = {
      id: sessionId,
      user_id: user.id,
      meso_id: mesoId,
      training_day_id: trainingDayId,
      week_number: weekIdx,
      day_number: dayIdx,
      started_at: startedAt,
      completed_at: opts.completedAt ?? null,
      is_complete: opts.isComplete ?? false,
    };

    const { error } = await supabase
      .from('workout_sessions')
      .upsert(row, { onConflict: 'id' });
    if (error) throw error;
  } catch (e) {
    reportSyncFailure('workout_session', e);
  } finally {
    syncEnd();
  }
}

// Delete a single workout_set row. Called when the user unchecks a set —
// uncheck means "I didn't do this," so the remote row should go away rather
// than linger with stale data. Fire-and-forget.
export async function deleteWorkoutSetRemote(setId: string): Promise<void> {
  if (!MIGRATED.workouts) return;
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase
      .from('workout_sets')
      .delete()
      .eq('id', setId)
      .eq('user_id', user.id);
    if (error) throw error;
  } catch (e) {
    reportSyncFailure('workout_set_delete', e);
  } finally {
    syncEnd();
  }
}

// Single-set upsert. Called from DayView.handleUpdateSet after a set is
// confirmed (or edited after confirmation). Debounced per-set-id to coalesce
// rapid input edits.
export async function upsertWorkoutSetRemote(
  sessionId: string,
  setId: string,
  exerciseId: string,
  setNumber: number,
  payload: {
    weight: number | null;
    reps: number | null;
    rpe: number | null;
    isWarmup: boolean;
  },
): Promise<void> {
  if (!MIGRATED.workouts) return;
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;

    const { error } = await supabase
      .from('workout_sets')
      .upsert(
        {
          id: setId,
          workout_session_id: sessionId,
          user_id: user.id,
          exercise_id: exerciseId,
          set_number: setNumber,
          weight_lbs: payload.weight,
          reps: payload.reps,
          rpe: payload.rpe,
          is_warmup: payload.isWarmup,
        },
        { onConflict: 'id' },
      );
    if (error) throw error;
  } catch (e) {
    reportSyncFailure('workout_set', e);
  } finally {
    syncEnd();
  }
}

// Chunk 4b: pull all workout_sessions + workout_sets for the active meso
// and reconstruct the local foundry:day{d}:week{w} jsonb shape (+ done flags
// and completedDate flags). Called from pullFromSupabase after
// pullTrainingStructure so the training_day_exercises sort_order map is
// available for exercise_id → exerciseIndex resolution.
//
// Shape the app expects in foundry:day{d}:week{w}:
//   { [exerciseIndex]: { [setIdx]: { id, weight, reps, rpe, confirmed, warmup? } } }
//
// Maps RPE numeric back to the app's label strings: 7→"Easy", 8→"Good",
// 9.5→"Hard". Other numeric RPE values pass through as numbers. Done this
// way so the UI's RPE prompt stays label-based client-side while the
// remote column stays numeric-queryable for coaching dashboards.
async function pullWorkoutHistory(mesoId: string, userId: string): Promise<void> {
  try {
    // Fetch all workout_sessions for this meso
    const { data: sessionRows, error: sessionError } = await supabase
      .from('workout_sessions')
      .select('id, training_day_id, week_number, day_number, started_at, completed_at, is_complete')
      .eq('user_id', userId)
      .eq('meso_id', mesoId);

    if (sessionError) throw sessionError;
    if (!sessionRows || sessionRows.length === 0) return;

    type SessionRow = {
      id: string;
      training_day_id: string;
      week_number: number;
      day_number: number;
      started_at: string | null;
      completed_at: string | null;
      is_complete: boolean;
    };
    const sessions = sessionRows as SessionRow[];
    const sessionIds = sessions.map((s) => s.id);

    // Fetch all workout_sets for those sessions in one query
    const { data: setRows, error: setsError } = await supabase
      .from('workout_sets')
      .select('id, workout_session_id, exercise_id, set_number, weight_lbs, reps, rpe, is_warmup')
      .in('workout_session_id', sessionIds)
      .order('set_number', { ascending: true });

    if (setsError) throw setsError;

    type SetRow = {
      id: string;
      workout_session_id: string;
      exercise_id: string;
      set_number: number;
      weight_lbs: number | null;
      reps: number | null;
      rpe: number | null;
      is_warmup: boolean;
    };
    const sets = (setRows || []) as SetRow[];

    // Group sets by session_id for fast lookup during reconstruction
    const setsBySession = new Map<string, SetRow[]>();
    sets.forEach((s) => {
      const existing = setsBySession.get(s.workout_session_id) || [];
      existing.push(s);
      setsBySession.set(s.workout_session_id, existing);
    });

    // Fetch the exercise_id → sort_order mapping for this meso so we can
    // reconstruct the jsonb's exerciseIndex key (position, not exercise id).
    // Join via training_day_id.
    const trainingDayIds = Array.from(new Set(sessions.map((s) => s.training_day_id)));
    const { data: tdeRows, error: tdeError } = await supabase
      .from('training_day_exercises')
      .select('training_day_id, exercise_id, sort_order')
      .in('training_day_id', trainingDayIds);

    if (tdeError) throw tdeError;

    // Map: (training_day_id, exercise_id) → sort_order
    const exerciseIndexMap = new Map<string, number>();
    ((tdeRows || []) as { training_day_id: string; exercise_id: string; sort_order: number }[]).forEach((r) => {
      exerciseIndexMap.set(`${r.training_day_id}:${r.exercise_id}`, r.sort_order);
    });

    // Helper: decode numeric rpe back to app's label strings
    const decodeRpe = (n: number | null): string | number | undefined => {
      if (n == null) return undefined;
      if (n === 7) return 'Easy';
      if (n === 8) return 'Good';
      if (n === 9.5) return 'Hard';
      return n;
    };

    // Reconstruct each session's jsonb
    for (const session of sessions) {
      const sessionSets = setsBySession.get(session.id) || [];

      // Rebuild the { [exIdx]: { [setIdx]: {...} } } shape
      const dayData: Record<string, Record<string, Record<string, unknown>>> = {};
      for (const s of sessionSets) {
        const exIdx = exerciseIndexMap.get(`${session.training_day_id}:${s.exercise_id}`);
        if (exIdx == null) continue; // orphaned set (exercise no longer in program)
        const exKey = String(exIdx);
        if (!dayData[exKey]) dayData[exKey] = {};
        dayData[exKey][String(s.set_number)] = {
          id: s.id,
          weight: s.weight_lbs != null ? String(s.weight_lbs) : '',
          reps: s.reps != null ? String(s.reps) : '',
          rpe: decodeRpe(s.rpe),
          confirmed: true, // if the row exists, the user confirmed it
          warmup: s.is_warmup || undefined,
        };
      }

      // Persist the reconstructed session state locally. setFromRemote skips
      // the dirty queue (it's a pulled value, not a local edit).
      const dayKey = `foundry:day${session.day_number}:week${session.week_number}`;
      const tsIso = session.completed_at || session.started_at || new Date().toISOString();
      store.setFromRemote(dayKey, JSON.stringify(dayData), tsIso);

      // Done flag + completed date
      if (session.is_complete) {
        try {
          localStorage.setItem(`foundry:done:d${session.day_number}:w${session.week_number}`, '1');
          if (session.completed_at) {
            const d = new Date(session.completed_at);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            localStorage.setItem(
              `foundry:completedDate:d${session.day_number}:w${session.week_number}`,
              dateStr,
            );
          }
        } catch (e) {
          console.warn('[Foundry Sync] Failed to write done/completedDate for session', e);
        }
      }

      // Cache the session id so future writes (unchecks, re-completes) target
      // the same workout_sessions row.
      try {
        localStorage.setItem(`foundry:ws_id:d${session.day_number}:w${session.week_number}`, session.id);
      } catch {}
    }
  } catch (e) {
    reportSyncFailure('workout_history_pull', e);
  }
}

// Chunk 5a: pull body_weight_log rows for the user, rebuild the local
// foundry:bwlog array. Ordered by date desc and capped at 52 entries to
// match the local write-side cap in addBwEntry.
async function pullBodyWeightLog(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('body_weight_log')
      .select('logged_at, weight_lbs')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(52);
    if (error) throw error;
    if (!data) return;
    const entries = (data as { logged_at: string; weight_lbs: number }[]).map((r) => ({
      date: r.logged_at,
      weight: Number(r.weight_lbs),
    }));
    store.setFromRemote('foundry:bwlog', JSON.stringify(entries), new Date().toISOString());
  } catch (e) {
    reportSyncFailure('bodyweight_pull', e);
  }
}

// Chunk 5b: pull readiness_checkins rows for the user, rebuild the
// per-date foundry:readiness:YYYY-MM-DD keys. Reads sleep/soreness/energy
// columns if present (ALTER TABLE must have been run); otherwise only the
// score is available and the individual components come back as null.
async function pullReadinessCheckins(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('readiness_checkins')
      .select('checked_at, score, sleep, soreness, energy')
      .eq('user_id', userId);
    if (error) throw error;
    if (!data) return;

    type Row = {
      checked_at: string;
      score: number;
      sleep: string | null;
      soreness: string | null;
      energy: string | null;
    };
    (data as Row[]).forEach((row) => {
      const entry: Record<string, string> = {};
      if (row.sleep) entry.sleep = row.sleep;
      if (row.soreness) entry.soreness = row.soreness;
      if (row.energy) entry.energy = row.energy;
      // Only write if we have at least one component — otherwise the key
      // would be an empty object and the UI would show "Not Set"
      if (Object.keys(entry).length === 0) return;
      const key = `foundry:readiness:${row.checked_at}`;
      store.setFromRemote(key, JSON.stringify(entry), new Date().toISOString());
    });
  } catch (e) {
    reportSyncFailure('readiness_pull', e);
  }
}

// Chunk 5c: pull cardio_sessions rows, rebuild per-date
// foundry:cardio:session:YYYY-MM-DD keys. Prefers the `data` jsonb blob
// (written by chunk 5c's sync helper) since it preserves all fields the
// app uses; falls back to reconstructing from the normalized columns if
// `data` is null (e.g., rows inserted by some other tool).
async function pullCardioSessions(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('cardio_sessions')
      .select('protocol, duration_min, intensity, performed_at, data')
      .eq('user_id', userId);
    if (error) throw error;
    if (!data) return;

    type Row = {
      protocol: string;
      duration_min: number;
      intensity: string | null;
      performed_at: string;
      data: unknown;
    };
    (data as Row[]).forEach((row) => {
      const dateStr = row.performed_at.slice(0, 10);
      const key = `foundry:cardio:session:${dateStr}`;
      // Prefer the jsonb blob if it was written by the app; reconstruct
      // otherwise. Both shapes are valid inputs to CardioSessionView.
      const reconstructed =
        row.data && typeof row.data === 'object'
          ? row.data
          : {
              protocolId: null,
              type: row.protocol,
              duration: String(row.duration_min),
              intensity: row.intensity || '',
              completed: true,
              startedAt: null,
              completedAt: new Date(row.performed_at).getTime(),
            };
      store.setFromRemote(key, JSON.stringify(reconstructed), new Date().toISOString());
    });
  } catch (e) {
    reportSyncFailure('cardio_pull', e);
  }
}

// Chunk 5d: pull notes and rebuild the local foundry:notes:d{d}:w{w} +
// foundry:exnotes:d{d}:w{w} keys. Session notes attach to workout_session
// rows (resolved via workout_sessions.id → (day_number, week_number));
// exercise notes attach to training_day_exercises (resolved via the
// (dayIdx:exIdx) tde map populated in chunk 3/4a).
async function pullNotes(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('target_type, target_id, content')
      .eq('user_id', userId);
    if (error) throw error;
    if (!data) return;

    type Row = { target_type: string; target_id: string; content: string };
    const rows = data as Row[];

    // Group by target_type
    const sessionNotes = new Map<string, string>(); // workout_session.id → text
    const exerciseNotes = new Map<string, string>(); // training_day_exercise.id → text
    rows.forEach((r) => {
      if (r.target_type === 'workout_session') sessionNotes.set(r.target_id, r.content);
      else if (r.target_type === 'exercise') exerciseNotes.set(r.target_id, r.content);
    });

    // ── Session notes → foundry:notes:d{d}:w{w} ─────────────────────────
    // Need the reverse map workout_session.id → (dayIdx, weekIdx). Pulled
    // in chunk 4b via the cached foundry:ws_id keys written at that time.
    // Walk localStorage for those keys and build the reverse lookup.
    const sessionIdToDayWeek = new Map<string, { d: number; w: number }>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const m = k.match(/^foundry:ws_id:d(\d+):w(\d+)$/);
        if (m) {
          const id = localStorage.getItem(k);
          if (id) sessionIdToDayWeek.set(id, { d: parseInt(m[1], 10), w: parseInt(m[2], 10) });
        }
      }
    } catch {}

    sessionNotes.forEach((text, sessionId) => {
      const loc = sessionIdToDayWeek.get(sessionId);
      if (!loc) return;
      const key = `foundry:notes:d${loc.d}:w${loc.w}`;
      store.setFromRemote(key, text, new Date().toISOString());
    });

    // ── Exercise notes → foundry:exnotes:d{d}:w{w} ──────────────────────
    // Each exercise note row attaches to a training_day_exercise.id, which
    // is per-(day, exIdx) and shared across all weeks of the meso. Fan out
    // the same note text into every week's exnotes key for that (day, exIdx).
    if (exerciseNotes.size > 0) {
      const mesoId = typeof window !== 'undefined' ? localStorage.getItem('foundry:active_meso_id') : null;
      if (mesoId) {
        const tdeMap = getTdeIdMapLocal(mesoId);
        if (tdeMap) {
          // Reverse: tde_id → "dayIdx:exIdx"
          const tdeIdToKey = new Map<string, string>();
          Object.entries(tdeMap).forEach(([k, v]) => tdeIdToKey.set(v, k));

          // Group exercise notes by dayIdx
          const byDay = new Map<number, Record<string, string>>();
          exerciseNotes.forEach((text, tdeId) => {
            const keyStr = tdeIdToKey.get(tdeId);
            if (!keyStr) return;
            const [dayIdxStr, exIdxStr] = keyStr.split(':');
            const dayIdx = parseInt(dayIdxStr, 10);
            const existing = byDay.get(dayIdx) || {};
            existing[exIdxStr] = text;
            byDay.set(dayIdx, existing);
          });

          // Fan out to every week's foundry:exnotes:d{d}:w{w}. Read meso
          // length from the stored profile to know how many weeks exist.
          let weeks = 6;
          try {
            const p = JSON.parse(localStorage.getItem('foundry:profile') || '{}') as { mesoLength?: number };
            if (p.mesoLength && p.mesoLength > 0) weeks = p.mesoLength;
          } catch {}

          byDay.forEach((notesByEx, dayIdx) => {
            for (let w = 0; w <= weeks; w++) {
              const key = `foundry:exnotes:d${dayIdx}:w${w}`;
              store.setFromRemote(key, JSON.stringify(notesByEx), new Date().toISOString());
            }
          });
        }
      }
    }
  } catch (e) {
    reportSyncFailure('notes_pull', e);
  }
}

// Chunk 3: update a single training_day_exercises row when the user swaps
// an exercise. Called from DayView.handleSwap after the local override is
// written. The swap replaces the exercise_id for that (training_day, sort_order)
// slot; other fields (sets, reps, progression) inherit from the new exercise.
export async function syncExerciseSwapRemote(
  mesoId: string,
  dayIdx: number,
  exIdx: number,
  newExercise: {
    id: unknown;
    sets?: unknown;
    reps?: unknown;
    progression?: unknown;
    anchor?: unknown;
  },
): Promise<void> {
  if (!MIGRATED.training_structure) return;
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;

    // Find the training_day row for this (meso, dayIdx)
    const { data: tdRows, error: tdError } = await supabase
      .from('training_days')
      .select('id')
      .eq('meso_id', mesoId)
      .eq('user_id', user.id)
      .eq('day_index', dayIdx)
      .limit(1);
    if (tdError) throw tdError;
    if (!tdRows || tdRows.length === 0) return;
    const trainingDayId = (tdRows[0] as { id: string }).id;

    const { min, max } = parseRepRange(newExercise.reps);
    const setsNum = Number(newExercise.sets);

    const { error: updateError } = await supabase
      .from('training_day_exercises')
      .update({
        exercise_id: String(newExercise.id),
        sets: !isNaN(setsNum) && setsNum > 0 ? setsNum : 3,
        rep_min: min,
        rep_max: max,
        progression: mapProgressionType({
          progression: newExercise.progression,
          anchor: newExercise.anchor,
        }),
        is_anchor: !!newExercise.anchor,
      })
      .eq('training_day_id', trainingDayId)
      .eq('user_id', user.id)
      .eq('sort_order', exIdx);

    if (updateError) throw updateError;
  } catch (e) {
    reportSyncFailure('exercise_swap', e);
  } finally {
    syncEnd();
  }
}

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

let _inflight = 0;
function syncStart() {
  _inflight++;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('foundry:sync', { detail: { inflight: _inflight } }));
}
function syncEnd() {
  _inflight = Math.max(0, _inflight - 1);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('foundry:sync', { detail: { inflight: _inflight } }));
}

// ─── DIRTY KEY QUEUE ────────────────────────────────────────────────────────
const DIRTY_KEY = 'foundry:sync:dirty';

function readDirtySet(): Set<string> {
  try {
    const raw = localStorage.getItem(DIRTY_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {}
  return new Set();
}

function writeDirtySet(s: Set<string>): void {
  try {
    localStorage.setItem(DIRTY_KEY, JSON.stringify([...s]));
  } catch {}
}

// ─── DEBOUNCED SYNC ─────────────────────────────────────────────────────────
const _debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function debouncedSync(key: string, fn: () => void, delay = 1500): void {
  const existing = _debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  _debounceTimers.set(key, setTimeout(() => {
    _debounceTimers.delete(key);
    fn();
  }, delay));
}

export function markDirty(key: string): void {
  const s = readDirtySet();
  s.add(key);
  writeDirtySet(s);
}

export function clearDirty(key: string): void {
  const s = readDirtySet();
  s.delete(key);
  writeDirtySet(s);
}

let _flushInProgress = false;

export async function flushDirty(): Promise<void> {
  if (_flushInProgress) return;
  const dirty = readDirtySet();
  if (dirty.size === 0) return;

  _flushInProgress = true;
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;

    for (const key of dirty) {
      const raw = store.get(key);
      if (!raw) { clearDirty(key); continue; }

      let succeeded = false;
      let deferred = false; // key belongs to an unmigrated table — leave dirty, don't error
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const dayWeekMatch = key.match(/^foundry:day(\d+):week(\d+)$/);
          if (dayWeekMatch) {
            if (!MIGRATED.workouts) { deferred = true; break; }
            // When MIGRATED.workouts flips to true, implement the normalized
            // write here (workout_sessions row + workout_sets rows).
            succeeded = true; break;
          }
          if (key === 'foundry:profile') {
            if (!MIGRATED.profile) { deferred = true; break; }
            const row = appProfileToSupabaseRow(JSON.parse(raw) as Profile, user.id);
            const { error } = await supabase
              .from('user_profiles')
              .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'id' });
            if (error) throw error;
            succeeded = true; break;
          }
          const readinessMatch = key.match(/^foundry:readiness:(\d{4}-\d{2}-\d{2})$/);
          if (readinessMatch) {
            if (!MIGRATED.readiness) { deferred = true; break; }
            const r = JSON.parse(raw) as ReadinessEntry;
            const [, date] = readinessMatch;
            const score = readinessScoreFromEntry(r);
            if (score == null) { succeeded = true; break; } // incomplete entry
            const { error } = await supabase
              .from('readiness_checkins')
              .upsert(
                {
                  user_id: user.id,
                  checked_at: date,
                  score,
                  sleep: r.sleep ?? null,
                  soreness: r.soreness ?? null,
                  energy: r.energy ?? null,
                },
                { onConflict: 'user_id,checked_at' },
              );
            if (error) throw error;
            succeeded = true; break;
          }
          const cardioMatch = key.match(/^foundry:cardio:session:(\d{4}-\d{2}-\d{2})$/);
          if (cardioMatch) {
            if (!MIGRATED.cardio) { deferred = true; break; }
            // Route through the same helper used by direct saves so we
            // apply the exact same "only sync completed sessions" gate
            // and field mapping.
            const [, date] = cardioMatch;
            await syncCardioSessionToSupabase(date, JSON.parse(raw));
            succeeded = true; break;
          }
          // Unknown key pattern — nothing to do
          succeeded = true; break;
        } catch (err) {
          lastError = err;
          if (attempt < 2) await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
        }
      }
      if (deferred) {
        // Migration-pending — leave the key dirty so the next flush retries
        // once the chunk lands. No error, no toast.
        continue;
      }
      if (!succeeded && lastError) {
        console.warn('[Foundry Sync] flushDirty key failed after retries:', key, lastError);
        Sentry.captureException(lastError, { tags: { context: 'sync', operation: 'flushDirty', key } });
      }
      if (succeeded) {
        clearDirty(key);
      } else {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('foundry:toast', {
            detail: { message: 'Sync failed — changes saved locally', type: 'warning' },
          }));
        }
      }
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { context: 'sync', operation: 'flushDirty' } });
  } finally {
    _flushInProgress = false;
    syncEnd();
  }
}

// NOTE: `readinessScore(r)` helper was removed along with the old denormalized
// readiness sync. When the readiness chunk migrates to the normalized schema,
// reinstate a helper that computes the 0-6 score from sleep/soreness/energy
// enums:
//   sleep:   poor=0, ok=1, good=2
//   soreness: high=0, moderate=1, low=2
//   energy:  low=0, moderate=1, high=2
//   score = sleep + soreness + energy  (null if any field is missing)

// Track the last time we showed a sync-failure toast so we don't spam the
// user when a whole batch of writes all fail for the same reason (offline,
// RLS misconfig, schema error). One toast per 30s is plenty to surface the
// problem without being annoying.
let _lastSyncFailureToast = 0;
function reportSyncFailure(operation: string, err: unknown): void {
  console.warn(`[Foundry Sync] ${operation} failed`, err);
  Sentry.captureException(err, { tags: { context: 'sync', operation } });
  if (typeof window !== 'undefined') {
    const now = Date.now();
    if (now - _lastSyncFailureToast > 30_000) {
      _lastSyncFailureToast = now;
      window.dispatchEvent(new CustomEvent('foundry:toast', {
        detail: { message: `Cloud sync failed (${operation}). Saved locally — will retry.`, type: 'warning' },
      }));
    }
  }
}

export async function syncProfileToSupabase(profile: Profile): Promise<void> {
  if (!MIGRATED.profile) return;
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const row = appProfileToSupabaseRow(profile, user.id);
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw error;
  } catch (e) { reportSyncFailure('profile', e); } finally { syncEnd(); }
}

// Chunk 2: mesocycle sync. Called alongside syncProfileToSupabase whenever
// the profile is saved. Idempotent via upsert on the stable
// foundry:active_meso_id — first call creates the row, subsequent calls
// update it. Resetting a meso clears the id (see archiveMesocycleRemote)
// so the next saveProfile creates a fresh mesocycle row.
export async function syncMesocycleToSupabase(profile: Profile): Promise<void> {
  if (!MIGRATED.mesocycles) return;
  // Skip if the profile doesn't have enough meso config yet (e.g., during
  // partial onboarding writes before setup completes).
  const p = profile as unknown as Record<string, unknown>;
  if (!p.mesoLength || !p.splitType) return;

  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const mesoId = getOrCreateActiveMesoId();
    const row = appProfileToMesocycleRow(profile, user.id, mesoId);
    const { error } = await supabase
      .from('mesocycles')
      .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw error;
  } catch (e) { reportSyncFailure('mesocycle', e); } finally { syncEnd(); }
}

// Mark the active mesocycle as abandoned and clear the local active meso
// pointer. Called from resetMeso() in archive.ts when the user discards
// the current cycle mid-way. Next saveProfile creates a fresh mesocycle.
export async function archiveMesocycleRemote(): Promise<void> {
  if (!MIGRATED.mesocycles) return;
  if (typeof window === 'undefined') return;
  const mesoId = localStorage.getItem('foundry:active_meso_id');
  if (!mesoId) return;

  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase
      .from('mesocycles')
      .update({
        status: 'abandoned',
        completed_at: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mesoId)
      .eq('user_id', user.id);
    if (error) throw error;

    // Clear the FK pointer so pullFromSupabase won't restore this meso
    await supabase
      .from('user_profiles')
      .update({ active_meso_id: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);
  } catch (e) {
    reportSyncFailure('mesocycle', e);
  } finally {
    // Always clear locally — even if remote update failed. The dirty state
    // is acceptable because mesocycles is append/archive only, not merged.
    localStorage.removeItem('foundry:active_meso_id');
    syncEnd();
  }
}

// Mark the active mesocycle as completed (all weeks finished). Called from
// useMesoState.handleComplete when the final week wraps. Keeps the id
// around so the user can see it in history; next meso requires explicit
// reset + setup.
export async function completeMesocycleRemote(): Promise<void> {
  if (!MIGRATED.mesocycles) return;
  if (typeof window === 'undefined') return;
  const mesoId = localStorage.getItem('foundry:active_meso_id');
  if (!mesoId) return;

  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase
      .from('mesocycles')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mesoId)
      .eq('user_id', user.id);
    if (error) throw error;
  } catch (e) { reportSyncFailure('mesocycle', e); } finally { syncEnd(); }
}

// The following helpers are stubbed until their respective normalized-schema
// migration chunks land. They silently no-op so we don't spam toasts for
// tables that have a different shape than the app is writing. When each
// chunk is implemented, flip the corresponding MIGRATED flag and rewrite the
// body to use the actual normalized columns.

// Chunk 4a: this legacy "whole day" sync helper is intentionally a no-op.
// The normalized workout_sets model uses per-set upserts fired directly
// from DayView (see upsertWorkoutSetRemote + upsertWorkoutSessionRemote)
// rather than a "save the whole day's jsonb on every field change" shape.
// persistence.saveDayWeek still calls this for backward compat — it safely
// does nothing. Per-set writes go through the new helpers in DayView.
export async function syncWorkoutToSupabase(_dayIdx: number, _weekIdx: number, _data: DayData): Promise<void> {
  return;
}

// Chunk 5b: readiness_checkins — upsert keyed on (user_id, checked_at).
// Expects sleep/soreness/energy columns to exist (ALTER TABLE run manually).
// Also writes the computed score (0-6) for indexable queries.
export async function syncReadinessToSupabase(
  date: string,
  readinessData: ReadinessEntry,
): Promise<void> {
  if (!MIGRATED.readiness) return;
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const score = readinessScoreFromEntry(readinessData);
    if (score == null) return; // incomplete entry — don't write partial rows

    const { error } = await supabase
      .from('readiness_checkins')
      .upsert(
        {
          user_id: user.id,
          checked_at: date,
          score,
          sleep: readinessData.sleep ?? null,
          soreness: readinessData.soreness ?? null,
          energy: readinessData.energy ?? null,
        },
        { onConflict: 'user_id,checked_at' },
      );
    if (error) throw error;
  } catch (e) {
    reportSyncFailure('readiness', e);
  } finally {
    syncEnd();
  }
}

// Chunk 5a: body_weight_log — upsert keyed on (user_id, logged_at).
// Note the column is `logged_at`, not `date`, and the value is numeric.
export async function syncBodyWeightToSupabase(
  date: string,
  weightLbs: number,
): Promise<void> {
  if (!MIGRATED.bodyweight) return;
  if (isNaN(weightLbs) || weightLbs <= 0) return;
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase
      .from('body_weight_log')
      .upsert(
        {
          user_id: user.id,
          logged_at: date,
          weight_lbs: weightLbs,
        },
        { onConflict: 'user_id,logged_at' },
      );
    if (error) throw error;
  } catch (e) {
    reportSyncFailure('bodyweight', e);
  } finally {
    syncEnd();
  }
}

// Chunk 5c: cardio_sessions — only syncs when the session is complete.
// Partial sessions (protocol selected but not finished) stay localStorage-only
// because cardio_sessions has NOT NULL on protocol/duration_min/performed_at,
// and we don't want to invent placeholder values for unfinished work.
export async function syncCardioSessionToSupabase(
  date: string,
  sessionData: unknown,
): Promise<void> {
  if (!MIGRATED.cardio) return;
  const s = sessionData as {
    protocolId?: string | null;
    type?: string;
    duration?: string | number;
    intensity?: string;
    completed?: boolean;
    startedAt?: number | null;
    completedAt?: number | null;
  };
  if (!s || !s.completed) return; // only sync completed sessions

  const durationNum = parseInt(String(s.duration ?? ''), 10);
  if (isNaN(durationNum) || durationNum <= 0) return;

  // Protocol is NOT NULL. Prefer explicit type, fall back to protocol id,
  // then a generic label so we never write null.
  const protocol =
    (typeof s.type === 'string' && s.type) ||
    (typeof s.protocolId === 'string' && s.protocolId) ||
    'Cardio';

  // performed_at is NOT NULL. Prefer completedAt, then startedAt, then the
  // date string at midnight.
  const performedAtMs = s.completedAt ?? s.startedAt ?? null;
  const performedAt = performedAtMs
    ? new Date(performedAtMs).toISOString()
    : `${date}T00:00:00.000Z`;

  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase
      .from('cardio_sessions')
      .upsert(
        {
          user_id: user.id,
          protocol,
          duration_min: durationNum,
          intensity: typeof s.intensity === 'string' && s.intensity ? s.intensity : null,
          performed_at: performedAt,
          data: sessionData, // full blob preserved in the jsonb escape hatch
        },
        { onConflict: 'user_id,performed_at' },
      );
    if (error) throw error;
  } catch (e) {
    reportSyncFailure('cardio', e);
  } finally {
    syncEnd();
  }
}

// Chunk 5d: notes sync. Two kinds of notes in the app:
//   1. Session notes (foundry:notes:d{d}:w{w}) — one string per session →
//      stored with note_target_type='workout_session', target_id=session.id
//   2. Exercise notes (foundry:exnotes:d{d}:w{w}) — {[exIdx]: string} map →
//      one row per exercise with note_target_type='exercise', target_id is
//      the training_day_exercises.id (not per-week since the exercise
//      template is shared across weeks). Latest-edit-wins semantics.
//
// Uses delete-then-insert idempotency because the notes table doesn't have
// a composite unique index that would support onConflict upsert.
export async function syncNotesToSupabase(
  dayIdx: number,
  weekIdx: number,
  sessionText: string | null,
  exerciseNotes: unknown,
): Promise<void> {
  if (!MIGRATED.notes) return;
  if (typeof window === 'undefined') return;
  const mesoId = localStorage.getItem('foundry:active_meso_id');
  if (!mesoId) return;

  syncStart();
  try {
    const user = await getUser();
    if (!user) return;

    // ── Session note ────────────────────────────────────────────────────
    const sessionId = localStorage.getItem(`foundry:ws_id:d${dayIdx}:w${weekIdx}`);
    if (sessionId) {
      // Delete any existing session note for this workout_session (idempotent)
      const { error: delErr } = await supabase
        .from('notes')
        .delete()
        .eq('user_id', user.id)
        .eq('target_type', 'workout_session')
        .eq('target_id', sessionId);
      if (delErr) throw delErr;

      if (sessionText && sessionText.trim()) {
        const { error: insErr } = await supabase.from('notes').insert({
          user_id: user.id,
          target_type: 'workout_session',
          target_id: sessionId,
          content: sessionText,
        });
        if (insErr) throw insErr;
      }
    }

    // ── Exercise notes ──────────────────────────────────────────────────
    if (exerciseNotes && typeof exerciseNotes === 'object') {
      const tdeMap = getTdeIdMapLocal(mesoId);
      if (tdeMap) {
        const notesObj = exerciseNotes as Record<string, string>;
        const affectedTdeIds: string[] = [];
        const toInsert: Array<{
          user_id: string;
          target_type: string;
          target_id: string;
          content: string;
        }> = [];

        Object.entries(notesObj).forEach(([exIdxStr, content]) => {
          const exIdx = parseInt(exIdxStr, 10);
          if (isNaN(exIdx)) return;
          const tdeId = tdeMap[`${dayIdx}:${exIdx}`];
          if (!tdeId) return;
          affectedTdeIds.push(tdeId);
          if (content && content.trim()) {
            toInsert.push({
              user_id: user.id,
              target_type: 'exercise',
              target_id: tdeId,
              content,
            });
          }
        });

        // Delete existing notes for all exercises we're updating (even the
        // ones where content is empty — that handles note deletion)
        if (affectedTdeIds.length > 0) {
          const { error: delErr } = await supabase
            .from('notes')
            .delete()
            .eq('user_id', user.id)
            .eq('target_type', 'exercise')
            .in('target_id', affectedTdeIds);
          if (delErr) throw delErr;
        }

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase.from('notes').insert(toInsert);
          if (insErr) throw insErr;
        }
      }
    }
  } catch (e) {
    reportSyncFailure('notes', e);
  } finally {
    syncEnd();
  }
}

// Helper used by syncReadinessToSupabase (chunk 5b). Same scoring logic as
// the readinessScore helper removed in chunk 1, now lifted to module scope.
function readinessScoreFromEntry(r: ReadinessEntry | null | undefined): number | null {
  if (!r) return null;
  const s = ({ poor: 0, ok: 1, good: 2 } as Record<string, number>)[r.sleep ?? ''] ?? null;
  const o = ({ high: 0, moderate: 1, low: 2 } as Record<string, number>)[r.soreness ?? ''] ?? null;
  const e = ({ low: 0, moderate: 1, high: 2 } as Record<string, number>)[r.energy ?? ''] ?? null;
  if (s === null || o === null || e === null) return null;
  return s + o + e;
}

/** Returns true if remote timestamp is newer than local, or local has no timestamp */
export function remoteIsNewer(localKey: string, remoteUpdatedAt: string | undefined): boolean {
  if (!remoteUpdatedAt) return true;
  const localTs = store.getTimestamp(localKey);
  if (!localTs) return true;
  return new Date(remoteUpdatedAt).getTime() >= new Date(localTs).getTime();
}

/** Field-level merge for profile: for each key, keep the more recently written value */
export function mergeProfile(local: Record<string, unknown>, remote: Record<string, unknown>, remoteTs: string): Record<string, unknown> {
  const localTs = store.getTimestamp('foundry:profile');
  // If no local timestamp, remote wins entirely
  if (!localTs) return { ...remote };
  const localTime = new Date(localTs).getTime();
  const remoteTime = new Date(remoteTs).getTime();
  // Start with whichever is older, overlay the newer on top
  if (remoteTime >= localTime) {
    return { ...local, ...remote };
  }
  return { ...remote, ...local };
}

export async function pullFromSupabase(): Promise<void> {
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;

    // Only fetch tables that have been migrated to the normalized schema.
    // Pulling the others would 400 because the app's expected column
    // shape doesn't match what exists in Supabase yet. See MIGRATED above.

    let remoteActiveMesoId: string | null = null;

    if (MIGRATED.profile) {
      const profileRes = await supabase
        .from('user_profiles')
        .select('id, name, experience, primary_goal, days_per_week, preferred_split, equipment, gender, date_of_birth, weight_lbs, additional_notes, workout_days, session_duration_min, active_meso_id, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (profileRes.error) {
        console.warn('[Foundry Sync] Profile pull failed', profileRes.error);
      } else if (profileRes.data) {
        const row = profileRes.data as SupabaseProfileRow;
        const remoteTs = row.updated_at ?? new Date().toISOString();
        remoteActiveMesoId = row.active_meso_id ?? null;
        const localKey = 'foundry:profile';
        const localRaw = store.get(localKey);
        const remoteFields = supabaseRowToAppProfileFields(row);

        if (localRaw) {
          try {
            const localProfile = JSON.parse(localRaw) as Record<string, unknown>;
            const remoteIsFresher = remoteIsNewer(localKey, remoteTs);
            const merged = remoteIsFresher
              ? { ...localProfile, ...remoteFields }
              : { ...remoteFields, ...localProfile };
            store.setFromRemote(localKey, JSON.stringify(merged), remoteTs);
            if (!remoteIsFresher) markDirty(localKey);
          } catch {
            store.setFromRemote(localKey, JSON.stringify(remoteFields), remoteTs);
          }
        } else {
          store.setFromRemote(localKey, JSON.stringify(remoteFields), remoteTs);
        }
      }
    }

    // Chunk 2: fetch the active mesocycle row and hydrate meso-specific
    // fields into the local profile. Uses active_meso_id from user_profiles
    // as the authoritative pointer; falls back to most-recent-active if that
    // column is null (e.g., legacy user_profiles rows pre-chunk 2).
    if (MIGRATED.mesocycles) {
      let mesoId = remoteActiveMesoId;

      // Fallback: find the most recent active mesocycle for this user.
      if (!mesoId) {
        const { data: recentRows, error: recentErr } = await supabase
          .from('mesocycles')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(1);
        if (!recentErr && recentRows && recentRows.length > 0) {
          mesoId = (recentRows[0] as { id: string }).id;
        }
      }

      if (mesoId) {
        // Mirror locally so subsequent saveProfile writes target the right row
        if (typeof window !== 'undefined') {
          localStorage.setItem('foundry:active_meso_id', mesoId);
        }

        const { data: mesoData, error: mesoErr } = await supabase
          .from('mesocycles')
          .select('id, user_id, name, status, weeks_count, days_per_week, split_type, started_at, completed_at, updated_at')
          .eq('id', mesoId)
          .maybeSingle();

        if (mesoErr) {
          console.warn('[Foundry Sync] Mesocycle pull failed', mesoErr);
        } else if (mesoData && (mesoData as SupabaseMesocycleRow).status === 'active') {
          const mesoRow = mesoData as SupabaseMesocycleRow;
          const localKey = 'foundry:profile';
          const localRaw = store.get(localKey);
          const mesoFields = supabaseMesoRowToAppFields(mesoRow);
          try {
            const current = localRaw ? JSON.parse(localRaw) : {};
            const merged = { ...current, ...mesoFields };
            const remoteTs = mesoRow.updated_at ?? new Date().toISOString();
            store.setFromRemote(localKey, JSON.stringify(merged), remoteTs);
          } catch {
            // ignore parse errors
          }
        }

        // Chunk 3: pull training_days + training_day_exercises for this meso
        // and rebuild the local storedProgram cache. Joins exercise metadata
        // from EXERCISE_DB so the reconstructed program has all the fields
        // the rest of the app expects (name, muscle, tag, warmup, etc.).
        if (MIGRATED.training_structure) {
          await pullTrainingStructure(mesoId, user.id);
        }

        // Chunk 4b: pull workout_sessions + workout_sets for this meso and
        // reconstruct foundry:day{d}:week{w} jsonb + done flags. MUST run
        // AFTER pullTrainingStructure so the training_day_exercises
        // sort_order map is fresh (needed for exercise_id → exerciseIndex
        // lookups during reconstruction).
        if (MIGRATED.workouts) {
          await pullWorkoutHistory(mesoId, user.id);
        }
      }
    }

    // Chunk 5a/5b/5c: pull body weight log, readiness check-ins, cardio
    // sessions. These are per-user (not per-meso) so they run outside the
    // mesocycle block. Each writes its own localStorage key(s).
    if (MIGRATED.bodyweight) {
      await pullBodyWeightLog(user.id);
    }
    if (MIGRATED.readiness) {
      await pullReadinessCheckins(user.id);
    }
    if (MIGRATED.cardio) {
      await pullCardioSessions(user.id);
    }
    if (MIGRATED.notes) {
      await pullNotes(user.id);
    }

    // Workouts, readiness, body weight, cardio sessions, notes — all pending
    // normalized-schema migration (chunks 4-5). Skipping the pull for these
    // avoids the 400s that happen when asking for denormalized columns that
    // don't exist. When each MIGRATED flag flips to true, implement its
    // pull block using the actual normalized columns.

    console.log('[Foundry Sync] Pull complete (profile + mesocycles + training structure + workouts; readiness/bw/cardio/notes pending)');
    // Notify listeners (App/useMesoState) that local storage has been
    // refreshed from the remote, so they can re-read profile + derived state
    // without requiring a page reload.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('foundry:pull-complete'));
    }
  } catch (e) { console.warn('[Foundry Sync] Pull from Supabase failed', e); Sentry.captureException(e, { tags: { context: 'sync', operation: 'pull' } }); } finally { syncEnd(); }
}

export async function pushToSupabase(): Promise<void> {
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const ops: PromiseLike<unknown>[] = [];

    if (MIGRATED.profile) {
      const rawProfile = store.get('foundry:profile');
      if (rawProfile) {
        try {
          const profile = JSON.parse(rawProfile) as Profile;
          const row = appProfileToSupabaseRow(profile, user.id);
          ops.push(
            supabase.from('user_profiles').upsert(
              { ...row, updated_at: new Date().toISOString() },
              { onConflict: 'id' },
            ),
          );
        } catch {}
      }
    }

    // body_weight_log, workouts, readiness, cardio, notes — pending migration.
    // See MIGRATED flag at top of file. Re-implement each block here using
    // normalized columns when its chunk lands.

    const BATCH = 20;
    let failureCount = 0;
    let firstError: unknown = null;
    for (let i = 0; i < ops.length; i += BATCH) {
      const results = await Promise.allSettled(ops.slice(i, i + BATCH));
      for (const r of results) {
        if (r.status === 'rejected') {
          failureCount++;
          if (!firstError) firstError = r.reason;
          continue;
        }
        // Supabase client resolves to { data, error } without throwing on
        // API errors, so the allSettled "fulfilled" bucket still contains
        // silent failures unless we inspect .error explicitly.
        const v = r.value as { error?: unknown } | null | undefined;
        if (v && v.error) {
          failureCount++;
          if (!firstError) firstError = v.error;
        }
      }
    }
    if (failureCount > 0) {
      reportSyncFailure('push', firstError ?? new Error(`${failureCount} upserts failed silently`));
    } else {
      console.log('[Foundry Sync] Pushed ' + ops.length + ' records to Supabase');
    }
  } catch (e) { reportSyncFailure('push', e); } finally { syncEnd(); }
}

// ─── TRAIN WITH FRIENDS (social) ───────────────────────────────────────────

const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => INVITE_CHARS[b % INVITE_CHARS.length]).join('');
}

export async function createMesoInvite(mesoId: string): Promise<string | null> {
  syncStart();
  try {
    const user = await getUser();
    if (!user) return null;
    const code = generateInviteCode();
    const { error } = await supabase
      .from('mesocycle_members')
      .upsert(
        {
          mesocycle_id: mesoId,
          user_id: user.id,
          role: 'owner',
          invite_code: code,
          joined_at: new Date().toISOString(),
        },
        { onConflict: 'mesocycle_id,user_id' },
      );
    if (error) throw error;
    return code;
  } catch (e) {
    reportSyncFailure('create_invite', e);
    return null;
  } finally {
    syncEnd();
  }
}

export async function getInviteCode(mesoId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('mesocycle_members')
      .select('invite_code')
      .eq('mesocycle_id', mesoId)
      .eq('role', 'owner')
      .maybeSingle();
    if (error || !data) return null;
    return (data as { invite_code: string | null }).invite_code;
  } catch {
    return null;
  }
}

export async function previewInviteCode(code: string): Promise<{
  mesoId: string;
  mesoName: string;
  ownerName: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from('mesocycle_members')
      .select('mesocycle_id')
      .eq('invite_code', code.toUpperCase())
      .maybeSingle();
    if (error || !data) return null;

    const mesoId = (data as { mesocycle_id: string }).mesocycle_id;

    const { data: meso } = await supabase
      .from('mesocycles')
      .select('name, user_id')
      .eq('id', mesoId)
      .maybeSingle();
    if (!meso) return null;

    const { name: mesoName, user_id: ownerId } = meso as { name: string; user_id: string };

    const { data: ownerProfile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', ownerId)
      .maybeSingle();

    const ownerName = (ownerProfile as { name: string } | null)?.name || 'Someone';

    return { mesoId, mesoName, ownerName };
  } catch {
    return null;
  }
}

export async function joinMesoByCode(code: string): Promise<{
  success: boolean;
  mesoName?: string;
  ownerName?: string;
  error?: string;
}> {
  syncStart();
  try {
    const user = await getUser();
    if (!user) return { success: false, error: 'Not signed in' };

    const preview = await previewInviteCode(code);
    if (!preview) return { success: false, error: 'Invalid invite code' };

    const { mesoId, mesoName, ownerName } = preview;

    // Check if already a member
    const { data: existing } = await supabase
      .from('mesocycle_members')
      .select('user_id')
      .eq('mesocycle_id', mesoId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) return { success: false, error: 'You already joined this program' };

    // Archive current meso first (non-destructive — just marks as abandoned)
    await archiveMesocycleRemote();

    // Insert member row
    const { error: insertError } = await supabase
      .from('mesocycle_members')
      .insert({
        mesocycle_id: mesoId,
        user_id: user.id,
        role: 'member',
      });
    if (insertError) throw insertError;

    // Point active meso to the shared one
    localStorage.setItem('foundry:active_meso_id', mesoId);
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ active_meso_id: mesoId, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (profileError) throw profileError;

    // Pull training structure + workout history for the shared meso
    await pullFromSupabase();

    return { success: true, mesoName, ownerName };
  } catch (e) {
    reportSyncFailure('join_meso', e);
    return { success: false, error: 'Something went wrong. Try again.' };
  } finally {
    syncEnd();
  }
}

export async function fetchMesoMembers(mesoId: string): Promise<MesoMember[]> {
  try {
    const user = await getUser();
    if (!user) return [];

    const { data: members, error } = await supabase
      .from('mesocycle_members')
      .select('mesocycle_id, user_id, role, joined_at')
      .eq('mesocycle_id', mesoId);
    if (error || !members) return [];

    type MemberRow = { mesocycle_id: string; user_id: string; role: string; joined_at: string };
    const rows = members as MemberRow[];

    // Filter out current user
    const others = rows.filter((r) => r.user_id !== user.id);
    if (others.length === 0) return [];

    // Fetch names
    const userIds = others.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, name')
      .in('id', userIds);
    const nameMap = new Map<string, string>();
    if (profiles) {
      for (const p of profiles as { id: string; name: string }[]) {
        nameMap.set(p.id, p.name || 'User');
      }
    }

    // Fetch latest completed session per member for this meso
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('user_id, day_number, week_number, completed_at, is_complete')
      .eq('meso_id', mesoId)
      .in('user_id', userIds)
      .eq('is_complete', true)
      .order('completed_at', { ascending: false });

    const activityMap = new Map<string, { dayIdx: number; weekIdx: number; completedAt: string | null }>();
    if (sessions) {
      for (const s of sessions as { user_id: string; day_number: number; week_number: number; completed_at: string | null }[]) {
        if (!activityMap.has(s.user_id)) {
          activityMap.set(s.user_id, {
            dayIdx: s.day_number,
            weekIdx: s.week_number,
            completedAt: s.completed_at,
          });
        }
      }
    }

    return others.map((r): MesoMember => ({
      mesoId: r.mesocycle_id,
      userId: r.user_id,
      role: r.role as 'owner' | 'member',
      name: nameMap.get(r.user_id) || 'User',
      joinedAt: r.joined_at,
      latestActivity: activityMap.get(r.user_id) ?? null,
    }));
  } catch {
    return [];
  }
}

export async function fetchFriendWorkout(
  friendUserId: string,
  mesoId: string,
  dayIdx: number,
  weekIdx: number,
): Promise<FriendWorkoutData | null> {
  try {
    // Get friend's name
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', friendUserId)
      .maybeSingle();
    const userName = (profileData as { name: string } | null)?.name || 'Friend';

    // Get the workout session
    const { data: sessionData } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', friendUserId)
      .eq('meso_id', mesoId)
      .eq('day_number', dayIdx)
      .eq('week_number', weekIdx)
      .maybeSingle();

    if (!sessionData) {
      return { userId: friendUserId, userName, dayIdx, weekIdx, exercises: [] };
    }

    const sessionId = (sessionData as { id: string }).id;

    // Get their sets
    const { data: setRows } = await supabase
      .from('workout_sets')
      .select('exercise_id, set_number, weight_lbs, reps, rpe, is_warmup')
      .eq('workout_session_id', sessionId)
      .order('set_number', { ascending: true });

    if (!setRows || setRows.length === 0) {
      return { userId: friendUserId, userName, dayIdx, weekIdx, exercises: [] };
    }

    type SetRow = {
      exercise_id: string;
      set_number: number;
      weight_lbs: number | null;
      reps: number | null;
      rpe: number | null;
      is_warmup: boolean;
    };

    // Group sets by exercise_id
    const byExercise = new Map<string, SetRow[]>();
    for (const s of setRows as SetRow[]) {
      if (s.is_warmup) continue; // skip warmup sets in friend view
      const arr = byExercise.get(s.exercise_id) || [];
      arr.push(s);
      byExercise.set(s.exercise_id, arr);
    }

    // Resolve exercise names from EXERCISE_DB (dynamic import to avoid circular dep)
    const { EXERCISE_DB } = await import('../data/exercises');

    const exercises: FriendWorkoutData['exercises'] = [];
    for (const [exId, sets] of byExercise) {
      const dbEx = (EXERCISE_DB as unknown as Record<string, { name?: string; muscle?: string }>)[exId];
      exercises.push({
        name: dbEx?.name || exId,
        muscle: dbEx?.muscle || '',
        sets: sets.map((s) => ({
          weight: s.weight_lbs ?? '',
          reps: s.reps ?? '',
          rpe: s.rpe != null ? (s.rpe === 7 ? 'Easy' : s.rpe === 8 ? 'Good' : s.rpe >= 9 ? 'Hard' : s.rpe) : undefined,
        })),
      });
    }

    return { userId: friendUserId, userName, dayIdx, weekIdx, exercises };
  } catch {
    return null;
  }
}
