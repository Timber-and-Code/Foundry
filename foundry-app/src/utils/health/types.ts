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

/**
 * One completed strength session, as HealthKit wants it. Times are epoch
 * ms. Everything past `endMs` is optional metadata — a workout with only
 * a start and end is still a valid Apple Fitness entry.
 */
export interface StrengthWorkoutWrite {
  startMs: number;
  endMs: number;
  /** Active energy in kcal. Omitted or 0 → no Move-ring contribution. */
  kcal?: number;
  mesoId?: string;
  dayLabel?: string;
  weekIndex?: number;
  totalSets?: number;
  totalVolumeLbs?: number;
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

  /**
   * Prompt for body weight and workouts together, in one iOS sheet.
   * Throws if the native plugin isn't reachable — callers must distinguish
   * "declined" from "never asked", which swallowing the error destroys.
   */
  requestAllPermissions(): Promise<{ available: boolean; workouts: boolean; weight: boolean }>;

  /**
   * Prompt for permission to write workouts only. Kept for the fallback
   * path; prefer requestAllPermissions, which avoids the two-sheet race.
   */
  requestWorkoutPermission(): Promise<boolean>;

  /** Workout-write authorization as it stands, without prompting. */
  checkWorkoutPermission(): Promise<boolean>;

  /**
   * Save a completed session as a real HKWorkout so it appears in Apple
   * Fitness → Workouts and contributes to the Activity rings.
   * Resolves false when unsupported, unauthorized, or on any native error
   * — a failed Health write must never fail a finished workout.
   */
  writeStrengthWorkout(workout: StrengthWorkoutWrite): Promise<boolean>;
}

export const KG_TO_LBS = 2.20462;
