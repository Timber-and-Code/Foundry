/**
 * Left-open sessions — the rule for a workout that was started, worked, and
 * never finished.
 *
 * Real world: the lifter does the last set, forgets to log it, walks out, and
 * never taps Finish. Next time they open the app that session is still "in
 * progress" with twelve logged sets. Before this module the only way past it
 * was Skip, which hid a full workout from completion rate, Lifts by Muscle
 * and the PR timeline while every set reader kept showing its weights.
 *
 * The rule:
 *   1. A session started on an earlier local calendar day and never finished
 *      is LEFT OPEN, not in progress. Sessions do not span days.
 *   2. A left-open session with logged work is surfaced on Home with two ways
 *      out — log the rest, or mark it complete as logged. Never Skip.
 *   3. A left-open session with no logged work was an accidental start. Its
 *      start stamp is dropped silently; nothing happened.
 *   4. Whichever way it is closed, the completion is dated the day the lifter
 *      trained: the last write to that day's data on the day it was started,
 *      falling back to the start itself.
 *   5. A session that is both skipped and full of work is contradictory state
 *      from before this rule. It is unskipped on sight.
 */

import { store } from './storage';
import {
  getWeekSets,
  isSkipped,
  markComplete,
  sessionHasLoggedWork,
  setSkipped,
} from './training';
import {
  getOrCreateWorkoutSessionId,
  syncSkippedToSupabase,
  upsertWorkoutSessionRemote,
} from './sync';
import { logWorkoutToHealth } from './health/logWorkoutToHealth';
import { emit } from './events';
import { isLoggedSet } from './loggedSet';
import type { TrainingDay, WorkoutSet } from '../types';

export const leftOpenKey = (dayIdx: number, weekIdx: number): string =>
  `foundry:leftOpenAt:d${dayIdx}:w${weekIdx}`;
const startKey = (dayIdx: number, weekIdx: number): string =>
  `foundry:sessionStart:d${dayIdx}:w${weekIdx}`;
const strengthEndKey = (dayIdx: number, weekIdx: number): string =>
  `foundry:strengthEnd:d${dayIdx}:w${weekIdx}`;
const dayKey = (dayIdx: number, weekIdx: number): string =>
  `foundry:day${dayIdx}:week${weekIdx}`;

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function sessionStartMs(dayIdx: number, weekIdx: number): number | null {
  const raw = store.get(startKey(dayIdx, weekIdx));
  if (!raw) return null;
  const ms = parseInt(raw, 10);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Started on an earlier local calendar day, not done. Skip state is
 * deliberately ignored here — see rule 5.
 */
export function isLeftOpen(dayIdx: number, weekIdx: number, now: number = Date.now()): boolean {
  if (store.get(`foundry:done:d${dayIdx}:w${weekIdx}`) === '1') return false;
  const start = sessionStartMs(dayIdx, weekIdx);
  if (start == null) return false;
  return startOfLocalDay(start) < startOfLocalDay(now);
}

/**
 * When the training actually happened: the last write to the day's data if
 * it landed on the same local day the session started, else the start.
 * Pure — reads, never writes.
 */
export function trainedAtFor(dayIdx: number, weekIdx: number): Date | null {
  const start = sessionStartMs(dayIdx, weekIdx);
  if (start == null) return null;
  const ts = store.getTimestamp(dayKey(dayIdx, weekIdx));
  const tsMs = ts ? Date.parse(ts) : NaN;
  const sameDay =
    Number.isFinite(tsMs) && tsMs >= start && startOfLocalDay(tsMs) === startOfLocalDay(start);
  return new Date(sameDay ? tsMs : start);
}

/**
 * Stamp the trained-at time for a left-open session, once. Must run before
 * the lifter touches the session again (a confirm today would move the day
 * data's timestamp to today). Idempotent; returns the ISO stamp or null when
 * the session is not left open.
 */
export function noteLeftOpen(dayIdx: number, weekIdx: number, now: number = Date.now()): string | null {
  const existing = store.get(leftOpenKey(dayIdx, weekIdx));
  if (existing) return existing;
  if (!isLeftOpen(dayIdx, weekIdx, now)) return null;
  const at = trainedAtFor(dayIdx, weekIdx);
  if (!at) return null;
  const iso = at.toISOString();
  store.set(leftOpenKey(dayIdx, weekIdx), iso);
  return iso;
}

export interface LeftOpenSession {
  dayIdx: number;
  weekIdx: number;
  /** Epoch ms the session was started. */
  startedAt: number;
  /** ISO — when the training happened. Completion is dated here. */
  trainedAt: string;
  /** Working sets logged (confirmed — see utils/loggedSet). */
  setsDone: number;
  /** Working sets prescribed for that week. */
  totalSets: number;
  label: string;
}

function countLoggedSets(dayIdx: number, weekIdx: number): number {
  const raw = store.get(dayKey(dayIdx, weekIdx));
  if (!raw) return 0;
  let n = 0;
  try {
    const data = JSON.parse(raw) as Record<string, Record<string, WorkoutSet>>;
    for (const slice of Object.values(data || {})) {
      for (const set of Object.values(slice || {})) {
        if (!isLoggedSet(set) || set.warmup) continue;
        n++;
      }
    }
  } catch {
    return 0;
  }
  return n;
}

function prescribedSets(day: TrainingDay | undefined, weekIdx: number, totalWeeks: number): number {
  if (!day) return 0;
  let total = 0;
  for (const ex of day.exercises || []) {
    total += getWeekSets(Number(ex.sets) || 0, weekIdx, totalWeeks);
  }
  return total;
}

/**
 * Scan the meso for left-open sessions. Applies rules 3 and 5 as it goes:
 * accidental starts are dropped, contradictory skips are cleared. Returns
 * the sessions that still need the lifter's decision, oldest first.
 */
export function findLeftOpenSessions(
  activeDays: TrainingDay[],
  totalWeeks: number,
  now: number = Date.now(),
): LeftOpenSession[] {
  const out: LeftOpenSession[] = [];
  for (let w = 0; w < totalWeeks; w++) {
    for (let d = 0; d < activeDays.length; d++) {
      if (!isLeftOpen(d, w, now)) continue;
      if (!sessionHasLoggedWork(d, w)) {
        // Accidental start — nothing was logged, so nothing happened.
        store.remove(startKey(d, w));
        store.remove(strengthEndKey(d, w));
        store.remove(leftOpenKey(d, w));
        continue;
      }
      if (isSkipped(d, w)) {
        setSkipped(d, w, false);
        void syncSkippedToSupabase(d, w, false);
      }
      const trainedAt = noteLeftOpen(d, w, now);
      const startedAt = sessionStartMs(d, w);
      if (!trainedAt || startedAt == null) continue;
      const day = activeDays[d];
      out.push({
        dayIdx: d,
        weekIdx: w,
        startedAt,
        trainedAt,
        setsDone: countLoggedSets(d, w),
        totalSets: prescribedSets(day, w, totalWeeks),
        label: (day?.label || day?.tag || `Day ${d + 1}`) as string,
      });
    }
  }
  return out;
}

function sessionTotals(dayIdx: number, weekIdx: number): { sets: number; volume: number } {
  const raw = store.get(dayKey(dayIdx, weekIdx));
  let sets = 0;
  let volume = 0;
  if (!raw) return { sets, volume };
  try {
    const data = JSON.parse(raw) as Record<string, Record<string, WorkoutSet>>;
    for (const slice of Object.values(data || {})) {
      for (const set of Object.values(slice || {})) {
        if (!isLoggedSet(set) || set.warmup) continue;
        const r = parseInt(String(set.reps || 0), 10);
        const wt = parseFloat(String(set.weight || 0));
        sets++;
        if (Number.isFinite(r) && Number.isFinite(wt)) volume += r * wt;
      }
    }
  } catch {
    /* unreadable blob — report what we have */
  }
  return { sets, volume };
}

/**
 * Close out a session with what was logged. Dated the day the lifter trained
 * (rule 4). Writes the local completion, echoes it to Supabase with the real
 * completion time, posts the workout to Apple Health with the real start and
 * end, and tells the app state a session completed.
 *
 * Works for a same-day session too (DayActionSheet / DayStack reach it for
 * any session with logged work); it is then dated at the last logged write.
 */
export function completeLeftOpenSession(
  dayIdx: number,
  weekIdx: number,
  dayLabel?: string,
): void {
  const stamped = store.get(leftOpenKey(dayIdx, weekIdx));
  const stampedMs = stamped ? Date.parse(stamped) : NaN;
  const at = Number.isFinite(stampedMs)
    ? new Date(stampedMs)
    : trainedAtFor(dayIdx, weekIdx) || new Date();
  const start = sessionStartMs(dayIdx, weekIdx);

  if (isSkipped(dayIdx, weekIdx)) setSkipped(dayIdx, weekIdx, false);
  markComplete(dayIdx, weekIdx, at);
  store.set(strengthEndKey(dayIdx, weekIdx), String(at.getTime()));
  store.remove(leftOpenKey(dayIdx, weekIdx));

  const sessionId = getOrCreateWorkoutSessionId(dayIdx, weekIdx);
  void upsertWorkoutSessionRemote(dayIdx, weekIdx, {
    sessionId,
    startedAt: start != null ? new Date(start).toISOString() : null,
    completedAt: at.toISOString(),
    isComplete: true,
    skipped: false,
  });

  const { sets, volume } = sessionTotals(dayIdx, weekIdx);
  const elapsedSecs = start != null ? Math.max(0, Math.floor((at.getTime() - start) / 1000)) : 0;
  void logWorkoutToHealth({
    startMs: start,
    endMs: at.getTime(),
    elapsedSecs,
    dayIdx,
    weekIdx,
    dayLabel,
    totalSets: sets,
    totalVolumeLbs: volume,
  });

  emit('foundry:session-completed', { dayIdx, weekIdx });
}

export { sessionHasLoggedWork };
