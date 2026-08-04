import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const captureException = vi.fn();
const addBreadcrumb = vi.fn();

vi.mock('@sentry/react', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  addBreadcrumb: (...args: unknown[]) => addBreadcrumb(...args),
}));

const FAKE_MODULE = {
  EXERCISE_DB: [{ id: 'bb_flat_bench', name: 'Barbell Bench Press', muscle: 'chest' }],
  SAMPLE_PROGRAMS: [{ id: 'ppl', label: 'Push Pull Legs' }],
};

/** Fresh module state per test — `_db` / `_promise` are module-level. */
async function freshDB() {
  vi.resetModules();
  return import('../exerciseDB');
}

/** An importer that rejects its first `failCount` calls, then resolves. */
function flakyImporter(failCount: number) {
  let calls = 0;
  const fn = vi.fn(() => {
    calls++;
    return calls <= failCount
      ? Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
      : Promise.resolve(FAKE_MODULE);
  });
  return fn;
}

/** Drive the retry backoff (400 + 1200 + 3000ms) to completion. */
const flushRetries = () => vi.advanceTimersByTimeAsync(10_000);

beforeEach(() => {
  captureException.mockClear();
  addBreadcrumb.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('preloadExerciseDB — success', () => {
  it('loads the DB and exposes it synchronously afterwards', async () => {
    const db = await freshDB();
    db._setExercisesImporter(() => Promise.resolve(FAKE_MODULE));

    await expect(db.preloadExerciseDB()).resolves.toHaveLength(1);
    expect(db.getExerciseDB()).toHaveLength(1);
    expect(db.isExerciseDBReady()).toBe(true);
    expect(db.findExercise('bb_flat_bench')?.name).toBe('Barbell Bench Press');
    expect(db.getSamplePrograms()).toHaveLength(1);
  });

  it('imports the chunk only once across many callers', async () => {
    const db = await freshDB();
    const importer = vi.fn(() => Promise.resolve(FAKE_MODULE));
    db._setExercisesImporter(importer);

    await Promise.all([db.preloadExerciseDB(), db.preloadExerciseDB(), db.preloadExerciseDB()]);
    db.getExerciseDB();

    expect(importer).toHaveBeenCalledTimes(1);
  });
});

describe('preloadExerciseDB — transient failure', () => {
  it('retries and recovers without the caller seeing a rejection', async () => {
    const db = await freshDB();
    const importer = flakyImporter(2);
    db._setExercisesImporter(importer);

    const pending = db.preloadExerciseDB();
    await flushRetries();

    await expect(pending).resolves.toHaveLength(1);
    expect(importer).toHaveBeenCalledTimes(3);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('gives up after exhausting the backoff and reports once', async () => {
    const db = await freshDB();
    const importer = flakyImporter(Infinity);
    db._setExercisesImporter(importer);

    const pending = db.preloadExerciseDB();
    const assertion = expect(pending).rejects.toThrow(/Failed to fetch/);
    await flushRetries();
    await assertion;

    // Initial attempt + one per backoff step.
    expect(importer).toHaveBeenCalledTimes(4);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(addBreadcrumb).toHaveBeenCalledTimes(4);
  });
});

describe('preloadExerciseDB — regression: a failure must not be cached forever', () => {
  // The original bug: `_promise` held the rejected promise, so every later
  // call got the same rejection replayed. One dropped fetch left the app with
  // an empty exercise DB for the entire session — empty program, empty swap
  // menus — with no recovery short of force-quitting.
  it('re-attempts on the next call after a total failure', async () => {
    const db = await freshDB();
    const importer = flakyImporter(4); // exhausts the first call's 4 attempts
    db._setExercisesImporter(importer);

    const first = db.preloadExerciseDB();
    const firstRejects = expect(first).rejects.toThrow();
    await flushRetries();
    await firstRejects;
    expect(db.isExerciseDBReady()).toBe(false);

    // Network is back. A fresh call must actually try again.
    const second = db.preloadExerciseDB();
    await flushRetries();

    await expect(second).resolves.toHaveLength(1);
    expect(db.getExerciseDB()).toHaveLength(1);
    expect(importer).toHaveBeenCalledTimes(5);
  });

  it('getExerciseDB triggers a fresh attempt after a failure', async () => {
    const db = await freshDB();
    const importer = flakyImporter(4);
    db._setExercisesImporter(importer);

    const firstRejects = expect(db.preloadExerciseDB()).rejects.toThrow();
    await flushRetries();
    await firstRejects;

    expect(db.getExerciseDB()).toEqual([]); // still empty, but kicks off a retry
    await flushRetries();

    expect(db.getExerciseDB()).toHaveLength(1);
  });

});

describe('preloadExerciseDBQuietly', () => {
  it('swallows the rejection but still reports it', async () => {
    const db = await freshDB();
    db._setExercisesImporter(flakyImporter(Infinity));

    expect(() => db.preloadExerciseDBQuietly()).not.toThrow();
    await flushRetries();

    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('recovers on a later call, same as the loud variant', async () => {
    const db = await freshDB();
    db._setExercisesImporter(flakyImporter(4));

    db.preloadExerciseDBQuietly();
    await flushRetries();
    expect(db.isExerciseDBReady()).toBe(false);

    db.preloadExerciseDBQuietly();
    await flushRetries();
    expect(db.getExerciseDB()).toHaveLength(1);
  });
});
