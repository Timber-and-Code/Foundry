import { Health } from '@capgo/capacitor-health';
import type { AuthorizationStatus } from '@capgo/capacitor-health';
import type {
  HealthAccessStatus,
  HealthPermissions,
  HealthService,
  StrengthWorkoutWrite,
  WeightReading,
} from './types';
import { KG_TO_LBS } from './types';
import { FoundryHealth } from './foundryWorkoutPlugin';

/**
 * Native HealthService implementation. Wraps @capgo/capacitor-health.
 * Only instantiated on iOS / Android — the web build uses NoOpHealthService.
 */
export class CapacitorHealthService implements HealthService {
  async isAvailable(): Promise<boolean> {
    try {
      const res = await Health.isAvailable();
      return res.available;
    } catch {
      return false;
    }
  }

  async requestPermissions(perms: HealthPermissions): Promise<AuthorizationStatus> {
    return Health.requestAuthorization(perms);
  }

  async checkPermissions(perms: HealthPermissions): Promise<AuthorizationStatus> {
    return Health.checkAuthorization(perms);
  }

  async readLatestBodyWeight(): Promise<WeightReading | null> {
    try {
      // Pull a 90-day window so we find readings even if the user last
      // logged weight a couple of months ago. One sample, newest first.
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      const { samples } = await Health.readSamples({
        dataType: 'weight',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        limit: 1,
        ascending: false,
      });
      if (!samples.length) return null;
      const sample = samples[0];
      return {
        pounds: Math.round(sample.value * KG_TO_LBS * 10) / 10,
        takenAt: sample.startDate,
        sourceName: sample.sourceName,
      };
    } catch {
      return null;
    }
  }

  async writeBodyWeight(pounds: number, takenAt?: Date): Promise<boolean> {
    try {
      const kg = pounds / KG_TO_LBS;
      const stamp = (takenAt ?? new Date()).toISOString();
      await Health.saveSample({
        dataType: 'weight',
        value: kg,
        startDate: stamp,
        endDate: stamp,
      });
      return true;
    } catch {
      return false;
    }
  }

  // ── Workouts (our own Swift plugin — see foundryWorkoutPlugin.ts) ──────
  // These are separate from the weight calls above because HKWorkout has no
  // representation in @capgo/capacitor-health. Permission and status calls
  // throw when the native plugin is unreachable or HealthKit refuses the
  // request; the callers decide how to surface that. Health stays a side
  // effect of finishing a workout — logWorkoutToHealth is the guard that
  // keeps any of this from failing a completion.

  async requestAllPermissions(): Promise<HealthAccessStatus> {
    return FoundryHealth.requestHealthPermissions();
  }

  async getAccessStatus(): Promise<HealthAccessStatus> {
    return FoundryHealth.getHealthAuthorizationStatus();
  }

  async requestWorkoutPermission(): Promise<boolean> {
    try {
      const { granted } = await FoundryHealth.requestWorkoutPermission();
      return !!granted;
    } catch {
      return false;
    }
  }

  async checkWorkoutPermission(): Promise<boolean> {
    try {
      const { granted } = await FoundryHealth.checkWorkoutPermission();
      return !!granted;
    } catch {
      return false;
    }
  }

  async writeStrengthWorkout(workout: StrengthWorkoutWrite): Promise<boolean> {
    // Not caught: a rejection here is a real HealthKit failure, and the
    // caller reports it. An expected no-op resolves { saved: false }.
    const { saved } = await FoundryHealth.saveStrengthWorkout(workout);
    return !!saved;
  }
}
