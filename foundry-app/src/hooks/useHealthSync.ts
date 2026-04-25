import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { store, loadProfile, saveProfile, loadBwLog, addBwEntry } from '../utils/store';
import { getHealthService } from '../utils/health';
import type { Profile } from '../types';

const TOGGLE_KEY = 'foundry:health:enabled';
const LAST_SYNC_KEY = 'foundry:health:last_weight_sync';

/**
 * Minimum gap between background weight pulls. HealthKit doesn't rate-limit
 * us, but there's no reason to hammer it — bodyweight changes on the scale,
 * not the second.
 */
const SYNC_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

async function syncBodyWeight() {
  if (store.get(TOGGLE_KEY) !== '1') return;

  const last = parseInt(store.get(LAST_SYNC_KEY) || '0', 10);
  if (Date.now() - last < SYNC_COOLDOWN_MS) return;

  const health = getHealthService();
  if (!(await health.isAvailable())) return;

  const auth = await health.checkPermissions({ read: ['weight'], write: ['weight'] });
  if (!auth.readAuthorized.includes('weight')) return;

  const reading = await health.readLatestBodyWeight();
  store.set(LAST_SYNC_KEY, String(Date.now()));
  if (!reading) return;

  const profile = loadProfile();
  if (!profile) return;

  const currentLbs = typeof profile.weight === 'number'
    ? profile.weight
    : parseFloat(String(profile.weight ?? ''));

  // Skip if the HK reading matches what we already have (within 0.2 lb).
  const matchesProfile = !isNaN(currentLbs) && Math.abs(currentLbs - reading.pounds) < 0.2;
  if (matchesProfile) return;

  // 1) Update the profile's "current weight" (used by the workout BW
  //    prefill + Settings).
  const updated: Profile = { ...profile, weight: reading.pounds };
  saveProfile(updated);

  // 2) Append to the bodyweight log so HK readings show up in app trends.
  //    addBwEntry already de-dupes by date (latest per day wins). Only push
  //    when our most-recent log entry differs by ≥0.2 lb so we don't churn
  //    the log on no-op syncs.
  const log = loadBwLog();
  const latest = log[0];
  const latestLbs = latest ? Number(latest.weight) : NaN;
  const matchesLog = !isNaN(latestLbs) && Math.abs(latestLbs - reading.pounds) < 0.2;
  if (!matchesLog) {
    // skipHealthWrite — the value just came FROM HealthKit; writing it
    // back would create a ping-pong on every sync cycle.
    addBwEntry(reading.pounds, { skipHealthWrite: true });
  }
}

/**
 * Wire body-weight sync into the app lifecycle. Fires on mount and on each
 * resume from background — HealthKit doesn't push to us on its own.
 */
export function useHealthSync(): void {
  useEffect(() => {
    syncBodyWeight().catch(() => { /* swallow — we tried */ });
    const listenerPromise = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      syncBodyWeight().catch(() => { /* swallow */ });
    });
    return () => {
      listenerPromise.then((l) => l.remove()).catch(() => {});
    };
  }, []);
}
