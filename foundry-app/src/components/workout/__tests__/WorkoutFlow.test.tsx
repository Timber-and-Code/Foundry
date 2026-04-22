import '@testing-library/jest-dom';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks (vi.hoisted pattern)                                        */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => ({
  store: {
    get: vi.fn((_key: string) => null as string | null),
    set: vi.fn(),
    remove: vi.fn(),
  },
  loadDayWeek: vi.fn(() => ({})),
  saveDayWeek: vi.fn(),
  loadNotes: vi.fn(() => ''),
  saveNotes: vi.fn(),
  markComplete: vi.fn(),
  loadProfile: vi.fn(() => ({
    name: 'Test',
    weight: 80,
    experience: 'intermediate',
    splitType: 'ppl',
    daysPerWeek: 3,
    addedDayExercises: {},
  })),
  snapshotData: vi.fn(),
  loadCompleted: vi.fn(() => new Set<string>()),
  loadCurrentWeek: vi.fn(() => 0),
  saveCurrentWeek: vi.fn(),
  archiveCurrentMeso: vi.fn(),
  resetMeso: vi.fn(),

  getMeso: vi.fn(() => ({ days: 3, totalWeeks: 4, workWeeks: 3 })),
  getWeekPhase: vi.fn(() => ['accumulation']),
  getProgTargets: vi.fn(() => ({ linear: ['5x5'] })),
  resetMesoCache: vi.fn(),

  EXERCISE_DB: [
    {
      id: 'bench-press',
      name: 'Bench Press',
      muscle: 'chest',
      muscles: ['chest', 'triceps'],
      equipment: 'barbell',
      tag: 'compound',
      sets: 2,
      reps: '5',
      rest: 120,
      pattern: 'push',
    },
    {
      id: 'barbell-row',
      name: 'Barbell Row',
      muscle: 'back',
      muscles: ['back', 'biceps'],
      equipment: 'barbell',
      tag: 'compound',
      sets: 2,
      reps: '5',
      rest: 120,
      pattern: 'pull',
    },
    {
      id: 'squat',
      name: 'Squat',
      muscle: 'quads',
      muscles: ['quads', 'glutes'],
      equipment: 'barbell',
      tag: 'compound',
      sets: 2,
      reps: '5',
      rest: 120,
      pattern: 'legs',
    },
  ],

  generateProgram: vi.fn(() => [
    {
      label: 'Push',
      exercises: [
        {
          id: 'bench-press',
          name: 'Bench Press',
          muscle: 'chest',
          muscles: ['chest', 'triceps'],
          equipment: 'barbell',
          tag: 'compound',
          anchor: true,
          sets: 2,
          reps: '5',
          rest: 120,
          warmup: '2 warmup sets',
          progression: 'linear',
          description: '',
          videoUrl: '',
          bw: false,
        },
      ],
    },
    {
      label: 'Pull',
      exercises: [
        {
          id: 'barbell-row',
          name: 'Barbell Row',
          muscle: 'back',
          muscles: ['back', 'biceps'],
          equipment: 'barbell',
          tag: 'compound',
          anchor: true,
          sets: 2,
          reps: '5',
          rest: 120,
          warmup: '2 warmup sets',
          progression: 'linear',
          description: '',
          videoUrl: '',
          bw: false,
        },
      ],
    },
    {
      label: 'Legs',
      exercises: [
        {
          id: 'squat',
          name: 'Squat',
          muscle: 'quads',
          muscles: ['quads', 'glutes'],
          equipment: 'barbell',
          tag: 'compound',
          anchor: true,
          sets: 2,
          reps: '5',
          rest: 120,
          warmup: '2 warmup sets',
          progression: 'linear',
          description: '',
          videoUrl: '',
          bw: false,
        },
      ],
    },
  ]),
}));

vi.mock('../../../utils/store', () => ({
  store: mocks.store,
  loadDayWeek: mocks.loadDayWeek,
  saveDayWeek: mocks.saveDayWeek,
  loadNotes: mocks.loadNotes,
  saveNotes: mocks.saveNotes,
  markComplete: mocks.markComplete,
  loadProfile: mocks.loadProfile,
  snapshotData: mocks.snapshotData,
  loadCompleted: mocks.loadCompleted,
  loadCurrentWeek: mocks.loadCurrentWeek,
  saveCurrentWeek: mocks.saveCurrentWeek,
  archiveCurrentMeso: mocks.archiveCurrentMeso,
  resetMeso: mocks.resetMeso,
}));

vi.mock('../../../data/constants', () => ({
  getMeso: mocks.getMeso,
  getWeekPhase: mocks.getWeekPhase,
  getProgTargets: mocks.getProgTargets,
  resetMesoCache: mocks.resetMesoCache,
}));

vi.mock('../../../data/exercises', () => ({
  EXERCISE_DB: mocks.EXERCISE_DB,
  SAMPLE_PROGRAMS: [],
}));

vi.mock('../../../utils/program', () => ({
  generateProgram: mocks.generateProgram,
}));

/* ------------------------------------------------------------------ */
/*  Import under test                                                  */
/* ------------------------------------------------------------------ */

import { useMesoState } from '../../../hooks/useMesoState';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const defaultHookParams = {
  setView: vi.fn(),
  setOnboarded: vi.fn(),
};

const workoutData = JSON.stringify({
  0: { 0: { weight: 100, reps: 5 }, 1: { weight: 100, reps: 5 } },
});

function setupStoreGet(completedKeys: Set<string> = new Set()) {
  mocks.store.get.mockImplementation((key: string) => {
    // Workout data for day/week keys
    const dayWeekMatch = key.match(/^foundry:day(\d+):week(\d+)$/);
    if (dayWeekMatch) return workoutData;
    // Completed-day markers
    const doneMatch = key.match(/^foundry:done:d(\d+):w(\d+)$/);
    if (doneMatch) {
      const k = `${doneMatch[1]}:${doneMatch[2]}`;
      return completedKeys.has(k) ? '1' : null;
    }
    if (key === 'foundry:storedProgram') return null;
    if (key === 'foundry:onboarded') return '1';
    return null;
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('WorkoutFlow integration – useMesoState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMeso.mockReturnValue({ days: 3, totalWeeks: 4, workWeeks: 3 });
    mocks.loadCompleted.mockReturnValue(new Set<string>());
    mocks.loadCurrentWeek.mockReturnValue(0);
    setupStoreGet();
  });

  /* 1 */ it('handleComplete marks day complete and updates completedDays', () => {
    const { result } = renderHook(() => useMesoState(defaultHookParams));

    act(() => {
      result.current.handleComplete(0, 0);
    });

    expect(mocks.markComplete).toHaveBeenCalledWith(0, 0);
    expect(result.current.completedDays.has('0:0')).toBe(true);
  });

  /* 2 */ it('handleComplete does NOT trigger weekCompleteModal when week is incomplete', () => {
    const { result } = renderHook(() => useMesoState(defaultHookParams));

    act(() => {
      result.current.handleComplete(0, 0);
    });

    expect(result.current.weekCompleteModal).toBeNull();
  });

  /* 3 */ it('handleComplete triggers weekCompleteModal when all days in week are done', () => {
    // Pre-seed days 0 and 1 of week 0 as completed
    mocks.loadCompleted.mockReturnValue(new Set(['0:0', '1:0']));

    const { result } = renderHook(() => useMesoState(defaultHookParams));

    // Complete the last day (day 2) of week 0
    act(() => {
      result.current.handleComplete(2, 0);
    });

    expect(result.current.weekCompleteModal).not.toBeNull();
    expect(result.current.weekCompleteModal!.weekIdx).toBe(0);
    expect(result.current.weekCompleteModal!.isFinal).toBe(false);
  });

  /* 4 */ it('weekCompleteModal has isFinal=true when last week completed', () => {
    // With days: 2, totalWeeks: 2, isFinal is true when weekIdx === getMeso().totalWeeks === 2
    mocks.getMeso.mockReturnValue({ days: 2, totalWeeks: 2, workWeeks: 1 });
    mocks.loadCompleted.mockReturnValue(new Set(['0:0', '1:0', '0:1', '1:1', '0:2']));

    const { result } = renderHook(() => useMesoState(defaultHookParams));

    act(() => {
      result.current.handleComplete(1, 2);
    });

    expect(result.current.weekCompleteModal).not.toBeNull();
    expect(result.current.weekCompleteModal!.isFinal).toBe(true);
  });

  /* 5 */ it('handleComplete increments currentWeek on week completion', () => {
    mocks.loadCompleted.mockReturnValue(new Set(['0:0', '1:0']));

    const { result } = renderHook(() => useMesoState(defaultHookParams));

    act(() => {
      result.current.handleComplete(2, 0);
    });

    expect(mocks.saveCurrentWeek).toHaveBeenCalledWith(1);
  });

  /* 6 */ it('handleComplete calculates volume from localStorage workout data', () => {
    mocks.loadCompleted.mockReturnValue(new Set(['0:0', '1:0']));
    setupStoreGet(new Set(['0:0', '1:0']));

    const { result } = renderHook(() => useMesoState(defaultHookParams));

    act(() => {
      result.current.handleComplete(2, 0);
    });

    expect(result.current.weekCompleteModal).not.toBeNull();
    expect(result.current.weekCompleteModal!.sets).toBeGreaterThan(0);
    expect(result.current.weekCompleteModal!.volume).toBeGreaterThan(0);
  });

  /* 7 */ it('handleReset clears state and archives meso', () => {
    const { result } = renderHook(() => useMesoState(defaultHookParams));

    act(() => {
      result.current.handleReset();
    });

    expect(mocks.archiveCurrentMeso).toHaveBeenCalled();
    expect(mocks.resetMeso).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.completedDays.size).toBe(0);
  });
});
