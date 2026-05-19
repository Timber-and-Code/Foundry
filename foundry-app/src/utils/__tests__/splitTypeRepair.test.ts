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
  it('classifies Upper/Lower from day labels', () => {
    expect(classifyUnambiguousSplit(['Upper A', 'Lower A', 'Upper B'])).toBe('upper_lower');
    expect(classifyUnambiguousSplit(['Upper Body', 'Lower Body'])).toBe('upper_lower');
  });

  it('classifies Full Body from day labels', () => {
    expect(classifyUnambiguousSplit(['Full Body A', 'Full Body B'])).toBe('full_body');
  });

  it('returns null for PPL labels — ambiguous vs a 4-day Traditional', () => {
    expect(classifyUnambiguousSplit(['Push Day', 'Pull Day', 'Legs Day'])).toBeNull();
    expect(classifyUnambiguousSplit(['Push 1', 'Pull 1', 'Legs 1'])).toBeNull();
  });

  it('returns null for Traditional labels — never auto-corrected', () => {
    expect(classifyUnambiguousSplit(['Chest', 'Back', 'Legs', 'Shoulders + Arms'])).toBeNull();
    expect(classifyUnambiguousSplit(['Arms', 'Shoulders', 'Back', 'Chest', 'Legs'])).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(classifyUnambiguousSplit(['upper a', 'LOWER B'])).toBe('upper_lower');
  });

  it('returns null for empty labels', () => {
    expect(classifyUnambiguousSplit([])).toBeNull();
    expect(classifyUnambiguousSplit(['', ''])).toBeNull();
  });
});

describe('repairDriftedSplitType', () => {
  beforeEach(() => localStorage.clear());

  // Days carry a deliberately WRONG tag ('PUSH') — a synced Upper/Lower
  // program really does look like this. The repair must classify from the
  // label and ignore the tag entirely.
  const seed = (splitType: string, labels: string[]) => {
    localStorage.setItem('foundry:profile', JSON.stringify({ splitType, mesoLength: 6 }));
    localStorage.setItem(
      'foundry:storedProgram',
      JSON.stringify(labels.map((label, i) => ({ dayNum: i + 1, label, tag: 'PUSH', exercises: [] }))),
    );
  };

  it('corrects a drifted ppl → upper_lower from labels, ignoring PPL-style tags', () => {
    seed('ppl', ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C']);
    const r = repairDriftedSplitType();
    expect(r).toEqual({ repaired: true, from: 'ppl', to: 'upper_lower' });
    expect(JSON.parse(localStorage.getItem('foundry:profile')!).splitType).toBe('upper_lower');
    expect(localStorage.getItem('foundry:flag:splitType_repair_v2')).toBe('1');
  });

  it('is idempotent — a second run is a no-op', () => {
    seed('ppl', ['Upper A', 'Lower A']);
    repairDriftedSplitType();
    expect(repairDriftedSplitType().repaired).toBe(false);
  });

  it('leaves a genuine PPL meso untouched', () => {
    seed('ppl', ['Push Day', 'Pull Day', 'Legs Day']);
    const r = repairDriftedSplitType();
    expect(r.repaired).toBe(false);
    expect(JSON.parse(localStorage.getItem('foundry:profile')!).splitType).toBe('ppl');
    expect(localStorage.getItem('foundry:flag:splitType_repair_v2')).toBe('1');
  });

  it('does not latch the flag when storedProgram is missing — retries next launch', () => {
    localStorage.setItem('foundry:profile', JSON.stringify({ splitType: 'ppl' }));
    expect(repairDriftedSplitType().repaired).toBe(false);
    expect(localStorage.getItem('foundry:flag:splitType_repair_v2')).toBeNull();
  });

  it('is a no-op when splitType already matches the program', () => {
    seed('upper_lower', ['Upper A', 'Lower A']);
    const r = repairDriftedSplitType();
    expect(r.repaired).toBe(false);
    expect(localStorage.getItem('foundry:flag:splitType_repair_v2')).toBe('1');
  });
});
