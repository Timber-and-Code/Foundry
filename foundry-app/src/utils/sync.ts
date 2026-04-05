import * as Sentry from '@sentry/react';
import { supabase } from './supabase.js';
import { store } from './storage.js';
import type { Profile, ReadinessEntry, DayData } from '../types';
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
  profile: true,  // Chunk 1 — this file
  mesocycles: false,
  workouts: false,
  readiness: false,
  bodyweight: false,
  cardio: false,
  notes: false,
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
  const valid: SupabasePrimaryGoal[] = [
    'build_muscle',
    'build_strength',
    'lose_fat',
    'improve_fitness',
    'sport_conditioning',
  ];
  if (typeof goal === 'string' && (valid as string[]).includes(goal)) {
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
  };
}

function supabaseRowToAppProfileFields(row: SupabaseProfileRow): Record<string, unknown> {
  // Returns ONLY the identity fields — never touches meso-specific fields
  // (workoutDays, mesoLength, startDate, sessionDuration) so a pull doesn't
  // accidentally clear the user's active local meso config.
  return {
    name: row.name,
    experience: row.experience, // canonical enum value
    goal: row.primary_goal,
    splitType: row.preferred_split.toLowerCase(), // app uses lowercase
    daysPerWeek: row.days_per_week,
    equipment: Array.isArray(row.equipment) ? row.equipment : [],
    gender: row.gender ?? undefined,
    birthdate: row.date_of_birth ?? undefined,
    weight: row.weight_lbs != null ? String(row.weight_lbs) : undefined,
  };
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
            succeeded = true; break;
          }
          const cardioMatch = key.match(/^foundry:cardio:session:(\d{4}-\d{2}-\d{2})$/);
          if (cardioMatch) {
            if (!MIGRATED.cardio) { deferred = true; break; }
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

// The following helpers are stubbed until their respective normalized-schema
// migration chunks land. They silently no-op so we don't spam toasts for
// tables that have a different shape than the app is writing. When each
// chunk is implemented, flip the corresponding MIGRATED flag and rewrite the
// body to use the actual normalized columns.

export async function syncWorkoutToSupabase(_dayIdx: number, _weekIdx: number, _data: DayData): Promise<void> {
  if (!MIGRATED.workouts) return;
}

export async function syncReadinessToSupabase(_date: string, _readinessData: ReadinessEntry): Promise<void> {
  if (!MIGRATED.readiness) return;
}

export async function syncBodyWeightToSupabase(_date: string, _weightLbs: number): Promise<void> {
  if (!MIGRATED.bodyweight) return;
}

export async function syncCardioSessionToSupabase(_date: string, _data: unknown): Promise<void> {
  if (!MIGRATED.cardio) return;
}

export async function syncNotesToSupabase(_dayIdx: number, _weekIdx: number, _sessionNotes: string | null, _exerciseNotes: unknown): Promise<void> {
  if (!MIGRATED.notes) return;
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

    if (MIGRATED.profile) {
      const profileRes = await supabase
        .from('user_profiles')
        .select('id, name, experience, primary_goal, days_per_week, preferred_split, equipment, gender, date_of_birth, weight_lbs, additional_notes, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (profileRes.error) {
        console.warn('[Foundry Sync] Profile pull failed', profileRes.error);
      } else if (profileRes.data) {
        const row = profileRes.data as SupabaseProfileRow;
        const remoteTs = row.updated_at ?? new Date().toISOString();
        const localKey = 'foundry:profile';
        const localRaw = store.get(localKey);
        const remoteFields = supabaseRowToAppProfileFields(row);

        if (localRaw) {
          // Merge: overlay remote identity fields on the local profile, but
          // preserve local meso-specific fields (workoutDays, mesoLength,
          // startDate, sessionDuration, etc.) since those are not yet synced.
          try {
            const localProfile = JSON.parse(localRaw) as Record<string, unknown>;
            const remoteIsFresher = remoteIsNewer(localKey, remoteTs);
            const merged = remoteIsFresher
              ? { ...localProfile, ...remoteFields }
              : { ...remoteFields, ...localProfile };
            store.setFromRemote(localKey, JSON.stringify(merged), remoteTs);
            if (!remoteIsFresher) markDirty(localKey);
          } catch {
            // Local parse failed — take remote as-is
            store.setFromRemote(localKey, JSON.stringify(remoteFields), remoteTs);
          }
        } else {
          // No local profile — take remote identity fields. User will still
          // need to complete meso setup since those fields aren't synced yet.
          store.setFromRemote(localKey, JSON.stringify(remoteFields), remoteTs);
        }
      }
    }

    // Workouts, readiness, body weight, cardio sessions, notes — all pending
    // normalized-schema migration. Skipping the pull for these avoids the
    // 400s that happen when asking for denormalized columns that don't exist.
    // When each MIGRATED flag flips to true, re-implement the matching pull
    // block using the actual normalized columns for that table.

    console.log('[Foundry Sync] Pull from Supabase complete (profile only — other tables pending migration)');
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
