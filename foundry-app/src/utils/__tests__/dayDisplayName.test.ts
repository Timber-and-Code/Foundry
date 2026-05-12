import { describe, it, expect } from 'vitest';
import { dayDisplayName } from '../splitLabel';

describe('dayDisplayName', () => {
  it('prefers day.label over everything else', () => {
    expect(
      dayDisplayName({ label: 'Hypertrophy A', tag: 'PUSH', name: 'Push Day 1' }, 0),
    ).toBe('Hypertrophy A');
  });

  it('derives Upper Body from UPPER tag even when name is a stale PPL string', () => {
    // The bug we are fixing — meso days carry old "Push Day 1" name after
    // splitType changes, but tag is structurally correct.
    expect(dayDisplayName({ tag: 'UPPER', name: 'Push Day 1' }, 0)).toBe('Upper Body');
  });

  it('derives Lower Body from LOWER tag', () => {
    expect(dayDisplayName({ tag: 'LOWER', name: 'Pull Day 2' }, 1)).toBe('Lower Body');
  });

  it('derives Push Day from PUSH tag when name is missing', () => {
    expect(dayDisplayName({ tag: 'PUSH' }, 0)).toBe('Push Day');
  });

  it('handles ARMS / FULL / CARDIO / MOBILITY / BW tags', () => {
    expect(dayDisplayName({ tag: 'ARMS' })).toBe('Arm Day');
    expect(dayDisplayName({ tag: 'FULL' })).toBe('Full Body');
    expect(dayDisplayName({ tag: 'CARDIO' })).toBe('Cardio');
    expect(dayDisplayName({ tag: 'MOBILITY' })).toBe('Mobility');
    expect(dayDisplayName({ tag: 'BW' })).toBe('Bodyweight');
  });

  it('is case-insensitive on tag', () => {
    expect(dayDisplayName({ tag: 'upper' }, 0)).toBe('Upper Body');
  });

  it('falls back to day.name when tag is unrecognised', () => {
    expect(dayDisplayName({ tag: 'WHATEVER', name: 'Custom Day' }, 0)).toBe('Custom Day');
  });

  it('falls back to day.name when tag is missing', () => {
    expect(dayDisplayName({ name: 'My Special Day' }, 0)).toBe('My Special Day');
  });

  it('falls back to Day N when nothing else is set', () => {
    expect(dayDisplayName({}, 2)).toBe('Day 3');
  });

  it('returns Workout when day and idx are both missing', () => {
    expect(dayDisplayName(null)).toBe('Workout');
    expect(dayDisplayName(undefined)).toBe('Workout');
  });
});
