/**
 * Swap-picker muscle-group helpers.
 *
 * EXERCISE_DB only tags exercises with PUSH / PULL / LEGS / CORE. Split-level
 * day tags (UPPER / LOWER / FULL / CUSTOM) don't match anything in the DB
 * directly, so they need to be mapped to the real tag set before filtering.
 *
 * See `foundry/beat2_preview_fixes.md` #2 in memory for the canonical mapping.
 */
import type { ExerciseEntry } from '../data/exerciseDB';

/**
 * Given a day-level tag, return the set of EXERCISE_DB tags that should
 * populate the swap picker.
 *
 *   PUSH           → [PUSH, LEGS]   // push days can include a squat
 *   PULL           → [PULL, LEGS]   // pull days can include a hinge
 *   LEGS           → [LEGS]
 *   UPPER          → [PUSH, PULL]
 *   LOWER          → [LEGS]
 *   FULL / CUSTOM  → [PUSH, PULL, LEGS, CORE]   (everything)
 *   anything else  → same fallback              (safest default)
 */
export function tagsForDay(dayTag: string | undefined | null): string[] {
  switch ((dayTag || '').toUpperCase()) {
    case 'PUSH':
      return ['PUSH', 'LEGS'];
    case 'PULL':
      return ['PULL', 'LEGS'];
    case 'LEGS':
      return ['LEGS'];
    case 'UPPER':
      return ['PUSH', 'PULL'];
    case 'LOWER':
      return ['LEGS'];
    default:
      return ['PUSH', 'PULL', 'LEGS', 'CORE'];
  }
}

/**
 * Filter + group an exercise DB by day tag, ready to pass into the swap
 * picker as `Record<muscle, Exercise[]>`.
 */
export function buildSwapGroups(
  db: ExerciseEntry[],
  dayTag: string | undefined | null,
): Record<string, ExerciseEntry[]> {
  const allow = new Set(tagsForDay(dayTag));
  const groups: Record<string, ExerciseEntry[]> = {};
  for (const ex of db) {
    if (!allow.has(ex.tag || '')) continue;
    const m = ex.muscle || 'other';
    if (!groups[m]) groups[m] = [];
    groups[m].push(ex);
  }
  return groups;
}
