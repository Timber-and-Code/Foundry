/**
 * Preview-then-apply contract.
 *
 * The load-bearing invariant is that what the lifter approves is what gets
 * written. generateProgram SHUFFLES, so the obvious implementation —
 * regenerate once to show a preview, regenerate again to commit — silently
 * hands back a different workout. These tests pin the commit path to the
 * previewed object.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: () => ({}) },
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { previewRebuild, previewRebuildAll, applyRebuild, rebuildWithLocks } from '../rebuildSession';
import { regenerateUntouchedDays } from '../regenerateDays';
import type { RegenerateOptions } from '../regenerateDays';
import { generateProgram } from '../program';
import { EXERCISE_DB } from '../../data/exercises';
import type { Profile } from '../../types';

const DB = EXERCISE_DB as unknown as NonNullable<RegenerateOptions['exerciseDB']>;

const profile = {
  splitType: 'full_body', daysPerWeek: 4, workoutDays: [1, 2, 4, 5],
  sessionDuration: 55, experience: 'intermediate', equipment: ['full_gym'],
  goal: 'build_muscle', mesoLength: 5,
} as unknown as Profile;

const storedProgram = () =>
  Array.from({ length: 4 }, (_, i) => ({
    dayNum: i + 1,
    label: `ORIGINAL ${i}`,
    tag: 'FULL',
    exercises: [
      { id: `orig_${i}_a`, name: `Original ${i}A`, anchor: true, sets: 3, reps: '8' },
      { id: `orig_${i}_b`, name: `Original ${i}B`, anchor: false, sets: 3, reps: '10' },
    ],
  }));

const seedProgram = () =>
  localStorage.setItem('foundry:storedProgram', JSON.stringify(storedProgram()));

const logWork = (dayIdx: number, weekIdx = 0) =>
  localStorage.setItem(
    `foundry:day${dayIdx}:week${weekIdx}`,
    JSON.stringify({ 0: { 1: { _exId: 'x', weight: 135, reps: 8, confirmed: true } } }),
  );

const idsOf = (program: unknown, dayIdx: number) =>
  ((program as { exercises: { id: string }[] }[])[dayIdx]?.exercises || []).map((e) => e.id);

describe('generateProgram is not deterministic', () => {
  // The premise the rest of this file rests on. If this ever starts passing,
  // the compute-once machinery is no longer load-bearing — but it is today.
  it('two calls can disagree', () => {
    const runs = new Set(
      Array.from({ length: 6 }, () =>
        JSON.stringify(
          generateProgram(profile, DB, { trainedIds: ['bb_back_squat'] }).map((d) =>
            d.exercises.map((e) => String(e.id)),
          ),
        ),
      ),
    );
    expect(runs.size).toBeGreaterThan(1);
  });
});

describe('previewRebuild', () => {
  beforeEach(() => localStorage.clear());

  it('describes the change without writing anything', () => {
    seedProgram();
    const before = localStorage.getItem('foundry:storedProgram');

    const preview = previewRebuild(profile, 2, DB);

    expect(preview).not.toBeNull();
    expect(preview!.dayIdx).toBe(2);
    expect(preview!.before.map((s) => s.id)).toEqual(['orig_2_a', 'orig_2_b']);
    expect(preview!.after.length).toBeGreaterThan(0);
    expect(preview!.changed).toBe(true);
    // Untouched on disk — this is a dry run.
    expect(localStorage.getItem('foundry:storedProgram')).toBe(before);
  });

  it('counts the other rebuildable days, excluding itself and logged ones', () => {
    seedProgram();
    logWork(0);

    const preview = previewRebuild(profile, 2, DB);

    // Days 0 (logged) and 2 (the subject) are excluded; 1 and 3 remain.
    expect(preview!.otherDays).toEqual([1, 3]);
  });

  it('refuses a day that has logged work', () => {
    seedProgram();
    logWork(2);
    expect(previewRebuild(profile, 2, DB)).toBeNull();
  });

  it('refuses when there is no stored program', () => {
    expect(previewRebuild(profile, 0, DB)).toBeNull();
  });
});

describe('applyRebuild', () => {
  beforeEach(() => localStorage.clear());

  it('writes exactly the previewed program, not a fresh draw', async () => {
    seedProgram();
    const preview = previewRebuild(profile, 2, DB)!;
    const promised = preview.after.map((s) => s.id);

    await applyRebuild(preview.result);

    const written = JSON.parse(localStorage.getItem('foundry:storedProgram')!);
    expect(idsOf(written, 2)).toEqual(promised);
  });

  it('leaves preserved days byte-identical', async () => {
    seedProgram();
    logWork(0);
    const preview = previewRebuild(profile, 2, DB)!;

    await applyRebuild(preview.result);

    const written = JSON.parse(localStorage.getItem('foundry:storedProgram')!);
    expect(idsOf(written, 0)).toEqual(['orig_0_a', 'orig_0_b']);
    expect(idsOf(written, 1)).toEqual(['orig_1_a', 'orig_1_b']);
    expect(idsOf(written, 3)).toEqual(['orig_3_a', 'orig_3_b']);
  });

  it('clears swap overrides for the rebuilt day only', async () => {
    seedProgram();
    localStorage.setItem('foundry:exov:d2:ex0', 'stale');
    localStorage.setItem('foundry:exov:d1:ex0', 'keep');

    const preview = previewRebuild(profile, 2, DB)!;
    await applyRebuild(preview.result);

    expect(localStorage.getItem('foundry:exov:d2:ex0')).toBeNull();
    expect(localStorage.getItem('foundry:exov:d1:ex0')).toBe('keep');
  });

  it('reports pushed when there is no meso to sync to', async () => {
    seedProgram();
    const preview = previewRebuild(profile, 2, DB)!;

    const { pushed, names } = await applyRebuild(preview.result);

    expect(pushed).toBe(true);
    expect(names).toHaveLength(1);
  });
});

describe('previewRebuildAll', () => {
  beforeEach(() => localStorage.clear());

  it('covers every day with no logged work', () => {
    seedProgram();
    logWork(0);

    const result = previewRebuildAll(profile, DB)!;

    expect(result.regenerated).toEqual([1, 2, 3]);
    expect(result.preserved).toEqual([0]);
    expect(result.committed).toBe(false);
  });

  it('returns null when every day is logged', () => {
    seedProgram();
    [0, 1, 2, 3].forEach((d) => logWork(d));
    expect(previewRebuildAll(profile, DB)).toBeNull();
  });

  it('applies the drawn program verbatim', async () => {
    seedProgram();
    const result = previewRebuildAll(profile, DB)!;
    const promised = result.regenerated.map((i) => idsOf(result.program, i));

    await applyRebuild(result);

    const written = JSON.parse(localStorage.getItem('foundry:storedProgram')!);
    result.regenerated.forEach((dayIdx, n) => {
      expect(idsOf(written, dayIdx)).toEqual(promised[n]);
    });
  });
});

describe('regenerateUntouchedDays commit option', () => {
  beforeEach(() => localStorage.clear());

  it('still commits what it just computed', () => {
    // The single-call path is unaffected by the shuffle problem — the bug was
    // only ever in calling it twice.
    seedProgram();
    const result = regenerateUntouchedDays(profile, { exerciseDB: DB, commit: true });
    const written = JSON.parse(localStorage.getItem('foundry:storedProgram')!);
    expect(written).toEqual(result.program);
  });
});

describe('otherLabels', () => {
  beforeEach(() => localStorage.clear());

  it('names the other rebuildable days so the UI never has to guess', () => {
    seedProgram();
    logWork(0);

    const preview = previewRebuild(profile, 2, DB)!;

    expect(preview.otherDays).toEqual([1, 3]);
    expect(preview.otherLabels).toEqual(['ORIGINAL 1', 'ORIGINAL 3']);
  });

  it('is empty when this is the only rebuildable day', () => {
    seedProgram();
    [0, 1, 3].forEach((d) => logWork(d));

    const preview = previewRebuild(profile, 2, DB)!;

    expect(preview.otherDays).toEqual([]);
    expect(preview.otherLabels).toEqual([]);
  });
});

/**
 * Lock-and-keep.
 *
 * The dedupe is the reason this exists: generateProgram has no concept of a
 * pinned slot, so a redraw can hand back an exercise the lifter has locked
 * elsewhere. Prescribing the same lift twice in one session is the exact
 * defect (two decline benches) that started this work.
 */
describe('rebuildWithLocks', () => {
  beforeEach(() => localStorage.clear());

  it('keeps every locked exercise exactly where it was', () => {
    seedProgram();
    const first = previewRebuild(profile, 2, DB)!;
    const keepIds = [first.after[0].id, first.after[2].id];

    const next = rebuildWithLocks(profile, first, [0, 2], DB)!;

    expect(next.after[0].id).toBe(keepIds[0]);
    expect(next.after[2].id).toBe(keepIds[1]);
  });

  it('never repeats an exercise inside the session', () => {
    seedProgram();
    let preview = previewRebuild(profile, 2, DB)!;
    // Redraw repeatedly with the first slot pinned — every result must stay
    // internally unique.
    for (let i = 0; i < 8; i++) {
      preview = rebuildWithLocks(profile, preview, [0], DB)!;
      const ids = preview.after.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('carries `before` through so the diff still shows the original', () => {
    seedProgram();
    const first = previewRebuild(profile, 2, DB)!;
    const originalBefore = first.before.map((s) => s.id);

    const second = rebuildWithLocks(profile, first, [], DB)!;
    const third = rebuildWithLocks(profile, second, [], DB)!;

    expect(third.before.map((s) => s.id)).toEqual(originalBefore);
    expect(originalBefore).toEqual(['orig_2_a', 'orig_2_b']);
  });

  it('returns a result that applies verbatim', async () => {
    seedProgram();
    const first = previewRebuild(profile, 2, DB)!;
    const next = rebuildWithLocks(profile, first, [0], DB)!;
    const promised = next.after.map((s) => s.id);

    await applyRebuild(next.result);

    const written = JSON.parse(localStorage.getItem('foundry:storedProgram')!);
    expect(idsOf(written, 2)).toEqual(promised);
  });

  it('declines when everything is locked', () => {
    seedProgram();
    const first = previewRebuild(profile, 2, DB)!;
    const all = first.after.map((_, i) => i);
    expect(rebuildWithLocks(profile, first, all, DB)).toBeNull();
  });

  it('leaves other days alone', () => {
    seedProgram();
    const first = previewRebuild(profile, 2, DB)!;
    const next = rebuildWithLocks(profile, first, [0], DB)!;

    expect(idsOf(next.result.program, 0)).toEqual(['orig_0_a', 'orig_0_b']);
    expect(idsOf(next.result.program, 3)).toEqual(['orig_3_a', 'orig_3_b']);
  });

  it('reports slots it could not fill rather than duplicating', () => {
    seedProgram();
    const first = previewRebuild(profile, 2, DB)!;
    const next = rebuildWithLocks(profile, first, [0], DB)!;
    // Whatever it could not resolve, the result is still internally unique —
    // an unresolved slot keeps its occupant, it never duplicates a locked one.
    const ids = next.after.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Array.isArray(next.unresolved)).toBe(true);
  });
});
