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
 *   ARMS           → [PUSH, PULL]   // triceps are PUSH, biceps are PULL
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
    case 'ARMS':
      return ['PUSH', 'PULL'];
    default:
      return ['PUSH', 'PULL', 'LEGS', 'CORE'];
  }
}

/**
 * Movement families — sibling muscle tags that should appear together in
 * the swap picker so variants of the same primary movement aren't split
 * across collapsed accordion groups.
 *
 * Concrete example: bodyweight + assisted Pull-ups are tagged
 * `muscle: 'Back'`, but Lat Pulldown / Single-Arm Pulldown / Pullover are
 * tagged `muscle: 'Lats'`. From the lifter's perspective these are all
 * the same swap candidate set — vertical pulls. Swapping a Pull-up for a
 * Lat Pulldown was previously hidden in a different collapsed group.
 *
 * `bucketFor(muscle)` returns the canonical bucket label; everything in
 * that bucket renders in one accordion group. Muscles not listed map to
 * themselves (back-compat — no behavioral drift for biceps/triceps/etc).
 *
 * The display label uses the FIRST muscle in the family list, which
 * means an existing autoExpandMuscle of 'Back' still works (we resolve
 * it through the same bucket). See #4 in the 2.8.0 fix list.
 */
const MUSCLE_FAMILIES: string[][] = [
  // Vertical / horizontal pull family — all of these are interchangeable
  // candidates when swapping a back-day exercise.
  ['Back', 'Lats', 'Traps'],
  // Quad-dominant lower family — squats / leg press / lunges all live
  // here. (Currently most leg exercises share `muscle: 'Quads'`, but a
  // few are tagged 'Glutes' — keep them visible together.)
  ['Quads', 'Glutes'],
];

/** Map an arbitrary muscle to its display bucket (first family member). */
export function bucketFor(muscle: string): string {
  for (const fam of MUSCLE_FAMILIES) {
    if (fam.includes(muscle)) return fam[0];
  }
  return muscle;
}

/**
 * Filter + group an exercise DB by day tag, ready to pass into the swap
 * picker as `Record<muscle, Exercise[]>`. Related muscle tags are
 * collapsed into one bucket via `MUSCLE_FAMILIES` so movement variants
 * sit in the same accordion group (#4).
 *
 * `sourceTag` (optional) is the EXERCISE_DB tag of the exercise the user is
 * currently swapping out. We always allow exercises sharing that tag so
 * like-for-like swaps remain available even when `dayTag` has drifted —
 * e.g. a Back (PULL) exercise stuck on a stale PUSH-tagged day still gets
 * back/pull options. Without this, the swap picker would silently exclude
 * the exact muscle the lifter is trying to replace.
 */
export function buildSwapGroups(
  db: ExerciseEntry[],
  dayTag: string | undefined | null,
  sourceTag?: string | null,
): Record<string, ExerciseEntry[]> {
  const allow = new Set(tagsForDay(dayTag));
  if (sourceTag) allow.add(sourceTag.toUpperCase());
  const groups: Record<string, ExerciseEntry[]> = {};
  for (const ex of db) {
    if (!allow.has(ex.tag || '')) continue;
    const m = bucketFor(ex.muscle || 'other');
    if (!groups[m]) groups[m] = [];
    groups[m].push(ex);
  }
  return groups;
}
