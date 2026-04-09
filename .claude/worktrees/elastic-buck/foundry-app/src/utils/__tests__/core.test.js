/**
 * Core function tests for the Foundry app.
 * Tests: generateProgram, detectStallingLifts, detectSessionPRs,
 *        loadDayWeekWithCarryover, archiveCurrentMeso
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateProgram } from '../program.js';
import {
  detectStallingLifts,
  detectSessionPRs,
  loadDayWeekWithCarryover,
  archiveCurrentMeso,
} from '../store.js';

// ─── Minimal Exercise DB fixtures ──────────────────────────────────────────

const mkEx = (overrides) => ({
  id: 'default_id',
  name: 'Test Exercise',
  muscle: 'Chest',
  muscles: ['Chest', 'Triceps'],
  tag: 'PUSH',
  equipment: 'barbell',
  pattern: 'push',
  anchor: true,
  diff: 2,
  sets: 3,
  reps: '6-10',
  rest: '2-3 min',
  warmup: 'Full protocol',
  bw: false,
  ...overrides,
});

// Minimal DB covering PPL tags + anchor/non-anchor mixes
const EXERCISE_DB = [
  // PUSH anchors
  mkEx({
    id: 'bench',
    name: 'Bench Press',
    tag: 'PUSH',
    anchor: true,
    muscles: ['Chest', 'Shoulders', 'Triceps'],
    pattern: 'push',
  }),
  mkEx({
    id: 'ohp',
    name: 'OHP',
    tag: 'PUSH',
    anchor: true,
    muscles: ['Shoulders', 'Triceps'],
    pattern: 'push',
    equipment: 'barbell',
  }),
  // PUSH accessories
  mkEx({
    id: 'tricep',
    name: 'Tricep Pushdown',
    tag: 'PUSH',
    anchor: false,
    muscles: ['Triceps'],
    pattern: 'isolation',
    diff: 1,
    equipment: 'cable',
  }),
  mkEx({
    id: 'fly',
    name: 'Cable Fly',
    tag: 'PUSH',
    anchor: false,
    muscles: ['Chest'],
    pattern: 'isolation',
    diff: 1,
    equipment: 'cable',
  }),
  mkEx({
    id: 'lat_raise',
    name: 'Lat Raise',
    tag: 'PUSH',
    anchor: false,
    muscles: ['Shoulders'],
    pattern: 'isolation',
    diff: 1,
    equipment: 'dumbbell',
  }),
  mkEx({
    id: 'dip',
    name: 'Dip',
    tag: 'PUSH',
    anchor: false,
    muscles: ['Chest', 'Triceps'],
    pattern: 'push',
    diff: 1,
    equipment: 'bodyweight',
  }),
  mkEx({
    id: 'incline',
    name: 'Incline Press',
    tag: 'PUSH',
    anchor: false,
    muscles: ['Chest', 'Shoulders'],
    pattern: 'push',
    diff: 1,
    equipment: 'dumbbell',
  }),

  // PULL anchors
  mkEx({
    id: 'row',
    name: 'Barbell Row',
    tag: 'PULL',
    anchor: true,
    muscles: ['Lats', 'Back', 'Biceps'],
    pattern: 'pull',
  }),
  mkEx({
    id: 'pullup',
    name: 'Pull-up',
    tag: 'PULL',
    anchor: true,
    muscles: ['Lats', 'Back'],
    pattern: 'pull',
    equipment: 'bodyweight',
    bw: true,
  }),
  // PULL accessories
  mkEx({
    id: 'curl',
    name: 'Bicep Curl',
    tag: 'PULL',
    anchor: false,
    muscles: ['Biceps'],
    pattern: 'isolation',
    diff: 1,
    equipment: 'dumbbell',
  }),
  mkEx({
    id: 'face',
    name: 'Face Pull',
    tag: 'PULL',
    anchor: false,
    muscles: ['Shoulders', 'Upper Traps'],
    pattern: 'isolation',
    diff: 1,
    equipment: 'cable',
  }),
  mkEx({
    id: 'rdl',
    name: 'RDL',
    tag: 'PULL',
    anchor: false,
    muscles: ['Hamstrings', 'Glutes'],
    pattern: 'hinge',
    diff: 2,
    equipment: 'barbell',
  }),
  mkEx({
    id: 'cable_row',
    name: 'Cable Row',
    tag: 'PULL',
    anchor: false,
    muscles: ['Lats', 'Back'],
    pattern: 'pull',
    diff: 1,
    equipment: 'cable',
  }),
  mkEx({
    id: 'shrug',
    name: 'Shrug',
    tag: 'PULL',
    anchor: false,
    muscles: ['Upper Traps'],
    pattern: 'isolation',
    diff: 1,
    equipment: 'dumbbell',
  }),

  // LEGS anchors
  mkEx({
    id: 'squat',
    name: 'Barbell Squat',
    tag: 'LEGS',
    anchor: true,
    muscles: ['Quads', 'Hamstrings', 'Glutes'],
    pattern: 'squat',
  }),
  mkEx({
    id: 'deadlift',
    name: 'Deadlift',
    tag: 'LEGS',
    anchor: true,
    muscles: ['Hamstrings', 'Glutes', 'Back'],
    pattern: 'hinge',
  }),
  // LEGS accessories
  mkEx({
    id: 'leg_press',
    name: 'Leg Press',
    tag: 'LEGS',
    anchor: false,
    muscles: ['Quads', 'Hamstrings'],
    pattern: 'push',
    diff: 1,
    equipment: 'machine',
  }),
  mkEx({
    id: 'leg_curl',
    name: 'Leg Curl',
    tag: 'LEGS',
    anchor: false,
    muscles: ['Hamstrings'],
    pattern: 'isolation',
    diff: 1,
    equipment: 'machine',
  }),
  mkEx({
    id: 'calf',
    name: 'Calf Raise',
    tag: 'LEGS',
    anchor: false,
    muscles: ['Gastrocnemius'],
    pattern: 'isolation',
    diff: 1,
    equipment: 'machine',
  }),
  mkEx({
    id: 'lunge',
    name: 'Lunge',
    tag: 'LEGS',
    anchor: false,
    muscles: ['Quads', 'Glutes'],
    pattern: 'squat',
    diff: 1,
    equipment: 'dumbbell',
  }),
  mkEx({
    id: 'goblet',
    name: 'Goblet Squat',
    tag: 'LEGS',
    anchor: false,
    muscles: ['Quads', 'Glutes'],
    pattern: 'squat',
    diff: 1,
    equipment: 'kettlebell',
  }),
];

const BASE_PROFILE = {
  experience: 'intermediate',
  equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell'],
  sessionDuration: 60,
  goal: 'build_muscle',
};

// ─── localStorage mock helpers ──────────────────────────────────────────────

function setLS(key, value) {
  localStorage.setItem(key, value);
}

function setLSJson(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}

// ============================================================================
// 1. generateProgram
// ============================================================================
describe('generateProgram', () => {
  it('returns 3 days for PPL with daysPerWeek=3', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 },
      EXERCISE_DB
    );
    expect(days).toHaveLength(3);
  });

  it('returns 5 days for PPL with daysPerWeek=5', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 5 },
      EXERCISE_DB
    );
    expect(days).toHaveLength(5);
  });

  it('returns 6 days for PPL with daysPerWeek=6', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 6 },
      EXERCISE_DB
    );
    expect(days).toHaveLength(6);
  });

  it('returns 2 days for upper_lower with daysPerWeek=2', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'upper_lower', daysPerWeek: 2 },
      EXERCISE_DB
    );
    expect(days).toHaveLength(2);
  });

  it('returns 4 days for upper_lower with daysPerWeek=4', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'upper_lower', daysPerWeek: 4 },
      EXERCISE_DB
    );
    expect(days).toHaveLength(4);
  });

  it('returns 3 days for full_body with daysPerWeek=3', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'full_body', daysPerWeek: 3 },
      EXERCISE_DB
    );
    expect(days).toHaveLength(3);
  });

  it('returns 4 days for push_pull', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'push_pull', daysPerWeek: 4 },
      EXERCISE_DB
    );
    expect(days).toHaveLength(4);
  });

  it('each day has required fields', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 },
      EXERCISE_DB
    );
    days.forEach((day) => {
      expect(day).toHaveProperty('dayNum');
      expect(day).toHaveProperty('label');
      expect(day).toHaveProperty('tag');
      expect(day).toHaveProperty('muscles');
      expect(day).toHaveProperty('note');
      expect(day).toHaveProperty('exercises');
      expect(Array.isArray(day.exercises)).toBe(true);
    });
  });

  it('each exercise has required output fields', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 },
      EXERCISE_DB
    );
    days.forEach((day) => {
      day.exercises.forEach((ex) => {
        expect(ex).toHaveProperty('id');
        expect(ex).toHaveProperty('name');
        expect(ex).toHaveProperty('sets');
        expect(ex).toHaveProperty('reps');
        expect(ex).toHaveProperty('rest');
        expect(ex).toHaveProperty('warmup');
        expect(ex).toHaveProperty('anchor');
      });
    });
  });

  it('first exercise in each PPL day is the anchor', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 },
      EXERCISE_DB
    );
    days.forEach((day) => {
      if (day.exercises.length > 0) {
        expect(day.exercises[0].anchor).toBe(true);
      }
    });
  });

  it('returns aiDays directly when present in profile', () => {
    const aiDays = [{ dayNum: 1, label: 'AI Day', tag: 'PUSH', exercises: [] }];
    const days = generateProgram({ ...BASE_PROFILE, aiDays }, EXERCISE_DB);
    expect(days).toBe(aiDays);
  });

  it('produces same number of days on two calls with same input', () => {
    const profile = { ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 6 };
    const d1 = generateProgram(profile, EXERCISE_DB);
    const d2 = generateProgram(profile, EXERCISE_DB);
    expect(d1).toHaveLength(d2.length);
  });
});

// ============================================================================
// 2. detectStallingLifts
// ============================================================================
describe('detectStallingLifts', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const day = {
    exercises: [{ name: 'Bench Press' }],
  };
  const resolvedEx = [{ name: 'Bench Press' }];
  const profile = { experience: 'intermediate' };
  const deps = { EXERCISE_DB: [] };

  it('returns empty arrays when no data logged', () => {
    const result = detectStallingLifts(0, day, resolvedEx, 3, profile, deps);
    expect(result.stalls).toEqual([]);
    expect(result.regressions).toEqual([]);
  });

  it('detects a 3-week plateau (stall)', () => {
    // Mark weeks 0, 1, 2 as done with same weight
    for (let w = 0; w < 3; w++) {
      setLS(`foundry:done:d0:w${w}`, '1');
      setLSJson(`foundry:day0:week${w}`, {
        0: {
          0: { weight: '100', reps: '8' },
          1: { weight: '100', reps: '8' },
        },
      });
    }
    const result = detectStallingLifts(0, day, resolvedEx, 3, profile, deps);
    expect(result.stalls).toHaveLength(1);
    expect(result.stalls[0].name).toBe('Bench Press');
    expect(result.stalls[0].weight).toBe(100);
  });

  it('detects a regression (weight dropped week over week)', () => {
    setLS('foundry:done:d0:w0', '1');
    setLSJson('foundry:day0:week0', { 0: { 0: { weight: '110', reps: '8' } } });
    setLS('foundry:done:d0:w1', '1');
    setLSJson('foundry:day0:week1', { 0: { 0: { weight: '100', reps: '8' } } });

    const result = detectStallingLifts(0, day, resolvedEx, 2, profile, deps);
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0].name).toBe('Bench Press');
    expect(result.regressions[0].current).toBe(100);
    expect(result.regressions[0].previous).toBe(110);
  });

  it('does not flag stall when only 2 weeks at same weight', () => {
    for (let w = 0; w < 2; w++) {
      setLS(`foundry:done:d0:w${w}`, '1');
      setLSJson(`foundry:day0:week${w}`, {
        0: { 0: { weight: '100', reps: '8' } },
      });
    }
    const result = detectStallingLifts(0, day, resolvedEx, 2, profile, deps);
    expect(result.stalls).toHaveLength(0);
  });

  it('does not flag stall when warmup sets are all that exist', () => {
    for (let w = 0; w < 3; w++) {
      setLS(`foundry:done:d0:w${w}`, '1');
      setLSJson(`foundry:day0:week${w}`, {
        0: { 0: { weight: '60', reps: '5', warmup: true } },
      });
    }
    const result = detectStallingLifts(0, day, resolvedEx, 3, profile, deps);
    expect(result.stalls).toHaveLength(0);
  });

  it('does not flag stall when progression happened in current week', () => {
    for (let w = 0; w < 3; w++) {
      setLS(`foundry:done:d0:w${w}`, '1');
      setLSJson(`foundry:day0:week${w}`, {
        0: { 0: { weight: '100', reps: '8' } },
      });
    }
    // Current week (w=3) has higher weight
    setLSJson('foundry:day0:week3', { 0: { 0: { weight: '105', reps: '8' } } });
    const result = detectStallingLifts(0, day, resolvedEx, 3, profile, deps);
    expect(result.stalls).toHaveLength(0);
  });
});

// ============================================================================
// 3. detectSessionPRs
// ============================================================================
describe('detectSessionPRs', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const exercises = [{ id: 'bench', name: 'Bench Press' }];

  describe('mode: meso', () => {
    it('returns PR when current best beats prior weeks', () => {
      // Prior week data
      setLSJson('foundry:day0:week0', {
        0: { 0: { weight: '100', reps: '8' } },
      });
      setLSJson('foundry:day0:week1', {
        0: { 0: { weight: '105', reps: '8' } },
      });

      const weekData = { 0: { 0: { weight: '110', reps: '8' } } };
      const prs = detectSessionPRs(exercises, weekData, 'meso', {
        dayIdx: 0,
        weekIdx: 2,
      });
      expect(prs).toHaveLength(1);
      expect(prs[0].name).toBe('Bench Press');
      expect(prs[0].newBest).toBe(110);
      expect(prs[0].prevBest).toBe(105);
    });

    it('returns empty array when no improvement over prior weeks', () => {
      setLSJson('foundry:day0:week0', {
        0: { 0: { weight: '110', reps: '8' } },
      });

      const weekData = { 0: { 0: { weight: '105', reps: '8' } } };
      const prs = detectSessionPRs(exercises, weekData, 'meso', {
        dayIdx: 0,
        weekIdx: 1,
      });
      expect(prs).toHaveLength(0);
    });

    it('returns empty array when no prior week data exists', () => {
      const weekData = { 0: { 0: { weight: '100', reps: '8' } } };
      const prs = detectSessionPRs(exercises, weekData, 'meso', {
        dayIdx: 0,
        weekIdx: 0,
      });
      expect(prs).toHaveLength(0);
    });

    it('returns empty array when current weight is 0', () => {
      setLSJson('foundry:day0:week0', {
        0: { 0: { weight: '100', reps: '8' } },
      });
      const weekData = { 0: { 0: { weight: '0', reps: '8' } } };
      const prs = detectSessionPRs(exercises, weekData, 'meso', {
        dayIdx: 0,
        weekIdx: 1,
      });
      expect(prs).toHaveLength(0);
    });
  });

  describe('mode: extra', () => {
    it('returns empty array when no prior data and exercise has no id', () => {
      const exNoId = [{ name: 'Unknown' }];
      const weekData = { 0: { 0: { weight: '100', reps: '8' } } };
      const prs = detectSessionPRs(exNoId, weekData, 'extra', {
        activeDays: [],
        currentDateStr: '2024-01-15',
      });
      expect(prs).toHaveLength(0);
    });

    it('returns empty array when current weight is 0 in extra mode', () => {
      const weekData = { 0: {} };
      const prs = detectSessionPRs(exercises, weekData, 'extra', {
        activeDays: [],
        currentDateStr: '2024-01-15',
      });
      expect(prs).toHaveLength(0);
    });

    it('returns empty when no prior history exists anywhere', () => {
      const weekData = { 0: { 0: { weight: '100', reps: '8' } } };
      const prs = detectSessionPRs(exercises, weekData, 'extra', {
        activeDays: [],
        currentDateStr: '2024-01-15',
      });
      // priorBest will be 0, so todayBest (100) > 0 but priorBest must be > 0 to be a PR
      expect(prs).toHaveLength(0);
    });
  });
});

// ============================================================================
// 4. loadDayWeekWithCarryover
// ============================================================================
describe('loadDayWeekWithCarryover', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const makeDay = (equipment = 'barbell', reps = '6-10') => ({
    exercises: [
      {
        id: 'bench',
        name: 'Bench Press',
        equipment,
        reps,
        sets: 3,
        bw: false,
      },
    ],
  });

  const profile = { experience: 'intermediate' };

  it('returns stored data when current week already has data', () => {
    const stored = { 0: { 0: { weight: '100', reps: '8' } } };
    setLSJson('foundry:day0:week1', stored);
    const result = loadDayWeekWithCarryover(0, 1, makeDay(), profile);
    expect(result[0][0].weight).toBe('100');
    expect(result[0][0].reps).toBe('8');
  });

  it('returns empty object for weekIdx=0 (no prior weeks)', () => {
    const result = loadDayWeekWithCarryover(0, 0, makeDay(), profile);
    expect(result).toEqual({});
  });

  it('carries over barbell weight with +5 lb nudge when all reps hit', () => {
    // Week 0 data: all reps hit the max of range (10)
    setLSJson('foundry:day0:week0', {
      0: {
        0: { weight: '100', reps: '10' },
        1: { weight: '100', reps: '10' },
        2: { weight: '100', reps: '10' },
      },
    });
    const result = loadDayWeekWithCarryover(0, 1, makeDay('barbell', '6-10'), profile);
    // Should suggest 105 (100 + 5 barbell nudge)
    expect(result[0][0].weight).toBe('105');
    expect(result[0][0].suggested).toBe(true);
  });

  it('carries over dumbbell weight with +2.5 lb nudge for light weights', () => {
    setLSJson('foundry:day0:week0', {
      0: {
        0: { weight: '20', reps: '10' },
        1: { weight: '20', reps: '10' },
        2: { weight: '20', reps: '10' },
      },
    });
    const result = loadDayWeekWithCarryover(0, 1, makeDay('dumbbell', '6-10'), profile);
    // weight < 25 → nudge is 2.5
    expect(result[0][0].weight).toBe('22.5');
    expect(result[0][0].suggested).toBe(true);
  });

  it('carries over dumbbell weight with +5 lb nudge for heavier weights', () => {
    setLSJson('foundry:day0:week0', {
      0: {
        0: { weight: '30', reps: '10' },
        1: { weight: '30', reps: '10' },
        2: { weight: '30', reps: '10' },
      },
    });
    const result = loadDayWeekWithCarryover(0, 1, makeDay('dumbbell', '6-10'), profile);
    // weight >= 25 → nudge is 5
    expect(result[0][0].weight).toBe('35');
    expect(result[0][0].suggested).toBe(true);
  });

  it('suggests rep progression (not weight bump) when reps not fully hit', () => {
    // Only hit 8 reps when max is 10
    setLSJson('foundry:day0:week0', {
      0: {
        0: { weight: '100', reps: '8' },
        1: { weight: '100', reps: '8' },
        2: { weight: '100', reps: '8' },
      },
    });
    const result = loadDayWeekWithCarryover(0, 1, makeDay('barbell', '6-10'), profile);
    expect(result[0][0].weight).toBe('100');
    expect(result[0][0].suggested).toBeFalsy();
    expect(result[0][0].repsSuggested).toBe(true);
    // Rep suggestion = prevReps + 1 (capped at rangeMax)
    expect(result[0][0].reps).toBe('9');
  });

  it('returns empty object when no prior weeks have weight data', () => {
    // Week 0 exists but has no weight logged
    setLSJson('foundry:day0:week0', { 0: { 0: { weight: '', reps: '8' } } });
    const result = loadDayWeekWithCarryover(0, 1, makeDay(), profile);
    expect(result).toEqual({});
  });
});

// ============================================================================
// 5. archiveCurrentMeso
// ============================================================================
describe('archiveCurrentMeso', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const profile = {
    experience: 'intermediate',
    mesoLength: 6,
    workoutDays: [1, 3, 5],
    daysPerWeek: 3,
    splitType: 'ppl',
    equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
    goal: 'build_muscle',
  };

  it('archives meso data to foundry:archive', () => {
    // Seed some session data
    setLSJson('foundry:day0:week0', { 0: { 0: { weight: '100', reps: '8' } } });
    setLS('foundry:done:d0:w0', '1');

    archiveCurrentMeso(profile, {});
    const archive = JSON.parse(localStorage.getItem('foundry:archive') || '[]');
    expect(archive).toHaveLength(1);
    expect(archive[0]).toHaveProperty('id');
    expect(archive[0]).toHaveProperty('archivedAt');
    expect(archive[0]).toHaveProperty('profile');
    expect(archive[0]).toHaveProperty('sessions');
    expect(archive[0].completedSessions).toBe(1);
  });

  it('prepends new archive entry (most recent first)', () => {
    // Pre-seed existing archive with 2 entries
    const existing = [
      { id: 1, archivedAt: '2024-01-01', profile: {}, sessions: [] },
      { id: 2, archivedAt: '2024-01-15', profile: {}, sessions: [] },
    ];
    setLSJson('foundry:archive', existing);

    archiveCurrentMeso(profile, {});
    const archive = JSON.parse(localStorage.getItem('foundry:archive') || '[]');
    expect(archive).toHaveLength(3);
    // Most recent is first
    expect(archive[0].id).not.toBe(1);
    expect(archive[0].id).not.toBe(2);
  });

  it('respects 10-meso cap — trims oldest entries', () => {
    const fullArchive = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      archivedAt: '2024-01-01',
      profile: {},
      sessions: [],
    }));
    setLSJson('foundry:archive', fullArchive);

    archiveCurrentMeso(profile, {});
    const archive = JSON.parse(localStorage.getItem('foundry:archive') || '[]');
    expect(archive).toHaveLength(10);
    // The last entry (id=10) is pushed off the end after unshift + slice(0,10)
    expect(archive.find((e) => e.id === 10)).toBeUndefined();
    // The first 9 existing entries are still present
    expect(archive.find((e) => e.id === 1)).toBeDefined();
  });

  it('saves anchor peak weights when generateProgram is provided', () => {
    // Seed weight data for day 0 (the anchor exercise slot)
    setLSJson('foundry:day0:week0', { 0: { 0: { weight: '150', reps: '5' } } });
    setLSJson('foundry:day0:week1', { 0: { 0: { weight: '155', reps: '5' } } });

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
            reps: '4-6',
            rest: '3 min',
            warmup: '',
          },
        ],
      },
    ];

    archiveCurrentMeso(profile, { generateProgram: mockGenerateProgram });
    const transition = JSON.parse(localStorage.getItem('foundry:meso_transition') || 'null');
    expect(transition).not.toBeNull();
    expect(transition.anchorPeaks).toBeDefined();
    expect(transition.anchorPeaks.length).toBeGreaterThan(0);
    expect(transition.anchorPeaks[0].name).toBe('Bench Press');
    expect(transition.anchorPeaks[0].peak).toBe(155);
  });

  it('does nothing when profile is null', () => {
    archiveCurrentMeso(null, {});
    const archive = JSON.parse(localStorage.getItem('foundry:archive') || '[]');
    expect(archive).toHaveLength(0);
  });

  it('stores profile snapshot inside archive record', () => {
    archiveCurrentMeso(profile, {});
    const archive = JSON.parse(localStorage.getItem('foundry:archive') || '[]');
    expect(archive[0].profile.experience).toBe('intermediate');
    expect(archive[0].profile.splitType).toBe('ppl');
  });
});
