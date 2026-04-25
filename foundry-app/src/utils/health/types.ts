import type { AuthorizationStatus, HealthDataType } from '@capgo/capacitor-health';

export type { HealthDataType, AuthorizationStatus };

export interface WeightReading {
  /** Weight in pounds (app's native unit). */
  pounds: number;
  /** ISO 8601 date the reading was taken. */
  takenAt: string;
  /** Name of the source app that wrote the reading, when available. */
  sourceName?: string;
}

export interface HealthPermissions {
  read: HealthDataType[];
  write: HealthDataType[];
}

export interface HealthService {
  /** True when the underlying platform supports HealthKit / Health Connect. */
  isAvailable(): Promise<boolean>;

  /**
   * Prompt the user for access. First call surfaces the native sheet; later
   * calls are no-ops if already granted (or already denied — iOS hides this).
   */
  requestPermissions(perms: HealthPermissions): Promise<AuthorizationStatus>;

  /** Check what we currently have access to without prompting. */
  checkPermissions(perms: HealthPermissions): Promise<AuthorizationStatus>;

  /**
   * Return the most recent body-weight sample the user has written to
   * HealthKit, or null if nothing's stored / permission's denied.
   * Value is already converted to pounds.
   */
  readLatestBodyWeight(): Promise<WeightReading | null>;

  /**
   * Write a body-weight sample to HealthKit / Health Connect.
   * Pounds in, kg out (the platform native unit). Silently no-ops if
   * write permission isn't granted — the caller shouldn't have to know.
   * @returns true if the write succeeded, false otherwise.
   */
  writeBodyWeight(pounds: number, takenAt?: Date): Promise<boolean>;
}

export const KG_TO_LBS = 2.20462;
