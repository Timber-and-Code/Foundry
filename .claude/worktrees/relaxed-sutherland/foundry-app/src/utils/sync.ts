import { supabase } from './supabase.js';
import { store } from './storage.js';
import type { Profile, ReadinessEntry, DayData } from '../types';

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function readinessScore(r: ReadinessEntry | null | undefined): number | null {
  if (!r) return null;
  const s = ({ poor: 0, ok: 1, good: 2 } as Record<string, number>)[r.sleep ?? ''] ?? null;
  const o = ({ high: 0, moderate: 1, low: 2 } as Record<string, number>)[r.soreness ?? ''] ?? null;
  const e = ({ low: 0, moderate: 1, high: 2 } as Record<string, number>)[r.energy ?? ''] ?? null;
  if (s === null || o === null || e === null) return null;
  return s + o + e;
}

export async function syncProfileToSupabase(profile: Profile): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase.from('user_profiles').upsert({ id: user.id, data: profile, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  } catch (e) { console.warn('[Foundry Sync] Profile sync failed', e); }
}

export async function syncWorkoutToSupabase(dayIdx: number, weekIdx: number, data: DayData): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase.from('workout_sessions').upsert(
      { user_id: user.id, day_idx: dayIdx, week_idx: weekIdx, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,day_idx,week_idx' }
    );
  } catch (e) { console.warn('[Foundry Sync] Workout sync failed', e); }
}

export async function syncReadinessToSupabase(date: string, readinessData: ReadinessEntry): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase.from('readiness_checkins').upsert(
      { user_id: user.id, date, sleep: readinessData.sleep ?? null, soreness: readinessData.soreness ?? null, energy: readinessData.energy ?? null, score: readinessScore(readinessData), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
  } catch (e) { console.warn('[Foundry Sync] Readiness sync failed', e); }
}

export async function syncBodyWeightToSupabase(date: string, weightLbs: number): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase.from('body_weight_log').upsert(
      { user_id: user.id, date, weight_lbs: weightLbs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
  } catch (e) { console.warn('[Foundry Sync] Body weight sync failed', e); }
}

export async function syncCardioSessionToSupabase(date: string, data: unknown): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase.from('cardio_sessions').upsert(
      { user_id: user.id, date, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
  } catch (e) { console.warn('[Foundry Sync] Cardio session sync failed', e); }
}

export async function syncNotesToSupabase(dayIdx: number, weekIdx: number, sessionNotes: string | null, exerciseNotes: unknown): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase.from('notes').upsert(
      { user_id: user.id, day_idx: dayIdx, week_idx: weekIdx, session_notes: sessionNotes ?? null, exercise_notes: exerciseNotes ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,day_idx,week_idx' }
    );
  } catch (e) { console.warn('[Foundry Sync] Notes sync failed', e); }
}

export async function pullFromSupabase(): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;

    const [profileRes, workoutsRes, readinessRes, bwRes, cardioRes, notesRes] = await Promise.allSettled([
      supabase.from('user_profiles').select('data').eq('id', user.id).single(),
      supabase.from('workout_sessions').select('day_idx,week_idx,data').eq('user_id', user.id),
      supabase.from('readiness_checkins').select('date,sleep,soreness,energy').eq('user_id', user.id),
      supabase.from('body_weight_log').select('date,weight_lbs').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('cardio_sessions').select('date,data').eq('user_id', user.id),
      supabase.from('notes').select('day_idx,week_idx,session_notes,exercise_notes').eq('user_id', user.id),
    ]);

    if (profileRes.status === 'fulfilled' && (profileRes.value.data as { data?: unknown })?.data) {
      store.set('foundry:profile', JSON.stringify((profileRes.value.data as { data: unknown }).data));
    }
    if (workoutsRes.status === 'fulfilled' && workoutsRes.value.data) {
      for (const row of workoutsRes.value.data as { day_idx: number; week_idx: number; data: unknown }[]) {
        if (row.data != null) store.set('foundry:day' + row.day_idx + ':week' + row.week_idx, JSON.stringify(row.data));
      }
    }
    if (readinessRes.status === 'fulfilled' && readinessRes.value.data) {
      for (const row of readinessRes.value.data as { date: string; sleep?: string; soreness?: string; energy?: string }[]) {
        const entry: Record<string, string> = {};
        if (row.sleep) entry.sleep = row.sleep;
        if (row.soreness) entry.soreness = row.soreness;
        if (row.energy) entry.energy = row.energy;
        store.set('foundry:readiness:' + row.date, JSON.stringify(entry));
      }
    }
    if (bwRes.status === 'fulfilled' && (bwRes.value.data as unknown[])?.length) {
      const entries = (bwRes.value.data as { date: string; weight_lbs: string }[])
        .slice(0, 52).map((r) => ({ date: r.date, weight: parseFloat(r.weight_lbs) }));
      store.set('foundry:bwlog', JSON.stringify(entries));
    }
    if (cardioRes.status === 'fulfilled' && cardioRes.value.data) {
      for (const row of cardioRes.value.data as { date: string; data: unknown }[]) {
        if (row.data != null) store.set('foundry:cardio:session:' + row.date, JSON.stringify(row.data));
      }
    }
    if (notesRes.status === 'fulfilled' && notesRes.value.data) {
      for (const row of notesRes.value.data as { day_idx: number; week_idx: number; session_notes?: string; exercise_notes?: unknown }[]) {
        if (row.session_notes != null) store.set('foundry:notes:d' + row.day_idx + ':w' + row.week_idx, row.session_notes);
        if (row.exercise_notes != null) store.set('foundry:exnotes:d' + row.day_idx + ':w' + row.week_idx, JSON.stringify(row.exercise_notes));
      }
    }
    console.log('[Foundry Sync] Pull from Supabase complete');
  } catch (e) { console.warn('[Foundry Sync] Pull from Supabase failed', e); }
}

export async function pushToSupabase(): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;
    const ops: Promise<unknown>[] = [];

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
    for (let i = 0; i < ops.length; i += BATCH) {
      await Promise.allSettled(ops.slice(i, i + BATCH));
    }
    console.log('[Foundry Sync] Pushed ' + ops.length + ' records to Supabase');
  } catch (e) { console.warn('[Foundry Sync] Push to Supabase failed', e); }
}
