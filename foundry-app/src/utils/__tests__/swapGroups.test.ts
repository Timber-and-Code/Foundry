/**
 * Tests for swapGroups — day-tag → EXERCISE_DB-tag mapping shared by
 * DayView and DayAccordion. See `foundry/beat2_preview_fixes.md` #2.
 */
import { describe, it, expect } from 'vitest';
import { tagsForDay, buildSwapGroups } from '../swapGroups';

describe('tagsForDay', () => {
  it('PUSH includes LEGS (squats live on push days in P/P/L splits)', () => {
    expect(tagsForDay('PUSH')).toEqual(['PUSH', 'LEGS']);
  });

  it('PULL includes LEGS (hinges live on pull days in P/P/L splits)', () => {
    expect(tagsForDay('PULL')).toEqual(['PULL', 'LEGS']);
  });

  it('LEGS is LEGS-only', () => {
    expect(tagsForDay('LEGS')).toEqual(['LEGS']);
  });

  it('UPPER maps to PUSH + PULL', () => {
    expect(tagsForDay('UPPER')).toEqual(['PUSH', 'PULL']);
  });

  it('LOWER maps to LEGS', () => {
    expect(tagsForDay('LOWER')).toEqual(['LEGS']);
  });

  it('FULL, CUSTOM and unknown tags fall back to everything', () => {
    const full = ['PUSH', 'PULL', 'LEGS', 'CORE'];
    expect(tagsForDay('FULL')).toEqual(full);
    expect(tagsForDay('CUSTOM')).toEqual(full);
    expect(tagsForDay('')).toEqual(full);
    expect(tagsForDay(undefined)).toEqual(full);
    expect(tagsForDay(null)).toEqual(full);
    expect(tagsForDay('BANANA')).toEqual(full);
  });

  it('is case-insensitive on the input tag', () => {
    expect(tagsForDay('push')).toEqual(['PUSH', 'LEGS']);
    expect(tagsForDay('Legs')).toEqual(['LEGS']);
  });
});

describe('buildSwapGroups', () => {
  const db = [
    { id: 'bb_flat_bench', name: 'Flat Bench', muscle: 'chest', tag: 'PUSH' },
    { id: 'bb_row', name: 'Barbell Row', muscle: 'back', tag: 'PULL' },
    { id: 'bb_squat', name: 'Back Squat', muscle: 'quads', tag: 'LEGS' },
    { id: 'plank', name: 'Plank', muscle: 'abs', tag: 'CORE' },
  ];

  it('groups by muscle', () => {
    const groups = buildSwapGroups(db, 'FULL');
    expect(Object.keys(groups).sort()).toEqual(['abs', 'back', 'chest', 'quads']);
    expect(groups.chest[0].id).toBe('bb_flat_bench');
  });

  it('filters out exercises whose tag is not in the day-tag set (PUSH → no PULL)', () => {
    const groups = buildSwapGroups(db, 'PUSH');
    expect(groups.chest).toBeDefined();
    expect(groups.quads).toBeDefined(); // LEGS included with PUSH
    expect(groups.back).toBeUndefined();
    expect(groups.abs).toBeUndefined(); // CORE not in PUSH
  });

  it('LEGS keeps only leg exercises', () => {
    const groups = buildSwapGroups(db, 'LEGS');
    expect(Object.keys(groups)).toEqual(['quads']);
  });

  it('FULL keeps everything — including CORE', () => {
    const groups = buildSwapGroups(db, 'FULL');
    expect(groups.abs).toBeDefined();
  });
});
