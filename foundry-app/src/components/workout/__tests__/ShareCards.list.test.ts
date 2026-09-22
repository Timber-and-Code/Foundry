/**
 * The session share card lists EVERY lift with a working set. It used to
 * keep four and drop the rest, which read as "I did four exercises". Rows
 * scale down to fit the count instead.
 */
import { describe, it, expect } from 'vitest';
import { listScale, topSets } from '../share/ShareCards';
import type { WorkoutCompleteStats } from '../WorkoutCompleteModal';

const stats = (n: number) =>
  ({
    breakdown: Array.from({ length: n }, (_, i) => ({
      name: `Lift ${i + 1}`,
      anchor: i === n - 1,
      sets: [
        { weight: 45, reps: 10, warmup: true },
        { weight: 100 + i, reps: 8, warmup: false },
        { weight: 100 + i, reps: 6, warmup: false },
      ],
    })),
  }) as unknown as WorkoutCompleteStats;

describe('share card lift list', () => {
  it('includes every lift, in session order, with its top working set', () => {
    const rows = topSets(stats(7));
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.name)).toEqual(['Lift 1', 'Lift 2', 'Lift 3', 'Lift 4', 'Lift 5', 'Lift 6', 'Lift 7']);
    expect(rows[0].text).toBe('100 × 8');
  });

  it('drops a lift with only warmups', () => {
    const s = stats(2);
    (s.breakdown as { sets: { warmup: boolean }[] }[])[1].sets.forEach((x) => (x.warmup = true));
    expect(topSets(s)).toHaveLength(1);
  });

  it('rows stay full size up to five lifts and shrink from there, never below half', () => {
    expect(listScale(0)).toBe(1);
    expect(listScale(4)).toBe(1);
    expect(listScale(5)).toBe(1);
    expect(listScale(6)).toBeLessThan(1);
    expect(listScale(6)).toBeGreaterThan(0.85);
    expect(listScale(8)).toBeLessThan(listScale(6));
    expect(listScale(20)).toBe(0.5);
  });
});
