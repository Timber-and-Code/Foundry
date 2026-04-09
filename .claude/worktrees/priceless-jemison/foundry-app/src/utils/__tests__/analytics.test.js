/**
 * Tests for analytics.js:
 * getReadinessScore, getReadinessLabel, loadExerciseHistory, detectSessionPRs
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getReadinessScore,
  getReadinessLabel,
  loadExerciseHistory,
  detectSessionPRs,
} from '../analytics';

// ============================================================================
// getReadinessScore
// ============================================================================
describe('getReadinessScore', () => {
  it('returns null for null input', () => {
    expect(getReadinessScore(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getReadinessScore(undefined)).toBeNull();
  });

  it('returns 6 for all-optimal values (good sleep, low soreness, high energy)', () => {
    expect(getReadinessScore({ sleep: 'good', soreness: 'low', energy: 'high' })).toBe(6);
  });

  it('returns 0 for all-worst values (poor sleep, high soreness, low energy)', () => {
    expect(getReadinessScore({ sleep: 'poor', soreness: 'high', energy: 'low' })).toBe(0);
  });

  it('returns 3 for middle values (ok sleep, moderate soreness, moderate energy)', () => {
    expect(getReadinessScore({ sleep: 'ok', soreness: 'moderate', energy: 'moderate' })).toBe(3);
  });

  it('returns 4 for ok sleep + low soreness + moderate energy', () => {
    // ok=1, low=2, moderate=1 → 4
    expect(getReadinessScore({ sleep: 'ok', soreness: 'low', energy: 'moderate' })).toBe(4);
  });

  it('returns 5 for good sleep + low soreness + moderate energy', () => {
    // good=2, low=2, moderate=1 → 5
    expect(getReadinessScore({ sleep: 'good', soreness: 'low', energy: 'moderate' })).toBe(5);
  });

  it('returns null when sleep field is missing', () => {
    expect(getReadinessScore({ soreness: 'low', energy: 'high' })).toBeNull();
  });

  it('returns null when an unknown sleep value is provided', () => {
    expect(getReadinessScore({ sleep: 'excellent', soreness: 'low', energy: 'high' })).toBeNull();
  });

  it('returns null when soreness value is unrecognized', () => {
    expect(getReadinessScore({ sleep: 'good', soreness: 'none', energy: 'high' })).toBeNull();
  });
});

// ============================================================================
// getReadinessLabel
// ============================================================================
describe('getReadinessLabel', () => {
  it('returns null for null score', () => {
    expect(getReadinessLabel(null)).toBeNull();
  });

  it('returns READY label for score of 6', () => {
    const result = getReadinessLabel(6);
    expect(result.label).toBe('READY');
  });

  it('returns READY label for score of 5', () => {
    const result = getReadinessLabel(5);
    expect(result.label).toBe('READY');
  });

  it('returns MODERATE label for score of 4', () => {
    const result = getReadinessLabel(4);
    expect(result.label).toBe('MODERATE');
  });

  it('returns MODERATE label for score of 3', () => {
    const result = getReadinessLabel(3);
    expect(result.label).toBe('MODERATE');
  });

  it('returns LOW label for score of 2', () => {
    const result = getReadinessLabel(2);
    expect(result.label).toBe('LOW');
  });

  it('returns LOW label for score of 0', () => {
    const result = getReadinessLabel(0);
    expect(result.label).toBe('LOW');
  });

  it('LOW label includes a banner message', () => {
    const result = getReadinessLabel(0);
    expect(result.banner).not.toBeNull();
    expect(typeof result.banner).toBe('string');
  });

  it('READY label has null banner', () => {
    const result = getReadinessLabel(6);
    expect(result.banner).toBeNull();
  });

  it('MODERATE label has null banner', () => {
    const result = getReadinessLabel(3);
    expect(result.banner).toBeNull();
  });

  it('each label includes an advice string', () => {
    [0, 3, 6].forEach((score) => {
      const result = getReadinessLabel(score);
      expect(typeof result.advice).toBe('string');
      expect(result.advice.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// loadExerciseHistory
// ============================================================================
describe('loadExerciseHistory', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty array when no done markers exist', () => {
    const rows = loadExerciseHistory(0, 0, 4);
    expect(rows).toEqual([]);
  });

  it('returns empty array when done but no day data stored', () => {
    localStorage.setItem('foundry:done:d0:w0', '1');
    const rows = loadExerciseHistory(0, 0, 4);
    expect(rows).toEqual([]);
  });

  it('returns one row for a single completed week with data', () => {
    localStorage.setItem('foundry:done:d0:w0', '1');
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: '100', reps: '8' } } })
    );
    const rows = loadExerciseHistory(0, 0, 4);
    expect(rows).toHaveLength(1);
    expect(rows[0].week).toBe(0);
    expect(rows[0].sets).toHaveLength(1);
    expect(rows[0].sets[0].weight).toBe('100');
  });

  it('returns rows in reverse order (most recent week first)', () => {
    for (let w = 0; w < 3; w++) {
      localStorage.setItem(`foundry:done:d0:w${w}`, '1');
      localStorage.setItem(
        `foundry:day0:week${w}`,
        JSON.stringify({ 0: { 0: { weight: String(100 + w * 5), reps: '8' } } })
      );
    }
    const rows = loadExerciseHistory(0, 0, 4);
    expect(rows).toHaveLength(3);
    // reverse() makes most recent (week 2) come first
    expect(rows[0].week).toBe(2);
    expect(rows[2].week).toBe(0);
  });

  it('skips weeks that are not marked done', () => {
    // Week 0 done, week 1 not done, week 2 done
    localStorage.setItem('foundry:done:d0:w0', '1');
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: '100', reps: '8' } } })
    );
    localStorage.setItem(
      'foundry:day0:week1',
      JSON.stringify({ 0: { 0: { weight: '105', reps: '8' } } })
    );
    localStorage.setItem('foundry:done:d0:w2', '1');
    localStorage.setItem(
      'foundry:day0:week2',
      JSON.stringify({ 0: { 0: { weight: '110', reps: '8' } } })
    );
    const rows = loadExerciseHistory(0, 0, 4);
    expect(rows).toHaveLength(2);
  });
});

// ============================================================================
// detectSessionPRs — additional coverage beyond core.test.js
// ============================================================================
describe('detectSessionPRs — additional coverage', () => {
  beforeEach(() => localStorage.clear());

  const exercises = [
    { id: 'squat', name: 'Barbell Squat' },
    { id: 'bench', name: 'Bench Press' },
  ];

  it('returns multiple PRs when multiple exercises beat prior bests', () => {
    // Prior week data for both exercises
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({
        0: { 0: { weight: '200', reps: '5' } },
        1: { 0: { weight: '100', reps: '8' } },
      })
    );
    const weekData = {
      0: { 0: { weight: '205', reps: '5' } },
      1: { 0: { weight: '105', reps: '8' } },
    };
    const prs = detectSessionPRs(exercises, weekData, 'meso', { dayIdx: 0, weekIdx: 1 });
    expect(prs).toHaveLength(2);
    expect(prs.map((p) => p.name)).toContain('Barbell Squat');
    expect(prs.map((p) => p.name)).toContain('Bench Press');
  });

  it('does not return PR when weight exactly ties prior best (must strictly improve)', () => {
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: '100', reps: '8' } } })
    );
    const weekData = { 0: { 0: { weight: '100', reps: '8' } } };
    const prs = detectSessionPRs(
      [{ id: 'bench', name: 'Bench Press' }],
      weekData,
      'meso',
      { dayIdx: 0, weekIdx: 1 }
    );
    expect(prs).toHaveLength(0);
  });

  it('handles exercises with reps but no weight (no PR)', () => {
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: '', reps: '10' } } })
    );
    const weekData = { 0: { 0: { weight: '', reps: '12' } } };
    const prs = detectSessionPRs(
      [{ id: 'pullup', name: 'Pull-up' }],
      weekData,
      'meso',
      { dayIdx: 0, weekIdx: 1 }
    );
    expect(prs).toHaveLength(0);
  });

  it('only detects PR for the exercise that improved, not all', () => {
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({
        0: { 0: { weight: '200', reps: '5' } },
        1: { 0: { weight: '150', reps: '8' } },
      })
    );
    // squat improved, bench did not
    const weekData = {
      0: { 0: { weight: '210', reps: '5' } },
      1: { 0: { weight: '145', reps: '8' } },
    };
    const prs = detectSessionPRs(exercises, weekData, 'meso', { dayIdx: 0, weekIdx: 1 });
    expect(prs).toHaveLength(1);
    expect(prs[0].name).toBe('Barbell Squat');
  });

  it('mode extra — returns empty when exercise has no id', () => {
    const weekData = { 0: { 0: { weight: '100', reps: '8' } } };
    const prs = detectSessionPRs(
      [{ name: 'No ID Exercise' }],
      weekData,
      'extra',
      { activeDays: [], currentDateStr: '2024-01-01' }
    );
    expect(prs).toHaveLength(0);
  });
});
