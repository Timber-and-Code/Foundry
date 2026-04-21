import { Capacitor } from '@capacitor/core';
import { CapacitorHealthService } from './CapacitorHealthService';
import { NoOpHealthService } from './NoOpHealthService';
import type { HealthService } from './types';

export * from './types';

let _instance: HealthService | null = null;

/**
 * Single process-wide HealthService. Native implementation on iOS/Android,
 * no-op stub on the web build. The caller never needs to branch on platform.
 */
export function getHealthService(): HealthService {
  if (_instance) return _instance;
  _instance = Capacitor.isNativePlatform()
    ? new CapacitorHealthService()
    : new NoOpHealthService();
  return _instance;
}
