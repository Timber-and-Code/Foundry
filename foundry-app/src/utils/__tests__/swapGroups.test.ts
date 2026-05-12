/**
 * Tests for swapGroups — day-tag → EXERCISE_DB-tag mapping shared by
 * DayView and DayAccordion. See `foundry/beat2_preview_fixes.md` #2.
 */
import { describe, it, expect } from 'vitest';
import { tagsForDay, buildSwapGroups, bucketFor } from '../swapGroups';

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

  it('sourceTag forces inclusion of like-for-like swaps even when dayTag would exclude them', () => {
    // Reported regression: a Back (PULL) exercise stuck on a stale PUSH-tagged
    // day showed NO back options in the swap picker. Passing the source's tag
    // through to buildSwapGroups always allows same-tag swaps.
    const groups = buildSwapGroups(db, 'PUSH', 'PULL');
    expect(groups.back).toBeDefined();
    expect(groups.back[0].id).toBe('bb_row');
    // Original day-tag allow-set is still honoured for everything else.
    expect(groups.chest).toBeDefined();
    expect(groups.quads).toBeDefined(); // LEGS still included with PUSH
  });

  it('sourceTag is a no-op when already in the dayTag allow-set', () => {
    // UPPER already includes PULL, so passing sourceTag='PULL' doesn't change
    // the output — both groups appear either way.
    const withSource = buildSwapGroups(db, 'UPPER', 'PULL');
    const withoutSource = buildSwapGroups(db, 'UPPER');
    expect(Object.keys(withSource).sort()).toEqual(Object.keys(withoutSource).sort());
  });
});

describe('bucketFor — movement family merge (#4)', () => {
  it('Back / Lats / Traps share the Back bucket so vertical-pull variants are visible together', () => {
    expect(bucketFor('Back')).toBe('Back');
    expect(bucketFor('Lats')).toBe('Back');
    expect(bucketFor('Traps')).toBe('Back');
  });

  it('Quads / Glutes share the Quads bucket', () => {
    expect(bucketFor('Quads')).toBe('Quads');
    expect(bucketFor('Glutes')).toBe('Quads');
  });

  it('unrecognized muscles map to themselves (back-compat)', () => {
    expect(bucketFor('Biceps')).toBe('Biceps');
    expect(bucketFor('Triceps')).toBe('Triceps');
    expect(bucketFor('Chest')).toBe('Chest');
    expect(bucketFor('')).toBe('');
  });
});

describe('buildSwapGroups — assisted Pull-Up appears alongside Lat Pulldown (#4)', () => {
  // Mirrors the real EXERCISE_DB shape: pull-ups + assisted variants live
  // under muscle='Back' and lat pulldowns under muscle='Lats'. Before the
  // movement-family merge, these were split across two collapsed groups.
  const db = [
    { id: 'pullups_bw', name: 'Bodyweight Pull-ups', muscle: 'Back', tag: 'PULL' },
    { id: 'pullups_assisted', name: 'Assisted Pull-ups', muscle: 'Back', tag: 'PULL' },
    { id: 'lat_pulldown', name: 'Lat Pulldown', muscle: 'Lats', tag: 'PULL' },
    { id: 'cable_row', name: 'Cable Row', muscle: 'Back', tag: 'PULL' },
  ];

  it('lands all four in the same Back bucket', () => {
    const groups = buildSwapGroups(db, 'PULL');
    expect(Object.keys(groups)).toEqual(['Back']);
    const ids = groups.Back.map((e) => e.id).sort();
    expect(ids).toEqual([
      'cable_row',
      'lat_pulldown',
      'pullups_assisted',
      'pullups_bw',
    ]);
  });
});
