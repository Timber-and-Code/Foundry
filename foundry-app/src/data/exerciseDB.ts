/**
 * Lazy-loaded exercise database.
 *
 * The raw exercises.js is ~241KB (55KB gzip). By loading it dynamically,
 * it's excluded from the critical-path bundle and only fetched when
 * first needed (typically within ~200ms of app mount via preload).
 *
 * Usage:
 *   import { getExerciseDB, findExercise, preloadExerciseDB } from '../data/exerciseDB';
 *
 *   // In components — re-renders when DB loads:
 *   const db = useExerciseDB();
 *
 *   // Sync access (returns [] if not yet loaded):
 *   const db = getExerciseDB();
 *
 *   // Single lookup:
 *   const ex = findExercise('bb_flat_bench');
 */
import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/react';

export interface ExerciseEntry {
  id: string;
  name: string;
  muscle: string;
  muscles?: string[];
  tag?: string;
  splits?: string[];
  equipment?: string | string[];
  pattern?: string;
  fatigue?: string;
  anchor?: boolean;
  diff?: number;
  sets?: number | string;
  reps?: string;
  rest?: string;
  warmup?: string;
  description?: string;
  videoUrl?: string;
  bw?: boolean;
  supersetWith?: number;
  [key: string]: unknown;
}

let _db: ExerciseEntry[] | null = null;
let _promise: Promise<ExerciseEntry[]> | null = null;
const _listeners = new Set<() => void>();

// Backoff between attempts to fetch the chunk. The failure this guards against
// is `TypeError: Failed to fetch dynamically imported module` — a gym wifi
// dropout mid-fetch, or a deploy landing between the page load and this import
// (the old chunk hash is gone from the new deployment). Both are transient, so
// a couple of spaced retries recover without the user noticing.
const RETRY_DELAYS_MS = [400, 1200, 3000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type ExercisesModule = {
  EXERCISE_DB: unknown;
  SAMPLE_PROGRAMS?: unknown;
};

// Injection seam, same pattern as `_setMarkDirty` in storage.ts. A failed
// dynamic import is cached by the module registry, which makes the retry and
// cache-clearing behaviour below impossible to drive through the real
// `import()`. Production always uses the default.
let _importExercises: () => Promise<ExercisesModule> =
  () => import('./exercises') as Promise<ExercisesModule>;

/** @internal test-only — override the chunk importer. */
export function _setExercisesImporter(fn: () => Promise<ExercisesModule>): void {
  _importExercises = fn;
}

/**
 * Fetch the exercises chunk, retrying transient network failures.
 *
 * Caveat worth knowing: whether a retry can succeed at all depends on the
 * browser. Some engines cache a failed module fetch in the module registry, in
 * which case re-importing the same specifier replays the failure and only a
 * page reload recovers. We deliberately do NOT auto-reload — this app is used
 * mid-workout and a reload during a logged session is worse than a degraded
 * exercise list. Retrying is cheap and helps where it can.
 */
function fetchExercisesModule(attempt = 0): Promise<ExercisesModule> {
  return _importExercises().catch((err) => {
    Sentry.addBreadcrumb({
      category: 'exercise_db',
      type: 'error',
      level: 'warning',
      message: `exercise DB chunk fetch failed (attempt ${attempt + 1})`,
      data: { attempt, online: typeof navigator === 'undefined' ? null : navigator.onLine },
    });
    if (attempt >= RETRY_DELAYS_MS.length) throw err;
    return sleep(RETRY_DELAYS_MS[attempt]).then(() => fetchExercisesModule(attempt + 1));
  });
}

/**
 * Start loading the exercise DB. Safe to call multiple times.
 *
 * On failure the cached promise is CLEARED rather than left in place. That is
 * load-bearing: `_promise` used to keep the rejected promise forever, so one
 * dropped fetch meant every later call — every `useExerciseDB()` mount, every
 * `getExerciseDB()` — got handed the same rejection back. The DB stayed empty
 * for the whole session even after the network recovered, which surfaced as an
 * empty program and empty swap menus with no way back short of force-quitting.
 * Clearing it means the next caller gets a real attempt.
 */
export function preloadExerciseDB(): Promise<ExerciseEntry[]> {
  if (_db) return Promise.resolve(_db);
  if (!_promise) {
    _promise = fetchExercisesModule()
      .then((m) => {
        _db = m.EXERCISE_DB as ExerciseEntry[];
        // Also grab SAMPLE_PROGRAMS if present
        if (m.SAMPLE_PROGRAMS) {
          _samples = m.SAMPLE_PROGRAMS as SampleProgram[];
        }
        // Listeners are only cleared on success — a failed load leaves them
        // subscribed so a later retry still re-renders them.
        _listeners.forEach((fn) => fn());
        _listeners.clear();
        return _db;
      })
      .catch((err) => {
        _promise = null;
        Sentry.captureException(err, {
          level: 'error',
          tags: { feature: 'exercise_db' },
          extra: {
            attempts: RETRY_DELAYS_MS.length + 1,
            online: typeof navigator === 'undefined' ? null : navigator.onLine,
          },
        });
        throw err;
      });
  }
  return _promise;
}

/**
 * Fire-and-forget preload for callers that have no way to handle a failure
 * (app bootstrap, render-phase accessors). The rejection is already reported
 * to Sentry inside `preloadExerciseDB`; swallowing it here just keeps it from
 * surfacing a second time as an unhandled rejection.
 */
export function preloadExerciseDBQuietly(): void {
  void preloadExerciseDB().catch(() => {});
}

/** Sync access — returns the cached DB or empty array if still loading. */
export function getExerciseDB(): ExerciseEntry[] {
  if (!_db && !_promise) preloadExerciseDBQuietly();
  return _db ?? [];
}

/** Find a single exercise by ID. Returns undefined if not found or not loaded. */
export function findExercise(id: string): ExerciseEntry | undefined {
  return _db?.find((e) => e.id === id);
}

/** Whether the DB has finished loading. */
export function isExerciseDBReady(): boolean {
  return _db !== null;
}

// SAMPLE_PROGRAMS lazy access
export interface SampleProgram {
  id: string;
  category: string;
  label: string;
  split: string;
  weeks: number;
  daysPerWeek: number;
  level: string;
  defaultDays: number[];
  splitType: string;
  description: string;
  days: { label: string; tag: string; exercises: string[] }[];
  [key: string]: unknown;
}
let _samples: SampleProgram[] | null = null;
export function getSamplePrograms(): SampleProgram[] {
  return _samples ?? [];
}

/**
 * React hook — returns the exercise DB, re-rendering once when it loads.
 * Triggers preload on first call.
 */
export function useExerciseDB(): ExerciseEntry[] {
  const [, setReady] = useState(() => _db !== null);

  useEffect(() => {
    if (_db) return;
    const listener = () => setReady(true);
    _listeners.add(listener);
    preloadExerciseDBQuietly();
    return () => { _listeners.delete(listener); };
  }, []);

  return _db ?? [];
}
