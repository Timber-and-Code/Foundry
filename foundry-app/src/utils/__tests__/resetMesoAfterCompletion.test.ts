/**
 * Tests for archive.resetMesoAfterCompletion — the post-meso-completion
 * remote handoff.
 *
 * The ordering here is load-bearing and fails silently if inverted:
 * completeMesocycleRemote reads foundry:active_meso_id, and
 * detachActiveMesoRemote deletes it. Run them concurrently (or in the wrong
 * order) and the completion write finds no id, so the finished meso stays
 * status='active'. The pull falls back to "most recent active mesocycle"
 * exactly when the profile pointer is null — which detaching is what makes
 * it — so an active finished meso gets re-adopted with its done flags,
 * which is the "new meso starts on week 3" bug via another route.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const order: string[] = [];
let completeResolve: () => void = () => {};

vi.mock('../sync', () => ({
  archiveMesocycleRemote: vi.fn(async () => {}),
  detachActiveMesoRemote: vi.fn(async () => {
    order.push('detach');
  }),
  completeMesocycleRemote: vi.fn(
    () =>
      new Promise<void>((resolve) => {
        order.push('complete');
        completeResolve = () => resolve();
      }),
  ),
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import { resetMesoAfterCompletion } from '../archive';

describe('resetMesoAfterCompletion', () => {
  beforeEach(() => {
    order.length = 0;
    localStorage.clear();
  });

  it('marks the meso completed before detaching the pointer it reads', async () => {
    localStorage.setItem('foundry:active_meso_id', 'meso-1');
    localStorage.setItem('foundry:done:d0:w0', '1');

    resetMesoAfterCompletion();

    // Detach must NOT have run yet — the completion write still needs the id.
    expect(order).toEqual(['complete']);

    completeResolve();
    await vi.waitFor(() => expect(order).toEqual(['complete', 'detach']));
  });

  it('wipes session data synchronously, before either remote call settles', () => {
    localStorage.setItem('foundry:done:d0:w0', '1');
    localStorage.setItem('foundry:day0:week0', '{}');
    localStorage.setItem('foundry:currentWeek', '5');

    resetMesoAfterCompletion();

    expect(localStorage.getItem('foundry:done:d0:w0')).toBeNull();
    expect(localStorage.getItem('foundry:day0:week0')).toBeNull();
    expect(localStorage.getItem('foundry:currentWeek')).toBe('0');
  });
});
