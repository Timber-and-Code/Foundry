// ─── One-time recovery: a drifted profile.splitType ────────────────────────
// Mesocycle rows written to Supabase before the 2026-04-27 `appSplitToEnum`
// fix stored a wrong `split_type` enum — e.g. an Upper/Lower meso recorded as
// 'PPL'. Every sync pull echoed that back over the local profile.splitType,
// and the meso owner's app pushed it straight back: a self-perpetuating loop
// that pinned the banner + profile drawer to PUSH/PULL/LEGS while the actual
// program stayed correct.
//
// The stored program's day LABELS are the ground truth (a synced program's
// day TAGS are rebuilt from exercise tags and lose UPPER/LOWER). This repair
// runs once and only corrects UNAMBIGUOUS cases: "Upper/Lower" and "Full
// Body" labels can't belong to a PPL or Traditional program. PPL /
// Traditional labels are deliberately left alone — a 4-day Traditional split
// is indistinguishable from PPL, so "repairing" it would risk a wrong guess.

import { store } from './storage';
import { saveProfile } from './training';
import { resetMesoCache } from '../data/constants';
import type { TrainingDay } from '../types';

// v2: the v1 repair classified from day TAGS, but a synced program's day
// tag is rebuilt from the first exercise's tag (PUSH/PULL/LEGS only) — it
// never carries UPPER/LOWER, so v1 could not classify an Upper/Lower meso.
// v2 classifies from day LABELS ("Upper A", "Lower B"…), which survive the
// sync round-trip. New flag key so devices that latched v1 re-run.
const REPAIR_FLAG = 'foundry:flag:splitType_repair_v2';

export interface SplitRepairResult {
  repaired: boolean;
  from?: string;
  to?: string;
}

/**
 * Classify a split from program day LABELS — but ONLY when the labels make
 * the answer unambiguous. Returns null for PPL / Traditional labels (a
 * 4-day Traditional looks like PPL, so it's never auto-corrected) and for
 * anything that can't be confidently named. Day labels ("Upper A",
 * "Lower B", "Full Body A") survive the sync round-trip; day tags do not.
 */
export function classifyUnambiguousSplit(
  labels: readonly string[],
): 'upper_lower' | 'full_body' | null {
  const text = labels.join(' ').toLowerCase();
  // Any PPL- or Traditional-style day word means the split is NOT
  // unambiguously upper/lower or full-body — don't guess.
  const looksPplOrTraditional =
    /\b(push|pull|legs?|chest|back|shoulders?|arms?|quads?|hams?|hamstrings?|glutes?|biceps?|triceps?|delts?)\b/.test(
      text,
    );
  const hasUpperLower = /\b(upper|lower)\b/.test(text);
  const hasFull = /\bfull\b/.test(text);
  if (hasUpperLower && !looksPplOrTraditional) return 'upper_lower';
  if (hasFull && !hasUpperLower && !looksPplOrTraditional) return 'full_body';
  return null;
}

/**
 * One-shot, idempotent. Corrects `profile.splitType` from the stored
 * program's day labels when it has unambiguously drifted, then persists +
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

    const labels = program
      .map((d) => String(d?.label || ''))
      .filter((l) => l.length > 0);
    const derived = classifyUnambiguousSplit(labels);

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
