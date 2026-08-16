import { describe, it, expect } from 'vitest';
import { estimateKcal, MAX_CREDITED_MINUTES } from '../health/calorieEstimate';

const HOUR = 3600000;

describe('estimateKcal', () => {
  it('applies the MET formula: METs x kg x hours', () => {
    // 5 METs (moderate) x (220.462 lbs -> 100kg) x 1h = 500 kcal
    expect(estimateKcal({ startMs: 0, endMs: HOUR, weightLbs: 220.462 })).toBe(500);
  });

  it('scales with duration', () => {
    const half = estimateKcal({ startMs: 0, endMs: HOUR / 2, weightLbs: 220.462 });
    expect(half).toBe(250);
  });

  it('scales with intensity', () => {
    const base = { startMs: 0, endMs: HOUR, weightLbs: 220.462 };
    expect(estimateKcal({ ...base, intensity: 'light' })).toBe(350);
    expect(estimateKcal({ ...base, intensity: 'moderate' })).toBe(500);
    expect(estimateKcal({ ...base, intensity: 'vigorous' })).toBe(600);
  });

  it('caps absurd durations instead of trusting them', () => {
    // A lifter who never hit complete. Six hours of "moderate lifting"
    // would put a fictional four-figure burn on the Move ring.
    const sixHours = estimateKcal({ startMs: 0, endMs: 6 * HOUR, weightLbs: 220.462 });
    const capped = estimateKcal({
      startMs: 0,
      endMs: MAX_CREDITED_MINUTES * 60000,
      weightLbs: 220.462,
    });
    expect(sixHours).toBe(capped);
    expect(sixHours).toBe(1500); // 3h cap, not 6h
  });

  it('falls back to an assumed bodyweight when the profile has none', () => {
    const missing = estimateKcal({ startMs: 0, endMs: HOUR });
    expect(missing).toBeGreaterThan(0);
    expect(missing).toBe(estimateKcal({ startMs: 0, endMs: HOUR, weightLbs: 170 }));
  });

  it('treats junk bodyweight as missing rather than producing zero', () => {
    for (const w of ['', null, undefined, 'abc', 0, -5]) {
      expect(estimateKcal({ startMs: 0, endMs: HOUR, weightLbs: w as never })).toBe(
        estimateKcal({ startMs: 0, endMs: HOUR, weightLbs: 170 }),
      );
    }
  });

  it('accepts a numeric string bodyweight', () => {
    expect(estimateKcal({ startMs: 0, endMs: HOUR, weightLbs: '220.462' })).toBe(500);
  });

  it('returns 0 for a non-positive or malformed interval', () => {
    expect(estimateKcal({ startMs: HOUR, endMs: HOUR, weightLbs: 200 })).toBe(0);
    expect(estimateKcal({ startMs: 2 * HOUR, endMs: HOUR, weightLbs: 200 })).toBe(0);
    expect(estimateKcal({ startMs: NaN, endMs: HOUR, weightLbs: 200 })).toBe(0);
    expect(estimateKcal({ startMs: 0, endMs: NaN, weightLbs: 200 })).toBe(0);
  });
});
