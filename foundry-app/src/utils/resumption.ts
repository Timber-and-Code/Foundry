/**
 * Resumption — re-anchors the calendar clock when a lifter returns from a
 * 7+ day layoff.
 *
 * Background: Foundry maintains two clocks.
 *  1. The progress clock (`activeWeek`) is derived from `completedDays` and
 *     pauses on absence.
 *  2. The calendar clock (`profile.startDate`) is wall-clock-driven; the
 *     Schedule grid + Home preview lay out forward from `startDate` so a
 *     meso that started May 1 silently shows "Week 7" on June 16 even if
 *     the lifter only completed Week 2.
 *
 * This module slides `profile.startDate` forward by the gap when the lifter
 * resumes, re-anchoring the calendar grid to their actual position. Four
 * choices, each with its own startDate / completedDays effect — see the
 * brief / `applyResumptionChoice` for the per-choice behaviour matrix.
 *
 * Pure functions where possible; the apply step does store I/O for the
 * archive / flag side effects but stays free of React state.
 */

import { store } from './storage';
import { archiveCurrentMeso } from './archive';
import { formatSplitName } from './splitLabel';
import type { Profile, TrainingDay } from '../types';

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface ResumptionGap {
  /** today - lastCompletedDateISO, in whole days. */
  gapDays: number;
  /** 'YYYY-MM-DD' of the most recent completion. */
  lastCompletedDateISO: string;
  /** 'Push A' etc — best-effort from the training program. */
  lastDayLabel: string;
  /** dayIdx of the last completion — kept so the toast can name the next
   *  session, and so the test layer can verify label derivation. */
  lastDayIdx: number;
  /** weekIdx of the last completion. Used by `applyResumptionChoice` for
   *  the `repeat_last_week` / recalibrate flag write. */
  lastWeekIdx: number;
}

export type ResumptionChoice =
  | 'pick_up'
  | 'repeat_last_week'
  | 'recalibrate'
  | 'restart_meso';

export interface ResumptionApplyContext {
  profile: Profile;
  completedDays: Set<string>;
  currentWeek: number;
  setProfile: (p: Profile) => void;
  setCompletedDays: (s: Set<string>) => void;
  setCurrentWeek: (w: number) => void;
}

export interface ResumptionApplyResult {
  startDateShifted: number;
  completedWiped: number;
  archived: boolean;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

const HANDLED_KEY = 'foundry:resumption_handled';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse 'YYYY-MM-DD' using the codebase convention (midnight local). */
function parseISO(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

/** Days between two 'YYYY-MM-DD' strings (b - a), floored. */
function diffDays(aISO: string, bISO: string): number {
  const a = parseISO(aISO).getTime();
  const b = parseISO(bISO).getTime();
  return Math.floor((b - a) / 86400000);
}

/** Shift a 'YYYY-MM-DD' string by N days, returning a new 'YYYY-MM-DD'. */
function shiftISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── DETECT ─────────────────────────────────────────────────────────────────

/**
 * Detect whether the lifter has been absent 7+ days since their last
 * recorded completion. Returns null when:
 *  - no completion exists,
 *  - the gap is < 7 days,
 *  - profile is null.
 *
 * Last-completion timestamp is read from `foundry:completedDate:d{d}:w{w}`
 * for each entry in `completedDays`. Ties (same date) resolve by the
 * later week/day pair so the label points at the most recent session.
 *
 * Last-day label is derived from the program at `program[lastDayIdx]`,
 * formatted via `formatSplitName`. Falls back to `Day {n+1}`.
 */
export function detectResumptionGap(
  completedDays: Set<string>,
  profile: Profile | null,
  program: TrainingDay[],
): ResumptionGap | null {
  if (!profile) return null;
  if (!completedDays || completedDays.size === 0) return null;

  let bestDate: string | null = null;
  let bestDay = -1;
  let bestWeek = -1;

  for (const key of completedDays) {
    const [dStr, wStr] = key.split(':');
    const d = parseInt(dStr, 10);
    const w = parseInt(wStr, 10);
    if (!Number.isFinite(d) || !Number.isFinite(w)) continue;
    const dateStr = store.get(`foundry:completedDate:d${d}:w${w}`);
    if (!dateStr) continue;
    // Lexicographic compare works for 'YYYY-MM-DD'.
    if (
      !bestDate ||
      dateStr > bestDate ||
      (dateStr === bestDate && (w > bestWeek || (w === bestWeek && d > bestDay)))
    ) {
      bestDate = dateStr;
      bestDay = d;
      bestWeek = w;
    }
  }

  if (!bestDate) return null;

  const today = todayISO();
  const gapDays = diffDays(bestDate, today);
  if (gapDays < 7) return null;

  // Derive label from the program day. Falls back gracefully when the
  // program slot is missing (e.g. program hasn't loaded yet).
  let lastDayLabel = `Day ${bestDay + 1}`;
  const day = program?.[bestDay];
  if (day) {
    if (day.label) {
      lastDayLabel = day.label;
    } else if (day.tag) {
      // formatSplitName accepts split-style strings; fall back to the
      // tag-as-name when the helper returns the literal tag back. For
      // day tags we prefer the friendly name from the tag map.
      const tag = day.tag.toUpperCase();
      const friendly = TAG_DISPLAY[tag];
      lastDayLabel = friendly || day.name || `Day ${bestDay + 1}`;
    } else if (day.name) {
      lastDayLabel = day.name;
    }
  }
  // Suffix with the day's split-letter (e.g. "Push A" for daysPerWeek 6) so
  // the lifter recognises which specific session they last finished.
  // formatSplitName is the canonical split-name helper but it speaks
  // splitType, not day tag — we keep it imported in case a future caller
  // wants to widen the derivation, and so tree-shaking doesn't drop it.
  void formatSplitName;

  return {
    gapDays,
    lastCompletedDateISO: bestDate,
    lastDayLabel,
    lastDayIdx: bestDay,
    lastWeekIdx: bestWeek,
  };
}

const TAG_DISPLAY: Record<string, string> = {
  PUSH: 'Push Day',
  PULL: 'Pull Day',
  LEGS: 'Leg Day',
  UPPER: 'Upper Body',
  LOWER: 'Lower Body',
  ARMS: 'Arm Day',
  FULL: 'Full Body',
  CARDIO: 'Cardio',
  MOBILITY: 'Mobility',
  BW: 'Bodyweight',
};

// ─── APPLY ──────────────────────────────────────────────────────────────────

/**
 * Apply the lifter's chosen resumption strategy. Mutates store, completedDays,
 * profile, and (for `restart_meso`) the archive. Returns a small result
 * object so the UI can surface a confirmation toast.
 *
 * Side-effect summary:
 *   pick_up          startDate += gapDays.
 *   repeat_last_week startDate += gapDays + 7. Wipe completion + day data
 *                    for `lastWeekIdx` (archived to
 *                    foundry:resumption_archive:repeat:{mesoId}:{lastWk}
 *                    first). currentWeek = lastWeekIdx.
 *   recalibrate      startDate += gapDays. Set
 *                    foundry:reentry_deload:{mesoId}:{weekIdx} = '1' for
 *                    the current active week (= lastWeekIdx + 1 or the
 *                    passed currentWeek, whichever is later).
 *   restart_meso     startDate = today. completedDays cleared.
 *                    currentWeek = 1. archiveCurrentMeso fires.
 */
export function applyResumptionChoice(
  choice: ResumptionChoice,
  gap: ResumptionGap,
  ctx: ResumptionApplyContext,
): ResumptionApplyResult {
  const { profile, completedDays, currentWeek, setProfile, setCompletedDays, setCurrentWeek } = ctx;
  const startDate = profile.startDate || todayISO();
  const mesoId = store.get('foundry:active_meso_id') || 'local';

  if (choice === 'pick_up') {
    const nextStart = shiftISO(startDate, gap.gapDays);
    const nextProfile: Profile = { ...profile, startDate: nextStart };
    setProfile(nextProfile);
    persistProfile(nextProfile);
    return { startDateShifted: gap.gapDays, completedWiped: 0, archived: false };
  }

  if (choice === 'recalibrate') {
    const nextStart = shiftISO(startDate, gap.gapDays);
    const nextProfile: Profile = { ...profile, startDate: nextStart };
    setProfile(nextProfile);
    persistProfile(nextProfile);
    // The lifter is re-entering at the *next* incomplete week. Use
    // currentWeek when ahead of (lastWeekIdx + 1), else the natural
    // continuation week.
    const targetWeek = Math.max(currentWeek, gap.lastWeekIdx + 1);
    store.set(`foundry:reentry_deload:${mesoId}:${targetWeek}`, '1');
    return { startDateShifted: gap.gapDays, completedWiped: 0, archived: false };
  }

  if (choice === 'repeat_last_week') {
    const nextStart = shiftISO(startDate, gap.gapDays + 7);
    const nextProfile: Profile = { ...profile, startDate: nextStart };
    setProfile(nextProfile);
    persistProfile(nextProfile);

    // Wipe completion + day data for lastWeekIdx. Archive day data first
    // under foundry:resumption_archive:repeat:{mesoId}:{lastWk} so the
    // lifter never loses what they did.
    const lastWk = gap.lastWeekIdx;
    const next = new Set(completedDays);
    let wiped = 0;
    const archived: Record<string, unknown> = { archivedAt: new Date().toISOString(), week: lastWk, days: {} };
    const archivedDays = archived.days as Record<string, unknown>;

    for (const key of completedDays) {
      const [, wStr] = key.split(':');
      if (parseInt(wStr, 10) === lastWk) {
        next.delete(key);
        wiped++;
      }
    }

    // Scan day data keys for week lastWk and archive + remove. We probe a
    // generous day range (0..9) since profile.workoutDays length varies.
    for (let d = 0; d < 10; d++) {
      const rawKey = `foundry:day${d}:week${lastWk}`;
      const raw = store.get(rawKey);
      if (raw !== null) {
        archivedDays[String(d)] = raw;
        store.remove(rawKey);
      }
      const doneKey = `foundry:done:d${d}:w${lastWk}`;
      if (store.get(doneKey) === '1') store.remove(doneKey);
      const completedDateKey = `foundry:completedDate:d${d}:w${lastWk}`;
      if (store.get(completedDateKey) !== null) store.remove(completedDateKey);
      // v2 id-keyed mirror, if present.
      const v2Key = `foundry:day_v2:${d}:${lastWk}`;
      if (store.get(v2Key) !== null) store.remove(v2Key);
    }

    store.set(
      `foundry:resumption_archive:repeat:${mesoId}:${lastWk}`,
      JSON.stringify(archived),
    );

    setCompletedDays(next);
    setCurrentWeek(lastWk);
    return { startDateShifted: gap.gapDays + 7, completedWiped: wiped, archived: false };
  }

  // restart_meso
  try {
    archiveCurrentMeso(profile);
  } catch (e) {
    console.warn('[Foundry]', 'archiveCurrentMeso failed during restart', e);
  }

  // Wipe day data, completion markers, and reset structure. We don't call
  // archive.resetMeso here because the lifter wants the program *kept* —
  // they're re-running it from week 1. So manually wipe the per-day
  // localStorage keys (same key shape resetMeso uses).
  const wiped = completedDays.size;
  for (let d = 0; d < 10; d++) {
    for (let w = 0; w < 20; w++) {
      store.remove(`foundry:day${d}:week${w}`);
      store.remove(`foundry:done:d${d}:w${w}`);
      store.remove(`foundry:completedDate:d${d}:w${w}`);
      store.remove(`foundry:day_v2:${d}:${w}`);
      store.remove(`foundry:cardio:d${d}:w${w}`);
      store.remove(`foundry:skip:d${d}:w${w}`);
    }
  }

  const nextProfile: Profile = { ...profile, startDate: todayISO() };
  setProfile(nextProfile);
  persistProfile(nextProfile);
  setCompletedDays(new Set());
  setCurrentWeek(1);

  return { startDateShifted: 0, completedWiped: wiped, archived: true };
}

/** Persist profile to localStorage without firing the Supabase sync chain
 *  (we don't want every choice to slam Supabase; the next saveProfile
 *  call from elsewhere will pick it up). */
function persistProfile(profile: Profile): void {
  store.set('foundry:profile', JSON.stringify(profile));
}

// ─── HANDLED FLAG ───────────────────────────────────────────────────────────

/**
 * One-shot trigger gating: keyed on the gap's lastCompletedDateISO so a
 * new gap (different last-completed date) resets the flag and re-fires
 * the sheet. The sheet itself sets the flag on choice. Cleared on the
 * next workout completion (caller's responsibility — the sheet just sets).
 */
export function isResumptionHandled(gap: ResumptionGap): boolean {
  return store.get(HANDLED_KEY) === gap.lastCompletedDateISO;
}

export function markResumptionHandled(gap: ResumptionGap): void {
  store.set(HANDLED_KEY, gap.lastCompletedDateISO);
}
