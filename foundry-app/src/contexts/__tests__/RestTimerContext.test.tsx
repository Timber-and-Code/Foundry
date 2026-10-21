/**
 * RestTimerContext — ONE chime + haptic at zero, every set, foreground or
 * background. These are the device scenarios that made the ding "only fire
 * sometimes": zero inside the background grace window, return after the
 * OS already rang, return before zero, a new rest started as the old one
 * hits zero, and the zero-rep skip.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

const { chime, unlock, schedule, cancel, clearDelivered, ensure } = vi.hoisted(() => ({
  chime: vi.fn(),
  unlock: vi.fn(),
  schedule: vi.fn<(endTime: number, exName: string) => Promise<boolean>>(() => Promise.resolve(true)),
  cancel: vi.fn(() => Promise.resolve()),
  clearDelivered: vi.fn(() => Promise.resolve()),
  ensure: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../../utils/audio', () => ({ playTimerCompleteChime: chime, unlockAudio: unlock }));
vi.mock('../../utils/restNotification', () => ({
  ensureNotificationPermission: ensure,
  scheduleRestComplete: schedule,
  cancelRestComplete: cancel,
  clearDeliveredRestComplete: clearDelivered,
}));

import { RestTimerProvider, useRestTimer } from '../RestTimerContext';

let captured: ReturnType<typeof useRestTimer> | null = null;
function Capture() {
  captured = useRestTimer();
  return null;
}

let visibility: DocumentVisibilityState = 'visible';
async function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

async function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(
      <RestTimerProvider>
        <Capture />
      </RestTimerProvider>,
    );
  });
  return async () => {
    await act(async () => root?.unmount());
    document.body.removeChild(container);
  };
}

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('RestTimerContext', () => {
  let cleanup: (() => Promise<void>) | null = null;

  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    chime.mockClear();
    unlock.mockClear();
    schedule.mockClear();
    schedule.mockImplementation(() => Promise.resolve(true));
    cancel.mockClear();
    clearDelivered.mockClear();
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    captured = null;
    cleanup = await mount();
  });

  afterEach(async () => {
    await cleanup?.();
    vi.useRealTimers();
  });

  it('foreground: counts down and fires the cue exactly once at zero', async () => {
    act(() => captured!.startRestTimer('3 sec', 'Bench'));
    expect(captured!.restTimer).toEqual({ remaining: 3, total: 3, exName: 'Bench' });
    expect(unlock).toHaveBeenCalled();
    await tick(1500);
    expect(captured!.restTimer?.remaining).toBe(2);
    expect(chime).not.toHaveBeenCalled();
    await tick(2000);
    expect(captured!.restTimer?.remaining).toBe(0);
    expect(chime).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalled();
    // Nothing more after zero.
    await tick(5000);
    expect(chime).toHaveBeenCalledTimes(1);
  });

  it('hidden before zero: ticking stops, the OS owns the cue, and the return after zero does NOT replay it', async () => {
    act(() => captured!.startRestTimer('5 sec', 'Squat'));
    await tick(1000);
    await setVisibility('hidden');
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule.mock.calls[0][1]).toBe('Squat');
    // Zero passes while hidden — WKWebView's grace window. No in-app cue,
    // and the just-scheduled notification is NOT cancelled.
    const cancelsBefore = cancel.mock.calls.length;
    await tick(6000);
    expect(chime).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(cancelsBefore);
    // Back in front: the OS already rang. One cue per period.
    await setVisibility('visible');
    expect(chime).not.toHaveBeenCalled();
    expect(captured!.restTimer?.remaining).toBe(0);
    expect(captured!.restTimerMinimized).toBe(false);
    expect(clearDelivered).toHaveBeenCalled();
    await tick(3000);
    expect(chime).not.toHaveBeenCalled();
  });

  it('hidden with no OS cue possible (permission off / web): the chime plays on return, once', async () => {
    schedule.mockImplementation(() => Promise.resolve(false));
    act(() => captured!.startRestTimer('2 sec', 'Row'));
    await setVisibility('hidden');
    await tick(4000);
    expect(chime).not.toHaveBeenCalled();
    await setVisibility('visible');
    expect(chime).toHaveBeenCalledTimes(1);
    expect(captured!.restTimer?.remaining).toBe(0);
    await tick(3000);
    expect(chime).toHaveBeenCalledTimes(1);
  });

  it('hidden then back BEFORE zero: notification cancelled, ticking resumes, chime at zero once', async () => {
    act(() => captured!.startRestTimer('6 sec', 'Press'));
    await tick(1000);
    await setVisibility('hidden');
    await tick(2000);
    await setVisibility('visible');
    expect(cancel).toHaveBeenCalled();
    expect(captured!.restTimer?.remaining).toBe(3);
    expect(chime).not.toHaveBeenCalled();
    await tick(3500);
    expect(chime).toHaveBeenCalledTimes(1);
    expect(captured!.restTimer?.remaining).toBe(0);
  });

  it('already fired in front, then hidden: nothing is scheduled with the OS', async () => {
    act(() => captured!.startRestTimer('1 sec', 'Curl'));
    await tick(1500);
    expect(chime).toHaveBeenCalledTimes(1);
    await setVisibility('hidden');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('a new rest started as the old one hits zero gets its own full period and cue', async () => {
    act(() => captured!.startRestTimer('1 sec', 'A'));
    await tick(1000);
    act(() => captured!.startRestTimer('2 sec', 'B'));
    expect(captured!.restTimer).toEqual({ remaining: 2, total: 2, exName: 'B' });
    await tick(1000);
    expect(captured!.restTimer?.remaining).toBe(1);
    await tick(1500);
    expect(captured!.restTimer?.remaining).toBe(0);
    // One cue for A (if it reached zero) at most, exactly one for B.
    expect(chime.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(chime.mock.calls.length).toBeLessThanOrEqual(2);
    const after = chime.mock.calls.length;
    await tick(3000);
    expect(chime).toHaveBeenCalledTimes(after);
  });

  it('dismiss clears everything, cancels the OS cue and re-arms for the next rest', async () => {
    act(() => captured!.startRestTimer('5 sec', 'Dip'));
    await tick(1000);
    act(() => captured!.dismissRestTimer());
    expect(captured!.restTimer).toBeNull();
    expect(cancel).toHaveBeenCalled();
    expect(clearDelivered).toHaveBeenCalled();
    await tick(6000);
    expect(chime).not.toHaveBeenCalled();
    act(() => captured!.startRestTimer('1 sec', 'Dip'));
    await tick(1500);
    expect(chime).toHaveBeenCalledTimes(1);
  });

  it('a zero rest (the zero-rep skip) starts no timer and never dings', async () => {
    act(() => captured!.startRestTimer('0 sec', 'Bailed'));
    expect(captured!.restTimer).toBeNull();
    await tick(100_000);
    expect(chime).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });
});
