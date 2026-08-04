/**
 * Tests for mergeArchiveEntries — the fold behind chunk 5e (archive sync).
 *
 * foundry:archive was the only local store with no sync coverage, so a fresh
 * install or a sign-out/in erased every past mesocycle and with it the "last
 * meso" suggestion for lifts trained for months. Chunk 5e rebuilds it from
 * normalized tables. This fold is the risky half: get it wrong and the fix
 * itself destroys the local-only entries it was written to protect.
 *
 * Ordering is pinned because findLastMesoWeight reports `mesosAgo: i + 1`
 * straight off the array index — a bad sort silently misreports how long ago
 * a lift was trained rather than failing loudly.
 */
import { describe, it, expect, vi } from 'vitest';
import { mergeArchiveEntries } from '../sync';

const entry = (id: string, archivedAt: string | null) => ({ id, archivedAt });

describe('mergeArchiveEntries', () => {
  it('keeps local-only entries the remote rebuild knows nothing about', () => {
    // A meso archived offline: numeric Date.now() id, never reached Supabase.
    const local = JSON.stringify([entry('1714003200000', '2026-04-25T00:00:00Z')]);
    const merged = mergeArchiveEntries([entry('meso-uuid-1', '2026-07-01T00:00:00Z')], local);

    expect(merged.map((e) => e.id)).toEqual(['meso-uuid-1', '1714003200000']);
  });

  it('lets the derived entry win over its locally-written twin', () => {
    // Same meso, two representations: the local writer's copy and the
    // rebuild. Keeping both would double-count it in Previous Meso Cycles
    // and shift every mesosAgo below it by one.
    const local = JSON.stringify([
      { id: 'meso-uuid-1', archivedAt: '2026-07-01T00:00:00Z', sessions: [], stale: true },
    ]);
    const merged = mergeArchiveEntries(
      [{ id: 'meso-uuid-1', archivedAt: '2026-07-01T00:00:00Z', sessions: [{ d: 0, w: 0 }] }],
      local,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).not.toHaveProperty('stale');
    expect((merged[0] as { sessions: unknown[] }).sessions).toHaveLength(1);
  });

  it('orders newest first so mesosAgo counts backwards correctly', () => {
    const merged = mergeArchiveEntries(
      [
        entry('old', '2026-01-01T00:00:00Z'),
        entry('newest', '2026-07-01T00:00:00Z'),
        entry('middle', '2026-04-01T00:00:00Z'),
      ],
      null,
    );

    expect(merged.map((e) => e.id)).toEqual(['newest', 'middle', 'old']);
  });

  it('interleaves local-only entries into the ordering by date', () => {
    const local = JSON.stringify([entry('local-mid', '2026-05-01T00:00:00Z')]);
    const merged = mergeArchiveEntries(
      [entry('remote-new', '2026-07-01T00:00:00Z'), entry('remote-old', '2026-02-01T00:00:00Z')],
      local,
    );

    expect(merged.map((e) => e.id)).toEqual(['remote-new', 'local-mid', 'remote-old']);
  });

  it('falls back to completedAt and date on entries lacking archivedAt', () => {
    // Older local entries used different timestamp field names.
    const local = JSON.stringify([
      { id: 'by-completed', completedAt: '2026-06-01T00:00:00Z' },
      { id: 'by-date', date: '2026-03-01T00:00:00Z' },
    ]);
    const merged = mergeArchiveEntries([entry('by-archived', '2026-04-15T00:00:00Z')], local);

    expect(merged.map((e) => e.id)).toEqual(['by-completed', 'by-archived', 'by-date']);
  });

  it('sorts an undated entry oldest instead of poisoning the comparison', () => {
    const local = JSON.stringify([{ id: 'no-timestamp' }, entry('dated', '2026-06-01T00:00:00Z')]);
    const merged = mergeArchiveEntries([entry('remote', '2026-07-01T00:00:00Z')], local);

    expect(merged.map((e) => e.id)).toEqual(['remote', 'dated', 'no-timestamp']);
  });

  it('survives corrupt local JSON without losing the derived entries', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const merged = mergeArchiveEntries([entry('meso-uuid-1', '2026-07-01T00:00:00Z')], '{not json');

    expect(merged.map((e) => e.id)).toEqual(['meso-uuid-1']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('handles a missing local key and a non-array payload', () => {
    expect(mergeArchiveEntries([entry('a', '2026-07-01T00:00:00Z')], null)).toHaveLength(1);
    expect(mergeArchiveEntries([entry('a', '2026-07-01T00:00:00Z')], '{"not":"an array"}')).toHaveLength(1);
  });

  it('drops local entries with no id rather than emitting an unkeyed record', () => {
    const local = JSON.stringify([{ archivedAt: '2026-06-01T00:00:00Z' }, { id: null }]);
    const merged = mergeArchiveEntries([entry('remote', '2026-07-01T00:00:00Z')], local);

    expect(merged.map((e) => e.id)).toEqual(['remote']);
  });

  it('applies no 10-entry cap — the local writer capped, this must not', () => {
    // archive.ts does `archive.slice(0, 10)`, silently dropping the 11th meso
    // onward. Deriving from remote is precisely what lifts that ceiling.
    const derived = Array.from({ length: 14 }, (_, i) =>
      entry(`meso-${i}`, `2026-0${(i % 9) + 1}-01T00:00:00Z`),
    );
    expect(mergeArchiveEntries(derived, null)).toHaveLength(14);
  });
});
