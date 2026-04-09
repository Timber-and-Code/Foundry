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

/** Start loading the exercise DB. Safe to call multiple times. */
export function preloadExerciseDB(): Promise<ExerciseEntry[]> {
  if (_db) return Promise.resolve(_db);
  if (!_promise) {
    _promise = import('./exercises').then((m) => {
      _db = m.EXERCISE_DB as ExerciseEntry[];
      // Also grab SAMPLE_PROGRAMS if present
      if (m.SAMPLE_PROGRAMS) {
        _samples = m.SAMPLE_PROGRAMS as SampleProgram[];
      }
      _listeners.forEach((fn) => fn());
      _listeners.clear();
      return _db;
    });
  }
  return _promise;
}

/** Sync access — returns the cached DB or empty array if still loading. */
export function getExerciseDB(): ExerciseEntry[] {
  if (!_db && !_promise) preloadExerciseDB();
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
    preloadExerciseDB();
    return () => { _listeners.delete(listener); };
  }, []);

  return _db ?? [];
}
