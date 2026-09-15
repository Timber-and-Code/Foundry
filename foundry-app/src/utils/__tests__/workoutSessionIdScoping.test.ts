/**
 * Which workout_sessions row a (day, week) resolves to across mesocycles.
 *
 * Pre-2.14.2 the key was unscoped — `foundry:ws_id:d{d}:w{w}` — so (day 0,
 * week 0) meant the same remote row forever. 2.14.2 scoped it by meso but
 * adopted any surviving unscoped id UNCONDITIONALLY, which re-pointed an old
 * session's meso_id to the current cycle and dragged every set it already
 * held along with it.
 *
 * Observed in prod before this fix: 14 sessions holding up to 54 set rows
 * across four separate days, with duplicate set_numbers that rebuildDayData
 * collapses arbitrarily — so the weights shown for a week were not stable.
 *
 * Adoption still has to happen for a genuinely in-flight session, because
 * archiving a meso REMOVES foundry:active_meso_id and a workout started in
 * that gap writes unscoped. Age is what separates the two.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../supabase.js', () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }),
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }),
    },
    from: () => ({ upsert: async () => ({ error: null }) }),
  },
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { getOrCreateWorkoutSessionId, peekWorkoutSessionId } from '../sync';

const MESO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MESO_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const legacyId = (d: number, w: number) => `foundry:ws_id:d${d}:w${w}`;
const legacyAt = (d: number, w: number) => `foundry:ws_id_at:d${d}:w${w}`;
const scoped = (m: string, d: number, w: number) => `foundry:ws_id:${m}:d${d}:w${w}`;

describe('a stale unscoped session id is never adopted into a new meso', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('mints a fresh id when the legacy key has no age stamp', () => {
    // Exactly the pre-2.14.2 shape: an id, no stamp, belonging to some
    // finished cycle. This is what merged four months of Tyler's training.
    localStorage.setItem(legacyId(0, 0), 'old-session-from-april');
    localStorage.setItem('foundry:active_meso_id', MESO_B);

    const id = getOrCreateWorkoutSessionId(0, 0);
    expect(id).not.toBe('old-session-from-april');
    expect(localStorage.getItem(scoped(MESO_B, 0, 0))).toBe(id);
  });

  it('mints a fresh id when the stamp is older than the in-flight window', () => {
    localStorage.setItem(legacyId(0, 0), 'yesterdays-session');
    localStorage.setItem(legacyAt(0, 0), String(Date.now() - 7 * 60 * 60 * 1000));
    localStorage.setItem('foundry:active_meso_id', MESO_B);

    expect(getOrCreateWorkoutSessionId(0, 0)).not.toBe('yesterdays-session');
  });

  it('clears the legacy keys either way, so a stale id is judged once', () => {
    localStorage.setItem(legacyId(0, 0), 'old-session');
    localStorage.setItem('foundry:active_meso_id', MESO_B);
    getOrCreateWorkoutSessionId(0, 0);

    expect(localStorage.getItem(legacyId(0, 0))).toBeNull();
    expect(localStorage.getItem(legacyAt(0, 0))).toBeNull();
  });

  it('leaves the old session row bound to its own meso', () => {
    // The whole point of minting fresh: nothing re-points the April row.
    localStorage.setItem(scoped(MESO_A, 0, 0), 'april-session');
    localStorage.setItem(legacyId(0, 0), 'april-session');
    localStorage.setItem('foundry:active_meso_id', MESO_B);
    getOrCreateWorkoutSessionId(0, 0);

    expect(localStorage.getItem(scoped(MESO_A, 0, 0))).toBe('april-session');
    expect(localStorage.getItem(scoped(MESO_B, 0, 0))).not.toBe('april-session');
  });
});

describe('a session genuinely in flight is still adopted', () => {
  beforeEach(() => localStorage.clear());

  it('carries an unscoped id forward when it was written moments ago', () => {
    // Archiving a meso removes active_meso_id; a workout started in that gap
    // writes unscoped. When the next meso gets an id mid-session, the row
    // must NOT fork.
    const inGap = getOrCreateWorkoutSessionId(0, 0);
    expect(localStorage.getItem(legacyId(0, 0))).toBe(inGap);
    expect(Number(localStorage.getItem(legacyAt(0, 0)))).toBeGreaterThan(0);

    localStorage.setItem('foundry:active_meso_id', MESO_B);
    expect(getOrCreateWorkoutSessionId(0, 0)).toBe(inGap);
    expect(localStorage.getItem(scoped(MESO_B, 0, 0))).toBe(inGap);
  });

  it('stamps only the unscoped write, not the scoped one', () => {
    localStorage.setItem('foundry:active_meso_id', MESO_B);
    getOrCreateWorkoutSessionId(1, 1);
    expect(localStorage.getItem(legacyAt(1, 1))).toBeNull();
  });
});

describe('ordinary behaviour is unchanged', () => {
  beforeEach(() => localStorage.clear());

  it('is stable across calls within one meso', () => {
    localStorage.setItem('foundry:active_meso_id', MESO_B);
    expect(getOrCreateWorkoutSessionId(2, 3)).toBe(getOrCreateWorkoutSessionId(2, 3));
  });

  it('gives two mesos two different rows for the same day and week', () => {
    localStorage.setItem('foundry:active_meso_id', MESO_A);
    const a = getOrCreateWorkoutSessionId(0, 0);
    localStorage.setItem('foundry:active_meso_id', MESO_B);
    expect(getOrCreateWorkoutSessionId(0, 0)).not.toBe(a);
  });

  it('peek does not reach for another meso\'s unscoped id', () => {
    localStorage.setItem(legacyId(0, 0), 'old-session');
    localStorage.setItem('foundry:active_meso_id', MESO_B);
    expect(peekWorkoutSessionId(0, 0)).toBeNull();
  });

  it('peek still reads the unscoped key when there is no active meso', () => {
    localStorage.setItem(legacyId(0, 0), 'anon-session');
    expect(peekWorkoutSessionId(0, 0)).toBe('anon-session');
  });
});
