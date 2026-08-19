import { registerPlugin } from '@capacitor/core';

/**
 * Bridge to our own Swift plugin (`ios/App/App/FoundryHealthPlugin.swift`).
 *
 * `@capgo/capacitor-health` exposes only steps / distance / calories /
 * heartRate / weight — there is no HKWorkout API in it. Writing a real
 * workout (so the session shows in Apple Fitness → Workouts and credits
 * the Move ring) has to go through HealthKit directly, which means Swift.
 *
 * `jsName` here must match the plugin's `jsName` on the native side.
 * Registration happens in MainViewController's capacitorDidLoad() via
 * registerPluginInstance — NOT registerPluginType, which is a no-op while
 * Capacitor's autoRegisterPlugins is on (it only reads the generated
 * capacitor.config.json packageClassList, and an app-local plugin never
 * appears there).
 */
export interface FoundryHealthPlugin {
  /**
   * Body weight AND workouts in a single iOS sheet. Chaining two separate
   * requests loses the second one — HealthKit drops an authorization request
   * made while another sheet is still on screen.
   */
  requestHealthPermissions(): Promise<{ available: boolean; workouts: boolean; weight: boolean }>;
  /** True only on a device where HealthKit exists and workout sharing is granted. */
  requestWorkoutPermission(): Promise<{ granted: boolean }>;
  /** Current workout-write authorization without prompting. */
  checkWorkoutPermission(): Promise<{ granted: boolean }>;
  saveStrengthWorkout(opts: {
    startMs: number;
    endMs: number;
    kcal?: number;
    mesoId?: string;
    dayLabel?: string;
    weekIndex?: number;
    totalSets?: number;
    totalVolumeLbs?: number;
  }): Promise<{ saved: boolean; uuid?: string }>;
}

export const FoundryHealth = registerPlugin<FoundryHealthPlugin>('FoundryHealth');
