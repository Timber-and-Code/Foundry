/**
 * Reorder persistence.
 *
 * The dangerous part isn't moving the exercises — it's that
 * `foundry:exov:d{day}[:w{week}]:ex{slot}` pins a swap to a SLOT INDEX. Move
 * the program without moving the overrides and someone's swap silently lands
 * on a different lift. Most of this file is about that.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: () => ({}) },
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import {
  permutationFromIds,
  isIdentity,
  permuteOverridesForDay,
  commitReorderLocal,
  pushReorderRemote,
} from '../reorderPersistence';

const program = () => [
  {
    dayNum: 1,
    label: 'FULL BODY A',
    tag: 'FULL',
    exercises: [
      { id: 'a', name: 'A', sets: 3, reps: '8' },
      { id: 'b', name: 'B', sets: 3, reps: '8' },
      { id: 'c', name: 'C', sets: 3, reps: '8' },
    ],
  },
  {
    dayNum: 2,
    label: 'FULL BODY B',
    tag: 'FULL',
    exercises: [
      { id: 'x', name: 'X', sets: 3, reps: '8' },
      { id: 'y', name: 'Y', sets: 3, reps: '8' },
    ],
  },
];

const seed = () =>
  localStorage.setItem('foundry:storedProgram', JSON.stringify(program()));

const idsOf = (dayIdx: number) => {
  const raw = JSON.parse(localStorage.getItem('foundry:storedProgram')!);
  return raw[dayIdx].exercises.map((e: { id: string }) => e.id);
};

describe('permutationFromIds', () => {
  it('maps each new position back to where it came from', () => {
    // ['a','b','c'] dragged to ['c','a','b']
    expect(permutationFromIds(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual([2, 0, 1]);
  });

  it('recognises no-change as the identity', () => {
    const perm = permutationFromIds(['a', 'b', 'c'], ['a', 'b', 'c'])!;
    expect(isIdentity(perm)).toBe(true);
  });

  it('refuses when an exercise was added or removed mid-session', () => {
    expect(permutationFromIds(['a', 'b'], ['a', 'b', 'c'])).toBeNull();
    expect(permutationFromIds(['a', 'b', 'c'], ['a', 'b'])).toBeNull();
  });

  it('refuses when the same exercise occupies two slots', () => {
    // Which 'a' moved where is unanswerable, and a wrong answer misplaces
    // that slot's swap override.
    expect(permutationFromIds(['a', 'a', 'b'], ['b', 'a', 'a'])).toBeNull();
  });

  it('refuses an unrecognised exercise', () => {
    expect(permutationFromIds(['a', 'b', 'c'], ['a', 'b', 'z'])).toBeNull();
  });
});

describe('permuteOverridesForDay', () => {
  beforeEach(() => localStorage.clear());

  it('carries a meso-wide swap to the slot its exercise moved to', () => {
    localStorage.setItem('foundry:exov:d0:ex0', 'swapped_a');
    // ['a','b','c'] → ['c','a','b']: old slot 0 is now slot 1.
    permuteOverridesForDay(0, [2, 0, 1]);

    expect(localStorage.getItem('foundry:exov:d0:ex1')).toBe('swapped_a');
    expect(localStorage.getItem('foundry:exov:d0:ex0')).toBeNull();
  });

  it('carries week-scoped swaps too, keeping them week-scoped', () => {
    localStorage.setItem('foundry:exov:d0:w2:ex0', 'this_week_only');
    permuteOverridesForDay(0, [2, 0, 1]);

    expect(localStorage.getItem('foundry:exov:d0:w2:ex1')).toBe('this_week_only');
    expect(localStorage.getItem('foundry:exov:d0:w2:ex0')).toBeNull();
    // Must not be promoted into a meso-wide override.
    expect(localStorage.getItem('foundry:exov:d0:ex1')).toBeNull();
  });

  it('does not swallow overrides when slots trade places', () => {
    // The in-place hazard: writing slot 0 before reading slot 1 loses one.
    localStorage.setItem('foundry:exov:d0:ex0', 'first');
    localStorage.setItem('foundry:exov:d0:ex1', 'second');

    permuteOverridesForDay(0, [1, 0]);

    expect(localStorage.getItem('foundry:exov:d0:ex0')).toBe('second');
    expect(localStorage.getItem('foundry:exov:d0:ex1')).toBe('first');
  });

  it('leaves other days alone', () => {
    localStorage.setItem('foundry:exov:d0:ex0', 'day0');
    localStorage.setItem('foundry:exov:d1:ex0', 'day1');

    permuteOverridesForDay(0, [2, 0, 1]);

    expect(localStorage.getItem('foundry:exov:d1:ex0')).toBe('day1');
  });

  it('is not fooled by a day index that shares a prefix', () => {
    // d1 must not match the regex for d10 (or vice versa).
    localStorage.setItem('foundry:exov:d10:ex0', 'day10');
    permuteOverridesForDay(1, [1, 0]);
    expect(localStorage.getItem('foundry:exov:d10:ex0')).toBe('day10');
  });
});

describe('commitReorderLocal', () => {
  beforeEach(() => localStorage.clear());

  it('writes the new order to the stored program', () => {
    seed();
    const commit = commitReorderLocal(0, [2, 0, 1]);

    expect(commit!.exercises.map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(idsOf(0)).toEqual(['c', 'a', 'b']);
  });

  it('leaves every other day untouched', () => {
    seed();
    commitReorderLocal(0, [2, 0, 1]);
    expect(idsOf(1)).toEqual(['x', 'y']);
  });

  it('moves the swap overrides in the same breath', () => {
    seed();
    localStorage.setItem('foundry:exov:d0:ex2', 'swapped_c');

    commitReorderLocal(0, [2, 0, 1]);

    // 'c' moved from slot 2 to slot 0, so its override must follow.
    expect(idsOf(0)[0]).toBe('c');
    expect(localStorage.getItem('foundry:exov:d0:ex0')).toBe('swapped_c');
    expect(localStorage.getItem('foundry:exov:d0:ex2')).toBeNull();
  });

  it('declines the identity permutation rather than writing a no-op', () => {
    seed();
    expect(commitReorderLocal(0, [0, 1, 2])).toBeNull();
  });

  it('declines when the permutation does not match the stored day', () => {
    seed();
    // Day 0 holds 3 exercises; a 2-length permutation is stale state.
    expect(commitReorderLocal(0, [1, 0])).toBeNull();
    expect(idsOf(0)).toEqual(['a', 'b', 'c']);
  });

  it('declines when there is no stored program', () => {
    expect(commitReorderLocal(0, [1, 0])).toBeNull();
  });
});

describe('pushReorderRemote', () => {
  beforeEach(() => localStorage.clear());

  it('reports success when there is no meso to sync to', async () => {
    await expect(
      pushReorderRemote(0, [{ id: 'a' }, { id: 'b' }] as never),
    ).resolves.toBe(true);
  });

  it('does nothing for an empty day', async () => {
    localStorage.setItem('foundry:active_meso_id', 'meso-1');
    await expect(pushReorderRemote(0, [] as never)).resolves.toBe(true);
  });
});
