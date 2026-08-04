/**
 * Lifetime totals for the profile drawer.
 *
 * Everything else in that drawer is scoped to the current cycle, so nothing
 * in the app answered "how much have I actually done". This is that number —
 * which means an inflated one is worse than none at all.
 */
import { describe, it, expect } from 'vitest';
import { summarizeLifetime } from '../progressAggregation';
import type { ArchiveEntry } from '../../types';

const meso = (
  id: string,
  sessions: { d: number; w: number; done?: boolean; data: unknown }[],
  extra: Record<string, unknown> = {},
): unknown => ({ id, sessions, ...extra });

const set = (weight: number | undefined, reps: number | undefined, warmup = false) =>
  ({ _exId: 'x', weight, reps, warmup });

describe('summarizeLifetime', () => {
  it('totals cycles, completed sessions and working sets', () => {
    const archive = [
      meso('m1', [
        { d: 0, w: 0, done: true, data: { 0: { 1: set(135, 8), 2: set(135, 8) } } },
        { d: 1, w: 0, done: true, data: { 0: { 1: set(95, 10) } } },
      ]),
      meso('m2', [{ d: 0, w: 0, done: true, data: { 0: { 1: set(185, 5) } } }]),
    ] as unknown as ArchiveEntry[];

    expect(summarizeLifetime(archive)).toMatchObject({ cycles: 2, sessions: 3, sets: 4 });
  });

  it('counts sets from sessions never marked complete', () => {
    // The work happened whether or not you tapped Complete. Only the SESSION
    // count keys off the flag.
    const archive = [
      meso('m1', [{ d: 0, w: 0, done: false, data: { 0: { 1: set(100, 5) } } }]),
    ] as unknown as ArchiveEntry[];

    const out = summarizeLifetime(archive);
    expect(out.sessions).toBe(0);
    expect(out.sets).toBe(1);
  });

  it('excludes warmups and blank rows', () => {
    const archive = [
      meso('m1', [{
        d: 0, w: 0, done: true,
        data: { 0: { 1: set(45, 10, true), 2: set(0, 0), 3: set(undefined, undefined), 4: set(135, 8) } },
      }]),
    ] as unknown as ArchiveEntry[];

    expect(summarizeLifetime(archive).sets).toBe(1);
  });

  it('counts bodyweight work logged as reps with no weight', () => {
    const archive = [
      meso('m1', [{ d: 0, w: 0, done: true, data: { 0: { 1: set(undefined, 12) } } }]),
    ] as unknown as ArchiveEntry[];

    expect(summarizeLifetime(archive).sets).toBe(1);
  });

  it('reports the earliest start date across all cycles', () => {
    const trained = [{ d: 0, w: 0, done: true, data: { 0: { 1: set(100, 5) } } }];
    const archive = [
      meso('m2', trained, { profile: { startDate: '2026-06-01' } }),
      meso('m1', trained, { profile: { startDate: '2026-03-15' } }),
    ] as unknown as ArchiveEntry[];

    expect(summarizeLifetime(archive).since).toBe('2026-03-15');
  });

  it('falls back to archivedAt when a cycle has no start date', () => {
    const archive = [
      meso('m1', [{ d: 0, w: 0, done: true, data: { 0: { 1: set(100, 5) } } }],
           { archivedAt: '2026-04-20T00:00:00Z' }),
    ] as unknown as ArchiveEntry[];

    expect(summarizeLifetime(archive).since).toBe('2026-04-20T00:00:00Z');
  });

  it('does not count a cycle that was never trained', () => {
    // Prod has three mesocycles with zero sessions — builds started and
    // dropped. The remote rebuild already refuses them, but a locally
    // written archive entry survives the merge, and counting it would
    // inflate the one number this summary exists to state honestly.
    const archive = [
      meso('trained', [{ d: 0, w: 0, done: true, data: { 0: { 1: set(135, 8) } } }],
           { profile: { startDate: '2026-05-01' } }),
      meso('empty-shell', [], { profile: { startDate: '2026-01-01' } }),
      meso('opened-never-logged', [{ d: 0, w: 0, done: false, data: {} }],
           { profile: { startDate: '2026-02-01' } }),
    ] as unknown as ArchiveEntry[];

    const out = summarizeLifetime(archive);
    expect(out.cycles).toBe(1);
    // The untrained cycles must not drag the "since" line back either — it
    // would claim you have been training since January on no evidence.
    expect(out.since).toBe('2026-05-01');
  });

  it('returns zeroes for an empty, null or malformed archive', () => {
    expect(summarizeLifetime([])).toEqual({ cycles: 0, sessions: 0, sets: 0, since: null });
    expect(summarizeLifetime(null as unknown as ArchiveEntry[]).cycles).toBe(0);
    expect(summarizeLifetime([{ id: 'x' }] as unknown as ArchiveEntry[]))
      .toMatchObject({ cycles: 0, sessions: 0, sets: 0 });
  });
});
