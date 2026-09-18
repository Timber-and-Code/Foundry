import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HealthAccessStatus } from '../health/types';

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

const mocks = vi.hoisted(() => ({
  isAvailable: vi.fn(async () => true),
  getAccessStatus: vi.fn(async (): Promise<HealthAccessStatus> => ({
    available: true,
    weight: 'authorized',
    workouts: 'authorized',
    activeEnergy: 'authorized',
    needsPrompt: false,
  })),
  requestAllPermissions: vi.fn(async (): Promise<HealthAccessStatus> => ({
    available: true,
    weight: 'authorized',
    workouts: 'authorized',
    activeEnergy: 'authorized',
    needsPrompt: false,
  })),
}));

vi.mock('../health/index', () => ({
  getHealthService: () => mocks,
}));

const { reconcileHealthAccess } = await import('../health/reconcileAccess');

describe('reconcileHealthAccess', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.isAvailable.mockResolvedValue(true);
    mocks.getAccessStatus.mockResolvedValue(access());
    mocks.requestAllPermissions.mockResolvedValue(access());
    localStorage.setItem('foundry:health:enabled', '1');
  });

  it('does nothing — not even a status read — while Health is off', async () => {
    localStorage.setItem('foundry:health:enabled', '0');
    await expect(reconcileHealthAccess()).resolves.toBeNull();
    expect(mocks.getAccessStatus).not.toHaveBeenCalled();
    expect(mocks.requestAllPermissions).not.toHaveBeenCalled();
  });

  it('does nothing when HealthKit is unavailable', async () => {
    mocks.isAvailable.mockResolvedValue(false);
    await expect(reconcileHealthAccess()).resolves.toBeNull();
    expect(mocks.requestAllPermissions).not.toHaveBeenCalled();
  });

  it('shows the sheet when a type was never asked about', async () => {
    // Health ON from 2.15.0 build 1: weight granted, workouts never asked.
    mocks.getAccessStatus.mockResolvedValue(
      access({ workouts: 'notDetermined', activeEnergy: 'notDetermined', needsPrompt: true }),
    );
    const result = await reconcileHealthAccess();
    expect(mocks.requestAllPermissions).toHaveBeenCalledTimes(1);
    expect(result?.workouts).toBe('authorized');
  });

  it('never re-asks a lifter who already answered, even with a refusal', async () => {
    mocks.getAccessStatus.mockResolvedValue(access({ workouts: 'denied', needsPrompt: false }));
    const result = await reconcileHealthAccess();
    expect(mocks.requestAllPermissions).not.toHaveBeenCalled();
    expect(result?.workouts).toBe('denied');
  });

  it('coalesces concurrent callers into one sheet', async () => {
    mocks.getAccessStatus.mockResolvedValue(access({ workouts: 'notDetermined', needsPrompt: true }));
    await Promise.all([reconcileHealthAccess(), reconcileHealthAccess()]);
    expect(mocks.requestAllPermissions).toHaveBeenCalledTimes(1);
  });

  it('lets a native failure propagate for the caller to report', async () => {
    mocks.getAccessStatus.mockRejectedValue(new Error('plugin not implemented'));
    await expect(reconcileHealthAccess()).rejects.toThrow('plugin not implemented');
  });
});
