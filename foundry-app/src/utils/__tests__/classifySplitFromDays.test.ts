import { describe, it, expect } from 'vitest';
import { classifySplitFromDays } from '../splitLabel';

describe('classifySplitFromDays', () => {
  it('returns null for empty / missing input', () => {
    expect(classifySplitFromDays(null)).toBeNull();
    expect(classifySplitFromDays(undefined)).toBeNull();
    expect(classifySplitFromDays([])).toBeNull();
  });

  it('classifies an Upper/Lower split', () => {
    expect(
      classifySplitFromDays([{ tag: 'UPPER' }, { tag: 'LOWER' }, { tag: 'UPPER' }, { tag: 'LOWER' }]),
    ).toBe('upper_lower');
  });

  it('classifies a Push/Pull/Legs split', () => {
    expect(
      classifySplitFromDays([{ tag: 'PUSH' }, { tag: 'PULL' }, { tag: 'LEGS' }]),
    ).toBe('ppl');
  });

  it('classifies a Push/Pull split (no leg day)', () => {
    expect(classifySplitFromDays([{ tag: 'PUSH' }, { tag: 'PULL' }])).toBe('push_pull');
  });

  it('classifies a Full Body split', () => {
    expect(classifySplitFromDays([{ tag: 'FULL' }, { tag: 'FULL' }, { tag: 'FULL' }])).toBe(
      'full_body',
    );
  });

  it('classifies Traditional via the ARMS day even with PPL-style tags present', () => {
    // The disambiguation that the naive day-tag union got wrong.
    expect(
      classifySplitFromDays([
        { tag: 'PUSH' },
        { tag: 'PULL' },
        { tag: 'LEGS' },
        { tag: 'ARMS' },
      ]),
    ).toBe('traditional');
  });

  it('ignores non-lifting tags (CARDIO / MOBILITY / BW / rest)', () => {
    expect(
      classifySplitFromDays([
        { tag: 'UPPER' },
        { tag: 'LOWER' },
        { tag: 'CARDIO' },
        { tag: 'MOBILITY' },
        { tag: undefined },
      ]),
    ).toBe('upper_lower');
  });

  it('is case-insensitive on tags', () => {
    expect(classifySplitFromDays([{ tag: 'upper' }, { tag: 'lower' }])).toBe('upper_lower');
  });

  it('returns null when tags cannot be confidently classified', () => {
    // A lone LEGS day, or only non-lifting tags — not a nameable split.
    expect(classifySplitFromDays([{ tag: 'LEGS' }])).toBeNull();
    expect(classifySplitFromDays([{ tag: 'CARDIO' }, { tag: 'MOBILITY' }])).toBeNull();
  });
});
