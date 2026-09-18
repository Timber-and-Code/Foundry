import type { HealthAccessStatus } from './types';

/**
 * Where to change Health permissions once iOS has recorded an answer. The
 * app can't re-show the sheet for an answered type, so this is the only
 * way back. This Health-app path holds on every iOS version we ship to.
 */
export const HEALTH_SETTINGS_PATH = 'Health app → your profile → Apps → The Foundry';

export type HealthRowStatus = 'OFF' | 'ON' | 'SET UP' | 'PARTIAL' | 'PAUSED';

export interface HealthRowView {
  status: HealthRowStatus;
  subtitle: string;
  /** Tapping the row shows the permission sheet rather than turning sync off. */
  tapRequests: boolean;
}

/**
 * What Settings → Apple Health should say, from the REAL per-type share
 * status.
 *
 * The old copy keyed off the weight read check, which only proves the lifter
 * was ASKED about weight (iOS hides read grants). So a lifter who refused
 * everything, or who was never asked about workouts, saw a green ON — and
 * was told to allow Workouts in iOS Settings, where no such switch exists
 * for a type the app never requested.
 */
export function describeHealthState(enabled: boolean, access: HealthAccessStatus | null): HealthRowView {
  if (!enabled) {
    return {
      status: 'OFF',
      subtitle:
        'Sync bodyweight with Apple Health, and post finished workouts to Apple Fitness so they count toward your rings.',
      tapRequests: true,
    };
  }
  if (!access) {
    return { status: 'ON', subtitle: 'Checking Apple Health access…', tapRequests: false };
  }
  if (access.needsPrompt) {
    return {
      status: 'SET UP',
      subtitle:
        'Apple Health needs your OK for workouts. Tap to allow them so finished sessions post to Apple Fitness.',
      tapRequests: true,
    };
  }
  const weight = access.weight === 'authorized';
  const workouts = access.workouts === 'authorized';
  if (weight && workouts) {
    return {
      status: 'ON',
      subtitle: 'Active. Bodyweight syncs both ways; finished workouts post to Apple Fitness.',
      tapRequests: false,
    };
  }
  if (workouts) {
    return {
      status: 'PARTIAL',
      subtitle: `Workouts post to Apple Fitness. Bodyweight is off — turn on Weight in ${HEALTH_SETTINGS_PATH}.`,
      tapRequests: false,
    };
  }
  if (weight) {
    return {
      status: 'PARTIAL',
      subtitle: `Bodyweight syncs. Workouts are off — turn on Workouts and Active Energy in ${HEALTH_SETTINGS_PATH}.`,
      tapRequests: false,
    };
  }
  return {
    status: 'PAUSED',
    subtitle: `Apple Health access is off for The Foundry. Turn it on in ${HEALTH_SETTINGS_PATH}.`,
    tapRequests: false,
  };
}
