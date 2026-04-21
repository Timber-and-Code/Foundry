import { Health } from '@capgo/capacitor-health';
import type { AuthorizationStatus } from '@capgo/capacitor-health';
import type { HealthPermissions, HealthService, WeightReading } from './types';
import { KG_TO_LBS } from './types';

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
}
