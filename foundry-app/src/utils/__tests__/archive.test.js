/**
 * Tests for archive.js:
 * loadArchive, deleteArchiveEntry, clearAllSkips, resetMeso, archiveCurrentMeso
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadArchive,
  deleteArchiveEntry,
  clearAllSkips,
  resetMeso,
  archiveCurrentMeso,
} from '../archive';

// ============================================================================
// loadArchive
// ============================================================================
describe('loadArchive', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty array when nothing is stored', () => {
    expect(loadArchive()).toEqual([]);
  });

  it('returns the parsed archive array', () => {
    const entries = [
      { id: 1, archivedAt: '2024-01-01', profile: {}, sessions: [] },
      { id: 2, archivedAt: '2024-02-01', profile: {}, sessions: [] },
    ];
    localStorage.setItem('foundry:archive', JSON.stringify(entries));
    expect(loadArchive()).toEqual(entries);
  });

  it('returns empty array for corrupted archive JSON', () => {
    localStorage.setItem('foundry:archive', 'corrupted-json{[');
    expect(loadArchive()).toEqual([]);
  });
});

// ============================================================================
// deleteArchiveEntry
// ============================================================================
describe('deleteArchiveEntry', () => {
  beforeEach(() => localStorage.clear());

  it('removes the matching entry by id', () => {
    const entries = [
      { id: 10, archivedAt: '2024-01-01', sessions: [] },
      { id: 20, archivedAt: '2024-02-01', sessions: [] },
    ];
    localStorage.setItem('foundry:archive', JSON.stringify(entries));

    deleteArchiveEntry(10);
    const remaining = loadArchive();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(20);
  });

  it('is a no-op when the id does not exist', () => {
    const entries = [{ id: 5, archivedAt: '2024-01-01', sessions: [] }];
    localStorage.setItem('foundry:archive', JSON.stringify(entries));

    deleteArchiveEntry(999);
    expect(loadArchive()).toHaveLength(1);
  });

  it('handles deletion from empty archive without error', () => {
    expect(() => deleteArchiveEntry(1)).not.toThrow();
    expect(loadArchive()).toEqual([]);
  });
});

// ============================================================================
// clearAllSkips
// ============================================================================
describe('clearAllSkips', () => {
  beforeEach(() => localStorage.clear());

  it('removes skip keys for all day/week combinations with given bounds', () => {
    localStorage.setItem('foundry:skip:d0:w0', '1');
    localStorage.setItem('foundry:skip:d1:w2', '1');
    localStorage.setItem('foundry:skip:d2:w4', '1');

    clearAllSkips(6, 3); // weeks=6, days=3
    expect(localStorage.getItem('foundry:skip:d0:w0')).toBeNull();
    expect(localStorage.getItem('foundry:skip:d1:w2')).toBeNull();
    expect(localStorage.getItem('foundry:skip:d2:w4')).toBeNull();
  });

  it('does not remove non-skip foundry keys', () => {
    localStorage.setItem('foundry:profile', JSON.stringify({ name: 'Test' }));
    localStorage.setItem('foundry:skip:d0:w0', '1');

    clearAllSkips(6, 3);
    expect(localStorage.getItem('foundry:profile')).not.toBeNull();
  });

  it('uses defaults (12 weeks, 6 days) when called with no arguments', () => {
    localStorage.setItem('foundry:skip:d5:w12', '1');
    clearAllSkips();
    expect(localStorage.getItem('foundry:skip:d5:w12')).toBeNull();
  });
});

// ============================================================================
// resetMeso
// ============================================================================
describe('resetMeso', () => {
  beforeEach(() => localStorage.clear());

  it('removes day/week training data', () => {
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ 0: {} }));
    localStorage.setItem('foundry:day1:week2', JSON.stringify({ 0: {} }));
    resetMeso(4, 2);
    expect(localStorage.getItem('foundry:day0:week0')).toBeNull();
    expect(localStorage.getItem('foundry:day1:week2')).toBeNull();
  });

  it('removes completion (done) markers', () => {
    localStorage.setItem('foundry:done:d0:w0', '1');
    localStorage.setItem('foundry:done:d1:w3', '1');
    resetMeso(4, 2);
    expect(localStorage.getItem('foundry:done:d0:w0')).toBeNull();
    expect(localStorage.getItem('foundry:done:d1:w3')).toBeNull();
  });

  it('removes notes for each day/week', () => {
    localStorage.setItem('foundry:notes:d0:w0', 'felt great today');
    resetMeso(4, 2);
    expect(localStorage.getItem('foundry:notes:d0:w0')).toBeNull();
  });

  it('sets foundry:currentWeek to "0"', () => {
    localStorage.setItem('foundry:currentWeek', '5');
    resetMeso(4, 2);
    expect(localStorage.getItem('foundry:currentWeek')).toBe('0');
  });

  it('preserves foundry:profile across reset', () => {
    const profile = { experience: 'advanced', splitType: 'ppl' };
    localStorage.setItem('foundry:profile', JSON.stringify(profile));
    resetMeso(4, 2);
    expect(localStorage.getItem('foundry:profile')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('foundry:profile'))).toEqual(profile);
  });

  it('removes skip markers', () => {
    localStorage.setItem('foundry:skip:d0:w1', '1');
    resetMeso(4, 2);
    expect(localStorage.getItem('foundry:skip:d0:w1')).toBeNull();
  });
});

// ============================================================================
// archiveCurrentMeso — additional coverage
// ============================================================================
describe('archiveCurrentMeso — additional', () => {
  beforeEach(() => localStorage.clear());

  const baseProfile = {
    experience: 'intermediate',
    mesoLength: 4,
    workoutDays: [1, 3, 5],
    daysPerWeek: 3,
    splitType: 'ppl',
    equipment: ['barbell', 'dumbbell'],
    goal: 'build_muscle',
  };

  it('writes meso_transition when generateProgram dep is provided', () => {
    const mockGenerateProgram = () => [
      {
        dayNum: 1,
        label: 'Push',
        tag: 'PUSH',
        muscles: '',
        note: '',
        exercises: [
          {
            id: 'bench',
            name: 'Bench Press',
            anchor: true,
            sets: 3,
            reps: '6-10',
            rest: '3 min',
            warmup: 'Full protocol',
          },
        ],
      },
    ];
    archiveCurrentMeso(baseProfile, { generateProgram: mockGenerateProgram });
    const raw = localStorage.getItem('foundry:meso_transition');
    expect(raw).not.toBeNull();
    const transition = JSON.parse(raw);
    expect(transition.anchorPeaks).toBeDefined();
    expect(transition.accessoryIds).toBeDefined();
    expect(transition.profile.experience).toBe('intermediate');
  });

  it('does NOT write meso_transition when no generateProgram provided', () => {
    archiveCurrentMeso(baseProfile, {});
    expect(localStorage.getItem('foundry:meso_transition')).toBeNull();
  });

  it('counts completedSessions correctly across days and weeks', () => {
    localStorage.setItem('foundry:done:d0:w0', '1');
    localStorage.setItem('foundry:done:d0:w1', '1');
    localStorage.setItem('foundry:done:d1:w0', '1');

    archiveCurrentMeso(baseProfile, {});
    const archive = JSON.parse(localStorage.getItem('foundry:archive') || '[]');
    expect(archive[0].completedSessions).toBe(3);
  });
});
