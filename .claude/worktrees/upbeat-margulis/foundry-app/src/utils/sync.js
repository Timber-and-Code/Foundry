/**
 * Supabase sync layer — localStorage is authoritative for reads/writes,
 * Supabase is the cloud backup. All sync is fire-and-forget.
 *
 * Rules:
 *  - Write to localStorage first, then sync to Supabase in background.
 *  - On login/startup, pull from Supabase and merge (Supabase wins on conflict).
 *  - On signup, push existing localStorage data to Supabase.
 *  - Every Supabase call is wrapped in try/catch — offline = localStorage only.
 */

import { supabase } from './supabase.js';
import { store } from './storage.js';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function getUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function readinessScore(r) {
  if (!r) return null;
  const s = { poor: 0, ok: 1, good: 2 }[r.sleep] ?? null;
  const o = { high: 0, moderate: 1, low: 2 }[r.soreness] ?? null;
  const e = { low: 0, moderate: 1, high: 2 }[r.energy] ?? null;
  if (s === null || o === null || e === null) return null;
  return s + o + e;
}

// ─── INDIVIDUAL SYNC FUNCTIONS ───────────────────────────────────────────────

/**
 * Upsert user profile to Supabase.
 * Called after saveProfile().
 */
export async function syncProfileToSupabase(profile) {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase
      .from('user_profiles')
      .upsert({ id: user.id, data: profile, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  } catch (e) {
    console.warn('[Foundry Sync] Profile sync failed', e);
  }
}

/**
 * Upsert a workout session (day/week exercise data) to Supabase.
 * Called after saveDayWeek().
 */
export async function syncWorkoutToSupabase(dayIdx, weekIdx, data) {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase.from('workout_sessions').upsert(
      {
        user_id: user.id,
        day_idx: dayIdx,
        week_idx: weekIdx,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day_idx,week_idx' }
    );
  } catch (e) {
    console.warn('[Foundry Sync] Workout sync failed', e);
  }
}

/**
 * Upsert a readiness check-in to Supabase.
 * Called after the readiness store.set() in HomeView / DayView.
 */
export async function syncReadinessToSupabase(date, readinessData) {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase.from('readiness_checkins').upsert(
      {
        user_id: user.id,
        date,
        sleep: readinessData.sleep ?? null,
        soreness: readinessData.soreness ?? null,
        energy: readinessData.energy ?? null,
        score: readinessScore(readinessData),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    );
  } catch (e) {
    console.warn('[Foundry Sync] Readiness sync failed', e);
  }
}

/**
 * Upsert a body-weight entry to Supabase.
 * Called after addBwEntry() / saveBwLog().
 */
export async function syncBodyWeightToSupabase(date, weightLbs) {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase.from('body_weight_log').upsert(
      {
        user_id: user.id,
        date,
        weight_lbs: weightLbs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    );
  } catch (e) {
    console.warn('[Foundry Sync] Body weight sync failed', e);
  }
}

/**
 * Upsert a cardio session to Supabase.
 * Called after saveCardioSession().
 */
export async function syncCardioSessionToSupabase(date, data) {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase.from('cardio_sessions').upsert(
      {
        user_id: user.id,
        date,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    );
  } catch (e) {
    console.warn('[Foundry Sync] Cardio session sync failed', e);
  }
}

/**
 * Upsert workout notes to Supabase.
 * Called after saveNotes() or saveExNotes().
 */
export async function syncNotesToSupabase(dayIdx, weekIdx, sessionNotes, exerciseNotes) {
  try {
    const user = await getUser();
    if (!user) return;
    await supabase.from('notes').upsert(
      {
        user_id: user.id,
        day_idx: dayIdx,
        week_idx: weekIdx,
        session_notes: sessionNotes ?? null,
        exercise_notes: exerciseNotes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day_idx,week_idx' }
    );
  } catch (e) {
    console.warn('[Foundry Sync] Notes sync failed', e);
  }
}

// ─── PULL FROM SUPABASE ───────────────────────────────────────────────────────

/**
 * Pull all user data from Supabase and merge into localStorage.
 * Supabase wins on conflicts (cloud is source of truth after login).
 * Called on login and app startup when authenticated.
 */
export async function pullFromSupabase() {
  try {
    const user = await getUser();
    if (!user) return;

    // Run all pulls in parallel
    const [profileRes, workoutsRes, readinessRes, bwRes, cardioRes, notesRes] = await Promise.allSettled([
      supabase.from('user_profiles').select('data').eq('id', user.id).single(),
      supabase.from('workout_sessions').select('day_idx,week_idx,data').eq('user_id', user.id),
      supabase.from('readiness_checkins').select('date,sleep,soreness,energy').eq('user_id', user.id),
      supabase.from('body_weight_log').select('date,weight_lbs').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('cardio_sessions').select('date,data').eq('user_id', user.id),
      supabase.from('notes').select('day_idx,week_idx,session_notes,exercise_notes').eq('user_id', user.id),
    ]);

    // Profile
    if (profileRes.status === 'fulfilled' && profileRes.value.data?.data) {
      store.set('foundry:profile', JSON.stringify(profileRes.value.data.data));
    }

    // Workout sessions
    if (workoutsRes.status === 'fulfilled' && workoutsRes.value.data) {
      for (const row of workoutsRes.value.data) {
        if (row.data != null) {
          store.set(`foundry:day${row.day_idx}:week${row.week_idx}`, JSON.stringify(row.data));
        }
      }
    }

    // Readiness check-ins
    if (readinessRes.status === 'fulfilled' && readinessRes.value.data) {
      for (const row of readinessRes.value.data) {
        const entry = {};
        if (row.sleep) entry.sleep = row.sleep;
        if (row.soreness) entry.soreness = row.soreness;
        if (row.energy) entry.energy = row.energy;
        store.set(`foundry:readiness:${row.date}`, JSON.stringify(entry));
      }
    }

    // Body weight log — rebuild the local array from Supabase rows
    if (bwRes.status === 'fulfilled' && bwRes.value.data?.length) {
      const entries = bwRes.value.data
        .slice(0, 52)
        .map((r) => ({ date: r.date, weight: parseFloat(r.weight_lbs) }));
      store.set('foundry:bwlog', JSON.stringify(entries));
    }

    // Cardio sessions
    if (cardioRes.status === 'fulfilled' && cardioRes.value.data) {
      for (const row of cardioRes.value.data) {
        if (row.data != null) {
          store.set(`foundry:cardio:session:${row.date}`, JSON.stringify(row.data));
        }
      }
    }

    // Notes
    if (notesRes.status === 'fulfilled' && notesRes.value.data) {
      for (const row of notesRes.value.data) {
        if (row.session_notes != null) {
          store.set(`foundry:notes:d${row.day_idx}:w${row.week_idx}`, row.session_notes);
        }
        if (row.exercise_notes != null) {
          store.set(
            `foundry:exnotes:d${row.day_idx}:w${row.week_idx}`,
            JSON.stringify(row.exercise_notes)
          );
        }
      }
    }

    console.log('[Foundry Sync] Pull from Supabase complete');
  } catch (e) {
    console.warn('[Foundry Sync] Pull from Supabase failed', e);
  }
}

// ─── PUSH TO SUPABASE ─────────────────────────────────────────────────────────

/**
 * Push all localStorage data to Supabase.
 * Called on signup (so existing users don't lose data) or "Sync now".
 */
export async function pushToSupabase() {
  try {
    const user = await getUser();
    if (!user) return;

    const ops = [];

    // Profile
    const rawProfile = store.get('foundry:profile');
    if (rawProfile) {
      try {
        const profile = JSON.parse(rawProfile);
        ops.push(
          supabase
            .from('user_profiles')
            .upsert({ id: user.id, data: profile, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        );
      } catch {}
    }

    // Body weight log
    const rawBwLog = store.get('foundry:bwlog');
    if (rawBwLog) {
      try {
        const entries = JSON.parse(rawBwLog);
        for (const entry of entries) {
          if (!entry.date || !entry.weight) continue;
          ops.push(
            supabase.from('body_weight_log').upsert(
              { user_id: user.id, date: entry.date, weight_lbs: entry.weight, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,date' }
            )
          );
        }
      } catch {}
    }

    // Scan localStorage for day/week, readiness, cardio, notes keys
    const keysToProcess = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('foundry:')) keysToProcess.push(key);
      }
    } catch {}

    for (const key of keysToProcess) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      // foundry:day{d}:week{w}
      const dayWeekMatch = key.match(/^foundry:day(\d+):week(\d+)$/);
      if (dayWeekMatch) {
        try {
          const data = JSON.parse(raw);
          const [, d, w] = dayWeekMatch;
          ops.push(
            supabase.from('workout_sessions').upsert(
              { user_id: user.id, day_idx: parseInt(d), week_idx: parseInt(w), data, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,day_idx,week_idx' }
            )
          );
        } catch {}
        continue;
      }

      // foundry:readiness:{YYYY-MM-DD}
      const readinessMatch = key.match(/^foundry:readiness:(\d{4}-\d{2}-\d{2})$/);
      if (readinessMatch) {
        try {
          const r = JSON.parse(raw);
          const [, date] = readinessMatch;
          ops.push(
            supabase.from('readiness_checkins').upsert(
              {
                user_id: user.id,
                date,
                sleep: r.sleep ?? null,
                soreness: r.soreness ?? null,
                energy: r.energy ?? null,
                score: readinessScore(r),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,date' }
            )
          );
        } catch {}
        continue;
      }

      // foundry:cardio:session:{YYYY-MM-DD}
      const cardioMatch = key.match(/^foundry:cardio:session:(\d{4}-\d{2}-\d{2})$/);
      if (cardioMatch) {
        try {
          const data = JSON.parse(raw);
          const [, date] = cardioMatch;
          ops.push(
            supabase.from('cardio_sessions').upsert(
              { user_id: user.id, date, data, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,date' }
            )
          );
        } catch {}
        continue;
      }

      // foundry:notes:d{d}:w{w}
      const notesMatch = key.match(/^foundry:notes:d(\d+):w(\d+)$/);
      if (notesMatch) {
        const [, d, w] = notesMatch;
        const dayIdx = parseInt(d);
        const weekIdx = parseInt(w);
        let exNotes = null;
        try {
          const exRaw = localStorage.getItem(`foundry:exnotes:d${d}:w${w}`);
          if (exRaw) exNotes = JSON.parse(exRaw);
        } catch {}
        ops.push(
          supabase.from('notes').upsert(
            {
              user_id: user.id,
              day_idx: dayIdx,
              week_idx: weekIdx,
              session_notes: raw,
              exercise_notes: exNotes,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,day_idx,week_idx' }
          )
        );
        continue;
      }
    }

    // Fire all upserts in parallel (batched to avoid overwhelming the connection)
    const BATCH = 20;
    for (let i = 0; i < ops.length; i += BATCH) {
      await Promise.allSettled(ops.slice(i, i + BATCH));
    }

    console.log(`[Foundry Sync] Pushed ${ops.length} records to Supabase`);
  } catch (e) {
    console.warn('[Foundry Sync] Push to Supabase failed', e);
  }
}
