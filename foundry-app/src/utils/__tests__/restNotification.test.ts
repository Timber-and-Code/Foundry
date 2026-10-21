import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capacitor + plugin mocks. Hoisted by vi.mock so they take effect before
// the SUT imports them.
// Vitest 4 takes a single function type here. The old two-arg form
// (`vi.fn<[], boolean>()`) still runs, but TS resolves the mock's parameter
// to `never`, so every .mockReturnValue below became a type error — 24 of
// them, which is what had CI red while the tests themselves passed.
const mockIsNativePlatform = vi.fn<() => boolean>();
const mockGetPlatform = vi.fn<() => string>();
const mockCheckPermissions = vi.fn();
const mockRequestPermissions = vi.fn();
const mockSchedule = vi.fn();
const mockCancel = vi.fn();
const mockGetDelivered = vi.fn();
const mockRemoveDelivered = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    get isNativePlatform() {
      return mockIsNativePlatform;
    },
    get getPlatform() {
      return mockGetPlatform;
    },
  },
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    requestPermissions: (...args: unknown[]) => mockRequestPermissions(...args),
    schedule: (...args: unknown[]) => mockSchedule(...args),
    cancel: (...args: unknown[]) => mockCancel(...args),
    getDeliveredNotifications: (...args: unknown[]) => mockGetDelivered(...args),
    removeDeliveredNotifications: (...args: unknown[]) => mockRemoveDelivered(...args),
  },
}));

// Import AFTER mocks so the SUT picks them up.
import {
  ensureNotificationPermission,
  scheduleRestComplete,
  cancelRestComplete,
  clearDeliveredRestComplete,
} from '../restNotification';

const PERM_CACHE_KEY = 'foundry:rest_notif_permission';

beforeEach(() => {
  mockIsNativePlatform.mockReset();
  mockGetPlatform.mockReset();
  mockGetPlatform.mockReturnValue('ios'); // sensible default; tests override
  mockCheckPermissions.mockReset();
  mockRequestPermissions.mockReset();
  mockSchedule.mockReset();
  mockCancel.mockReset();
  mockGetDelivered.mockReset();
  mockGetDelivered.mockResolvedValue({ notifications: [] });
  mockRemoveDelivered.mockReset();
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

  it('a cached denied is never trusted — the OS is asked again and a later grant wins', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    localStorage.setItem(PERM_CACHE_KEY, 'denied');
    mockCheckPermissions.mockResolvedValue({ display: 'granted' });
    const ok = await ensureNotificationPermission();
    expect(ok).toBe(true);
    expect(mockCheckPermissions).toHaveBeenCalledOnce();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(localStorage.getItem(PERM_CACHE_KEY)).toBe('granted');
  });

  it('a live denied answers false without re-prompting', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockCheckPermissions.mockResolvedValue({ display: 'denied' });
    const ok = await ensureNotificationPermission();
    expect(ok).toBe(false);
    expect(mockRequestPermissions).not.toHaveBeenCalled();
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

  it('a declined (or dismissed) system prompt is not cached as granted', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockCheckPermissions.mockResolvedValue({ display: 'prompt' });
    mockRequestPermissions.mockResolvedValue({ display: 'denied' });
    const ok = await ensureNotificationPermission();
    expect(ok).toBe(false);
    expect(localStorage.getItem(PERM_CACHE_KEY)).not.toBe('granted');
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

  it('no-ops (false) when the OS says permission is not granted', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockCheckPermissions.mockResolvedValue({ display: 'denied' });
    const ok = await scheduleRestComplete(Date.now() + 60_000, 'Bench Press');
    expect(ok).toBe(false);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('a stale cached denied does not block scheduling once the OS grants', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    localStorage.setItem(PERM_CACHE_KEY, 'denied');
    mockCheckPermissions.mockResolvedValue({ display: 'granted' });
    const ok = await scheduleRestComplete(Date.now() + 60_000, 'Bench Press');
    expect(ok).toBe(true);
    expect(mockSchedule).toHaveBeenCalledOnce();
    expect(localStorage.getItem(PERM_CACHE_KEY)).toBe('granted');
  });

  it('schedules at the absolute end time when granted', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    localStorage.setItem(PERM_CACHE_KEY, 'granted');
    const endTime = Date.now() + 90_000;
    const ok = await scheduleRestComplete(endTime, 'Incline DB Press');
    expect(ok).toBe(true);
    expect(mockSchedule).toHaveBeenCalledOnce();
    expect(mockCheckPermissions).not.toHaveBeenCalled();
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
    const ok = await scheduleRestComplete(Date.now() - 5_000, 'Squat');
    expect(ok).toBe(false);
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

  it('uses iOS custom chime filename when platform=ios', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockGetPlatform.mockReturnValue('ios');
    localStorage.setItem(PERM_CACHE_KEY, 'granted');
    await scheduleRestComplete(Date.now() + 60_000, 'Bench');
    expect(mockSchedule.mock.calls[0][0].notifications[0].sound).toBe('rest-complete.wav');
  });

  it('uses Android resource name when platform=android', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockGetPlatform.mockReturnValue('android');
    localStorage.setItem(PERM_CACHE_KEY, 'granted');
    await scheduleRestComplete(Date.now() + 60_000, 'Bench');
    expect(mockSchedule.mock.calls[0][0].notifications[0].sound).toBe('rest_complete');
  });

  it('never sends an undefined sound (that is a silent notification) when getPlatform throws', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockGetPlatform.mockImplementation(() => {
      throw new Error('platform unavailable');
    });
    localStorage.setItem(PERM_CACHE_KEY, 'granted');
    await scheduleRestComplete(Date.now() + 60_000, 'Bench');
    expect(mockSchedule.mock.calls[0][0].notifications[0].sound).toBe('rest-complete.wav');
  });

  it('reports false when the plugin rejects the schedule', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    localStorage.setItem(PERM_CACHE_KEY, 'granted');
    mockSchedule.mockRejectedValue(new Error('at is in the past'));
    const ok = await scheduleRestComplete(Date.now() + 60_000, 'Bench');
    expect(ok).toBe(false);
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

describe('clearDeliveredRestComplete', () => {
  it('no-ops on web', async () => {
    mockIsNativePlatform.mockReturnValue(false);
    await clearDeliveredRestComplete();
    expect(mockGetDelivered).not.toHaveBeenCalled();
  });

  it('removes only the rest-complete banner from the notification centre', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockGetDelivered.mockResolvedValue({
      notifications: [{ id: 1001, title: 'Rest Complete' }, { id: 7, title: 'Other' }],
    });
    await clearDeliveredRestComplete();
    expect(mockRemoveDelivered).toHaveBeenCalledOnce();
    expect(mockRemoveDelivered.mock.calls[0][0]).toEqual({
      notifications: [{ id: 1001, title: 'Rest Complete' }],
    });
  });

  it('skips the remove call when nothing of ours was delivered', async () => {
    mockIsNativePlatform.mockReturnValue(true);
    await clearDeliveredRestComplete();
    expect(mockRemoveDelivered).not.toHaveBeenCalled();
  });
});
