// ─── Big-Big Phase 2 — DayData v1 → v2 migration ───────────────────────────
// Phase 1 (a26459e) introduced the parallel v2 storage shape (`foundry:day_v2:{d}:{w}`)
// behind a dual-write flag. Phase 2 adds a one-shot migration that backfills
// v2 records for users who already have v1 data — covering both the
// flag-OFF historical writes and the flag-ON writes that skipped slots
// because the tde-id cache wasn't seeded yet at write time.
//
// Design contract:
//   - Pure function `migrateDayDataToV2` does the v1 → v2 transform with no
//     side effects, given the (mesoId-scoped) tde-id map and the per-slot
//     EXERCISE_DB id map sourced from the stored program.
//   - Storage runner `runDayDataV2Migration` walks all `foundry:day{d}:week{w}`
//     keys, snapshots v1 to a backup key (idempotent), and writes the v2
//     output via `saveDayWeekV2`. Idempotent — re-running a (d,w) pair
//     that already has v2 data is a no-op.
//   - v1 is NEVER deleted here. Phase 4 owns deletion. Until Phase 3 flips
//     reads, v1 stays the source of truth.
//
// Read-side wiring (loadDayWeekWithCarryover, ExerciseCard, MesoHistoryView,
// sync.ts) is intentionally untouched in this phase.

import { saveDayWeekV2 } from './persistence';
import type { DayData, DayDataV2, DayDataV2Slice, TrainingDay, WorkoutSet } from '../types';

// ─── PURE TRANSFORM ─────────────────────────────────────────────────────────

export interface MigrationContext {
  /** training_day_exercises uuid map: "dayIdx:exIdx" → uuid. Sourced from
   *  `foundry:tde_ids:{mesoId}` (populated by sync.ts after meso pull). */
  tdeIdMap: Record<string, string>;
  /** EXERCISE_DB id per slot, sourced from `foundry:storedProgram` so we can
   *  fill the v2 slice's `exId` even when v1 set blobs lack `_exId` (legacy
   *  pre-Med data). Keyed identically to tdeIdMap: "dayIdx:exIdx" → exId. */
  programExIds: Record<string, string>;
}

export interface MigrationSkip {
  exIdx: number;
  reason: 'no_tde_id' | 'no_ex_id';
}

export interface MigrationResult {
  v2: DayDataV2;
  /** Slots that couldn't be migrated. Caller logs these — Phase 4 will
   *  delete v1 entirely; orphan slots indicate a data mismatch worth
   *  investigating before then. */
  skipped: MigrationSkip[];
}

/**
 * Pure v1 → v2 transform. No localStorage access; safe to unit-test against
 * fixtures.
 *
 *   - Strips the `_exId` carryover marker from each set (clean v2 sets).
 *   - Resolves `exId` from `_exId` first (whichever set has it), falling back
 *     to ctx.programExIds when v1 sets are pre-Med legacy data.
 *   - Skips slots without a tde-id mapping or without any exId resolution.
 */
export function migrateDayDataToV2(
  v1: DayData,
  dayIdx: number,
  ctx: MigrationContext,
): MigrationResult {
  const v2: DayDataV2 = {};
  const skipped: MigrationSkip[] = [];

  for (const exIdxStr of Object.keys(v1)) {
    const exIdx = parseInt(exIdxStr, 10);
    if (!Number.isFinite(exIdx)) continue;

    const tdeId = ctx.tdeIdMap[`${dayIdx}:${exIdx}`];
    if (!tdeId) {
      skipped.push({ exIdx, reason: 'no_tde_id' });
      continue;
    }

    const setsMap = v1[exIdxStr] || {};

    // Pull `_exId` from any set in the slice (Med stamps it on writes from
    // 2.8.3+). Treat the set blob as Record<string, unknown> for the lookup
    // so we don't widen the public WorkoutSet shape.
    let exId: string | undefined;
    for (const setKey of Object.keys(setsMap)) {
      const blob = setsMap[setKey] as unknown as Record<string, unknown>;
      const candidate = blob && typeof blob._exId === 'string' ? blob._exId : undefined;
      if (candidate) {
        exId = candidate;
        break;
      }
    }
    if (!exId) {
      // Fallback: program-derived exId for this slot. This is what makes the
      // migration usable for legacy pre-Med data — Phase 1 had to skip those
      // slots entirely; here we backfill them.
      exId = ctx.programExIds[`${dayIdx}:${exIdx}`];
    }

    if (!exId) {
      skipped.push({ exIdx, reason: 'no_ex_id' });
      continue;
    }

    // Build a clean copy of the per-set data with the `_exId` marker stripped
    // so the v2 sets are pristine WorkoutSet shapes.
    const cleanSets: Record<string, WorkoutSet> = {};
    for (const setKey of Object.keys(setsMap)) {
      const blob = { ...(setsMap[setKey] as unknown as Record<string, unknown>) };
      delete blob._exId;
      cleanSets[setKey] = blob as unknown as WorkoutSet;
    }

    const slice: DayDataV2Slice = {
      sortOrder: exIdx,
      exId,
      sets: cleanSets,
    };
    v2[tdeId] = slice;
  }

  return { v2, skipped };
}

// ─── STORAGE RUNNER ─────────────────────────────────────────────────────────

export interface MigrationRunOrphan {
  dayIdx: number;
  weekIdx: number;
  exIdx: number;
  reason: 'no_tde_id' | 'no_ex_id';
}

export interface MigrationRunResult {
  /** Number of (dayIdx, weekIdx) pairs migrated this run (v2 written). */
  migrated: number;
  /** Pairs that already had a v2 record — skipped per idempotency. */
  alreadyMigrated: number;
  /** Pairs missing prerequisites (no active meso, no tde-id cache, no v1
   *  data, etc.) — included so callers can spot misconfiguration. */
  skippedPrereq: number;
  /** Slots inside otherwise-migrated days that couldn't be lifted. */
  orphanSlots: MigrationRunOrphan[];
}

/** localStorage key prefix matcher used to discover all v1 day records. */
const V1_DAY_KEY_RE = /^foundry:day(\d+):week(\d+)$/;

/**
 * Build the per-slot EXERCISE_DB id map from the cached program. Returns an
 * empty record when the program is missing or malformed — callers treat that
 * as "no fallback exId available" which only matters for legacy pre-Med data.
 */
function buildProgramExIdMap(programRaw: string | null): Record<string, string> {
  if (!programRaw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(programRaw);
  } catch {
    return {};
  }
  if (!Array.isArray(parsed)) return {};
  const out: Record<string, string> = {};
  (parsed as TrainingDay[]).forEach((day, dayIdx) => {
    if (!day || !Array.isArray(day.exercises)) return;
    day.exercises.forEach((ex, exIdx) => {
      const id = ex && (ex.id !== undefined && ex.id !== null) ? String(ex.id) : '';
      if (id) out[`${dayIdx}:${exIdx}`] = id;
    });
  });
  return out;
}

/**
 * Walk all v1 day-week localStorage keys for the active meso and produce v2
 * records for any pair missing one. Snapshots v1 to a backup key before
 * writing v2 (idempotent — won't overwrite an existing backup).
 *
 * Returns a structured summary; caller logs it. Never throws — bail-out
 * reasons (no active meso, no tde cache, no v1 data) come back as
 * `skippedPrereq` so the trigger site can record the no-op cleanly.
 */
export function runDayDataV2Migration(): MigrationRunResult {
  const result: MigrationRunResult = {
    migrated: 0,
    alreadyMigrated: 0,
    skippedPrereq: 0,
    orphanSlots: [],
  };

  if (typeof localStorage === 'undefined') {
    result.skippedPrereq++;
    return result;
  }

  const mesoId = localStorage.getItem('foundry:active_meso_id');
  if (!mesoId) {
    result.skippedPrereq++;
    return result;
  }

  const tdeRaw = localStorage.getItem(`foundry:tde_ids:${mesoId}`);
  if (!tdeRaw) {
    result.skippedPrereq++;
    return result;
  }
  let tdeIdMap: Record<string, string>;
  try {
    const parsed = JSON.parse(tdeRaw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      result.skippedPrereq++;
      return result;
    }
    tdeIdMap = parsed as Record<string, string>;
  } catch {
    result.skippedPrereq++;
    return result;
  }

  const programExIds = buildProgramExIdMap(localStorage.getItem('foundry:storedProgram'));

  // Snapshot the key list up front — the migration writes new v2 keys, which
  // would otherwise show up mid-iteration on some browsers.
  const v1Keys: Array<{ key: string; dayIdx: number; weekIdx: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const match = key.match(V1_DAY_KEY_RE);
    if (!match) continue;
    v1Keys.push({
      key,
      dayIdx: parseInt(match[1], 10),
      weekIdx: parseInt(match[2], 10),
    });
  }

  if (v1Keys.length === 0) {
    result.skippedPrereq++;
    return result;
  }

  for (const { key, dayIdx, weekIdx } of v1Keys) {
    const v2Key = `foundry:day_v2:${dayIdx}:${weekIdx}`;
    if (localStorage.getItem(v2Key) !== null) {
      result.alreadyMigrated++;
      continue;
    }

    const v1Raw = localStorage.getItem(key);
    if (!v1Raw) continue;

    let v1: DayData;
    try {
      const parsed = JSON.parse(v1Raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      v1 = parsed as DayData;
    } catch {
      continue;
    }

    // Snapshot v1 to backup BEFORE writing v2. Idempotent: don't clobber an
    // existing backup so a partial earlier migration's snapshot stays intact.
    const backupKey = `foundry:backup:day${dayIdx}:week${weekIdx}:v1`;
    if (localStorage.getItem(backupKey) === null) {
      try {
        localStorage.setItem(backupKey, v1Raw);
      } catch (e) {
        console.warn('[Foundry] migration: failed to write v1 backup', e);
      }
    }

    const { v2, skipped } = migrateDayDataToV2(v1, dayIdx, {
      tdeIdMap,
      programExIds,
    });

    for (const s of skipped) {
      result.orphanSlots.push({
        dayIdx,
        weekIdx,
        exIdx: s.exIdx,
        reason: s.reason,
      });
    }

    saveDayWeekV2(dayIdx, weekIdx, v2);
    result.migrated++;
  }

  return result;
}
