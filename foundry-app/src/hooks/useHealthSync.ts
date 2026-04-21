import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { store, loadProfile, saveProfile } from '../utils/store';
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

  const auth = await health.checkPermissions({ read: ['weight'], write: [] });
  if (!auth.readAuthorized.includes('weight')) return;

  const reading = await health.readLatestBodyWeight();
  store.set(LAST_SYNC_KEY, String(Date.now()));
  if (!reading) return;

  const profile = loadProfile();
  if (!profile) return;

  const currentLbs = typeof profile.weight === 'number'
    ? profile.weight
    : parseFloat(String(profile.weight ?? ''));

  // Skip if the HK reading matches what we already have (within 0.2 lb)
  if (!isNaN(currentLbs) && Math.abs(currentLbs - reading.pounds) < 0.2) return;

  const updated: Profile = { ...profile, weight: reading.pounds };
  saveProfile(updated);
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
