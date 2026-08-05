/**
 * Shared-meso overlay semantics.
 *
 * A member of someone else's mesocycle can swap an exercise. That swap is an
 * OVERLAY on the owner's program, not a rewrite of it:
 *
 *   - the member sees their pick, the owner never does
 *   - the member's logged sets must resolve to a slot, or pullWorkoutHistory
 *     drops every one of them (this is how Tyler lost 55 sets in prod)
 *
 * Both halves are exercised here through syncExerciseSwapRemote and
 * syncDayExercisesRemote, with a table-aware Supabase mock. The pull-side
 * resolution is covered by resolveOverlaySlots below, which mirrors the
 * ownership-then-recency rule pullTrainingStructure applies.
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
const ME = 'member-1';

const makeChain = (call: RecordedCall, resolve: () => { data: unknown; error: unknown }) => {
  const chain: Record<string, unknown> = {
    eq: (col: string, val: unknown) => { call.filters[col] = val; return chain; },
    in: (col: string, val: unknown) => { call.filters[col] = val; return chain; },
    is: (col: string, val: unknown) => { call.filters[col] = val; return chain; },
    order: () => chain,
    limit: () => Promise.resolve(resolve()),
    then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
  };
  return chain;
};

vi.mock('../supabase.js', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: ME } }, error: null }) },
    from: (table: string) => ({
      select: () => {
        const call: RecordedCall = { table, op: 'select', filters: {} };
        calls.push(call);
        return makeChain(call, () => (selectResults[table] || []).shift() || { data: [], error: null });
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
vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { syncExerciseSwapRemote, syncDayExercisesRemote } from '../sync';

const tdeCalls = () => calls.filter((c) => c.table === 'training_day_exercises');
const tdCalls = () => calls.filter((c) => c.table === 'training_days');

beforeEach(() => {
  calls.length = 0;
  selectResults = {};
  insertResult = { error: null };
  localStorage.clear();
  selectResults['training_days'] = [{ data: [{ id: 'td-1' }], error: null }];
});

describe('syncExerciseSwapRemote — member overlay', () => {
  it('does not scope the training_days lookup to the caller', () => {
    // The regression that caused the data loss: filtering training_days by
    // user_id meant a member found no row, returned early, and their swap
    // never reached the server at all.
    return syncExerciseSwapRemote('meso-1', 0, 1, { id: 'pullups_assisted', sets: 3, reps: '6-10' }).then(() => {
      const lookup = tdCalls().find((c) => c.op === 'select');
      expect(lookup?.filters.meso_id).toBe('meso-1');
      expect(lookup?.filters.day_index).toBe(0);
      expect(lookup?.filters).not.toHaveProperty('user_id');
    });
  });

  it('writes the overlay row as the member and retires only their own', async () => {
    selectResults['training_day_exercises'] = [
      // my live rows for this slot: none yet (first swap)
      { data: [], error: null },
      // fallback lookup for slot attributes — the owner's row
      { data: [{ id: 'tde-owner', exercise_id: 'weighted_pullups', modifier: 'paused', is_warmup: true }], error: null },
    ];

    await syncExerciseSwapRemote('meso-1', 0, 1, { id: 'pullups_assisted', sets: 3, reps: '6-10' });

    const insert = tdeCalls().find((c) => c.op === 'insert');
    expect(insert?.payload).toMatchObject({
      exercise_id: 'pullups_assisted',
      sort_order: 1,
      user_id: ME,
      // Slot attributes inherited from the owner's row, since the member has
      // none of their own to carry across.
      modifier: 'paused',
      is_warmup: true,
    });

    // The owner's row is NOT retired — the member is layering, not rewriting.
    expect(tdeCalls().some((c) => c.op === 'update')).toBe(false);
  });

  it('reads its live rows scoped to the caller', async () => {
    selectResults['training_day_exercises'] = [
      { data: [{ id: 'tde-mine', exercise_id: 'old', modifier: null, is_warmup: false }], error: null },
    ];

    await syncExerciseSwapRemote('meso-1', 0, 1, { id: 'pullups_assisted', sets: 3, reps: '6-10' });

    const liveLookup = tdeCalls().find((c) => c.op === 'select');
    expect(liveLookup?.filters.user_id).toBe(ME);
    // Having its own row, it retires that one and only that one.
    const update = tdeCalls().find((c) => c.op === 'update');
    expect(update?.filters.id).toEqual(['tde-mine']);
  });
});

describe('syncDayExercisesRemote — member overlay', () => {
  it('reaches the server for a member instead of no-oping', async () => {
    selectResults['training_day_exercises'] = [{ data: [], error: null }];

    const ok = await syncDayExercisesRemote('meso-1', 2, [
      { id: 'bb_flat_bench', sets: 4, reps: '6-10', anchor: true },
      { id: 'kb_calf_raise', sets: 3, reps: '10-15' },
    ]);

    expect(ok).toBe(true);
    const lookup = tdCalls().find((c) => c.op === 'select');
    expect(lookup?.filters).not.toHaveProperty('user_id');

    const rows = tdeCalls().find((c) => c.op === 'insert')?.payload as Record<string, unknown>[];
    expect(rows.map((r) => r.exercise_id)).toEqual(['bb_flat_bench', 'kb_calf_raise']);
    expect(rows.every((r) => r.user_id === ME)).toBe(true);
  });

  it('retires only the caller’s rows', async () => {
    selectResults['training_day_exercises'] = [
      { data: [{ id: 'tde-mine', exercise_id: 'x', sort_order: 0, modifier: null, is_warmup: false }], error: null },
    ];

    await syncDayExercisesRemote('meso-1', 2, [{ id: 'bb_flat_bench', sets: 4, reps: '6-10' }]);

    const liveLookup = tdeCalls().find((c) => c.op === 'select');
    expect(liveLookup?.filters.user_id).toBe(ME);
    expect(tdeCalls().find((c) => c.op === 'update')?.filters.id).toEqual(['tde-mine']);
  });
});

/**
 * Mirrors the per-slot resolution in pullTrainingStructure: ownership decides
 * before recency, so a member's older override still beats the owner's newer
 * default. Kept as a pure function here because the pull itself is a long
 * multi-table routine — this is the part with the actual rule in it.
 */
function resolveOverlaySlots<T extends { training_day_id: string; sort_order: number; user_id?: string | null; created_at?: string }>(
  rows: T[],
  me: string | null,
): T[] {
  const best = new Map<string, T>();
  rows.forEach((row) => {
    const key = `${row.training_day_id}:${row.sort_order}`;
    const prev = best.get(key);
    if (!prev) { best.set(key, row); return; }
    const rowIsMine = me != null && row.user_id === me;
    const prevIsMine = me != null && prev.user_id === me;
    if (rowIsMine !== prevIsMine) {
      if (rowIsMine) best.set(key, row);
      return;
    }
    if (String(row.created_at ?? '') > String(prev.created_at ?? '')) best.set(key, row);
  });
  return Array.from(best.values());
}

describe('overlay slot resolution', () => {
  const owner = { training_day_id: 'td-1', sort_order: 1, user_id: 'owner-1', exercise_id: 'weighted_pullups', created_at: '2026-08-05T00:00:00Z' };
  const mine = { training_day_id: 'td-1', sort_order: 1, user_id: ME, exercise_id: 'pullups_assisted', created_at: '2026-08-01T00:00:00Z' };

  it('gives the member their own pick even when the owner’s row is newer', () => {
    const out = resolveOverlaySlots([owner, mine], ME);
    expect(out).toHaveLength(1);
    expect(out[0].exercise_id).toBe('pullups_assisted');
  });

  it('gives the owner their own row, never the member’s', () => {
    const out = resolveOverlaySlots([owner, mine], 'owner-1');
    expect(out).toHaveLength(1);
    expect(out[0].exercise_id).toBe('weighted_pullups');
  });

  it('collapses one slot to exactly one row', () => {
    // Two live rows on a slot must never both render — that duplicates the
    // exercise in the program.
    const out = resolveOverlaySlots([owner, mine], ME);
    expect(out.filter((r) => r.sort_order === 1)).toHaveLength(1);
  });

  it('falls back to recency between rows of the same owner', () => {
    const older = { ...owner, exercise_id: 'a', created_at: '2026-08-01T00:00:00Z' };
    const newer = { ...owner, exercise_id: 'b', created_at: '2026-08-09T00:00:00Z' };
    expect(resolveOverlaySlots([older, newer], ME)[0].exercise_id).toBe('b');
  });
});

/**
 * Session-id scoping.
 *
 * This is what actually orphaned Tyler's history, and it is NOT the swap
 * path. `foundry:ws_id:d{day}:w{week}` carried no meso id, so (day 0, week 0)
 * resolved to the same workout_sessions row forever. wipeMesoSessionData
 * clears it when YOU start a cycle — but a shared-meso member never runs that
 * wipe, because the owner starting a new cycle isn't an event on their
 * device. April's sets and August's sets landed in one session row, FK'd to
 * whichever training_day existed last, and every exercise from the older
 * program became unplaceable.
 */
describe('getOrCreateWorkoutSessionId — meso scoping', () => {
  beforeEach(() => localStorage.clear());

  it('scopes the key to the active meso', async () => {
    const { getOrCreateWorkoutSessionId } = await import('../sync');
    localStorage.setItem('foundry:active_meso_id', 'meso-A');
    const id = getOrCreateWorkoutSessionId(0, 0);
    expect(localStorage.getItem('foundry:ws_id:meso-A:d0:w0')).toBe(id);
  });

  it('gives a different session to the same day/week in a different meso', async () => {
    const { getOrCreateWorkoutSessionId } = await import('../sync');
    localStorage.setItem('foundry:active_meso_id', 'meso-A');
    const first = getOrCreateWorkoutSessionId(0, 0);

    localStorage.setItem('foundry:active_meso_id', 'meso-B');
    const second = getOrCreateWorkoutSessionId(0, 0);

    // The whole bug in one assertion.
    expect(second).not.toBe(first);
  });

  it('adopts a legacy unscoped id so an in-flight session does not fork', async () => {
    const { getOrCreateWorkoutSessionId } = await import('../sync');
    localStorage.setItem('foundry:ws_id:d2:w1', 'legacy-session');
    localStorage.setItem('foundry:active_meso_id', 'meso-A');

    expect(getOrCreateWorkoutSessionId(2, 1)).toBe('legacy-session');
    expect(localStorage.getItem('foundry:ws_id:meso-A:d2:w1')).toBe('legacy-session');
    // Adopted once, then removed — leaving it would re-adopt into the NEXT
    // meso too, which is the original bug.
    expect(localStorage.getItem('foundry:ws_id:d2:w1')).toBeNull();
  });

  it('does not adopt the legacy id into a second meso', async () => {
    const { getOrCreateWorkoutSessionId } = await import('../sync');
    localStorage.setItem('foundry:ws_id:d0:w0', 'legacy-session');
    localStorage.setItem('foundry:active_meso_id', 'meso-A');
    expect(getOrCreateWorkoutSessionId(0, 0)).toBe('legacy-session');

    localStorage.setItem('foundry:active_meso_id', 'meso-B');
    expect(getOrCreateWorkoutSessionId(0, 0)).not.toBe('legacy-session');
  });

  it('is stable within one meso', async () => {
    const { getOrCreateWorkoutSessionId } = await import('../sync');
    localStorage.setItem('foundry:active_meso_id', 'meso-A');
    expect(getOrCreateWorkoutSessionId(1, 3)).toBe(getOrCreateWorkoutSessionId(1, 3));
  });

  it('peek never mints an id', async () => {
    const { peekWorkoutSessionId } = await import('../sync');
    localStorage.setItem('foundry:active_meso_id', 'meso-A');
    expect(peekWorkoutSessionId(0, 0)).toBeNull();
    expect(localStorage.getItem('foundry:ws_id:meso-A:d0:w0')).toBeNull();
  });
});
