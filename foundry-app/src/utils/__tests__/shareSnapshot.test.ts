import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../data/constants', () => ({
  getMeso: () => ({ totalWeeks: 6, days: 4 }),
  getWeekPhase: () => ['Establish', 'Accumulation', 'Accumulation', 'Intensification', 'Peak', 'Deload'],
  randomQuote: () => ({ text: 'Forge on.', author: 'Coach' }),
}));

import {
  saveShareSnapshot,
  loadShareSnapshot,
  canShareSession,
  rebuildShareSnapshot,
  resolveShareSnapshot,
  buildShareStats,
  buildShareCaption,
  shareSnapshotKey,
  type ShareSnapshot,
} from '../shareSnapshot';
import type { Exercise, TrainingDay } from '../../types';

const bench = { id: 'bench', name: 'Barbell Bench', anchor: true, sets: 3, reps: '6-8' } as unknown as Exercise;
const row = { id: 'row', name: 'Cable Row', sets: 3, reps: '10-12' } as unknown as Exercise;
const day = { label: 'Push A', tag: 'PUSH', exercises: [bench, row] } as unknown as TrainingDay;
const activeDays = [day];

const set = (weight: number, reps: number, exId: string, extra: Record<string, unknown> = {}) => ({
  weight,
  reps,
  confirmed: true,
  _exId: exId,
  ...extra,
});

const snap: ShareSnapshot = {
  v: 1,
  dayIdx: 0,
  weekIdx: 2,
  dayLabel: 'Push A',
  phase: 'Accumulation',
  stats: {
    sets: 6,
    reps: 50,
    volume: 9000,
    exercises: 2,
    duration: 3000,
    prs: [],
    anchorComparison: [],
    breakdown: [],
  },
  quote: { text: 'Forge on.', author: 'Coach' },
  dateStr: '2026-10-21',
};

describe('shareSnapshot', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a snapshot by session', () => {
    saveShareSnapshot(snap);
    expect(localStorage.getItem(shareSnapshotKey(0, 2))).toBeTruthy();
    expect(loadShareSnapshot(0, 2)).toEqual(snap);
    expect(loadShareSnapshot(0, 3)).toBeNull();
  });

  it('rejects a corrupt or foreign-version snapshot', () => {
    localStorage.setItem(shareSnapshotKey(0, 2), '{not json');
    expect(loadShareSnapshot(0, 2)).toBeNull();
    localStorage.setItem(shareSnapshotKey(0, 2), JSON.stringify({ v: 99 }));
    expect(loadShareSnapshot(0, 2)).toBeNull();
  });

  it('canShareSession: a snapshot or logged work, nothing otherwise', () => {
    expect(canShareSession(0, 2)).toBe(false);
    saveShareSnapshot(snap);
    expect(canShareSession(0, 2)).toBe(true);
    localStorage.clear();
    localStorage.setItem('foundry:day0:week2', JSON.stringify({ 0: { 0: set(185, 6, 'bench') } }));
    expect(canShareSession(0, 2)).toBe(true);
    // Warm-ups alone are not a session.
    localStorage.setItem('foundry:day0:week2', JSON.stringify({ 0: { 0: set(95, 10, 'bench', { warmup: true }) } }));
    expect(canShareSession(0, 2)).toBe(false);
  });

  it('buildShareStats totals working sets only and keeps warm-ups in the breakdown', () => {
    const weekData = {
      0: { 0: set(95, 10, 'bench', { warmup: true }), 1: set(185, 6, 'bench'), 2: set(185, 5, 'bench') },
      1: { 0: set(120, 12, 'row'), 1: { weight: 120, reps: '' } },
    };
    const stats = buildShareStats([bench, row], weekData as never, 0, 0, 2400);
    expect(stats.sets).toBe(3);
    expect(stats.reps).toBe(23);
    expect(stats.volume).toBe(185 * 6 + 185 * 5 + 120 * 12);
    expect(stats.exercises).toBe(2);
    expect(stats.duration).toBe(2400);
    expect(stats.isDeload).toBe(false);
    expect(stats.breakdown).toEqual([
      {
        name: 'Barbell Bench',
        anchor: true,
        sets: [
          { reps: 10, weight: 95, warmup: true },
          { reps: 6, weight: 185, warmup: false },
          { reps: 5, weight: 185, warmup: false },
        ],
      },
      { name: 'Cable Row', anchor: false, sets: [{ reps: 12, weight: 120, warmup: false }] },
    ]);
  });

  it('buildShareStats compares anchors against last week by exercise identity', () => {
    // Last week the bench sat in slot 1 (reordered since).
    localStorage.setItem(
      'foundry:day0:week1',
      JSON.stringify({ 0: { 0: set(120, 12, 'row') }, 1: { 0: set(175, 6, 'bench') } }),
    );
    const weekData = { 0: { 0: set(185, 6, 'bench') }, 1: { 0: set(120, 12, 'row') } };
    const stats = buildShareStats([bench, row], weekData as never, 0, 2, null);
    expect(stats.anchorComparison).toEqual([{ name: 'Barbell Bench', today: 185, prev: 175, delta: 10 }]);
    expect(stats.prs).toEqual([{ name: 'Barbell Bench', newBest: 185, prevBest: 175 }]);
  });

  it('rebuildShareSnapshot resolves a stored week whose slots no longer match the program', () => {
    // Stored with bench in slot 1 and row in slot 0; today's program is bench, row.
    localStorage.setItem(
      'foundry:day0:week2',
      JSON.stringify({ 0: { 0: set(120, 12, 'row') }, 1: { 0: set(185, 6, 'bench'), 1: set(185, 6, 'bench') } }),
    );
    localStorage.setItem('foundry:sess:lift:d0:w2', '48');
    localStorage.setItem('foundry:completedDate:d0:w2', '2026-10-20');
    const rebuilt = rebuildShareSnapshot(activeDays, 0, 2, 'm');
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.dayLabel).toBe('Push A');
    expect(rebuilt!.phase).toBe('Accumulation');
    expect(rebuilt!.stats.sets).toBe(3);
    expect(rebuilt!.stats.volume).toBe(185 * 12 + 120 * 12);
    expect(rebuilt!.stats.duration).toBe(48 * 60);
    expect(rebuilt!.stats.breakdown!.map((b) => b.name)).toEqual(['Barbell Bench', 'Cable Row']);
    expect(rebuilt!.quote).toEqual({ text: 'Forge on.', author: 'Coach' });
    expect(rebuilt!.dateStr).toBe('2026-10-20');
  });

  it('rebuildShareSnapshot is null without logged work or without the day', () => {
    expect(rebuildShareSnapshot(activeDays, 0, 2)).toBeNull();
    localStorage.setItem('foundry:day3:week2', JSON.stringify({ 0: { 0: set(185, 6, 'bench') } }));
    expect(rebuildShareSnapshot(activeDays, 3, 2)).toBeNull();
  });

  it('resolveShareSnapshot prefers the saved card over a rebuild', () => {
    localStorage.setItem('foundry:day0:week2', JSON.stringify({ 0: { 0: set(185, 6, 'bench') } }));
    saveShareSnapshot(snap);
    expect(resolveShareSnapshot(activeDays, 0, 2)).toEqual(snap);
    localStorage.removeItem(shareSnapshotKey(0, 2));
    expect(resolveShareSnapshot(activeDays, 0, 2)?.stats.sets).toBe(1);
  });

  it('buildShareCaption leads with the PR', () => {
    const text = buildShareCaption('Push A', 1, 'Accumulation', {
      ...snap.stats,
      prs: [{ name: 'Bench', newBest: 185, prevBest: 175 }],
    });
    expect(text).toContain('New PR: Bench 185 lb');
    expect(text).toContain('Push A, week 2 · Accumulation');
    expect(text).toContain('6 sets, 9,000 lb moved');
  });
});
