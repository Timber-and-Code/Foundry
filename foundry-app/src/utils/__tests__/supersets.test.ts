import { describe, it, expect } from 'vitest';
import type { Exercise } from '../../types';
import { applyPersistedSupersets, newSupersetId } from '../supersets';

function ex(id: string, sets = 3): Exercise {
  return {
    id,
    name: id,
    muscle: 'Test',
    equipment: 'other',
    sets,
    reps: '8-12',
    rest: '90s',
    warmup: '',
  } as Exercise;
}

describe('applyPersistedSupersets', () => {
  it('returns input unchanged when no pairs', () => {
    const list = [ex('bench'), ex('squat'), ex('row')];
    expect(applyPersistedSupersets(list, [])).toEqual(list);
  });

  it('stamps matching groupId on both members of a pair', () => {
    const list = [ex('bench'), ex('squat'), ex('row')];
    const out = applyPersistedSupersets(list, [['bench', 'row']]);
    const ssA = out.find((e) => e.id === 'bench')?.supersetGroupId;
    const ssB = out.find((e) => e.id === 'row')?.supersetGroupId;
    expect(ssA).toBeTruthy();
    expect(ssA).toBe(ssB);
    expect(out.find((e) => e.id === 'squat')?.supersetGroupId).toBeUndefined();
  });

  it('moves target adjacent to source after the splice', () => {
    const list = [ex('bench'), ex('squat'), ex('row')];
    const out = applyPersistedSupersets(list, [['bench', 'row']]);
    expect(out.map((e) => e.id)).toEqual(['bench', 'row', 'squat']);
  });

  it('equalises sets to the max of both members', () => {
    const list = [ex('bench', 3), ex('row', 5)];
    const out = applyPersistedSupersets(list, [['bench', 'row']]);
    expect(out.find((e) => e.id === 'bench')?.sets).toBe(5);
    expect(out.find((e) => e.id === 'row')?.sets).toBe(5);
  });

  it('is a no-op when source is missing from the list', () => {
    const list = [ex('bench'), ex('row')];
    const out = applyPersistedSupersets(list, [['squat', 'row']]);
    expect(out.find((e) => e.id === 'row')?.supersetGroupId).toBeUndefined();
    expect(out.map((e) => e.id)).toEqual(['bench', 'row']);
  });

  it('is a no-op when target is missing from the list', () => {
    const list = [ex('bench'), ex('squat')];
    const out = applyPersistedSupersets(list, [['bench', 'row']]);
    expect(out.find((e) => e.id === 'bench')?.supersetGroupId).toBeUndefined();
  });

  it('skips a pair when source already wears a groupId', () => {
    const list: Exercise[] = [
      { ...ex('bench'), supersetGroupId: 'ss_existing' },
      ex('row'),
    ];
    const out = applyPersistedSupersets(list, [['bench', 'row']]);
    expect(out.find((e) => e.id === 'row')?.supersetGroupId).toBeUndefined();
    expect(out.find((e) => e.id === 'bench')?.supersetGroupId).toBe('ss_existing');
  });

  it('applies multiple pairs in order', () => {
    const list = [ex('bench'), ex('squat'), ex('row'), ex('dip'), ex('curl')];
    const out = applyPersistedSupersets(list, [
      ['bench', 'row'],
      ['squat', 'curl'],
    ]);
    const grp1 = out.find((e) => e.id === 'bench')?.supersetGroupId;
    const grp2 = out.find((e) => e.id === 'squat')?.supersetGroupId;
    expect(grp1).toBeTruthy();
    expect(grp2).toBeTruthy();
    expect(grp1).not.toBe(grp2);
    expect(out.find((e) => e.id === 'row')?.supersetGroupId).toBe(grp1);
    expect(out.find((e) => e.id === 'curl')?.supersetGroupId).toBe(grp2);
  });
});

describe('newSupersetId', () => {
  it('returns a non-empty string', () => {
    expect(newSupersetId().length).toBeGreaterThan(0);
  });

  it('returns different ids on successive calls', () => {
    expect(newSupersetId()).not.toBe(newSupersetId());
  });
});
