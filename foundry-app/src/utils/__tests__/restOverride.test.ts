import { describe, it, expect, beforeEach } from 'vitest';
import {
  effectiveRest,
  recordRestEnd,
  undoRestLearn,
  loadRestOverride,
  clearRestOverride,
  formatRest,
  programRestSecs,
  restFloorSecs,
} from '../restOverride';

const row = { id: 'cable_row', name: 'Cable Row', rest: '2 min', anchor: false };
const bench = { id: 'bench', name: 'Barbell Bench', rest: '3 min', anchor: true };

describe('restOverride', () => {
  beforeEach(() => localStorage.clear());

  it('program rest and floors', () => {
    expect(programRestSecs(row)).toBe(120);
    expect(programRestSecs({ rest: undefined })).toBe(120);
    expect(programRestSecs({ rest: '90 sec' })).toBe(90);
    expect(restFloorSecs(bench)).toBe(90);
    expect(restFloorSecs(row)).toBe(45);
  });

  it('formatRest', () => {
    expect(formatRest(75)).toBe('1:15');
    expect(formatRest(45)).toBe('0:45');
    expect(formatRest(120)).toBe('2:00');
  });

  it('effectiveRest is the program until something is learned', () => {
    expect(effectiveRest(row)).toEqual({ secs: 120, restStr: '2 min', learned: false, programSecs: 120 });
  });

  it('one early end teaches nothing; two matching early ends set the rest to their average, in 5 s steps', () => {
    expect(recordRestEnd(row, 70)).toBeNull();
    expect(effectiveRest(row).learned).toBe(false);
    const learned = recordRestEnd(row, 82);
    expect(learned).toEqual({ exId: 'cable_row', exName: 'Cable Row', secs: 75, prevSecs: null });
    expect(effectiveRest(row)).toEqual({ secs: 75, restStr: '75 sec', learned: true, programSecs: 120 });
  });

  it('two early ends that disagree by more than 15 s do not pair — the later one becomes the new candidate', () => {
    expect(recordRestEnd(row, 60)).toBeNull();
    expect(recordRestEnd(row, 100)).toBeNull();
    expect(effectiveRest(row).learned).toBe(false);
    // 100 is now the candidate: a 95 pairs with it.
    expect(recordRestEnd(row, 95)?.secs).toBe(100);
  });

  it('a full-length rest in between resets the pair', () => {
    expect(recordRestEnd(row, 70)).toBeNull();
    expect(recordRestEnd(row, 118)).toBeNull(); // within 5 s of 120: not early
    expect(recordRestEnd(row, 72)).toBeNull(); // first of a NEW pair
    expect(recordRestEnd(row, 70)?.secs).toBe(70);
  });

  it('never goes below the floor: anchors stop at 1:30, others at 0:45', () => {
    expect(recordRestEnd(bench, 40)).toBeNull();
    expect(recordRestEnd(bench, 45)?.secs).toBe(90);
    // At the floor there is nothing left to learn.
    expect(recordRestEnd(bench, 30)).toBeNull();
    expect(recordRestEnd(bench, 30)).toBeNull();
    expect(effectiveRest(bench).secs).toBe(90);

    expect(recordRestEnd(row, 20)).toBeNull();
    expect(recordRestEnd(row, 25)?.secs).toBe(45);
  });

  it('keeps learning shorter, never longer', () => {
    recordRestEnd(row, 90);
    expect(recordRestEnd(row, 90)?.secs).toBe(90);
    // Early against the LEARNED 90 now: 60 + 60 → 60.
    recordRestEnd(row, 60);
    expect(recordRestEnd(row, 60)?.secs).toBe(60);
    // Ending at 85 is not early against 60 — it resets, nothing lengthens.
    expect(recordRestEnd(row, 85)).toBeNull();
    expect(effectiveRest(row).secs).toBe(60);
  });

  it('a learned rest longer than a shortened program is ignored', () => {
    recordRestEnd(row, 100);
    recordRestEnd(row, 100);
    expect(loadRestOverride('cable_row')).toBe(100);
    expect(effectiveRest({ ...row, rest: '90 sec' }).learned).toBe(false);
  });

  it('undo restores the previous override, or clears it', () => {
    recordRestEnd(row, 90);
    const first = recordRestEnd(row, 90)!;
    recordRestEnd(row, 60);
    const second = recordRestEnd(row, 60)!;
    expect(second.prevSecs).toBe(90);
    undoRestLearn(second);
    expect(effectiveRest(row).secs).toBe(90);
    undoRestLearn(first);
    expect(effectiveRest(row).learned).toBe(false);
    expect(loadRestOverride('cable_row')).toBeNull();
  });

  it('ignores exercises without an id, bad durations, and clears cleanly', () => {
    expect(recordRestEnd({ name: 'x', rest: '2 min' }, 60)).toBeNull();
    expect(recordRestEnd(row, 0)).toBeNull();
    expect(recordRestEnd(row, NaN)).toBeNull();
    recordRestEnd(row, 70);
    recordRestEnd(row, 70);
    clearRestOverride('cable_row');
    expect(effectiveRest(row).learned).toBe(false);
  });
});
