/**
 * Ordering of writes to a single workout_sets row.
 *
 * Every write here is fire-and-forget, and each one independently awaits
 * getUser() and then the network. Nothing made them land in the order they
 * were issued, so a delete could be overtaken by an upsert that was issued
 * BEFORE it — and the row came back.
 *
 * That is how a removed set became permanent: removing it within the 1500ms
 * debounce window deleted the row and then let the timer re-create it,
 * leaving an orphan no local state knew about. Every later pull rebuilt the
 * week from remote, so the set reappeared in history and in volume for good.
 *
 * Two guards, and they cover different windows:
 *   - cancelDebouncedSync — the timer that has NOT fired yet.
 *   - the per-row promise chain — the one that has, and is mid-flight.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const ops: string[] = [];
// Resolvers for in-flight supabase calls, so a test can hold one open.
let pending: Array<() => void> = [];
let holdOps = false;

const settle = (label: string) => {
  ops.push(`${label}:start`);
  return new Promise<{ error: null }>((resolve) => {
    const done = () => {
      ops.push(`${label}:end`);
      resolve({ error: null });
    };
    if (holdOps) pending.push(done);
    else done();
  });
};

vi.mock('../supabase.js', () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
      getSession: async () => ({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      }),
    },
    from: () => ({
      upsert: (payload: Record<string, unknown>) =>
        settle(`upsert(${payload.id}@${payload.set_number})`),
      delete: () => {
        const chain: Record<string, unknown> = {
          eq: () => chain,
          then: (onFulfilled: (v: unknown) => unknown) =>
            settle('delete').then(onFulfilled),
        };
        return chain;
      },
    }),
  },
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import {
  upsertWorkoutSetRemote,
  deleteWorkoutSetRemote,
  debouncedSync,
  cancelDebouncedSync,
} from '../sync';

const PAYLOAD = { weight: 135, reps: 10, rpe: null, isWarmup: false };
const flushAll = () => {
  pending.forEach((fn) => fn());
  pending = [];
};
/**
 * Drain the microtask queue. getUser() awaits getSession(), and chainSetOp
 * adds a .catch().then() hop before the op even starts, so a single
 * `await Promise.resolve()` lands well short of the supabase call.
 */
const tick = async (n = 20) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

describe('writes to one workout_sets row land in the order issued', () => {
  beforeEach(() => {
    ops.length = 0;
    pending = [];
    holdOps = false;
    vi.useRealTimers();
  });

  // Each test uses its own set ids: the per-row chain is module state and
  // outlives a test, so reusing an id would let one test's stalled write
  // block the next one's.
  it('runs a delete AFTER an upsert that is already in flight', async () => {
    holdOps = true;
    const up = upsertWorkoutSetRemote('s1', 'flight-a', 'bench', 3, PAYLOAD);
    // The upsert has started and is waiting on the network.
    await tick();
    expect(ops).toContain('upsert(flight-a@3):start');

    const del = deleteWorkoutSetRemote('flight-a');
    await tick();
    // The delete must not have even STARTED while the upsert is open.
    expect(ops).not.toContain('delete:start');

    flushAll(); // upsert completes
    await up;
    await tick(); // …which lets the queued delete begin
    flushAll();
    await del;

    expect(ops).toEqual([
      'upsert(flight-a@3):start',
      'upsert(flight-a@3):end',
      'delete:start',
      'delete:end',
    ]);
  });

  it('does not serialise writes to DIFFERENT rows', async () => {
    holdOps = true;
    const a = upsertWorkoutSetRemote('s1', 'par-a', 'bench', 0, PAYLOAD);
    const b = upsertWorkoutSetRemote('s1', 'par-b', 'bench', 1, PAYLOAD);
    await tick();
    // Both in flight at once — one row's slow write must not block every
    // other set in the session.
    expect(ops).toContain('upsert(par-a@0):start');
    expect(ops).toContain('upsert(par-b@1):start');
    flushAll();
    await Promise.all([a, b]);
  });
});

describe('deleting a set drops its pending debounced write', () => {
  beforeEach(() => {
    ops.length = 0;
    pending = [];
    holdOps = false;
    vi.useFakeTimers();
  });

  it('cancels a queued upsert instead of letting it re-create the row', async () => {
    debouncedSync('set:deb-a', () => {
      upsertWorkoutSetRemote('s1', 'deb-a', 'bench', 3, PAYLOAD);
    });
    // Lifter removes the set before the 1500ms debounce elapses.
    void deleteWorkoutSetRemote('deb-a');
    vi.advanceTimersByTime(5000);
    vi.useRealTimers();
    await tick();

    expect(ops.some((o) => o.startsWith('upsert'))).toBe(false);
    expect(ops).toContain('delete:start');
  });

  it('cancelDebouncedSync alone stops the callback firing', () => {
    const fn = vi.fn();
    debouncedSync('set:deb-b', fn);
    cancelDebouncedSync('set:deb-b');
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('leaves OTHER rows\' debounced writes alone', () => {
    const other = vi.fn();
    debouncedSync('set:deb-c', other);
    void deleteWorkoutSetRemote('deb-d');
    vi.advanceTimersByTime(5000);
    expect(other).toHaveBeenCalledTimes(1);
  });
});
