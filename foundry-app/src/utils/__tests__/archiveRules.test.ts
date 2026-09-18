/**
 * The abandoned/empty meso rules (utils/archiveRules.ts) and every place they
 * bite: the local writer, every reader, the remote rebuild's merge, Previous
 * Meso Cycles numbering, and the remote end-early call.
 *
 *   - Logged work is permanent history; ending early changes the label only.
 *   - No logged WORKING sets = no record anywhere.
 *   - Early-ended mesos count for data, not for meso numbering.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { hasLoggedWork, isEmptyMeso, isLegacyTwin, weeksReached } from '../archiveRules';
import { archiveCurrentMeso, loadArchive } from '../archive';
import { mergeArchiveEntries } from '../sync';
import { aggregatePreviousMesos } from '../progressAggregation';
import type { ArchiveEntry } from '../../types';

const set = (reps: unknown, extra: Record<string, unknown> = {}) => ({ weight: 100, reps, ...extra });
const session = (w: number, data: unknown) => ({ d: 0, w, data });
const WORK = [session(0, { 0: { 0: set(5) } })];

describe('hasLoggedWork / isEmptyMeso', () => {
  it('a working set with reps is work', () => {
    expect(hasLoggedWork({ sessions: WORK })).toBe(true);
  });

  it('warm-ups, blank reps and suggestions-only sets are not', () => {
    const entry = {
      sessions: [
        session(0, { 0: { 0: set(5, { warmup: true }), 1: set(''), 2: set('0') }, _exId: 'bench' }),
      ],
    };
    expect(hasLoggedWork(entry)).toBe(false);
    expect(isEmptyMeso(entry)).toBe(true);
  });

  it('ignores the per-slice _exId stamp instead of choking on it', () => {
    expect(hasLoggedWork({ sessions: [session(0, { 0: { _exId: 'bench', 0: set(8) } })] })).toBe(true);
  });

  it('an entry with no session detail at all is legacy history, not empty', () => {
    expect(isEmptyMeso({ id: 1 })).toBe(false);
  });

  it('weeksReached is the furthest week with work, 1-based', () => {
    expect(weeksReached({ sessions: [...WORK, session(2, { 0: { 0: set(6) } }), session(4, {})] })).toBe(3);
  });
});

describe('archiveCurrentMeso', () => {
  const profile = { experience: 'intermediate', splitType: 'ppl', mesoLength: 4, daysPerWeek: 3 } as never;
  beforeEach(() => localStorage.clear());

  it('does not archive a meso with nothing logged', () => {
    localStorage.setItem('foundry:done:d0:w0', '1'); // marked done, no sets
    archiveCurrentMeso(profile, { status: 'abandoned' });
    expect(loadArchive()).toEqual([]);
  });

  it('keys the entry by meso uuid and records how it ended', () => {
    localStorage.setItem('foundry:active_meso_id', 'meso-uuid-1');
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ 0: { 0: set(5) } }));
    archiveCurrentMeso(profile, { status: 'abandoned' });
    const [entry] = loadArchive() as (ArchiveEntry & { status?: string })[];
    expect(entry.id).toBe('meso-uuid-1');
    expect(entry.status).toBe('abandoned');
  });

  it('defaults to completed, and re-archiving the same meso replaces it', () => {
    localStorage.setItem('foundry:active_meso_id', 'meso-uuid-1');
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ 0: { 0: set(5) } }));
    archiveCurrentMeso(profile);
    archiveCurrentMeso(profile);
    const archive = loadArchive() as (ArchiveEntry & { status?: string })[];
    expect(archive).toHaveLength(1);
    expect(archive[0].status).toBe('completed');
  });

  it('readers drop empty entries already on disk', () => {
    localStorage.setItem(
      'foundry:archive',
      JSON.stringify([
        { id: 'empty', archivedAt: '2026-09-18', sessions: [] },
        { id: 'real', archivedAt: '2026-08-01', sessions: WORK },
      ]),
    );
    expect(loadArchive().map((e) => e.id)).toEqual(['real']);
  });
});

describe('legacy local twins', () => {
  // Before 2.15.6 the local writer used Date.now() for the id while the
  // remote rebuild keys by meso uuid — the same meso landed twice.
  const derived = { id: 'meso-uuid-1', archivedAt: '2026-09-18', mesoDays: 4, sessions: WORK };

  it('drops a Date.now()-keyed local entry ended the same UTC day', () => {
    const local = { id: 1789000000000, archivedAt: '2026-09-18T14:40:07.000Z', mesoDays: 4, sessions: WORK };
    expect(isLegacyTwin(local, derived)).toBe(true);
    const merged = mergeArchiveEntries([derived], JSON.stringify([local]));
    expect(merged.map((e) => e.id)).toEqual(['meso-uuid-1']);
  });

  it('keeps a local-only meso from another day, or with another shape', () => {
    const otherDay = { id: 1780000000000, archivedAt: '2026-06-01T10:00:00.000Z', mesoDays: 4, sessions: WORK };
    const otherShape = { id: 1789000000001, archivedAt: '2026-09-18T15:00:00.000Z', mesoDays: 6, sessions: WORK };
    const merged = mergeArchiveEntries([derived], JSON.stringify([otherDay, otherShape]));
    expect(merged.map((e) => String(e.id))).toEqual(['1789000000001', 'meso-uuid-1', '1780000000000']);
  });

  it('never treats a uuid-keyed local entry as a legacy twin', () => {
    expect(isLegacyTwin({ id: 'meso-uuid-2', archivedAt: '2026-09-18' }, derived)).toBe(false);
  });
});

describe('Previous Meso Cycles numbering', () => {
  it('numbers completed mesos only; early-ended ones carry week reached', () => {
    const archive = [
      { id: 'c2', status: 'completed', mesoWeeks: 7, sessions: WORK },
      { id: 'a1', status: 'abandoned', mesoWeeks: 7, sessions: [...WORK, session(1, { 0: { 0: set(6) } })] },
      { id: 'legacy', mesoWeeks: 7, sessions: WORK }, // no status = completed
    ] as unknown as ArchiveEntry[];
    const out = aggregatePreviousMesos(archive, []);
    expect(out.map((m) => m.number)).toEqual([2, null, 1]);
    expect(out[1].endedEarly).toEqual({ week: 2, of: 7 });
    expect(out[0].endedEarly).toBeUndefined();
  });
});
