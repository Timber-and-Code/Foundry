import type { Exercise, TrainingDay } from '../types';

/**
 * The weekly coverage rule: an auto-built program trains every major muscle
 * group DIRECTLY at least once a week.
 *
 * The generator fills each day's few accessory slots in a fixed muscle order,
 * so on short sessions it ran out of slots before it reached the arms —
 * structurally, not by bad luck. Measured over 60 builds per setting:
 * Upper/Lower 4-day at 60 min left out Triceps 100% of the time; at 45 min
 * Triceps, Biceps AND Calves; Full Body 3-day at 45 min the same three; PPL at
 * 45 min Biceps and Calves. A lifter ran two mesos with no triceps work.
 *
 * This pass runs last. For each missing group, in priority order, it swaps in
 * a direct exercise for it, replacing an accessory whose own group is trained
 * more than once that week (so nothing else becomes uncovered) on a day where
 * the new lift belongs. Anchors are never replaced, and nothing is appended:
 * session length stays what the lifter asked for. Only a primary `muscle`
 * counts as direct work — a bench press does not "cover" triceps.
 *
 * It only ever runs on programs The Foundry generated. A hand-built or
 * reviewed program (`aiDays`, manual builder) is returned verbatim.
 */

interface PoolExercise {
  id?: string | number;
  muscle?: string;
  anchor?: boolean;
  pattern?: string;
  tag?: string;
}

/** Priority order — when donor slots run out, the groups at the end lose. */
export const REQUIRED_GROUPS: { name: string; muscles: string[] }[] = [
  { name: 'Chest', muscles: ['Chest'] },
  { name: 'Back', muscles: ['Back', 'Lats'] },
  { name: 'Quads', muscles: ['Quads'] },
  { name: 'Posterior chain', muscles: ['Hamstrings', 'Glutes'] },
  { name: 'Shoulders', muscles: ['Shoulders'] },
  { name: 'Triceps', muscles: ['Triceps'] },
  { name: 'Biceps', muscles: ['Biceps'] },
  { name: 'Calves', muscles: ['Calves'] },
];

const PUSH = ['Chest', 'Shoulders', 'Triceps'];
const PULL = ['Back', 'Lats', 'Biceps', 'Traps'];
const LEGS = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors'];
const DAY_MUSCLES: Record<string, string[]> = {
  PUSH, PULL, LEGS, LOWER: LEGS, UPPER: [...PUSH, ...PULL], ARMS: ['Biceps', 'Triceps'],
  FULL: [...PUSH, ...PULL, ...LEGS],
};

const groupOf = (muscle: string | undefined) => REQUIRED_GROUPS.find((g) => g.muscles.includes(muscle || ''));

export function missingGroups(days: TrainingDay[]): string[] {
  const hit = new Set(days.flatMap((d) => d.exercises.map((e) => groupOf(e.muscle)?.name)));
  return REQUIRED_GROUPS.filter((g) => !hit.has(g.name)).map((g) => g.name);
}

export function ensureWeeklyCoverage<T extends PoolExercise>(
  days: TrainingDay[],
  pool: T[],
  toExercise: (e: T) => Exercise,
  shuffle: <U>(a: U[]) => U[] = (a) => a,
): TrainingDay[] {
  const out = days.map((d) => ({ ...d, exercises: [...d.exercises] }));
  const placed = new Set<string>(); // "day:idx" slots this pass filled — never donors

  for (const group of REQUIRED_GROUPS) {
    const counts = new Map<string, number>();
    out.forEach((d) => d.exercises.forEach((e) => {
      const g = groupOf(e.muscle)?.name;
      if (g) counts.set(g, (counts.get(g) || 0) + 1);
    }));
    if ((counts.get(group.name) || 0) > 0) continue;

    const usedIds = new Set(out.flatMap((d) => d.exercises.map((e) => String(e.id))));
    const candidates = shuffle(
      pool.filter((e) => !e.anchor && group.muscles.includes(e.muscle || '') && !usedIds.has(String(e.id))),
    );
    // Direct work first: an isolation for arms/calves rather than another compound.
    const pick = candidates.find((e) => e.pattern === 'isolation') || candidates[0];
    if (!pick) continue; // nothing for this group with the lifter's equipment

    // Donor: a non-anchor on a day this muscle belongs to, whose own group is
    // trained again elsewhere this week. Most-repeated group first, later days first.
    let best: { d: number; i: number; n: number } | null = null;
    const belongs = (day: TrainingDay) => {
      const allowed = DAY_MUSCLES[String(day.tag || '').toUpperCase()] || DAY_MUSCLES.FULL;
      return group.muscles.some((m) => allowed.includes(m));
    };
    // A Push/Pull split folds leg work into its push and pull days, so no day
    // is tagged for calves — when the muscle has no home, any day will do.
    const hasHome = out.some(belongs);
    out.forEach((day, d) => {
      if (hasHome && !belongs(day)) return;
      day.exercises.forEach((e, i) => {
        if (e.anchor || placed.has(`${d}:${i}`)) return;
        const g = groupOf(e.muscle)?.name;
        const n = g ? counts.get(g) || 0 : 99; // ungrouped (core, traps…) is the first to go
        if (n < 2) return;
        if (!best || n > best.n || (n === best.n && d >= best.d)) best = { d, i, n };
      });
    });
    if (!best) continue;
    const slot = best as { d: number; i: number };
    out[slot.d].exercises[slot.i] = toExercise(pick);
    placed.add(`${slot.d}:${slot.i}`);
  }
  return out;
}
