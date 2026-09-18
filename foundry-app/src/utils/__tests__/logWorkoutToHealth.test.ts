import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HealthAccessStatus } from '../health/types';

interface WrittenWorkout {
  startMs: number;
  endMs: number;
  kcal?: number;
  mesoId?: string;
  dayLabel?: string;
  weekIndex?: number;
  totalSets?: number;
  totalVolumeLbs?: number;
}

const mocks = vi.hoisted(() => ({
  isAvailable: vi.fn(async () => true),
  checkWorkoutPermission: vi.fn(async () => true),
  // Declared with its parameter so `mock.calls[0][0]` stays typed.
  writeStrengthWorkout: vi.fn(async (_workout: unknown) => true),
  loadProfile: vi.fn((): Record<string, unknown> => ({ weight: 220.462 })),
  getAccessStatus: vi.fn(async () => access({ needsPrompt: false, workouts: 'denied' })),
  requestAllPermissions: vi.fn(async () => access({ workouts: 'authorized' })),
  captureException: vi.fn(),
}));

function access(over: Partial<HealthAccessStatus> = {}): HealthAccessStatus {
  return {
    available: true,
    weight: 'authorized',
    workouts: 'authorized',
    activeEnergy: 'authorized',
    needsPrompt: false,
    ...over,
  };
}

vi.mock('@sentry/react', () => ({ captureException: mocks.captureException }));

/** The workout handed to the native layer on the Nth call. */
const written = (n = 0) => mocks.writeStrengthWorkout.mock.calls[n]![0] as WrittenWorkout;

vi.mock('../health/index', () => ({
  getHealthService: () => ({
    isAvailable: mocks.isAvailable,
    checkWorkoutPermission: mocks.checkWorkoutPermission,
    writeStrengthWorkout: mocks.writeStrengthWorkout,
    getAccessStatus: mocks.getAccessStatus,
    requestAllPermissions: mocks.requestAllPermissions,
  }),
}));

vi.mock('../store', async () => {
  const actual = await vi.importActual<typeof import('../storage')>('../storage');
  return { store: actual.store, loadProfile: mocks.loadProfile };
});

const { logWorkoutToHealth } = await import('../health/logWorkoutToHealth');

const HOUR = 3600000;
const base = {
  startMs: 1_700_000_000_000,
  endMs: 1_700_000_000_000 + HOUR,
  elapsedSecs: 3600,
  dayIdx: 0,
  weekIdx: 1,
  dayLabel: 'Full Body D',
  totalSets: 15,
  totalVolumeLbs: 12345.6,
};

describe('logWorkoutToHealth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.isAvailable.mockResolvedValue(true);
    mocks.checkWorkoutPermission.mockResolvedValue(true);
    mocks.writeStrengthWorkout.mockResolvedValue(true);
    mocks.loadProfile.mockReturnValue({ weight: 220.462 });
    mocks.getAccessStatus.mockResolvedValue(access({ needsPrompt: false, workouts: 'denied' }));
    mocks.requestAllPermissions.mockResolvedValue(access({ workouts: 'authorized' }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('foundry:health:enabled', '1');
    localStorage.setItem('foundry:active_meso_id', 'meso-abc');
  });

  it('writes the workout with metadata when everything is in order', async () => {
    await expect(logWorkoutToHealth(base)).resolves.toBe(true);
    expect(mocks.writeStrengthWorkout).toHaveBeenCalledTimes(1);
    const arg = written();
    expect(arg).toMatchObject({
      startMs: base.startMs,
      endMs: base.endMs,
      mesoId: 'meso-abc',
      dayLabel: 'Full Body D',
      weekIndex: 1,
      totalSets: 15,
    });
    expect(arg.kcal).toBe(500); // 5 METs x 100kg x 1h
    expect(arg.totalVolumeLbs).toBe(12346); // rounded
  });

  it('does nothing when the master Health toggle is off', async () => {
    localStorage.setItem('foundry:health:enabled', '0');
    await expect(logWorkoutToHealth(base)).resolves.toBe(false);
    expect(mocks.writeStrengthWorkout).not.toHaveBeenCalled();
  });

  it('does nothing when HealthKit is unavailable', async () => {
    mocks.isAvailable.mockResolvedValue(false);
    await expect(logWorkoutToHealth(base)).resolves.toBe(false);
    expect(mocks.writeStrengthWorkout).not.toHaveBeenCalled();
  });

  it('does nothing when workout sharing was refused', async () => {
    // The lifter can allow bodyweight and deny workouts — that must not
    // turn into a silently-attempted write on every completion.
    mocks.checkWorkoutPermission.mockResolvedValue(false);
    await expect(logWorkoutToHealth(base)).resolves.toBe(false);
    expect(mocks.writeStrengthWorkout).not.toHaveBeenCalled();
    // A refusal is an answer — it must never be re-asked.
    expect(mocks.requestAllPermissions).not.toHaveBeenCalled();
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it('asks for workouts when they were never requested, then writes', async () => {
    // The 2.15.0 build 1 state: Health ON, weight granted, the workout
    // request dropped by iOS — so workouts are notDetermined, not refused.
    // This used to return false silently on every completion, forever.
    mocks.checkWorkoutPermission.mockResolvedValue(false);
    mocks.getAccessStatus.mockResolvedValue(access({ needsPrompt: true, workouts: 'notDetermined' }));
    await expect(logWorkoutToHealth(base)).resolves.toBe(true);
    expect(mocks.requestAllPermissions).toHaveBeenCalledTimes(1);
    expect(mocks.writeStrengthWorkout).toHaveBeenCalledTimes(1);
  });

  it('does not write when the lifter declines the late workout sheet', async () => {
    mocks.checkWorkoutPermission.mockResolvedValue(false);
    mocks.getAccessStatus.mockResolvedValue(access({ needsPrompt: true, workouts: 'notDetermined' }));
    mocks.requestAllPermissions.mockResolvedValue(access({ workouts: 'denied' }));
    await expect(logWorkoutToHealth(base)).resolves.toBe(false);
    expect(mocks.writeStrengthWorkout).not.toHaveBeenCalled();
  });

  it('never writes the same session twice', async () => {
    // Re-completing a finished day would otherwise put a duplicate on the
    // Move ring; Apple Fitness does not dedupe.
    await logWorkoutToHealth(base);
    expect(mocks.writeStrengthWorkout).toHaveBeenCalledTimes(1);
    await expect(logWorkoutToHealth(base)).resolves.toBe(false);
    expect(mocks.writeStrengthWorkout).toHaveBeenCalledTimes(1);
  });

  it('does not mark written when the native write failed', async () => {
    mocks.writeStrengthWorkout.mockResolvedValue(false);
    await expect(logWorkoutToHealth(base)).resolves.toBe(false);
    // A later retry must still be allowed.
    mocks.writeStrengthWorkout.mockResolvedValue(true);
    await expect(logWorkoutToHealth(base)).resolves.toBe(true);
  });

  it('falls back to elapsed time when the start stamp is missing', async () => {
    await logWorkoutToHealth({ ...base, startMs: null });
    const arg = written();
    expect(arg.startMs).toBe(base.endMs - 3600 * 1000);
  });

  it('skips a session with no usable interval', async () => {
    await expect(
      logWorkoutToHealth({ ...base, startMs: null, elapsedSecs: 0 }),
    ).resolves.toBe(false);
    expect(mocks.writeStrengthWorkout).not.toHaveBeenCalled();
  });

  it('reports a throwing service instead of failing the completion', async () => {
    const err = new Error('HealthKit exploded');
    mocks.writeStrengthWorkout.mockRejectedValue(err);
    await expect(logWorkoutToHealth(base)).resolves.toBe(false);
    // Swallowed silently, this is exactly how "Health does nothing" shipped
    // with no trace. It must reach Sentry.
    expect(mocks.captureException).toHaveBeenCalledWith(err, {
      tags: { context: 'health', operation: 'write_workout' },
    });
  });

  it('writes the same day/week slot again in a new meso', async () => {
    // d0/w0 exists in every meso. An unscoped written-key from the first
    // meso blocked that slot in every meso after it.
    await expect(logWorkoutToHealth(base)).resolves.toBe(true);
    localStorage.setItem('foundry:active_meso_id', 'meso-next');
    await expect(logWorkoutToHealth(base)).resolves.toBe(true);
    expect(mocks.writeStrengthWorkout).toHaveBeenCalledTimes(2);
  });

  it('scopes the dedupe by start date for a lifter with no meso id', async () => {
    localStorage.removeItem('foundry:active_meso_id');
    mocks.loadProfile.mockReturnValue({ weight: 220.462, startDate: '2026-08-01' });
    await expect(logWorkoutToHealth(base)).resolves.toBe(true);
    await expect(logWorkoutToHealth(base)).resolves.toBe(false);
    mocks.loadProfile.mockReturnValue({ weight: 220.462, startDate: '2026-09-15' });
    await expect(logWorkoutToHealth(base)).resolves.toBe(true);
    expect(mocks.writeStrengthWorkout).toHaveBeenCalledTimes(2);
  });

  it('still writes when the meso pointer is missing', async () => {
    localStorage.removeItem('foundry:active_meso_id');
    await expect(logWorkoutToHealth(base)).resolves.toBe(true);
    expect(written().mesoId).toBeUndefined();
  });
});
