import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  loadProfile: vi.fn(() => ({ weight: 220.462 })),
}));

/** The workout handed to the native layer on the Nth call. */
const written = (n = 0) => mocks.writeStrengthWorkout.mock.calls[n]![0] as WrittenWorkout;

vi.mock('../health/index', () => ({
  getHealthService: () => ({
    isAvailable: mocks.isAvailable,
    checkWorkoutPermission: mocks.checkWorkoutPermission,
    writeStrengthWorkout: mocks.writeStrengthWorkout,
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

  it('swallows a throwing service rather than failing the completion', async () => {
    mocks.writeStrengthWorkout.mockRejectedValue(new Error('HealthKit exploded'));
    await expect(logWorkoutToHealth(base)).resolves.toBe(false);
  });

  it('still writes when the meso pointer is missing', async () => {
    localStorage.removeItem('foundry:active_meso_id');
    await expect(logWorkoutToHealth(base)).resolves.toBe(true);
    expect(written().mesoId).toBeUndefined();
  });
});
