/**
 * The end-of-meso summary's numbers, from real saved sessions.
 *
 * The recap used to read each lift's sets by SLOT (`wd[exIdx]`), so after a
 * reorder the chart and the start → peak line described whichever lift sat
 * in that position that week. It now matches by the `_exId` stamp, and
 * carries a per-week series for the charts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../utils/sync');
vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { useMesoState } from '../useMesoState';
import { resetMesoCache } from '../../data/constants';

// 2 working weeks + deload = weeks 0, 1, 2. One training day.
const profile = {
  name: 'T', experience: 'intermediate', splitType: 'full_body', daysPerWeek: 1,
  workoutDays: [1], mesoLength: 2, startDate: '2026-08-01', weight: 180,
};
const program = [
  {
    name: 'Full A', tag: 'FULL',
    exercises: [
      { id: 'squat', name: 'Back Squat', anchor: true, sets: 2, reps: '5-8', muscle: 'quads' },
      { id: 'curl', name: 'Curl', anchor: false, sets: 2, reps: '8-12', muscle: 'biceps' },
    ],
  },
];
const set = (w: number, reps: number, exId: string, extra: Record<string, unknown> = {}) => ({
  weight: String(w), reps: String(reps), confirmed: true, _exId: exId, ...extra,
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('foundry:profile', JSON.stringify(profile));
  localStorage.setItem('foundry:storedProgram', JSON.stringify(program));
  resetMesoCache();
  // Week 0 in program order.
  localStorage.setItem('foundry:day0:week0', JSON.stringify({
    0: { 0: set(200, 5, 'squat'), 1: set(95, 3, 'squat', { warmup: true }) },
    1: { 0: set(30, 10, 'curl') },
  }));
  // Week 1 REORDERED: curl sits in slot 0, squat in slot 1.
  localStorage.setItem('foundry:day0:week1', JSON.stringify({
    0: { 0: set(35, 10, 'curl') },
    1: { 0: set(215, 5, 'squat') },
  }));
  // Deload.
  localStorage.setItem('foundry:day0:week2', JSON.stringify({
    0: { 0: set(180, 5, 'squat') },
    1: { 0: set(30, 8, 'curl') },
  }));
  localStorage.setItem('foundry:done:d0:w0', '1');
  localStorage.setItem('foundry:done:d0:w1', '1');
});

describe('meso recap data', () => {
  it('tracks the anchor lift by identity across a reorder, week by week', () => {
    const { result } = renderHook(() => useMesoState({ setView: () => {}, setOnboarded: () => {} }));
    act(() => result.current.handleComplete(0, 2));
    const modal = result.current.weekCompleteModal!;
    expect(modal.isFinal).toBe(true);
    expect(modal.anchorGains).toHaveLength(1);
    const squat = modal.anchorGains[0];
    // By slot, week 1 would have read the curl (35). By identity: 215.
    expect(squat.weekly).toEqual([200, 215, 180]);
    expect(squat.start).toBe(200);
    // Peak over WORKING weeks — the deload is never the peak.
    expect(squat.peak).toBe(215);
    expect(squat.delta).toBe(15);
    expect(squat.peakWeek).toBe(2);
  });

  it('gives per-week volume, without warm-ups', () => {
    const { result } = renderHook(() => useMesoState({ setView: () => {}, setOnboarded: () => {} }));
    act(() => result.current.handleComplete(0, 2));
    const modal = result.current.weekCompleteModal!;
    // w0: 200×5 + 30×10 (the 95×3 warm-up excluded) = 1300
    // w1: 35×10 + 215×5 = 1425 · w2: 180×5 + 30×8 = 1140
    expect(modal.mesoWeeklyVolume).toEqual([1300, 1425, 1140]);
    expect(modal.mesoTotalVolume).toBe(1300 + 1425 + 1140);
  });
});
