import type { AuthorizationStatus } from '@capgo/capacitor-health';
import type { HealthService, WeightReading } from './types';

/**
 * Web fallback. Returns "not available" for every call so the rest of the
 * app can run the same code paths without caring what platform it's on.
 */
export class NoOpHealthService implements HealthService {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async requestPermissions(): Promise<AuthorizationStatus> {
    return { readAuthorized: [], readDenied: [], writeAuthorized: [], writeDenied: [] };
  }

  async checkPermissions(): Promise<AuthorizationStatus> {
    return { readAuthorized: [], readDenied: [], writeAuthorized: [], writeDenied: [] };
  }

  async readLatestBodyWeight(): Promise<WeightReading | null> {
    return null;
  }

  async writeBodyWeight(): Promise<boolean> {
    return false;
  }
}
