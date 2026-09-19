import { store } from '../store';
import { getHealthService } from './index';
import type { HealthAccessStatus } from './types';

/** Master Apple Health toggle, owned by Settings → Apple Health. */
export const HEALTH_TOGGLE_KEY = 'foundry:health:enabled';

let inFlight: Promise<HealthAccessStatus | null> | null = null;

/**
 * For a lifter who has Apple Health switched ON: if iOS still has a type it
 * has never asked about, show the one combined sheet now.
 *
 * Why this exists: 2.15.0 build 1 chained two permission requests and iOS
 * dropped the second, so everyone who enabled Health on it granted body
 * weight but was never asked about Workouts. Their toggle stayed ON, the
 * app told them to "allow Workouts in iOS Settings" — where no such switch
 * exists for a type the app never requested — and every finished session
 * silently skipped Apple Health. Nothing ever asked again. Only a new
 * request can put Workouts in front of them, and iOS only shows it for the
 * never-asked types, so this is a one-time sheet, not a nag.
 *
 * Returns the resulting status, or null when Health is off / unavailable.
 * Single-flight: launch and a workout completion racing each other must not
 * stack two sheets — the second one would be dropped by iOS anyway.
 * Throws when the native plugin is unreachable; callers report it.
 */
export function reconcileHealthAccess(): Promise<HealthAccessStatus | null> {
  if (!inFlight) {
    inFlight = run().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function run(): Promise<HealthAccessStatus | null> {
  if (store.get(HEALTH_TOGGLE_KEY) !== '1') return null;
  const health = getHealthService();
  if (!(await health.isAvailable())) return null;
  const status = await health.getAccessStatus();
  if (!status.available || !status.needsPrompt) return status;
  return health.requestAllPermissions();
}
