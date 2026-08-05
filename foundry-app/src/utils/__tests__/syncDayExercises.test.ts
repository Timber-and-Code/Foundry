/**
 * Tests for syncDayExercisesRemote — the push that "Rebuild upcoming days"
 * was missing.
 *
 * ensureTrainingStructureRemote populates a meso's training_day_exercises
 * once and early-returns forever after; syncExerciseSwapRemote only ever
 * touches one slot. So a locally regenerated day reached the server through
 * no path at all: the rebuild wrote foundry:storedProgram, the next
 * pullTrainingStructure rebuilt that key from the untouched remote rows, and
 * the new day reverted. The button reported success and changed nothing.
 *
 * Same table-aware Supabase mock as syncExerciseSwap.test.ts, for the same
 * reason: the shared harness in sync.test.ts has no .is()/.in()/.insert().
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

interface RecordedCall {
  table: string;
  op: 'select' | 'update' | 'insert';
  payload?: unknown;
  filters: Record<string, unknown>;
}

const calls: RecordedCall[] = [];
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
      insert: (payload: unknown) => {
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

import { syncDayExercisesRemote } from '../sync';

const NEW_DAY = [
  { id: 'bb_back_squat', sets: 3, reps: '5-8', anchor: true },
  { id: 'db_incline_bench', sets: 3, reps: '8-12' },
  { id: 'standing_calf_raise', sets: 3, reps: '10-15' },
];

const seedTrainingDay = () => {
  selectResults['training_days'] = [{ data: [{ id: 'td-1' }], error: null }];
};

const tdeCalls = () => calls.filter((c) => c.table === 'training_day_exercises');
const insertedRows = () =>
  (tdeCalls().find((c) => c.op === 'insert')?.payload || []) as Record<string, unknown>[];

describe('syncDayExercisesRemote', () => {
  beforeEach(() => {
    calls.length = 0;
    selectResults = {};
    insertResult = { error: null };
    localStorage.clear();
    seedTrainingDay();
  });

  it('inserts the new day and supersedes every previous live row', async () => {
    selectResults['training_day_exercises'] = [
      {
        data: [
          { id: 'tde-a', exercise_id: 'bb_decline_bench', sort_order: 0, modifier: null, is_warmup: false },
          { id: 'tde-b', exercise_id: 'db_decline_bench', sort_order: 1, modifier: null, is_warmup: false },
        ],
        error: null,
      },
    ];

    const ok = await syncDayExercisesRemote('meso-1', 2, NEW_DAY);
    expect(ok).toBe(true);

    const insert = tdeCalls().find((c) => c.op === 'insert');
    const update = tdeCalls().find((c) => c.op === 'update');

    expect(insertedRows().map((r) => r.exercise_id)).toEqual([
      'bb_back_squat',
      'db_incline_bench',
      'standing_calf_raise',
    ]);
    expect(insertedRows().map((r) => r.sort_order)).toEqual([0, 1, 2]);
    expect(insert?.payload).toBeDefined();

    // Old rows keep their exercise_id — that pair is how workout_sets find
    // their slot. Only replaced_at is stamped.
    expect(update?.payload).toHaveProperty('replaced_at');
    expect(update?.payload).not.toHaveProperty('exercise_id');
    expect(update?.filters.id).toEqual(['tde-a', 'tde-b']);
  });

  it('retires trailing rows when the rebuilt day is shorter', async () => {
    // Otherwise the extra old slots stay live and the day comes back longer
    // than the program says it is.
    selectResults['training_day_exercises'] = [
      {
        data: [
          { id: 'tde-a', exercise_id: 'a', sort_order: 0, modifier: null, is_warmup: false },
          { id: 'tde-b', exercise_id: 'b', sort_order: 1, modifier: null, is_warmup: false },
          { id: 'tde-c', exercise_id: 'c', sort_order: 2, modifier: null, is_warmup: false },
          { id: 'tde-d', exercise_id: 'd', sort_order: 3, modifier: null, is_warmup: false },
        ],
        error: null,
      },
    ];

    await syncDayExercisesRemote('meso-1', 0, NEW_DAY.slice(0, 2));

    const update = tdeCalls().find((c) => c.op === 'update');
    expect(update?.filters.id).toEqual(['tde-a', 'tde-b', 'tde-c', 'tde-d']);
  });

  it('carries slot attributes across, since they belong to the slot', async () => {
    selectResults['training_day_exercises'] = [
      {
        data: [
          { id: 'tde-a', exercise_id: 'old', sort_order: 0, modifier: 'paused', is_warmup: true },
        ],
        error: null,
      },
    ];

    await syncDayExercisesRemote('meso-1', 0, [NEW_DAY[0]]);

    expect(insertedRows()[0]).toMatchObject({ modifier: 'paused', is_warmup: true });
  });

  it('is a no-op when the live rows already match', async () => {
    // A retry, or a rebuild that lands on the same picks. Another generation
    // of superseded rows is one more ambiguous pair for the history mapper.
    selectResults['training_day_exercises'] = [
      {
        data: NEW_DAY.map((ex, i) => ({
          id: `tde-${i}`,
          exercise_id: ex.id,
          sort_order: i,
          modifier: null,
          is_warmup: false,
        })),
        error: null,
      },
    ];

    const ok = await syncDayExercisesRemote('meso-1', 0, NEW_DAY);

    expect(ok).toBe(true);
    expect(tdeCalls().some((c) => c.op === 'insert')).toBe(false);
    expect(tdeCalls().some((c) => c.op === 'update')).toBe(false);
  });

  it('does not touch a meso it does not own', async () => {
    // training_days is filtered by user_id, so a shared-meso member gets no
    // row back and must not rewrite the owner's program.
    selectResults['training_days'] = [{ data: [], error: null }];

    const ok = await syncDayExercisesRemote('meso-1', 0, NEW_DAY);

    expect(ok).toBe(true);
    expect(tdeCalls()).toHaveLength(0);
  });

  it('reports failure so the caller can warn the rebuild will revert', async () => {
    selectResults['training_day_exercises'] = [
      { data: [{ id: 'tde-a', exercise_id: 'old', sort_order: 0, modifier: null, is_warmup: false }], error: null },
    ];
    insertResult = { error: { message: 'network down' } };

    const ok = await syncDayExercisesRemote('meso-1', 0, NEW_DAY);

    expect(ok).toBe(false);
    // Insert failed, so nothing was retired — the old day is still intact.
    expect(tdeCalls().some((c) => c.op === 'update')).toBe(false);
  });
});
