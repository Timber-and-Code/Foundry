/**
 * Tests for persistence.js (storage CRUD) and related training.js helpers:
 * loadDayWeek, saveDayWeek, loadCardioSession, saveCardioSession,
 * loadMobilitySession, saveMobilitySession, loadExNotes, saveExNotes,
 * loadExtraExNotes, saveExtraExNotes, snapshotData,
 * loadProfile, saveProfile, loadCompleted, markComplete, loadBwLog
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadDayWeek,
  saveDayWeek,
  loadCardioSession,
  saveCardioSession,
  loadMobilitySession,
  saveMobilitySession,
  loadExNotes,
  saveExNotes,
  loadExtraExNotes,
  saveExtraExNotes,
  snapshotData,
} from '../persistence.js';
import {
  loadProfile,
  saveProfile,
  loadCompleted,
  markComplete,
  loadBwLog,
  saveBwLog,
} from '../training.js';

// ============================================================================
// loadDayWeek / saveDayWeek
// ============================================================================
describe('loadDayWeek', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty object when key is missing', () => {
    expect(loadDayWeek(0, 0)).toEqual({});
  });

  it('returns stored data for the correct day/week', () => {
    const data = { 0: { 0: { weight: '100', reps: '8' }, 1: { weight: '100', reps: '8' } } };
    localStorage.setItem('foundry:day2:week3', JSON.stringify(data));
    expect(loadDayWeek(2, 3)).toEqual(data);
  });

  it('uses the key format foundry:day{d}:week{w}', () => {
    const data = { 1: { 0: { weight: '50', reps: '12' } } };
    localStorage.setItem('foundry:day4:week1', JSON.stringify(data));
    expect(loadDayWeek(4, 1)[1][0].weight).toBe('50');
  });
});

describe('saveDayWeek', () => {
  beforeEach(() => localStorage.clear());

  it('writes to the correct localStorage key', () => {
    const data = { 0: { 0: { weight: '200', reps: '5' } } };
    saveDayWeek(1, 2, data);
    const raw = localStorage.getItem('foundry:day1:week2');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw)).toEqual(data);
  });

  it('round-trips with loadDayWeek', () => {
    const data = { 0: { 0: { weight: '135', reps: '10' } }, 1: { 0: { weight: '80', reps: '12' } } };
    saveDayWeek(0, 3, data);
    expect(loadDayWeek(0, 3)).toEqual(data);
  });
});

// ============================================================================
// loadCardioSession / saveCardioSession
// ============================================================================
describe('loadCardioSession', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when key is missing', () => {
    expect(loadCardioSession('2024-01-01')).toBeNull();
  });

  it('returns parsed data for the given date', () => {
    const data = { type: 'run', duration: 30, intensity: 'moderate' };
    localStorage.setItem('foundry:cardio:session:2024-03-15', JSON.stringify(data));
    expect(loadCardioSession('2024-03-15')).toEqual(data);
  });

  it('returns null for corrupted JSON', () => {
    localStorage.setItem('foundry:cardio:session:2024-01-01', 'not-valid-json');
    expect(loadCardioSession('2024-01-01')).toBeNull();
  });
});

describe('saveCardioSession / loadCardioSession round-trip', () => {
  beforeEach(() => localStorage.clear());

  it('stores and retrieves cardio session by date string', () => {
    const data = { type: 'bike', duration: 45, notes: 'easy pace' };
    saveCardioSession('2024-06-10', data);
    expect(loadCardioSession('2024-06-10')).toEqual(data);
  });
});

// ============================================================================
// loadMobilitySession / saveMobilitySession
// ============================================================================
describe('loadMobilitySession', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when key is missing', () => {
    expect(loadMobilitySession('2024-01-01')).toBeNull();
  });

  it('returns null for corrupted JSON', () => {
    localStorage.setItem('foundry:mobility:session:2024-02-20', 'bad-json');
    expect(loadMobilitySession('2024-02-20')).toBeNull();
  });
});

describe('saveMobilitySession / loadMobilitySession round-trip', () => {
  beforeEach(() => localStorage.clear());

  it('stores and retrieves mobility session by date string', () => {
    const data = { duration: 20, exercises: ['hip circles', 'thoracic rotation'] };
    saveMobilitySession('2024-07-04', data);
    expect(loadMobilitySession('2024-07-04')).toEqual(data);
  });
});

// ============================================================================
// loadExNotes / saveExNotes
// ============================================================================
describe('loadExNotes', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty object when key is missing', () => {
    expect(loadExNotes(0, 0)).toEqual({});
  });

  it('returns empty object for corrupted JSON', () => {
    localStorage.setItem('foundry:exnotes:d1:w2', 'broken{json');
    expect(loadExNotes(1, 2)).toEqual({});
  });
});

describe('saveExNotes / loadExNotes round-trip', () => {
  beforeEach(() => localStorage.clear());

  it('stores and retrieves exercise notes keyed by exIdx', () => {
    const notes = { 0: 'felt strong today', 2: 'shoulder was tight' };
    saveExNotes(0, 1, notes);
    expect(loadExNotes(0, 1)).toEqual(notes);
  });
});

// ============================================================================
// loadExtraExNotes / saveExtraExNotes
// ============================================================================
describe('loadExtraExNotes', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty object when key is missing', () => {
    expect(loadExtraExNotes('2024-01-15')).toEqual({});
  });

  it('returns empty object for corrupted JSON', () => {
    localStorage.setItem('foundry:extra:exnotes:2024-01-15', '}corrupt{');
    expect(loadExtraExNotes('2024-01-15')).toEqual({});
  });
});

describe('saveExtraExNotes / loadExtraExNotes round-trip', () => {
  beforeEach(() => localStorage.clear());

  it('stores and retrieves extra session exercise notes by date string', () => {
    const notes = { 0: 'grip failed', 1: 'PR attempt' };
    saveExtraExNotes('2024-08-20', notes);
    expect(loadExtraExNotes('2024-08-20')).toEqual(notes);
  });
});

// ============================================================================
// snapshotData
// ============================================================================
describe('snapshotData', () => {
  beforeEach(() => localStorage.clear());

  it('creates foundry:backup:0 after first call', () => {
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ 0: { 0: { weight: '100' } } }));
    snapshotData();
    expect(localStorage.getItem('foundry:backup:0')).not.toBeNull();
  });

  it('snapshot data does not include backup keys', () => {
    localStorage.setItem('foundry:profile', JSON.stringify({ name: 'Test' }));
    snapshotData();
    const snap = JSON.parse(localStorage.getItem('foundry:backup:0'));
    const keys = Object.keys(snap.data);
    expect(keys.every((k) => !k.startsWith('foundry:backup:'))).toBe(true);
  });

  it('includes foundry: data keys in snapshot', () => {
    localStorage.setItem('foundry:profile', JSON.stringify({ experience: 'intermediate' }));
    snapshotData();
    const snap = JSON.parse(localStorage.getItem('foundry:backup:0'));
    expect(snap.data['foundry:profile']).toBeDefined();
  });

  it('snapshot has version and snappedAt fields', () => {
    snapshotData();
    const snap = JSON.parse(localStorage.getItem('foundry:backup:0'));
    expect(snap.version).toBe(1);
    expect(snap.snappedAt).toBeDefined();
  });

  it('shifts backup:0 → backup:1 on second call', () => {
    localStorage.setItem('foundry:x', 'first');
    snapshotData();
    const first = localStorage.getItem('foundry:backup:0');

    localStorage.setItem('foundry:x', 'second');
    snapshotData();
    expect(localStorage.getItem('foundry:backup:1')).toBe(first);
  });

  it('keeps only 3 rolling snapshots after 4 calls', () => {
    // Call 4 times
    for (let i = 0; i < 4; i++) {
      localStorage.setItem('foundry:x', String(i));
      snapshotData();
    }
    // backup:0, :1, :2 exist; no backup:3
    expect(localStorage.getItem('foundry:backup:0')).not.toBeNull();
    expect(localStorage.getItem('foundry:backup:1')).not.toBeNull();
    expect(localStorage.getItem('foundry:backup:2')).not.toBeNull();
    expect(localStorage.getItem('foundry:backup:3')).toBeNull();
  });
});

// ============================================================================
// loadProfile / saveProfile (from training.js)
// ============================================================================
describe('loadProfile', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(loadProfile()).toBeNull();
  });
});

describe('saveProfile / loadProfile round-trip', () => {
  beforeEach(() => localStorage.clear());

  it('stores and retrieves profile correctly', () => {
    const profile = {
      experience: 'intermediate',
      splitType: 'ppl',
      daysPerWeek: 4,
      goal: 'build_muscle',
    };
    saveProfile(profile);
    expect(loadProfile()).toEqual(profile);
  });

  it('overwrites previous profile on repeated saves', () => {
    saveProfile({ experience: 'beginner' });
    saveProfile({ experience: 'advanced' });
    expect(loadProfile().experience).toBe('advanced');
  });
});

// ============================================================================
// loadCompleted / markComplete (from training.js)
// ============================================================================
describe('loadCompleted', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty Set when nothing is marked done', () => {
    const done = loadCompleted({ days: 3, weeks: 4 });
    expect(done.size).toBe(0);
  });

  it('includes completed day:week pairs in the Set', () => {
    markComplete(1, 2);
    const done = loadCompleted({ days: 3, weeks: 6 });
    expect(done.has('1:2')).toBe(true);
  });

  it('does not include non-completed pairs', () => {
    markComplete(0, 0);
    const done = loadCompleted({ days: 3, weeks: 6 });
    expect(done.has('0:1')).toBe(false);
    expect(done.has('1:0')).toBe(false);
  });

  it('uses default config (days=6, weeks=6) when no mesoConfig provided', () => {
    markComplete(5, 5);
    const done = loadCompleted();
    expect(done.has('5:5')).toBe(true);
  });
});

// ============================================================================
// loadBwLog (from training.js)
// ============================================================================
describe('loadBwLog', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty array when nothing stored', () => {
    expect(loadBwLog()).toEqual([]);
  });

  it('returns stored entries via saveBwLog', () => {
    const entries = [
      { date: '2024-01-10', weight: 180 },
      { date: '2024-01-03', weight: 181 },
    ];
    saveBwLog(entries);
    expect(loadBwLog()).toEqual(entries);
  });

  it('returns empty array for corrupted bwlog data', () => {
    localStorage.setItem('foundry:bwlog', 'not-an-array');
    expect(loadBwLog()).toEqual([]);
  });
});
