/**
 * Progress aggregation utilities — port of the sandbox ProgressPreview's
 * data shapes onto real Foundry data (foundry:day{d}:week{w} + foundry:archive).
 *
 * Pure module — no I/O. All functions take raw data in and return display structs.
 *
 * Two views:
 *  - aggregateLiftsByMuscle: current meso, per-muscle start/current/PR
 *  - aggregatePreviousMesos: archive entries → per-meso, per-muscle breakdown
 *
 * Algorithm notes:
 *  - Top working set per week = max weight across non-warmup sets that have
 *    both a weight and reps logged.
 *  - PR is the best e1RM (Epley: weight * (1 + reps / 30)) across all weeks
 *    in the meso, rounded to whole pounds.
 *  - Bicep/Tricep/Biceps/Triceps roll up into a single "Arms" group, matching
 *    the sandbox fixture's grouping. All other muscles pass through unchanged.
 *  - Empty muscles (no lifts with any logged set) are omitted from the output.
 */

import type {
  DayData,
  WorkoutSet,
  TrainingDay,
  ArchiveEntry,
} from '../types';
import type { ExerciseEntry } from '../data/exerciseDB';

// ─── Public display shapes ──────────────────────────────────────────────────

/** Per-exercise summary inside the current-meso "Lifts by Muscle" card. */
export interface MuscleLiftEntry {
  /** Exercise display name. */
  name: string;
  /** Top working-set weight in week 0. 0 if nothing logged that week. */
  start: number;
  /** Top working-set weight in the most recent week with any logged set. */
  current: number;
  /** Best e1RM observed across all weeks in this meso (Epley). 0 if no sets. */
  pr: number;
}

/** Current-meso aggregate, grouped by muscle for the Meso History sub-tab. */
export interface MuscleLiftAggregate {
  muscle: string;
  lifts: MuscleLiftEntry[];
}

/** Per-exercise summary inside the Previous Meso Cycles cards. */
export interface PrevMesoLiftEntry {
  name: string;
  /** Top working-set weight in the first week of the archived meso. */
  start: number;
  /** Top working-set weight in the LAST week of the archived meso. */
  end: number;
  /** Best e1RM observed across the archived meso (Epley). */
  pr: number;
}

export interface PrevMesoMuscleGroup {
  muscle: string;
  lifts: PrevMesoLiftEntry[];
}

/** Display shape consumed by PreviousMesosPage. */
export interface PrevMeso {
  /** Archive entry id (number or string). */
  id: string;
  /** Meso index — newer = higher number. Latest archived = highest. */
  number: number;
  /** Human date range, e.g. 'Jan 6 – Feb 23'. */
  dates: string;
  /** Phase summary, e.g. 'Hypertrophy block · 7 wk'. */
  phaseSummary: string;
  liftsByMuscle: PrevMesoMuscleGroup[];
  cardio: { sessions: number; totalMin: number };
  sessions: { done: number; total: number };
  /** Bodyweight change, e.g. '+3.1 lb' (empty string if unknown). */
  bwDelta: string;
}

// ─── Internals ──────────────────────────────────────────────────────────────

/**
 * Normalise a muscle string for grouping. Bicep(s)/Tricep(s) → 'Arms';
 * everything else passes through unchanged.
 */
export function normaliseMuscle(muscle: string | undefined | null): string {
  if (!muscle) return 'Other';
  const m = muscle.trim();
  if (/^(bicep|biceps|tricep|triceps)$/i.test(m)) return 'Arms';
  return m;
}

/** Epley e1RM. weight and reps are coerced to numbers; bails to 0 on garbage. */
export function epleyE1RM(weight: unknown, reps: unknown): number {
  const w = typeof weight === 'number' ? weight : parseFloat(String(weight ?? ''));
  const r = typeof reps === 'number' ? reps : parseFloat(String(reps ?? ''));
  if (!isFinite(w) || w <= 0) return 0;
  if (!isFinite(r) || r <= 0) return 0;
  return w * (1 + r / 30);
}

/** Coerce a set's weight to a number; bails to NaN on garbage. */
function setWeight(s: WorkoutSet | undefined): number {
  if (!s) return NaN;
  const w = typeof s.weight === 'number' ? s.weight : parseFloat(String(s.weight ?? ''));
  return isFinite(w) ? w : NaN;
}

function setReps(s: WorkoutSet | undefined): number {
  if (!s) return NaN;
  const r = typeof s.reps === 'number' ? s.reps : parseFloat(String(s.reps ?? ''));
  return isFinite(r) ? r : NaN;
}

/**
 * Top working-set weight in a single exercise slice. Returns NaN if the
 * slice has no non-warmup sets with both a positive weight and positive
 * reps logged.
 */
function topWorkingWeight(slice: Record<string, WorkoutSet> | undefined): number {
  if (!slice) return NaN;
  let best = -Infinity;
  for (const s of Object.values(slice)) {
    if (!s || s.warmup) continue;
    const w = setWeight(s);
    const r = setReps(s);
    if (!isFinite(w) || w <= 0 || !isFinite(r) || r <= 0) continue;
    if (w > best) best = w;
  }
  return best > -Infinity ? best : NaN;
}

/**
 * Best e1RM across a single exercise slice. Skips warmup sets and any set
 * missing weight or reps. Returns 0 if nothing scored.
 */
function bestE1RMInSlice(slice: Record<string, WorkoutSet> | undefined): number {
  if (!slice) return 0;
  let best = 0;
  for (const s of Object.values(slice)) {
    if (!s || s.warmup) continue;
    const e = epleyE1RM(s.weight, s.reps);
    if (e > best) best = e;
  }
  return best;
}

/** Find a slice in DayData whose sets carry `_exId === id`. */
function findSliceByExId(
  data: DayData,
  id: string | undefined,
): Record<string, WorkoutSet> | undefined {
  if (!id) return undefined;
  const stampOf = (set: unknown): string | null => {
    if (!set || typeof set !== 'object') return null;
    const stamp = (set as Record<string, unknown>)._exId;
    return typeof stamp === 'string' && stamp.length > 0 ? stamp : null;
  };
  for (const slice of Object.values(data)) {
    if (!slice) continue;
    const entries = Object.entries(slice);
    if (!entries.some(([, s]) => stampOf(s) === id)) continue;
    // Mixed slice (swap left the old exercise's sets behind and new ones
    // were logged alongside): keep only this exercise's sets, or its
    // start/current/PR inherit the other lift's numbers.
    const hasForeign = entries.some(([, s]) => {
      const stamp = stampOf(s);
      return stamp != null && stamp !== id;
    });
    if (!hasForeign) return slice as Record<string, WorkoutSet>;
    return Object.fromEntries(
      entries.filter(([, s]) => stampOf(s) === id),
    ) as Record<string, WorkoutSet>;
  }
  return undefined;
}

// ─── Public: current meso aggregation ───────────────────────────────────────

/**
 * Walk the current meso's stored DayData and group lifts by muscle.
 *
 * - `meso` provides totalWeeks + days (e.g. from getMeso()).
 * - `activeDays` is the canonical program for the current meso.
 * - `weekData(d, w)` returns the raw DayData for that (day, week) slot. The
 *    caller plumbs this through `loadDayWeek` (or its v2 equivalent). Keeping
 *    it as a callback keeps this function pure and testable.
 *
 * Returns one entry per muscle that has at least one lift with a logged set.
 * Bicep(s)/Tricep(s) are merged into 'Arms' (matches sandbox fixture).
 */
export function aggregateLiftsByMuscle(
  activeDays: TrainingDay[],
  totalWeeks: number,
  weekData: (dayIdx: number, weekIdx: number) => DayData,
): MuscleLiftAggregate[] {
  // muscle → exerciseKey → entry
  const byMuscle = new Map<string, Map<string, MuscleLiftEntry>>();

  // Stable insertion order for muscles so the UI renders deterministically.
  const muscleOrder: string[] = [];

  for (let d = 0; d < activeDays.length; d++) {
    const day = activeDays[d];
    if (!day || !Array.isArray(day.exercises)) continue;
    for (let exIdx = 0; exIdx < day.exercises.length; exIdx++) {
      const ex = day.exercises[exIdx];
      if (!ex || !ex.name) continue;
      if (ex.cardio) continue;
      const muscle = normaliseMuscle(ex.muscle);
      // Dedupe exercises that show up on multiple days by name+muscle.
      // (Same exercise on Push A and Push B should collapse into one row.)
      const key = `${muscle}::${ex.name}`;

      let startW = NaN;
      let currentW = NaN;
      let pr = 0;
      let anyData = false;

      for (let w = 0; w < totalWeeks; w++) {
        const wd = weekData(d, w) || {};
        // Prefer the slice whose sets carry _exId === ex.id (survives
        // reorder/superset shifts between weeks); fall back to positional
        // only when the positional slice is unstamped — a slice stamped as
        // a different exercise is that exercise's data (post-swap
        // leftovers) and would poison this lift's start/current/PR.
        let slice: Record<string, WorkoutSet> | undefined;
        if (ex.id != null) slice = findSliceByExId(wd, String(ex.id));
        if (!slice) {
          const positional = (wd[exIdx] as Record<string, WorkoutSet> | undefined) || undefined;
          const stampedAsOther =
            ex.id != null &&
            positional &&
            Object.values(positional).some((s) => {
              const stamp = (s as unknown as Record<string, unknown>)?._exId;
              return typeof stamp === 'string' && stamp.length > 0 && stamp !== String(ex.id);
            });
          if (!stampedAsOther) slice = positional;
        }
        const top = topWorkingWeight(slice);
        const e1 = bestE1RMInSlice(slice);
        if (e1 > pr) pr = e1;
        if (isFinite(top) && top > 0) {
          anyData = true;
          if (w === 0 || !isFinite(startW)) {
            // Week 0 is preferred; if absent, the earliest week with data
            // becomes "start" so the UI still has a sensible baseline.
            if (w === 0) startW = top;
            else if (!isFinite(startW)) startW = top;
          }
          currentW = top;
        }
      }

      if (!anyData) continue;

      if (!byMuscle.has(muscle)) {
        byMuscle.set(muscle, new Map());
        muscleOrder.push(muscle);
      }
      const muscleMap = byMuscle.get(muscle)!;
      const existing = muscleMap.get(key);
      const start = isFinite(startW) ? startW : 0;
      const current = isFinite(currentW) ? currentW : 0;
      const prRounded = Math.round(pr);
      if (!existing) {
        muscleMap.set(key, { name: ex.name, start, current, pr: prRounded });
      } else {
        // Same exercise appears on a later day too — merge by max.
        muscleMap.set(key, {
          name: ex.name,
          start: existing.start || start,
          current: Math.max(existing.current, current),
          pr: Math.max(existing.pr, prRounded),
        });
      }
    }
  }

  const out: MuscleLiftAggregate[] = [];
  for (const muscle of muscleOrder) {
    const lifts = Array.from(byMuscle.get(muscle)?.values() ?? []);
    if (lifts.length > 0) out.push({ muscle, lifts });
  }
  return out;
}

// ─── Public: previous meso aggregation ──────────────────────────────────────

interface ArchiveSessionShape {
  d: number;
  w: number;
  data: DayData;
  done?: boolean;
}

interface ArchiveRecordShape {
  id: number | string;
  archivedAt?: string;
  profile?: Partial<{
    name: string;
    goal: string;
    splitType: string;
    startDate: string;
    mesoLength: number;
    weight: number | string;
  }> & Record<string, unknown>;
  mesoWeeks?: number;
  mesoDays?: number;
  totalSessions?: number;
  completedSessions?: number;
  sessions?: ArchiveSessionShape[];
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtMonthDay(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function deriveDates(rec: ArchiveRecordShape): string {
  const startStr = rec.profile?.startDate as string | undefined;
  const archivedAt = rec.archivedAt;
  let end: Date | null = null;
  if (archivedAt) {
    const parsed = new Date(archivedAt);
    if (!isNaN(parsed.getTime())) end = parsed;
  }
  if (startStr) {
    const start = new Date(startStr + 'T00:00:00');
    if (!isNaN(start.getTime())) {
      if (!end) {
        // Assume mesoWeeks * 7 days if no archivedAt.
        const wks = rec.mesoWeeks ?? 7;
        end = new Date(start.getTime() + wks * 7 * 86400_000);
      }
      return `${fmtMonthDay(start)} – ${fmtMonthDay(end)}`;
    }
  }
  if (end) return fmtMonthDay(end);
  return '—';
}

function derivePhaseSummary(rec: ArchiveRecordShape): string {
  const wks = rec.mesoWeeks ?? rec.profile?.mesoLength ?? 7;
  const goal = String(rec.profile?.goal ?? '').toLowerCase();
  let block = 'Training block';
  if (goal.includes('strength')) block = 'Strength block';
  else if (goal.includes('hyp') || goal.includes('muscle') || goal.includes('size')) block = 'Hypertrophy block';
  else if (goal.includes('endur')) block = 'Endurance block';
  else if (goal.includes('cut') || goal.includes('lean')) block = 'Cutting block';
  return `${block} · ${wks} wk`;
}

/**
 * Sum cardio sessions in an archive entry. Stored shape is loose:
 * `sessions[].cardioLog` is JSON.parsed but its inner shape varies (legacy
 * arrays vs newer `{sessions: [{durationMin}]}`). We do a best-effort walk.
 */
function deriveCardio(rec: ArchiveRecordShape): { sessions: number; totalMin: number } {
  let count = 0;
  let total = 0;
  for (const s of rec.sessions ?? []) {
    const raw = (s as { cardioLog?: unknown }).cardioLog;
    if (!raw) continue;
    // Could be array of entries, object with .sessions, or single object.
    const visit = (entry: unknown): void => {
      if (!entry || typeof entry !== 'object') return;
      const obj = entry as Record<string, unknown>;
      const dur = obj.durationMin ?? obj.duration ?? obj.minutes;
      const d = typeof dur === 'number' ? dur : parseFloat(String(dur ?? ''));
      if (isFinite(d) && d > 0) {
        count++;
        total += d;
      }
    };
    if (Array.isArray(raw)) raw.forEach(visit);
    else if (typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.sessions)) obj.sessions.forEach(visit);
      else visit(raw);
    }
  }
  return { sessions: count, totalMin: Math.round(total) };
}

/**
 * Aggregate one archived meso's sessions by muscle.
 *
 * Looks up each set's `_exId` in `exerciseDB` to recover the muscle + name.
 * Sets without an `_exId` are skipped — legacy data predating that marker
 * cannot be attributed to a specific exercise.
 */
function aggregateArchiveByMuscle(
  rec: ArchiveRecordShape,
  exerciseDB: ExerciseEntry[],
): PrevMesoMuscleGroup[] {
  const dbById = new Map<string, ExerciseEntry>();
  for (const e of exerciseDB) {
    if (e.id) dbById.set(e.id, e);
  }

  // exId → { name, muscle, perWeek: Map<week, {top, e1rm}> }
  const byExId = new Map<
    string,
    { name: string; muscle: string; perWeek: Map<number, { top: number; bestE1: number }> }
  >();

  for (const session of rec.sessions ?? []) {
    if (!session?.data) continue;
    const w = session.w;
    // Walk each slot, group sets by their _exId.
    for (const slice of Object.values(session.data)) {
      if (!slice) continue;
      // Determine exId for the slice (use first set that has one).
      let exId: string | undefined;
      for (const set of Object.values(slice)) {
        if (set && typeof set === 'object') {
          const candidate = (set as unknown as Record<string, unknown>)._exId;
          if (candidate != null && String(candidate).length > 0) {
            exId = String(candidate);
            break;
          }
        }
      }
      if (!exId) continue;
      const dbEntry = dbById.get(exId);
      if (!dbEntry) continue;
      const muscle = normaliseMuscle(dbEntry.muscle);
      const name = dbEntry.name;

      const top = topWorkingWeight(slice as Record<string, WorkoutSet>);
      const e1 = bestE1RMInSlice(slice as Record<string, WorkoutSet>);

      if (!byExId.has(exId)) {
        byExId.set(exId, { name, muscle, perWeek: new Map() });
      }
      const rec2 = byExId.get(exId)!;
      const existing = rec2.perWeek.get(w);
      const topNew = isFinite(top) ? top : 0;
      const e1New = isFinite(e1) ? e1 : 0;
      if (!existing) {
        rec2.perWeek.set(w, { top: topNew, bestE1: e1New });
      } else {
        rec2.perWeek.set(w, {
          top: Math.max(existing.top, topNew),
          bestE1: Math.max(existing.bestE1, e1New),
        });
      }
    }
  }

  // Flatten to per-muscle groups.
  const muscleMap = new Map<string, PrevMesoLiftEntry[]>();
  const muscleOrder: string[] = [];
  for (const { name, muscle, perWeek } of byExId.values()) {
    if (perWeek.size === 0) continue;
    const weeks = Array.from(perWeek.keys()).sort((a, b) => a - b);
    const first = perWeek.get(weeks[0])!;
    const last = perWeek.get(weeks[weeks.length - 1])!;
    let pr = 0;
    for (const { bestE1 } of perWeek.values()) {
      if (bestE1 > pr) pr = bestE1;
    }
    if (!muscleMap.has(muscle)) {
      muscleMap.set(muscle, []);
      muscleOrder.push(muscle);
    }
    muscleMap.get(muscle)!.push({
      name,
      start: Math.round(first.top),
      end: Math.round(last.top),
      pr: Math.round(pr),
    });
  }

  const out: PrevMesoMuscleGroup[] = [];
  for (const m of muscleOrder) {
    const lifts = muscleMap.get(m) ?? [];
    if (lifts.length === 0) continue;
    out.push({ muscle: m, lifts });
  }
  return out;
}

/**
 * Aggregate the archive into a list of PrevMeso entries, newest first
 * (matching `loadArchive`'s ordering — it `unshifts` new entries).
 *
 * Meso numbering: latest = highest. So if `archive` has N entries, the
 * first (newest) is meso #N, the next is #N-1, etc. This is a display
 * convenience — the source of truth remains `id`.
 */
/** Result of a cross-meso "last weight" lookup. */
export interface LastMesoWeight {
  /** Top working-set weight from the most recent week with logged data. */
  weight: number;
  /** Best reps at that weight. */
  reps: number;
  /** 0-based week index within the archived meso the sets came from. */
  weekIdx: number;
  /** How many mesos back the match was found (1 = the meso right before this one). */
  mesosAgo: number;
  /** ISO timestamp the source meso was archived at, when recorded. */
  archivedAt?: string;
}

/**
 * Find the weight the lifter last used for `exId` in a previous meso.
 *
 * Walks the archive newest-first, and within each meso walks weeks
 * LATEST-first, returning the top working set from the most recent week
 * with any logged data for the exercise. An unfinished meso works fine —
 * whatever week they stopped at is the week that answers "what did I
 * last lift". Matching is by `_exId` (stamped on every set write); mesos
 * archived before stamping (pre 2026-04-29) can't be matched and are
 * skipped rather than guessed at by slot position.
 *
 * Returns null when no archived meso has logged sets for the exercise.
 */
export function findLastMesoWeight(
  archive: ArchiveEntry[],
  exId: string | number | undefined,
): LastMesoWeight | null {
  const idStr = exId == null ? null : String(exId);
  if (!idStr) return null;
  for (let i = 0; i < archive.length; i++) {
    const rec = archive[i] as unknown as ArchiveRecordShape;
    if (!rec?.sessions?.length) continue;
    // Latest week first; the archive writer walks (d, w) in order, so sort
    // rather than trust insertion order.
    const sessions = [...rec.sessions].sort((a, b) => b.w - a.w || b.d - a.d);
    for (const session of sessions) {
      if (!session?.data) continue;
      const slice = findSliceByExId(session.data, idStr);
      if (!slice) continue;
      let weight = 0;
      let reps = 0;
      for (const s of Object.values(slice)) {
        if (!s || s.warmup) continue;
        const w = setWeight(s);
        const r = setReps(s);
        if (!isFinite(w) || w <= 0 || !isFinite(r) || r <= 0) continue;
        if (w > weight || (w === weight && r > reps)) {
          weight = w;
          reps = r;
        }
      }
      if (weight > 0) {
        return {
          weight,
          reps,
          weekIdx: session.w,
          mesosAgo: i + 1,
          archivedAt: rec.archivedAt,
        };
      }
    }
  }
  return null;
}

/**
 * Every exercise id the lifter has actually *worked* on, across the archive.
 *
 * Powers anchor continuity in `generateProgram`: a new mesocycle should keep
 * progressing the compounds you already have numbers for rather than rolling
 * a fresh squat variant every cycle. Before this existed the generator
 * reshuffled anchors freely, so a lifter with 29 exercises of history could
 * open a new meso sharing only 3 of them — and every history reader matches
 * on exact `_exId`, so the other 26 had nothing to show by construction.
 *
 * "Worked" means a confirmed, non-warmup set carrying real numbers. A slice
 * that exists but holds only warmups or blank rows is a slot the lifter
 * opened and abandoned; treating that as history would pin the next meso to
 * a lift they never actually performed.
 *
 * Matching is by `_exId` stamp only. Slot position is deliberately not used
 * as a fallback — an unstamped slice cannot be attributed to an exercise
 * without guessing, and guessing here silently biases every future program.
 */
export function collectTrainedExerciseIds(archive: ArchiveEntry[]): Set<string> {
  const out = new Set<string>();
  for (const entry of archive || []) {
    const rec = entry as unknown as ArchiveRecordShape;
    for (const session of rec?.sessions || []) {
      if (!session?.data) continue;
      for (const slice of Object.values(session.data as DayData)) {
        if (!slice) continue;
        for (const set of Object.values(slice)) {
          if (!set || set.warmup) continue;
          const stamp = (set as unknown as Record<string, unknown>)._exId;
          if (typeof stamp !== 'string' || stamp.length === 0) continue;
          const w = setWeight(set);
          const r = setReps(set);
          // Bodyweight work logs reps with no weight, so either alone counts.
          if ((isFinite(w) && w > 0) || (isFinite(r) && r > 0)) out.add(stamp);
        }
      }
    }
  }
  return out;
}

export interface LifetimeSummary {
  cycles: number;
  sessions: number;
  sets: number;
  /** ISO date of the earliest cycle we can date, or null. */
  since: string | null;
}

/**
 * Totals across every archived mesocycle.
 *
 * Everything else in the profile drawer is scoped to the current cycle, so
 * there is nowhere in the app that answers "how much have I actually done".
 * This is that number.
 *
 * Counts only real working sets — non-warmup, carrying weight or reps —
 * because an inflated lifetime total is worse than no total. The CURRENT
 * cycle is not included; callers add it, since only they know what it is.
 */
export function summarizeLifetime(archive: ArchiveEntry[]): LifetimeSummary {
  let sessions = 0;
  let sets = 0;
  let cycles = 0;
  let since: string | null = null;

  for (const entry of archive || []) {
    const rec = entry as unknown as ArchiveRecordShape;
    if (!rec) continue;

    let cycleSessions = 0;
    let cycleSets = 0;
    for (const session of rec.sessions || []) {
      if (session?.done) cycleSessions++;
      if (!session?.data) continue;
      for (const slice of Object.values(session.data as DayData)) {
        if (!slice) continue;
        for (const set of Object.values(slice)) {
          if (!set || set.warmup) continue;
          const w = setWeight(set);
          const r = setReps(set);
          if ((isFinite(w) && w > 0) || (isFinite(r) && r > 0)) cycleSets++;
        }
      }
    }

    // A cycle only counts if it was actually trained. Abandoned shells are
    // real in the data — prod has three mesocycles with zero sessions, from
    // builds started and dropped — and the remote rebuild already refuses
    // them. But a locally-written archive entry for one survives the merge,
    // and counting it would inflate the headline number this whole summary
    // exists to state honestly.
    if (cycleSessions === 0 && cycleSets === 0) continue;

    cycles++;
    sessions += cycleSessions;
    sets += cycleSets;

    // Prefer the recorded start date; fall back to when it was archived so a
    // cycle without one still anchors the "since" line.
    const start = (rec.profile?.startDate as string | undefined) || rec.archivedAt;
    if (start && (!since || start < since)) since = start;
  }

  return { cycles, sessions, sets, since };
}

export function aggregatePreviousMesos(
  archive: ArchiveEntry[],
  exerciseDB: ExerciseEntry[],
): PrevMeso[] {
  const out: PrevMeso[] = [];
  const total = archive.length;
  for (let i = 0; i < total; i++) {
    const raw = archive[i] as unknown as ArchiveRecordShape;
    if (!raw) continue;
    const dates = deriveDates(raw);
    const phaseSummary = derivePhaseSummary(raw);
    const liftsByMuscle = aggregateArchiveByMuscle(raw, exerciseDB);
    const cardio = deriveCardio(raw);
    const done = raw.completedSessions ?? 0;
    const sessionTotal =
      raw.totalSessions ?? (raw.mesoWeeks ?? 0) * (raw.mesoDays ?? 0);
    out.push({
      id: String(raw.id ?? `meso-${i}`),
      number: total - i,
      dates,
      phaseSummary,
      liftsByMuscle,
      cardio,
      sessions: { done, total: sessionTotal },
      bwDelta: '',
    });
  }
  return out;
}
