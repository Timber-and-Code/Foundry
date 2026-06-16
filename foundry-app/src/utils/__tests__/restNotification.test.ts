import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capacitor + plugin mocks. Hoisted by vi.mock so they take effect before
// the SUT imports them.
const mockIsNativePlatform = vi.fn<[], boolean>();
const mockCheckPermissions = vi.fn();
const mockRequestPermissions = vi.fn();
const mockSchedule = vi.fn();
const mockCancel = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    get isNativePlatform() {
      return mockIsNativePlatform;
    },
  },
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    requestPermissions: (...args: unknown[]) => mockRequestPermissions(...args),
    schedule: (...args: unknown[]) => mockSchedule(...args),
    cancel: (...args: unknown[]) => mockCancel(...args),
  },
}));

// Import AFTER mocks so the SUT picks them up.
import {
  ensureNotificationPermission,
  scheduleRestComplete,
  cancelRestComplete,
} from '../restNotification';

const PERM_CACHE_KEY = 'foundry:rest_notif_permission';

beforeEach(() => {
  mockIsNativePlatform.mockReset();
  mockCheckPermissions.mockReset();
  mockRequestPermissions.mockReset();
  mockSchedule.mockReset();
  mockCancel.mockReset();
  localStorage.clear();
});

describe('ensureNotificationPermission', () => {
  it('returns false on web (Capacitor non-native)', async () => {
    mockIsNativePlatform.mockReturnValue(false);
    const ok = await ensureNotificationPermission();
    expect(ok).toBe(false);
    expect(mockCheckPermissions).not.toHaveBeenCalled();
  });

  it('short-circuits to true when cached granted', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    localStorage.setItem(PERM_CACHE_KEY, 'granted');
    const ok = await ensureNotificationPermission();
    expect(ok).toBe(true);
    expect(mockCheckPermissions).not.toHaveBeenCalled();
  });

  it('short-circuits to false when cached denied', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    localStorage.setItem(PERM_CACHE_KEY, 'denied');
    const ok = await ensureNotificationPermission();
    expect(ok).toBe(false);
    expect(mockCheckPermissions).not.toHaveBeenCalled();
  });

  it('requests permission when status is prompt; caches the outcome', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockCheckPermissions.mockResolvedValue({ display: 'prompt' });
    mockRequestPermissions.mockResolvedValue({ display: 'granted' });
    const ok = await ensureNotificationPermission();
    expect(ok).toBe(true);
    expect(mockRequestPermissions).toHaveBeenCalledOnce();
    expect(localStorage.getItem(PERM_CACHE_KEY)).toBe('granted');
  });

  it('caches denied when user declines the system prompt', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockCheckPermissions.mockResolvedValue({ display: 'prompt' });
    mockRequestPermissions.mockResolvedValue({ display: 'denied' });
    const ok = await ensureNotificationPermission();
    expect(ok).toBe(false);
    expect(localStorage.getItem(PERM_CACHE_KEY)).toBe('denied');
  });

  it('treats plugin errors as denied (does not throw)', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockCheckPermissions.mockRejectedValue(new Error('plugin not registered'));
    const ok = await ensureNotificationPermission();
    expect(ok).toBe(false);
  });
});

describe('scheduleRestComplete', () => {
  it('no-ops on web', async () => {
    mockIsNativePlatform.mockReturnValue(false);
    await scheduleRestComplete(Date.now() + 60_000, 'Bench Press');
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('no-ops without granted permission', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    // No cache entry → treated as unknown → skip without firing.
    await scheduleRestComplete(Date.now() + 60_000, 'Bench Press');
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('schedules at the absolute end time when granted', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    localStorage.setItem(PERM_CACHE_KEY, 'granted');
    const endTime = Date.now() + 90_000;
    await scheduleRestComplete(endTime, 'Incline DB Press');
    expect(mockSchedule).toHaveBeenCalledOnce();
    const arg = mockSchedule.mock.calls[0][0];
    const n = arg.notifications[0];
    expect(n.id).toBe(1001);
    expect(n.title).toBe('Rest Complete');
    expect(n.body).toBe('Next set — Incline DB Press');
    expect(n.schedule.at).toEqual(new Date(endTime));
  });

  it('skips when end time is already in the past', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    localStorage.setItem(PERM_CACHE_KEY, 'granted');
    await scheduleRestComplete(Date.now() - 5_000, 'Squat');
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('skips wildly-large delays (>1h) — guard against bugs', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    localStorage.setItem(PERM_CACHE_KEY, 'granted');
    await scheduleRestComplete(Date.now() + 2 * 60 * 60 * 1000, 'Deadlift');
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('uses generic body when exName is empty', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    localStorage.setItem(PERM_CACHE_KEY, 'granted');
    await scheduleRestComplete(Date.now() + 60_000, '');
    const body = mockSchedule.mock.calls[0][0].notifications[0].body;
    expect(body).toBe('Next set');
  });
});

describe('cancelRestComplete', () => {
  it('no-ops on web', async () => {
    mockIsNativePlatform.mockReturnValue(false);
    await cancelRestComplete();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('cancels by id on native', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    await cancelRestComplete();
    expect(mockCancel).toHaveBeenCalledOnce();
    expect(mockCancel.mock.calls[0][0]).toEqual({
      notifications: [{ id: 1001 }],
    });
  });

  it('swallows plugin errors silently', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockCancel.mockRejectedValue(new Error('no such notification'));
    await expect(cancelRestComplete()).resolves.toBeUndefined();
  });
});
