import { describe, it, expect, beforeEach, vi } from 'vitest';

// Inert Supabase + Sentry so saveProfile's fire-and-forget sync is a no-op.
vi.mock('../supabase.js', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  },
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { classifyUnambiguousSplit, repairDriftedSplitType } from '../splitTypeRepair';

describe('classifyUnambiguousSplit', () => {
  const S = (...t: string[]) => new Set(t);

  it('classifies Upper/Lower from UPPER/LOWER day tags', () => {
    expect(classifyUnambiguousSplit(S('UPPER', 'LOWER'))).toBe('upper_lower');
    expect(classifyUnambiguousSplit(S('UPPER'))).toBe('upper_lower');
  });

  it('classifies Full Body from FULL day tags', () => {
    expect(classifyUnambiguousSplit(S('FULL'))).toBe('full_body');
  });

  it('returns null for PPL-style tags — ambiguous vs a 4-day Traditional', () => {
    expect(classifyUnambiguousSplit(S('PUSH', 'PULL', 'LEGS'))).toBeNull();
    expect(classifyUnambiguousSplit(S('PUSH', 'PULL', 'LEGS', 'ARMS'))).toBeNull();
  });

  it('returns null when UPPER/LOWER mix with PPL tags — never guesses', () => {
    expect(classifyUnambiguousSplit(S('UPPER', 'LOWER', 'PUSH'))).toBeNull();
    expect(classifyUnambiguousSplit(S('FULL', 'LEGS'))).toBeNull();
  });

  it('ignores non-lifting tags (CARDIO etc.)', () => {
    expect(classifyUnambiguousSplit(S('UPPER', 'LOWER', 'CARDIO'))).toBe('upper_lower');
  });

  it('returns null for empty tags', () => {
    expect(classifyUnambiguousSplit(new Set())).toBeNull();
  });
});

describe('repairDriftedSplitType', () => {
  beforeEach(() => localStorage.clear());

  const seed = (splitType: string, tags: string[]) => {
    localStorage.setItem('foundry:profile', JSON.stringify({ splitType, mesoLength: 6 }));
    localStorage.setItem(
      'foundry:storedProgram',
      JSON.stringify(tags.map((tag, i) => ({ dayNum: i + 1, tag, exercises: [] }))),
    );
  };

  it('corrects a drifted ppl → upper_lower and latches the flag', () => {
    seed('ppl', ['UPPER', 'LOWER', 'UPPER', 'LOWER', 'UPPER']);
    const r = repairDriftedSplitType();
    expect(r).toEqual({ repaired: true, from: 'ppl', to: 'upper_lower' });
    expect(JSON.parse(localStorage.getItem('foundry:profile')!).splitType).toBe('upper_lower');
    expect(localStorage.getItem('foundry:flag:splitType_repair_v1')).toBe('1');
  });

  it('is idempotent — a second run is a no-op', () => {
    seed('ppl', ['UPPER', 'LOWER']);
    repairDriftedSplitType();
    expect(repairDriftedSplitType().repaired).toBe(false);
  });

  it('leaves a genuine PPL meso untouched', () => {
    seed('ppl', ['PUSH', 'PULL', 'LEGS']);
    const r = repairDriftedSplitType();
    expect(r.repaired).toBe(false);
    expect(JSON.parse(localStorage.getItem('foundry:profile')!).splitType).toBe('ppl');
    expect(localStorage.getItem('foundry:flag:splitType_repair_v1')).toBe('1');
  });

  it('does not latch the flag when storedProgram is missing — retries next launch', () => {
    localStorage.setItem('foundry:profile', JSON.stringify({ splitType: 'ppl' }));
    expect(repairDriftedSplitType().repaired).toBe(false);
    expect(localStorage.getItem('foundry:flag:splitType_repair_v1')).toBeNull();
  });

  it('is a no-op when splitType already matches the program', () => {
    seed('upper_lower', ['UPPER', 'LOWER']);
    const r = repairDriftedSplitType();
    expect(r.repaired).toBe(false);
    expect(localStorage.getItem('foundry:flag:splitType_repair_v1')).toBe('1');
  });
});
