// ─── One-time recovery: a drifted profile.splitType ────────────────────────
// Mesocycle rows written to Supabase before the 2026-04-27 `appSplitToEnum`
// fix stored a wrong `split_type` enum — e.g. an Upper/Lower meso recorded as
// 'PPL'. Every sync pull echoed that back over the local profile.splitType,
// and the meso owner's app pushed it straight back: a self-perpetuating loop
// that pinned the banner + profile drawer to PUSH/PULL/LEGS while the actual
// program stayed correct.
//
// The stored program's day tags are the ground truth. This repair runs once
// and only corrects UNAMBIGUOUS cases: UPPER/LOWER and FULL day tags cannot
// appear in a PPL or Traditional program. PUSH/PULL/LEGS is deliberately left
// alone — a 4-day Traditional split is byte-identical to PPL by day tags, so
// "repairing" it would risk a wrong guess. Those users keep their stored
// splitType untouched.

import { store } from './storage';
import { saveProfile } from './training';
import { resetMesoCache } from '../data/constants';
import type { TrainingDay } from '../types';

const REPAIR_FLAG = 'foundry:flag:splitType_repair_v1';

export interface SplitRepairResult {
  repaired: boolean;
  from?: string;
  to?: string;
}

/**
 * Classify a split from program day tags — but ONLY when the tags make the
 * answer unambiguous. Returns null for PPL-style tags (could be PPL or a
 * 4-day Traditional) and for anything that can't be confidently named.
 */
export function classifyUnambiguousSplit(
  tags: ReadonlySet<string>,
): 'upper_lower' | 'full_body' | null {
  const hasPPLTag = tags.has('PUSH') || tags.has('PULL') || tags.has('LEGS');
  if ((tags.has('UPPER') || tags.has('LOWER')) && !hasPPLTag) return 'upper_lower';
  if (
    tags.has('FULL') &&
    !hasPPLTag &&
    !tags.has('UPPER') &&
    !tags.has('LOWER')
  ) {
    return 'full_body';
  }
  return null;
}

/**
 * One-shot, idempotent. Corrects `profile.splitType` from the stored
 * program's day tags when it has unambiguously drifted, then persists +
 * syncs via `saveProfile`. Re-running is a no-op once the flag is set.
 *
 * Bails WITHOUT latching the flag when the profile or program isn't in
 * localStorage yet (e.g. exercise DB still lazy-loading), so it retries on
 * the next launch instead of burning its one chance.
 */
export function repairDriftedSplitType(): SplitRepairResult {
  if (store.get(REPAIR_FLAG) === '1') return { repaired: false };
  try {
    const profileRaw = store.get('foundry:profile');
    const programRaw = store.get('foundry:storedProgram');
    if (!profileRaw || !programRaw) return { repaired: false };

    const profile = JSON.parse(profileRaw);
    const program = JSON.parse(programRaw) as TrainingDay[];
    if (!Array.isArray(program) || program.length === 0) return { repaired: false };

    const tags = new Set<string>(
      program
        .map((d) => String(d?.tag || '').toUpperCase())
        .filter((t) => t.length > 0),
    );
    const derived = classifyUnambiguousSplit(tags);

    let result: SplitRepairResult = { repaired: false };
    if (derived && profile.splitType !== derived) {
      result = { repaired: true, from: profile.splitType, to: derived };
      profile.splitType = derived;
      saveProfile(profile); // persists locally + pushes the corrected split
      resetMesoCache();
    }
    // Inspection happened — latch so it never runs again.
    store.set(REPAIR_FLAG, '1');
    return result;
  } catch {
    return { repaired: false };
  }
}
