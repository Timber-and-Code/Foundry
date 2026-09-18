/**
 * What the carryover prescribes in the PROGRAMMED deload week.
 *
 * Everything in computeCarryoverForOneExercise above the deload branch is
 * progression: it asks "did you earn more?" and answers with a heavier bar
 * or another rep. None of that was ever switched off for the deload, so a
 * lifter who hit the top of the rep range in the MRV week was told to add
 * weight in the deload, and one who didn't was still told to add a rep. The
 * week cut sets and then pushed intensity up underneath.
 *
 * The shape is a middle ground: RP/Israetel's full deload goes back to week
 * 1's load and halves it for the second half of the week; Helms and Nuckols
 * hold load and let volume do the work. getWeekSets already does the volume
 * half. This is the rest: load anchored to WEEK 1 with a shallow taper
 * across the week, and reps at rangeMin for the RIR.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadDayWeekWithCarryover, saveDayWeek } from '../persistence';
import { getWeekSets } from '../training';

const TOTAL = 7; // week 6 is the deload
const DELOAD = TOTAL - 1;
const MRV = TOTAL - 2;
const BASE_SETS = 4;

const meso = (daysPerWeek: number) => ({ totalWeeks: TOTAL, daysPerWeek });

const makeDay = (opts: { reps?: string; equipment?: string; bw?: boolean } = {}) =>
  ({
    name: 'D', label: 'D', tag: 'PUSH', type: 'strength',
    exercises: [{
      id: 'bench', name: 'Bench', sets: BASE_SETS,
      reps: opts.reps ?? '4-6',
      equipment: opts.equipment ?? 'barbell',
      muscle: 'chest',
      ...(opts.bw ? { bw: true } : {}),
    }],
  }) as never;

/** Week-adjust the day the way DayView does before handing it to carryover. */
const weekAdjusted = (day: unknown, week: number) =>
  ({
    ...(day as Record<string, unknown>),
    exercises: (day as { exercises: { sets: number }[] }).exercises.map((e) => ({
      ...e, sets: getWeekSets(Number(e.sets), week, TOTAL),
    })),
  }) as never;

/** A fully-completed MRV week — every prescribed set logged at `reps`. */
const seedMrvWeek = (dayIdx: number, weight: string, reps: string) => {
  const slice: Record<number, unknown> = {};
  for (let s = 0; s < getWeekSets(BASE_SETS, MRV, TOTAL); s++) {
    slice[s] = { weight, reps, confirmed: true, _exId: 'bench' };
  }
  saveDayWeek(dayIdx, MRV, { 0: slice } as never);
};

/** Week 1 (index 0) at `weight` — what the deload is anchored to. */
const seedWeek1 = (dayIdx: number, weight: string, extra: Record<number, unknown> = {}) => {
  const slice: Record<number, unknown> = { ...extra };
  for (let s = 0; s < getWeekSets(BASE_SETS, 0, TOTAL); s++) {
    slice[s] ??= { weight, reps: '6', confirmed: true, _exId: 'bench' };
  }
  saveDayWeek(dayIdx, 0, { 0: slice } as never);
};

const prevSetsFor = (_e: number, w: number) => getWeekSets(BASE_SETS, w, TOTAL);

const deloadFor = (
  dayIdx: number,
  daysPerWeek: number,
  day = makeDay(),
): Record<string, Record<string, unknown>> => {
  const out = loadDayWeekWithCarryover(
    dayIdx, DELOAD, weekAdjusted(day, DELOAD), null, prevSetsFor, meso(daysPerWeek),
  );
  return out[0] as unknown as Record<string, Record<string, unknown>>;
};

describe('the deload week does not prescribe progression', () => {
  beforeEach(() => localStorage.clear());

  it('holds the weight after a PERFECT MRV week instead of adding 5 lb', () => {
    seedMrvWeek(0, '225', '6'); // 6 = rangeMax of 4-6, every set → used to bump
    const sets = deloadFor(0, 4);
    expect(Object.values(sets).map((s) => s.weight)).toEqual(['225', '225']);
  });

  it('puts reps at the BOTTOM of the range, not baseline + 1', () => {
    seedMrvWeek(0, '225', '5'); // short of rangeMax → used to suggest 6
    const sets = deloadFor(0, 4);
    expect(Object.values(sets).map((s) => s.reps)).toEqual(['4', '4']);
  });

  it('clears both suggestion flags so nothing reads as "push here"', () => {
    seedMrvWeek(0, '225', '6');
    for (const s of Object.values(deloadFor(0, 4))) {
      expect(s.suggested).toBe(false);
      expect(s.repsSuggested).toBe(false);
    }
  });

  it('still cuts volume to the programmed 2 sets', () => {
    seedMrvWeek(0, '225', '6');
    expect(Object.keys(deloadFor(0, 4))).toHaveLength(2);
  });
});

describe('the deload load taper steps across the week', () => {
  beforeEach(() => localStorage.clear());

  it('holds on day 1 and reaches 90% on the last day of a 4-day split', () => {
    const got = [0, 1, 2, 3].map((d) => {
      localStorage.clear();
      seedMrvWeek(d, '200', '6');
      return deloadFor(d, 4)[0].weight;
    });
    // 100 / 96.7 / 93.3 / 90, rounded to the nearest 2.5.
    expect(got).toEqual(['200', '192.5', '187.5', '180']);
  });

  it('spreads the same 10% over a 6-day split', () => {
    const got = [0, 1, 2, 3, 4, 5].map((d) => {
      localStorage.clear();
      seedMrvWeek(d, '200', '6');
      return deloadFor(d, 6)[0].weight;
    });
    expect(got).toEqual(['200', '195', '192.5', '187.5', '185', '180']);
  });

  it('holds flat when the meso trains one day a week', () => {
    seedMrvWeek(0, '200', '6');
    expect(deloadFor(0, 1)[0].weight).toBe('200');
  });

  it('never taps a bodyweight lift down to a phantom load', () => {
    seedMrvWeek(3, '', '12');
    const sets = deloadFor(3, 4, makeDay({ bw: true, reps: '8-12' }));
    expect(Object.values(sets).map((s) => s.weight)).toEqual(['', '']);
    expect(Object.values(sets).map((s) => s.reps)).toEqual(['8', '8']); // rangeMin
  });
});

describe('the deload branch stays out of the way', () => {
  beforeEach(() => localStorage.clear());

  it('leaves working weeks progressing as before', () => {
    // Week 1 off a perfect week 0 — barbell, all reps hit → +5 and flagged.
    const slice: Record<number, unknown> = {};
    for (let s = 0; s < getWeekSets(BASE_SETS, 0, TOTAL); s++) {
      slice[s] = { weight: '225', reps: '6', confirmed: true, _exId: 'bench' };
    }
    saveDayWeek(0, 0, { 0: slice } as never);
    const out = loadDayWeekWithCarryover(
      0, 1, weekAdjusted(makeDay(), 1), null, prevSetsFor, meso(4),
    );
    const first = (out[0] as unknown as Record<string, Record<string, unknown>>)[0];
    expect(first.weight).toBe('230');
    expect(first.suggested).toBe(true);
  });

  it('does nothing at all when no meso context is passed', () => {
    seedMrvWeek(0, '225', '6');
    const out = loadDayWeekWithCarryover(0, DELOAD, weekAdjusted(makeDay(), DELOAD), null, prevSetsFor);
    const first = (out[0] as unknown as Record<string, Record<string, unknown>>)[0];
    expect(first.weight).toBe('230'); // the old, wrong behaviour — unchanged
  });

  it('yields to the re-entry deload, which is a different prescription', () => {
    localStorage.setItem('foundry:active_meso_id', 'm1');
    localStorage.setItem(`foundry:reentry_deload:m1:${DELOAD}`, '1');
    seedMrvWeek(0, '200', '6');
    // Recalibrate is a flat 85% of baseline, not the day-0 hold.
    expect(deloadFor(0, 4)[0].weight).toBe('170');
  });
});

describe('the deload is anchored to WEEK 1, not the MRV week', () => {
  beforeEach(() => localStorage.clear());

  it('drops back to week 1\'s weight, then tapers it', () => {
    // 170 → 200 over the meso. Old code: 200 on day 0, 180 on the last day.
    const got = [0, 3].map((d) => {
      localStorage.clear();
      seedWeek1(d, '170');
      seedMrvWeek(d, '200', '6');
      return deloadFor(d, 4)[0].weight;
    });
    expect(got).toEqual(['170', '152.5']); // 170 × 0.9 = 153 → nearest 2.5
  });

  it('ignores warmups when reading week 1', () => {
    seedWeek1(0, '170', { 0: { weight: '250', reps: '3', warmup: true, _exId: 'bench' } });
    seedMrvWeek(0, '200', '6');
    expect(deloadFor(0, 4)[0].weight).toBe('170');
  });

  it('never sends a lifter UP if they went lighter since week 1', () => {
    seedWeek1(0, '220');
    seedMrvWeek(0, '200', '6');
    expect(deloadFor(0, 4)[0].weight).toBe('200');
  });

  it('falls back to last week when week 1 has nothing for the lift', () => {
    seedMrvWeek(0, '200', '6'); // swapped in mid-meso — no week-1 history
    expect(deloadFor(0, 4)[0].weight).toBe('200');
  });

  it('reads week 1 by tde id on the v2 path', () => {
    localStorage.setItem('foundry:active_meso_id', 'm1');
    localStorage.setItem('foundry:tde_ids:m1', JSON.stringify({ '3:0': 'tde-bench' }));
    const v2 = (weight: string, n: number) => ({
      'tde-bench': {
        sets: Object.fromEntries(
          Array.from({ length: n }, (_, i) => [i, { weight, reps: '6', confirmed: true }]),
        ),
      },
    });
    localStorage.setItem('foundry:day_v2:3:0', JSON.stringify(v2('170', getWeekSets(BASE_SETS, 0, TOTAL))));
    localStorage.setItem(`foundry:day_v2:3:${MRV}`, JSON.stringify(v2('200', getWeekSets(BASE_SETS, MRV, TOTAL))));
    expect(deloadFor(3, 4)[0].weight).toBe('152.5');
  });
});
