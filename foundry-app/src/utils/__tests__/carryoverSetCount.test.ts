/**
 * Carryover must judge last week's work against LAST week's prescription.
 *
 * Regression for the "I hit all my reps and the weight didn't climb" report
 * (2026-08-24). The gate compared last week's logged sets against THIS
 * week's target, so two things silently froze progression:
 *
 *   1. Trimming an exercise (4 sets → 3) locked it out for the rest of the
 *      meso — it would never log 4 again, so the gate could never pass.
 *   2. The MRV week (getWeekSets base → base+1) froze EVERY exercise at
 *      once, including ones the lifter had never touched.
 *
 * Numbers below are the reporter's real day-0 meso: 6 weeks, db_ohp base 4
 * reps 8-10, cable_fly base 3 reps 12-15, with a week-2 override of 3 sets.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadDayWeekWithCarryover, pickSetCount, loadSetCountWeeks } from '../persistence';
import { getWeekSets } from '../training';

const MESO_WEEKS = 6;
const setLSJson = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const profile = { experience: 'intermediate' } as never;

const ex = (id: string, base: number, reps: string, equipment = 'dumbbell') =>
  ({ id, name: id, equipment, reps, sets: base, bw: false });

/** Mirrors DayView: the day handed to carryover is week-adjusted. */
const weekDay = (weekIdx: number, exercises: ReturnType<typeof ex>[]) => ({
  exercises: exercises.map((e) => ({
    ...e,
    sets: getWeekSets(Number(e.sets), weekIdx, MESO_WEEKS),
  })),
}) as never;

/** Mirrors DayView's prevSetsFor. */
const resolverFor = (dayIdx: number, weekIdx: number, exercises: ReturnType<typeof ex>[]) => {
  const weeks = loadSetCountWeeks(dayIdx, weekIdx);
  return (exIdx: number, week: number) => {
    const e = exercises[exIdx];
    if (!e) return 0;
    return pickSetCount(weeks, e.id, week, (w) => getWeekSets(Number(e.sets), w, MESO_WEEKS));
  };
};

describe('carryover honours the previous week\'s set count', () => {
  beforeEach(() => localStorage.clear());

  it('getWeekSets ramps MAV -> MRV, which is what broke the gate', () => {
    expect(getWeekSets(4, 3, MESO_WEEKS)).toBe(4); // week 3, MAV
    expect(getWeekSets(4, 4, MESO_WEEKS)).toBe(5); // week 4, MRV
    expect(getWeekSets(3, 0, MESO_WEEKS)).toBe(2); // week 0, MEV
  });

  it('a trimmed exercise still progresses (db_ohp 4 -> 3 sets)', () => {
    const list = [ex('db_ohp', 4, '8-10')];
    // Week 2: lifter trimmed 4 prescribed sets to 3, then hit the rep cap
    // on all three.
    setLSJson('foundry:setcount:d0:w2', { db_ohp: 3 });
    setLSJson('foundry:day0:week2', { 0: {
      0: { weight: '40', reps: '10' },
      1: { weight: '40', reps: '10' },
      2: { weight: '40', reps: '10' },
    }});
    const r = loadDayWeekWithCarryover(
      0, 3, weekDay(3, list), profile, resolverFor(0, 3, list),
    );
    expect(r[0][0].weight).toBe('45'); // 40 + 5 (dumbbell >= 25)
    expect(r[0][0].suggested).toBe(true);
  });

  it('one rep short at baseline still holds the weight', () => {
    // The reporter's actual week 2: 10 / 10 / 9. Not a bump — by design.
    const list = [ex('db_ohp', 4, '8-10')];
    setLSJson('foundry:setcount:d0:w2', { db_ohp: 3 });
    setLSJson('foundry:day0:week2', { 0: {
      0: { weight: '40', reps: '10' },
      1: { weight: '40', reps: '10' },
      2: { weight: '40', reps: '9' },
    }});
    const r = loadDayWeekWithCarryover(
      0, 3, weekDay(3, list), profile, resolverFor(0, 3, list),
    );
    expect(r[0][0].weight).toBe('40');
    expect(r[0][0].suggested).toBe(false);
  });

  it('the MRV week does not freeze an untouched exercise', () => {
    // cable_fly: base 3, delta 0, three perfect sets in week 3. Week 4
    // prescribes 4 — that must not invalidate week 3's evidence.
    const list = [ex('cable_fly_low_high', 3, '12-15', 'cable')];
    setLSJson('foundry:setcount:d0:w2', { cable_fly_low_high: 3 });
    setLSJson('foundry:day0:week3', { 0: {
      0: { weight: '35', reps: '15' },
      1: { weight: '35', reps: '15' },
      2: { weight: '35', reps: '15' },
    }});
    const r = loadDayWeekWithCarryover(
      0, 4, weekDay(4, list), profile, resolverFor(0, 4, list),
    );
    expect(r[0][0].weight).toBe('40'); // 35 + 5
    expect(r[0][0].suggested).toBe(true);
    // ...and it emits THIS week's four rows, not last week's three.
    expect(Object.keys(r[0])).toHaveLength(4);
  });

  it('partial completion still blocks the bump', () => {
    // 4 prescribed, no override, only 2 logged — genuinely incomplete.
    const list = [ex('db_ohp', 4, '8-10')];
    setLSJson('foundry:day0:week2', { 0: {
      0: { weight: '40', reps: '10' },
      1: { weight: '40', reps: '10' },
    }});
    const r = loadDayWeekWithCarryover(
      0, 3, weekDay(3, list), profile, resolverFor(0, 3, list),
    );
    expect(r[0][0].weight).toBe('40');
    expect(r[0][0].suggested).toBe(false);
  });

  it('without a resolver, behaviour is unchanged (back-compat)', () => {
    const list = [ex('db_ohp', 4, '8-10')];
    setLSJson('foundry:day0:week2', { 0: {
      0: { weight: '40', reps: '10' },
      1: { weight: '40', reps: '10' },
      2: { weight: '40', reps: '10' },
      3: { weight: '40', reps: '10' },
    }});
    const r = loadDayWeekWithCarryover(0, 3, weekDay(3, list), profile);
    expect(r[0][0].weight).toBe('45');
  });
});
