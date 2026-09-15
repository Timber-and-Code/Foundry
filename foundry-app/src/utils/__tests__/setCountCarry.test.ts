import { describe, it, expect, beforeEach } from 'vitest';
import { loadSetCountWeeks, pickSetCount, saveSetCount } from '../persistence';
import { getWeekSets } from '../training';

// 6-week meso: week 0 is MEV (base-1), weeks 1-3 MAV (base), week 4 MRV
// (base+1), week 5 deload (always 2). Prescribed 3 sets throughout.
const TOTAL_WEEKS = 6;
const PROGRAM_SETS = 3;
const baseFor = (w: number) => getWeekSets(PROGRAM_SETS, w, TOTAL_WEEKS);
const OPTS = { baseFor, totalWeeks: TOTAL_WEEKS };

const resolve = (dayIdx: number, weekIdx: number, exId: string) =>
  pickSetCount(loadSetCountWeeks(dayIdx, weekIdx), exId, weekIdx, baseFor);

describe('set-count carry across weeks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('follows the program when the lifter has never adjusted', () => {
    expect(resolve(0, 0, 'bench')).toBe(2); // MEV
    expect(resolve(0, 1, 'bench')).toBe(3); // MAV
    expect(resolve(0, 4, 'bench')).toBe(4); // MRV
    expect(resolve(0, 5, 'bench')).toBe(2); // deload
  });

  it('carries an added set forward as a delta, not a frozen count', () => {
    // Week 0 prescribes 2; lifter makes it 3. That's +1 over prescribed.
    saveSetCount(0, 0, 'bench', 3);
    expect(resolve(0, 0, 'bench')).toBe(3);
    // Week 1 prescribes 3 — the program's own bump still lands, and the
    // lifter's +1 rides on top of it. This is the bug: it used to revert
    // to the prescribed 3 because nothing carried.
    expect(resolve(0, 1, 'bench')).toBe(4);
    // Week 4 prescribes 4 → 5. The progression keeps progressing.
    expect(resolve(0, 4, 'bench')).toBe(5);
  });

  it('carries a removed set forward the same way', () => {
    saveSetCount(0, 1, 'bench', 2); // prescribed 3, lifter drops to 2
    expect(resolve(0, 2, 'bench')).toBe(2); // 3 - 1
    expect(resolve(0, 4, 'bench')).toBe(3); // 4 - 1
  });

  it('lets a later adjustment supersede an earlier one', () => {
    saveSetCount(0, 0, 'bench', 3); // +1
    saveSetCount(0, 2, 'bench', 3); // back to prescribed → delta 0
    expect(resolve(0, 3, 'bench')).toBe(3);
    expect(resolve(0, 4, 'bench')).toBe(4);
  });

  it('applies the delta to the deload week too', () => {
    // The lifter stays in control: if they don't want the extra set on a
    // deload they remove it, and that becomes the new delta.
    saveSetCount(0, 0, 'bench', 3);
    expect(resolve(0, 5, 'bench')).toBe(3); // deload 2 + 1
  });

  it('never resolves below a single set', () => {
    saveSetCount(0, 1, 'bench', 1); // prescribed 3 → delta -2
    expect(resolve(0, 5, 'bench')).toBe(1); // deload 2 - 2 = 0, clamped
  });

  it('keeps each exercise and each day independent', () => {
    saveSetCount(0, 0, 'bench', 3);
    expect(resolve(0, 1, 'row')).toBe(3); // untouched exercise
    expect(resolve(1, 1, 'bench')).toBe(3); // same exercise, different day
  });

  it('this week\'s explicit choice wins over a carried delta', () => {
    saveSetCount(0, 0, 'bench', 4); // +2
    saveSetCount(0, 1, 'bench', 3); // explicit for week 1
    expect(resolve(0, 1, 'bench')).toBe(3);
  });

  it('falls back to the base when the exercise has no id', () => {
    expect(pickSetCount([], null, 1, baseFor)).toBe(3);
    expect(pickSetCount([], undefined, 4, baseFor)).toBe(4);
  });
});

// ── Deload floor + no-op clearing ───────────────────────────────────────────
//
// Both behaviours come out of one production incident: a lifter trimmed a
// set in week 2 and every later week silently inherited the −1, ending in a
// ONE-set deload. Reproduced from the real meso in `2.15.1-patches_and_fixes`.

const resolveTW = (dayIdx: number, weekIdx: number, exId: string, base: number, total: number) =>
  pickSetCount(
    loadSetCountWeeks(dayIdx, weekIdx),
    exId,
    weekIdx,
    (w) => getWeekSets(base, w, total),
    total,
  );

describe('carried deltas and the deload week', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not let a carried removal shrink the deload', () => {
    // Week 1 (MAV) prescribes 3; lifter drops to 2 → delta −1.
    saveSetCount(0, 1, 'bench', 2, OPTS);
    expect(resolveTW(0, 2, 'bench', PROGRAM_SETS, TOTAL_WEEKS)).toBe(2); // 3 − 1, carries
    // The deload prescribes a flat 2. Applying the same −1 gave 1 — a
    // dropped session, not a deload.
    expect(resolveTW(0, 5, 'bench', PROGRAM_SETS, TOTAL_WEEKS)).toBe(2);
  });

  it('still carries an ADDED set into the deload (2af293f product call)', () => {
    saveSetCount(0, 1, 'bench', 4, OPTS); // +1
    expect(resolveTW(0, 5, 'bench', PROGRAM_SETS, TOTAL_WEEKS)).toBe(3); // deload 2 + 1
  });

  it('honours an explicit choice made IN the deload week', () => {
    saveSetCount(0, 1, 'bench', 2, OPTS); // carried −1
    saveSetCount(0, 5, 'bench', 1, OPTS); // lifter deliberately picks 1
    expect(resolveTW(0, 5, 'bench', PROGRAM_SETS, TOTAL_WEEKS)).toBe(1);
  });

  it('pins the deload rule to getWeekSets', () => {
    // pickSetCount re-derives "is this the deload" rather than importing
    // getWeekSets (import cycle). If that rule ever drifts, this fails.
    for (const total of [4, 5, 6, 7, 8]) {
      expect(getWeekSets(PROGRAM_SETS, total - 1, total)).toBe(2);
      expect(getWeekSets(PROGRAM_SETS, total - 2, total)).not.toBe(2);
    }
  });
});

describe('returning to the prescription clears the override', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('leaves no residue when a set is added then removed again', () => {
    const base = baseFor(2); // 3
    saveSetCount(0, 2, 'bench', base + 1, OPTS); // add
    expect(loadSetCountWeeks(0, 2)[2]).toEqual({ bench: 4 });
    saveSetCount(0, 2, 'bench', base, OPTS); // and take it back off
    expect(loadSetCountWeeks(0, 2)[2]).toEqual({});
  });

  it('does not let a cleared week shadow an earlier real delta', () => {
    saveSetCount(0, 0, 'bench', 3, OPTS); // week 0: 2 → 3, a real +1
    // Week 2 prescribes 3, so the carried +1 puts 4 ON SCREEN. The lifter's
    // two taps therefore go 4 → 5 → 4, not 3 → 4 → 3; saveSetCount always
    // receives the resulting on-screen count.
    expect(resolveTW(0, 2, 'bench', PROGRAM_SETS, TOTAL_WEEKS)).toBe(4);
    saveSetCount(0, 2, 'bench', 5, OPTS); // add…
    saveSetCount(0, 2, 'bench', 4, OPTS); // …then remove
    expect(loadSetCountWeeks(0, 2)[2]).toEqual({});
    // Week 3 should still see the week-0 +1, not a zero delta from week 2.
    expect(resolveTW(0, 3, 'bench', PROGRAM_SETS, TOTAL_WEEKS)).toBe(4);
  });

  it('keeps other exercises in the same week untouched', () => {
    const base = baseFor(2);
    saveSetCount(0, 2, 'bench', base + 1, OPTS);
    saveSetCount(0, 2, 'row', base + 1, OPTS);
    saveSetCount(0, 2, 'bench', base, OPTS);
    expect(loadSetCountWeeks(0, 2)[2]).toEqual({ row: 4 });
  });

  it('stores the choice when it genuinely differs from the base', () => {
    saveSetCount(0, 2, 'bench', 2, OPTS); // 3 → 2
    expect(loadSetCountWeeks(0, 2)[2]).toEqual({ bench: 2 });
  });
});

describe('regression: the week-2 trim that reached the deload', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Real data, meso 90f0d431 day 0: db_ohp is a 4-set lift in a 7-week
  // meso. The lifter trimmed it to 3 in week 2 (MAV, base 4). Weeks 3-5
  // correctly inherited the −1 — and then the deload prescribed ONE set,
  // which is what the lifter actually logged.
  const OHP_BASE = 4;
  const SEVEN = 7;
  const OHP_OPTS = {
    baseFor: (w: number) => getWeekSets(OHP_BASE, w, SEVEN),
    totalWeeks: SEVEN,
  };

  it('reproduces the prescription the lifter was given, except the deload', () => {
    saveSetCount(0, 2, 'db_ohp', 3, OHP_OPTS);
    const got = [0, 1, 2, 3, 4, 5, 6].map((w) =>
      resolveTW(0, w, 'db_ohp', OHP_BASE, SEVEN),
    );
    //                      w0 w1 w2 w3 w4 w5  w6
    // program alone:        3  3  4  4  5  5   2
    // logged in prod:       3  3  3  3  4  4   1  ← deload collapsed
    expect(got).toEqual([3, 3, 3, 3, 4, 4, 2]);
  });
});

describe('overriding a carried delta back to the prescription', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Caught by eyeballing the real-meso matrix, not by a failing test: an
  // earlier version of this fix cleared any row equal to the week's base,
  // which silently discarded exactly this choice and let the −1 reassert.
  it('keeps an add-back that lands on the base while a delta is carried', () => {
    saveSetCount(0, 1, 'bench', 2, OPTS); // week 1: 3 → 2, a real −1
    expect(resolveTW(0, 4, 'bench', PROGRAM_SETS, TOTAL_WEEKS)).toBe(3); // 4 − 1

    // Week 4 prescribes 4, lifter is shown 3 and adds one back to 4. That
    // equals the base, but it is NOT a no-op — it overrides the carry.
    saveSetCount(0, 4, 'bench', 4, OPTS);
    expect(loadSetCountWeeks(0, 4)[4]).toEqual({ bench: 4 });
    expect(resolveTW(0, 4, 'bench', PROGRAM_SETS, TOTAL_WEEKS)).toBe(4);
  });

  it('clears it again if they take that same set back off', () => {
    saveSetCount(0, 1, 'bench', 2, OPTS); // carried −1
    saveSetCount(0, 4, 'bench', 4, OPTS); // add back to the prescription
    saveSetCount(0, 4, 'bench', 3, OPTS); // changed their mind — back to 4 − 1
    expect(loadSetCountWeeks(0, 4)[4]).toEqual({});
    expect(resolveTW(0, 4, 'bench', PROGRAM_SETS, TOTAL_WEEKS)).toBe(3);
  });
});
