import { useState, useRef, useEffect, useCallback } from 'react';
import { store } from '../utils/store';

/**
 * Shared workout session timer logic used by both DayView and ExtraDayView.
 * Manages session start/end timestamps, elapsed time display, and begin-workout action.
 */
export function useWorkoutTimer(opts: {
  /** localStorage key for session start timestamp */
  startKey: string;
  /** localStorage key for strength-end timestamp */
  strengthEndKey: string;
  /** Whether the session is already complete */
  isDone: boolean;
  /** Whether the session is locked (future week) */
  isLocked?: boolean;
}) {
  const { startKey, strengthEndKey, isDone, isLocked = false } = opts;

  // A single lifting session plausibly spans hours, not days. A persisted
  // start older than this is a leftover from an abandoned session (e.g. the
  // user fell off mid-workout for a layoff) — re-anchor to "now" instead of
  // restoring it and reporting a multi-week elapsed/duration (the "1700 hrs"
  // bug). Logged sets are untouched; only the clock restarts.
  const STALE_SESSION_START_MS = 12 * 60 * 60 * 1000;

  const sessionStartRef = useRef<number | null>(null);
  const strengthEndRef = useRef<number | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [workoutStarted, setWorkoutStarted] = useState(() => {
    const saved = store.get(startKey);
    return !!saved && !isDone && !isLocked;
  });
  const [elapsedSecs, setElapsedSecs] = useState(0);

  // Restore timestamps from localStorage on mount
  useEffect(() => {
    const savedStart = store.get(startKey);
    if (savedStart && !isDone && !isLocked) {
      const parsed = parseInt(savedStart, 10);
      if (Number.isFinite(parsed) && Date.now() - parsed > STALE_SESSION_START_MS) {
        // Stale leftover from an abandoned sitting — restart the clock and
        // drop the (equally stale) strength-end stamp.
        const now = Date.now();
        sessionStartRef.current = now;
        store.set(startKey, String(now));
        store.set(strengthEndKey, '');
        return;
      }
      sessionStartRef.current = parsed;
      const savedEnd = store.get(strengthEndKey);
      if (savedEnd) strengthEndRef.current = parseInt(savedEnd, 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elapsed timer — runs while workout is active and not complete
  useEffect(() => {
    if (!workoutStarted || isDone) return;
    const tick = () => {
      if (sessionStartRef.current) {
        setElapsedSecs(Math.floor((Date.now() - sessionStartRef.current) / 1000));
      }
    };
    tick();
    elapsedIntervalRef.current = setInterval(tick, 1000);
    return () => {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, [workoutStarted, isDone]);

  const beginWorkout = useCallback(() => {
    const now = Date.now();
    sessionStartRef.current = now;
    store.set(startKey, String(now));
    setWorkoutStarted(true);
  }, [startKey]);

  const stampStrengthEnd = useCallback(() => {
    strengthEndRef.current = Date.now();
    store.set(strengthEndKey, String(strengthEndRef.current));
  }, [strengthEndKey]);

  const clearTimers = useCallback(() => {
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    store.set(startKey, '');
    store.set(strengthEndKey, '');
  }, [startKey, strengthEndKey]);

  return {
    workoutStarted,
    setWorkoutStarted,
    elapsedSecs,
    sessionStartRef,
    strengthEndRef,
    beginWorkout,
    stampStrengthEnd,
    clearTimers,
  };
}

/** Format elapsed seconds as M:SS or H:MM:SS */
export function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
