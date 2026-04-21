/**
 * Tests for training.ts helpers that are not covered by core.test.js or
 * persistence.test.js. Currently focused on computeMobilityStreak.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { computeMobilityStreak } from '../training';
import { saveMobilitySession } from '../persistence';

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number, from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() - n);
  return d;
}

describe('computeMobilityStreak', () => {
  beforeEach(() => localStorage.clear());

  it('returns 0 when no sessions exist', () => {
    expect(computeMobilityStreak()).toBe(0);
  });

  it('returns 1 when only today has a completed session', () => {
    const today = new Date();
    saveMobilitySession(toDateStr(today), { completed: true });
    expect(computeMobilityStreak(today)).toBe(1);
  });

  it('returns 1 when today is empty but yesterday is completed (grace window)', () => {
    const today = new Date();
    saveMobilitySession(toDateStr(daysAgo(1, today)), { completed: true });
    expect(computeMobilityStreak(today)).toBe(1);
  });

  it('counts a 3-day chain ending today', () => {
    const today = new Date();
    saveMobilitySession(toDateStr(today), { completed: true });
    saveMobilitySession(toDateStr(daysAgo(1, today)), { completed: true });
    saveMobilitySession(toDateStr(daysAgo(2, today)), { completed: true });
    expect(computeMobilityStreak(today)).toBe(3);
  });

  it('stops at the first gap when walking backward', () => {
    const today = new Date();
    // Chain: today, -1, -2 completed; -3 missing; -4 completed (unreachable)
    saveMobilitySession(toDateStr(today), { completed: true });
    saveMobilitySession(toDateStr(daysAgo(1, today)), { completed: true });
    saveMobilitySession(toDateStr(daysAgo(2, today)), { completed: true });
    saveMobilitySession(toDateStr(daysAgo(4, today)), { completed: true });
    expect(computeMobilityStreak(today)).toBe(3);
  });

  it('treats a saved-but-uncompleted today as "not yet done" (falls back to yesterday)', () => {
    const today = new Date();
    // Today has a session but it is NOT completed → treated as no session,
    // so the grace window uses yesterday's completed session. Streak = 1.
    saveMobilitySession(toDateStr(today), { completed: false });
    saveMobilitySession(toDateStr(daysAgo(1, today)), { completed: true });
    expect(computeMobilityStreak(today)).toBe(1);
  });

  it('ignores yesterday when yesterday is saved-but-uncompleted', () => {
    const today = new Date();
    // Today empty, yesterday present but incomplete → streak breaks (0)
    saveMobilitySession(toDateStr(daysAgo(1, today)), { completed: false });
    expect(computeMobilityStreak(today)).toBe(0);
  });

  it('breaks the walk-backward chain at a saved-but-uncompleted day', () => {
    const today = new Date();
    // today and -1 completed, -2 saved-but-uncompleted (a break), -3 completed
    saveMobilitySession(toDateStr(today), { completed: true });
    saveMobilitySession(toDateStr(daysAgo(1, today)), { completed: true });
    saveMobilitySession(toDateStr(daysAgo(2, today)), { completed: false });
    saveMobilitySession(toDateStr(daysAgo(3, today)), { completed: true });
    expect(computeMobilityStreak(today)).toBe(2);
  });

  it('caps walk length to avoid pathological loops', () => {
    const today = new Date();
    // Seed 400 consecutive completed days — function should cap at 365
    for (let i = 0; i < 400; i++) {
      saveMobilitySession(toDateStr(daysAgo(i, today)), { completed: true });
    }
    const streak = computeMobilityStreak(today);
    expect(streak).toBeGreaterThanOrEqual(365);
    expect(streak).toBeLessThanOrEqual(366);
  });
});
