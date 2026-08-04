/**
 * Tests for syncExerciseSwapRemote — the supersede-don't-overwrite contract.
 *
 * This path used to UPDATE training_day_exercises.exercise_id in place,
 * which destroyed the only mapping from the outgoing exercise's
 * workout_sets back to a slot. pullWorkoutHistory drops any set whose
 * (training_day_id, exercise_id) has no tde row, so every set logged
 * against a swapped-out exercise disappeared on the next pull. These tests
 * pin the replacement behaviour: stamp the old row, insert a new one.
 *
 * Lives apart from sync.test.ts because it needs a table-aware Supabase
 * mock with .is()/.in()/.insert() and awaitable chains, which the shared
 * harness there deliberately doesn't have.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

interface RecordedCall {
  table: string;
  op: 'select' | 'update' | 'insert';
  payload?: Record<string, unknown>;
  filters: Record<string, unknown>;
}

const calls: RecordedCall[] = [];
// Per-table queued results, shifted off as each select resolves.
let selectResults: Record<string, Array<{ data: unknown; error: unknown }>> = {};
let insertResult: { error: unknown } = { error: null };

const makeChain = (call: RecordedCall, resolve: () => { data: unknown; error: unknown }) => {
  const chain: Record<string, unknown> = {
    eq: (col: string, val: unknown) => {
      call.filters[col] = val;
      return chain;
    },
    in: (col: string, val: unknown) => {
      call.filters[col] = val;
      return chain;
    },
    is: (col: string, val: unknown) => {
      call.filters[col] = val;
      return chain;
    },
    order: () => chain,
    limit: () => Promise.resolve(resolve()),
    then: (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled),
  };
  return chain;
};

vi.mock('../supabase.js', () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: (table: string) => ({
      select: () => {
        const call: RecordedCall = { table, op: 'select', filters: {} };
        calls.push(call);
        return makeChain(call, () => {
          const queue = selectResults[table] || [];
          return queue.shift() || { data: [], error: null };
        });
      },
      update: (payload: Record<string, unknown>) => {
        const call: RecordedCall = { table, op: 'update', payload, filters: {} };
        calls.push(call);
        return makeChain(call, () => ({ data: null, error: null }));
      },
      insert: (payload: Record<string, unknown>) => {
        const call: RecordedCall = { table, op: 'insert', payload, filters: {} };
        calls.push(call);
        return Promise.resolve(insertResult);
      },
    }),
  },
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import { syncExerciseSwapRemote } from '../sync';

const NEW_EX = { id: 'incline_db_press', sets: 3, reps: '8-12', progression: 'double' };

// training_days lookup always resolves to one day; tde queue is per-test.
const seedTrainingDay = () => {
  selectResults['training_days'] = [{ data: [{ id: 'td-1' }], error: null }];
};

const tdeCalls = () => calls.filter((c) => c.table === 'training_day_exercises');

describe('syncExerciseSwapRemote', () => {
  beforeEach(() => {
    calls.length = 0;
    selectResults = {};
    insertResult = { error: null };
    localStorage.clear();
    seedTrainingDay();
  });

  it('supersedes the outgoing row instead of overwriting its exercise_id', async () => {
    selectResults['training_day_exercises'] = [
      { data: [{ id: 'tde-old', exercise_id: 'barbell_bench' }], error: null },
    ];

    await syncExerciseSwapRemote('meso-1', 0, 2, NEW_EX);

    const update = tdeCalls().find((c) => c.op === 'update');
    const insert = tdeCalls().find((c) => c.op === 'insert');

    // The old row keeps its exercise_id — that mapping is what history reads.
    expect(update?.payload).toHaveProperty('replaced_at');
    expect(update?.payload).not.toHaveProperty('exercise_id');
    expect(update?.filters.id).toEqual(['tde-old']);

    // The new exercise lands at the same slot as a live row.
    expect(insert?.payload).toMatchObject({
      exercise_id: 'incline_db_press',
      sort_order: 2,
      training_day_id: 'td-1',
      user_id: 'user-1',
    });
    expect(insert?.payload?.replaced_at).toBeUndefined();
  });

  it('only considers the live occupant of the slot', async () => {
    selectResults['training_day_exercises'] = [
      { data: [{ id: 'tde-old', exercise_id: 'barbell_bench' }], error: null },
    ];

    await syncExerciseSwapRemote('meso-1', 0, 2, NEW_EX);

    const select = tdeCalls().find((c) => c.op === 'select');
    expect(select?.filters.replaced_at).toBeNull();
    expect(select?.filters.sort_order).toBe(2);
  });

  it('is a no-op when the slot already holds the target exercise', async () => {
    selectResults['training_day_exercises'] = [
      { data: [{ id: 'tde-live', exercise_id: 'incline_db_press' }], error: null },
    ];

    await syncExerciseSwapRemote('meso-1', 0, 2, NEW_EX);

    // No bogus superseded row, no duplicate insert.
    expect(tdeCalls().some((c) => c.op === 'update')).toBe(false);
    expect(tdeCalls().some((c) => c.op === 'insert')).toBe(false);
  });

  it('inserts without superseding when the slot is empty', async () => {
    selectResults['training_day_exercises'] = [{ data: [], error: null }];

    await syncExerciseSwapRemote('meso-1', 0, 2, NEW_EX);

    expect(tdeCalls().some((c) => c.op === 'update')).toBe(false);
    expect(tdeCalls().find((c) => c.op === 'insert')?.payload).toMatchObject({
      exercise_id: 'incline_db_press',
    });
  });

  it('leaves the old row live when the insert fails', async () => {
    selectResults['training_day_exercises'] = [
      { data: [{ id: 'tde-old', exercise_id: 'barbell_bench' }], error: null },
    ];
    insertResult = { error: { message: 'network' } };

    await syncExerciseSwapRemote('meso-1', 0, 2, NEW_EX);

    // Insert-before-retire is what makes this safe: the failure leaves the
    // slot still occupied by the outgoing exercise. Retiring first would
    // need a compensating write that can fail for the same reason the
    // insert just did, and an empty slot reads as "exercise deleted".
    expect(tdeCalls().some((c) => c.op === 'update')).toBe(false);
  });

  it('inserts before it retires', async () => {
    selectResults['training_day_exercises'] = [
      { data: [{ id: 'tde-old', exercise_id: 'barbell_bench' }], error: null },
    ];

    await syncExerciseSwapRemote('meso-1', 0, 2, NEW_EX);

    const ops = tdeCalls().filter((c) => c.op !== 'select').map((c) => c.op);
    expect(ops).toEqual(['insert', 'update']);
  });

  it('carries the slot\'s modifier and warmup flag onto the replacement', async () => {
    // These are properties of the SLOT, not the exercise. The old in-place
    // UPDATE preserved them for free by keeping the row; an append-only
    // swap drops them unless they're copied across.
    selectResults['training_day_exercises'] = [
      {
        data: [
          {
            id: 'tde-old',
            exercise_id: 'barbell_bench',
            modifier: 'paused',
            is_warmup: true,
          },
        ],
        error: null,
      },
    ];

    await syncExerciseSwapRemote('meso-1', 0, 2, NEW_EX);

    expect(tdeCalls().find((c) => c.op === 'insert')?.payload).toMatchObject({
      modifier: 'paused',
      is_warmup: true,
    });
  });

  it('repoints the tde id cache at the new row so notes follow the swap', async () => {
    localStorage.setItem(
      'foundry:tde_ids:meso-1',
      JSON.stringify({ '0:2': 'tde-old', '0:3': 'tde-other' }),
    );
    selectResults['training_day_exercises'] = [
      { data: [{ id: 'tde-old', exercise_id: 'barbell_bench' }], error: null },
    ];

    await syncExerciseSwapRemote('meso-1', 0, 2, NEW_EX);

    const cache = JSON.parse(localStorage.getItem('foundry:tde_ids:meso-1') || '{}');
    const insertedId = tdeCalls().find((c) => c.op === 'insert')?.payload?.id;
    expect(cache['0:2']).toBe(insertedId);
    expect(cache['0:2']).not.toBe('tde-old');
    // Untouched slots keep their ids.
    expect(cache['0:3']).toBe('tde-other');
  });
});
