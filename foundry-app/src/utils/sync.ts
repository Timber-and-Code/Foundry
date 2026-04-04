import * as Sentry from '@sentry/react';
import { supabase } from './supabase.js';
import { store } from './storage.js';
import type { Profile, ReadinessEntry, DayData } from '../types';
import { validateProfile, validateDayData } from './schemas';

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
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const dayWeekMatch = key.match(/^foundry:day(\d+):week(\d+)$/);
          if (dayWeekMatch) {
            const data = JSON.parse(raw);
            const [, d, w] = dayWeekMatch;
            const { error } = await supabase.from('workout_sessions').upsert({ user_id: user.id, day_idx: parseInt(d), week_idx: parseInt(w), data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day_idx,week_idx' });
            if (error) throw error;
            succeeded = true; break;
          }
          if (key === 'foundry:profile') {
            const { error } = await supabase.from('user_profiles').upsert({ id: user.id, data: JSON.parse(raw), updated_at: new Date().toISOString() }, { onConflict: 'id' });
            if (error) throw error;
            succeeded = true; break;
          }
          const readinessMatch = key.match(/^foundry:readiness:(\d{4}-\d{2}-\d{2})$/);
          if (readinessMatch) {
            const r = JSON.parse(raw) as ReadinessEntry;
            const [, date] = readinessMatch;
            const { error } = await supabase.from('readiness_checkins').upsert({ user_id: user.id, date, sleep: r.sleep ?? null, soreness: r.soreness ?? null, energy: r.energy ?? null, score: readinessScore(r), updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' });
            if (error) throw error;
            succeeded = true; break;
          }
          const cardioMatch = key.match(/^foundry:cardio:session:(\d{4}-\d{2}-\d{2})$/);
          if (cardioMatch) {
            const [, date] = cardioMatch;
            const { error } = await supabase.from('cardio_sessions').upsert({ user_id: user.id, date, data: JSON.parse(raw), updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' });
            if (error) throw error;
            succeeded = true; break;
          }
          // Unknown key pattern — nothing to do
          succeeded = true; break;
        } catch (err) {
          lastError = err;
          if (attempt < 2) await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
        }
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

function readinessScore(r: ReadinessEntry | null | undefined): number | null {
  if (!r) return null;
  const s = ({ poor: 0, ok: 1, good: 2 } as Record<string, number>)[r.sleep ?? ''] ?? null;
  const o = ({ high: 0, moderate: 1, low: 2 } as Record<string, number>)[r.soreness ?? ''] ?? null;
  const e = ({ low: 0, moderate: 1, high: 2 } as Record<string, number>)[r.energy ?? ''] ?? null;
  if (s === null || o === null || e === null) return null;
  return s + o + e;
}

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
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase.from('user_profiles').upsert({ id: user.id, data: profile, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw error;
  } catch (e) { reportSyncFailure('profile', e); } finally { syncEnd(); }
}

export async function syncWorkoutToSupabase(dayIdx: number, weekIdx: number, data: DayData): Promise<void> {
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase.from('workout_sessions').upsert(
      { user_id: user.id, day_idx: dayIdx, week_idx: weekIdx, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,day_idx,week_idx' }
    );
    if (error) throw error;
  } catch (e) { reportSyncFailure('workout', e); } finally { syncEnd(); }
}

export async function syncReadinessToSupabase(date: string, readinessData: ReadinessEntry): Promise<void> {
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase.from('readiness_checkins').upsert(
      { user_id: user.id, date, sleep: readinessData.sleep ?? null, soreness: readinessData.soreness ?? null, energy: readinessData.energy ?? null, score: readinessScore(readinessData), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
    if (error) throw error;
  } catch (e) { reportSyncFailure('readiness', e); } finally { syncEnd(); }
}

export async function syncBodyWeightToSupabase(date: string, weightLbs: number): Promise<void> {
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase.from('body_weight_log').upsert(
      { user_id: user.id, date, weight_lbs: weightLbs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
    if (error) throw error;
  } catch (e) { reportSyncFailure('bodyweight', e); } finally { syncEnd(); }
}

export async function syncCardioSessionToSupabase(date: string, data: unknown): Promise<void> {
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase.from('cardio_sessions').upsert(
      { user_id: user.id, date, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
    if (error) throw error;
  } catch (e) { reportSyncFailure('cardio', e); } finally { syncEnd(); }
}

export async function syncNotesToSupabase(dayIdx: number, weekIdx: number, sessionNotes: string | null, exerciseNotes: unknown): Promise<void> {
  syncStart();
  try {
    const user = await getUser();
    if (!user) return;
    const { error } = await supabase.from('notes').upsert(
      { user_id: user.id, day_idx: dayIdx, week_idx: weekIdx, session_notes: sessionNotes ?? null, exercise_notes: exerciseNotes ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,day_idx,week_idx' }
    );
    if (error) throw error;
  } catch (e) { reportSyncFailure('notes', e); } finally { syncEnd(); }
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

    const [profileRes, workoutsRes, readinessRes, bwRes, cardioRes, notesRes] = await Promise.allSettled([
      supabase.from('user_profiles').select('data,updated_at').eq('id', user.id).single(),
      supabase.from('workout_sessions').select('day_idx,week_idx,data,updated_at').eq('user_id', user.id),
      supabase.from('readiness_checkins').select('date,sleep,soreness,energy,updated_at').eq('user_id', user.id),
      supabase.from('body_weight_log').select('date,weight_lbs,updated_at').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('cardio_sessions').select('date,data,updated_at').eq('user_id', user.id),
      supabase.from('notes').select('day_idx,week_idx,session_notes,exercise_notes,updated_at').eq('user_id', user.id),
    ]);

    if (profileRes.status === 'fulfilled' && (profileRes.value.data as { data?: unknown })?.data) {
      const row = profileRes.value.data as { data: unknown; updated_at?: string };
      const remoteTs = row.updated_at ?? new Date().toISOString();
      const parsed = validateProfile(row.data);
      if (parsed.success) {
        const localKey = 'foundry:profile';
        const localRaw = store.get(localKey);
        if (localRaw && !remoteIsNewer(localKey, remoteTs)) {
          // Local is newer — merge fields, keep local as primary, mark dirty
          try {
            const merged = mergeProfile(JSON.parse(localRaw), parsed.data as Record<string, unknown>, remoteTs);
            store.setFromRemote(localKey, JSON.stringify(merged), remoteTs);
          } catch {
            // Parse failed — keep local
          }
          markDirty(localKey);
        } else if (localRaw) {
          // Remote is newer — merge with remote as primary
          try {
            const merged = mergeProfile(JSON.parse(localRaw), parsed.data as Record<string, unknown>, remoteTs);
            store.setFromRemote(localKey, JSON.stringify(merged), remoteTs);
          } catch {
            store.setFromRemote(localKey, JSON.stringify(parsed.data), remoteTs);
          }
        } else {
          // No local data — take remote
          store.setFromRemote(localKey, JSON.stringify(parsed.data), remoteTs);
        }
      } else {
        console.warn('[Foundry Sync] Invalid profile from Supabase:', parsed.error.issues);
        Sentry.captureMessage('Invalid profile data from Supabase', { extra: { issues: parsed.error.issues } });
      }
    }
    if (workoutsRes.status === 'fulfilled' && workoutsRes.value.data) {
      for (const row of workoutsRes.value.data as { day_idx: number; week_idx: number; data: unknown; updated_at?: string }[]) {
        if (row.data == null) continue;
        const parsed = validateDayData(row.data);
        if (!parsed.success) continue;
        const localKey = 'foundry:day' + row.day_idx + ':week' + row.week_idx;
        if (remoteIsNewer(localKey, row.updated_at)) {
          store.setFromRemote(localKey, JSON.stringify(parsed.data), row.updated_at ?? new Date().toISOString());
        } else {
          markDirty(localKey);
        }
      }
    }
    if (readinessRes.status === 'fulfilled' && readinessRes.value.data) {
      for (const row of readinessRes.value.data as { date: string; sleep?: string; soreness?: string; energy?: string; updated_at?: string }[]) {
        const localKey = 'foundry:readiness:' + row.date;
        if (!remoteIsNewer(localKey, row.updated_at)) { markDirty(localKey); continue; }
        const entry: Record<string, string> = {};
        if (row.sleep) entry.sleep = row.sleep;
        if (row.soreness) entry.soreness = row.soreness;
        if (row.energy) entry.energy = row.energy;
        store.setFromRemote(localKey, JSON.stringify(entry), row.updated_at ?? new Date().toISOString());
      }
    }
    if (bwRes.status === 'fulfilled' && (bwRes.value.data as unknown[])?.length) {
      const localKey = 'foundry:bwlog';
      const rows = bwRes.value.data as { date: string; weight_lbs: string; updated_at?: string }[];
      const latestRemoteTs = rows.reduce((max, r) => {
        const t = r.updated_at ?? '';
        return t > max ? t : max;
      }, '');
      if (remoteIsNewer(localKey, latestRemoteTs)) {
        const entries = rows.slice(0, 52).map((r) => ({ date: r.date, weight: parseFloat(r.weight_lbs) }));
        store.setFromRemote(localKey, JSON.stringify(entries), latestRemoteTs || new Date().toISOString());
      } else {
        markDirty(localKey);
      }
    }
    if (cardioRes.status === 'fulfilled' && cardioRes.value.data) {
      for (const row of cardioRes.value.data as { date: string; data: unknown; updated_at?: string }[]) {
        if (row.data == null) continue;
        const localKey = 'foundry:cardio:session:' + row.date;
        if (remoteIsNewer(localKey, row.updated_at)) {
          store.setFromRemote(localKey, JSON.stringify(row.data), row.updated_at ?? new Date().toISOString());
        } else {
          markDirty(localKey);
        }
      }
    }
    if (notesRes.status === 'fulfilled' && notesRes.value.data) {
      for (const row of notesRes.value.data as { day_idx: number; week_idx: number; session_notes?: string; exercise_notes?: unknown; updated_at?: string }[]) {
        const notesKey = 'foundry:notes:d' + row.day_idx + ':w' + row.week_idx;
        const exNotesKey = 'foundry:exnotes:d' + row.day_idx + ':w' + row.week_idx;
        if (remoteIsNewer(notesKey, row.updated_at)) {
          const ts = row.updated_at ?? new Date().toISOString();
          if (row.session_notes != null) store.setFromRemote(notesKey, row.session_notes, ts);
          if (row.exercise_notes != null) store.setFromRemote(exNotesKey, JSON.stringify(row.exercise_notes), ts);
        } else {
          markDirty(notesKey);
        }
      }
    }
    console.log('[Foundry Sync] Pull from Supabase complete (with conflict resolution)');
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

    const rawProfile = store.get('foundry:profile');
    if (rawProfile) {
      try {
        const profile = JSON.parse(rawProfile);
        ops.push(supabase.from('user_profiles').upsert({ id: user.id, data: profile, updated_at: new Date().toISOString() }, { onConflict: 'id' }));
      } catch {}
    }

    const rawBwLog = store.get('foundry:bwlog');
    if (rawBwLog) {
      try {
        const entries = JSON.parse(rawBwLog) as { date: string; weight: number }[];
        for (const entry of entries) {
          if (!entry.date || !entry.weight) continue;
          ops.push(supabase.from('body_weight_log').upsert({ user_id: user.id, date: entry.date, weight_lbs: entry.weight, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' }));
        }
      } catch {}
    }

    const keysToProcess: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('foundry:')) keysToProcess.push(key);
      }
    } catch {}

    for (const key of keysToProcess) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const dayWeekMatch = key.match(/^foundry:day(\d+):week(\d+)$/);
      if (dayWeekMatch) {
        try {
          const data = JSON.parse(raw);
          const [, d, w] = dayWeekMatch;
          ops.push(supabase.from('workout_sessions').upsert({ user_id: user.id, day_idx: parseInt(d), week_idx: parseInt(w), data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day_idx,week_idx' }));
        } catch {}
        continue;
      }
      const readinessMatch = key.match(/^foundry:readiness:(\d{4}-\d{2}-\d{2})$/);
      if (readinessMatch) {
        try {
          const r = JSON.parse(raw) as ReadinessEntry;
          const [, date] = readinessMatch;
          ops.push(supabase.from('readiness_checkins').upsert({ user_id: user.id, date, sleep: r.sleep ?? null, soreness: r.soreness ?? null, energy: r.energy ?? null, score: readinessScore(r), updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' }));
        } catch {}
        continue;
      }
      const cardioMatch = key.match(/^foundry:cardio:session:(\d{4}-\d{2}-\d{2})$/);
      if (cardioMatch) {
        try {
          const data = JSON.parse(raw);
          const [, date] = cardioMatch;
          ops.push(supabase.from('cardio_sessions').upsert({ user_id: user.id, date, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' }));
        } catch {}
        continue;
      }
      const notesMatch = key.match(/^foundry:notes:d(\d+):w(\d+)$/);
      if (notesMatch) {
        const [, d, w] = notesMatch;
        let exNotes: unknown = null;
        try {
          const exRaw = localStorage.getItem('foundry:exnotes:d' + d + ':w' + w);
          if (exRaw) exNotes = JSON.parse(exRaw);
        } catch {}
        ops.push(supabase.from('notes').upsert({ user_id: user.id, day_idx: parseInt(d), week_idx: parseInt(w), session_notes: raw, exercise_notes: exNotes, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day_idx,week_idx' }));
        continue;
      }
    }

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
