import { renderHook, act } from '@testing-library/react';

const mockStore = vi.hoisted(() => ({
  get: vi.fn() as ReturnType<typeof vi.fn>,
  set: vi.fn() as ReturnType<typeof vi.fn>,
  remove: vi.fn() as ReturnType<typeof vi.fn>,
}));

const mockStoreUtils = vi.hoisted(() => ({
  store: mockStore,
  loadProfile: vi.fn() as ReturnType<typeof vi.fn>,
  loadCompleted: vi.fn(() => new Set<string>()),
  markComplete: vi.fn() as ReturnType<typeof vi.fn>,
  loadCurrentWeek: vi.fn(() => 1),
  saveCurrentWeek: vi.fn() as ReturnType<typeof vi.fn>,
  snapshotData: vi.fn() as ReturnType<typeof vi.fn>,
  resetMeso: vi.fn() as ReturnType<typeof vi.fn>,
  archiveCurrentMeso: vi.fn() as ReturnType<typeof vi.fn>,
}));

const mockConstants = vi.hoisted(() => ({
  getMeso: vi.fn(() => ({
    workWeeks: 3,
    totalWeeks: 4,
    days: ['Push', 'Pull', 'Legs'],
    phases: ['accumulation', 'accumulation', 'intensification', 'deload'],
    rirs: [3, 2, 1, 0],
  })),
  resetMesoCache: vi.fn() as ReturnType<typeof vi.fn>,
}));

const mockExercises = vi.hoisted(() => ({
  EXERCISE_DB: [
    { id: 'bench', name: 'Bench Press', muscle: 'chest', equipment: 'barbell' },
  ],
  SAMPLE_PROGRAMS: [],
}));

const mockProgram = vi.hoisted(() => ({
  generateProgram: vi.fn(() => [
    {
      label: 'Push',
      tag: 'PUSH',
      exercises: [
        { name: 'Bench Press', sets: 3, progression: 'linear', anchor: true },
      ],
    },
    {
      label: 'Pull',
      tag: 'PULL',
      exercises: [
        { name: 'Rows', sets: 3, progression: 'linear' },
      ],
    },
    {
      label: 'Legs',
      tag: 'LEGS',
      exercises: [
        { name: 'Squat', sets: 3, progression: 'linear' },
      ],
    },
  ]),
}));

vi.mock('../../utils/store', () => mockStoreUtils);
vi.mock('../../data/constants', () => mockConstants);
vi.mock('../../data/exercises', () => mockExercises);
vi.mock('../../utils/program', () => mockProgram);

import { useMesoState } from '../useMesoState';

const defaultProfile = {
  name: 'Test User',
  weight: 80,
  split: 'PPL',
  addedDayExercises: {},
};

describe('useMesoState', () => {
  let setView: (v: string) => void;
  let setOnboarded: (v: boolean) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    setView = vi.fn() as unknown as (v: string) => void;
    setOnboarded = vi.fn() as unknown as (v: boolean) => void;

    // Defaults
    mockStoreUtils.loadProfile.mockReturnValue(null);
    mockStoreUtils.loadCompleted.mockReturnValue(new Set<string>());
    mockStoreUtils.loadCurrentWeek.mockReturnValue(1);
    mockStore.get.mockReturnValue(null);

    // getMeso days property is an array with length 3, but the hook uses
    // getMeso().days in numeric contexts (e.g. Array.from({ length: getMeso().days })).
    // The array ['Push','Pull','Legs'] has .length 3 which works for iteration,
    // but for numeric slicing we need it to behave as a number too.
    // Actually the hook does base.slice(0, getMeso().days) where days is an array,
    // which means slice(0, ['Push','Pull','Legs']) => slice(0, NaN) => [].
    // Let's override getMeso to return a numeric days count instead.
    mockConstants.getMeso.mockReturnValue({
      workWeeks: 3,
      totalWeeks: 4,
      days: 3 as unknown as string[],
      phases: ['accumulation', 'accumulation', 'intensification', 'deload'],
      rirs: [3, 2, 1, 0],
    });
  });

  it('returns null profile when loadProfile returns null', () => {
    mockStoreUtils.loadProfile.mockReturnValue(null);

    const { result } = renderHook(() =>
      useMesoState({ setView, setOnboarded }),
    );

    expect(result.current.profile).toBeNull();
  });

  it('loads profile from store', () => {
    mockStoreUtils.loadProfile.mockReturnValue(defaultProfile);

    const { result } = renderHook(() =>
      useMesoState({ setView, setOnboarded }),
    );

    expect(result.current.profile).toEqual(defaultProfile);
  });

  it('completedDays initializes from loadCompleted', () => {
    const completed = new Set(['0:0', '1:0']);
    mockStoreUtils.loadCompleted.mockReturnValue(completed);

    const { result } = renderHook(() =>
      useMesoState({ setView, setOnboarded }),
    );

    expect(result.current.completedDays).toEqual(completed);
  });

  it('currentWeek initializes from loadCurrentWeek', () => {
    mockStoreUtils.loadCurrentWeek.mockReturnValue(2);

    const { result } = renderHook(() =>
      useMesoState({ setView, setOnboarded }),
    );

    expect(result.current.currentWeek).toBe(2);
  });

  it('activeWeek returns first incomplete week', () => {
    // Mark all days of week 0 as completed (days 0, 1, 2)
    const completed = new Set(['0:0', '1:0', '2:0']);
    mockStoreUtils.loadCompleted.mockReturnValue(completed);
    mockStoreUtils.loadProfile.mockReturnValue(defaultProfile);

    const { result } = renderHook(() =>
      useMesoState({ setView, setOnboarded }),
    );

    // Week 0 is fully done, so activeWeek should be 1
    expect(result.current.activeWeek).toBe(1);
  });

  it('handleComplete marks day complete and updates completedDays', () => {
    mockStoreUtils.loadProfile.mockReturnValue(defaultProfile);
    mockStoreUtils.loadCompleted.mockReturnValue(new Set<string>());

    const { result } = renderHook(() =>
      useMesoState({ setView, setOnboarded }),
    );

    act(() => {
      result.current.handleComplete(0, 0);
    });

    expect(mockStoreUtils.markComplete).toHaveBeenCalledWith(0, 0);
    expect(result.current.completedDays.has('0:0')).toBe(true);
  });

  it('handleComplete triggers weekCompleteModal when all days in week are done', () => {
    // Pre-complete days 0 and 1 of week 0
    const completed = new Set(['0:0', '1:0']);
    mockStoreUtils.loadCompleted.mockReturnValue(completed);
    mockStoreUtils.loadProfile.mockReturnValue(defaultProfile);

    const { result } = renderHook(() =>
      useMesoState({ setView, setOnboarded }),
    );

    // Complete the last day (day 2) of week 0
    act(() => {
      result.current.handleComplete(2, 0);
    });

    expect(mockStoreUtils.snapshotData).toHaveBeenCalled();
    expect(result.current.weekCompleteModal).not.toBeNull();
    expect(result.current.weekCompleteModal!.weekIdx).toBe(0);
  });

  it('handleReset clears state and calls archiveCurrentMeso', () => {
    mockStoreUtils.loadProfile.mockReturnValue(defaultProfile);

    const { result } = renderHook(() =>
      useMesoState({ setView, setOnboarded }),
    );

    act(() => {
      result.current.handleReset();
    });

    expect(mockStoreUtils.archiveCurrentMeso).toHaveBeenCalledWith(
      defaultProfile,
      { generateProgram: mockProgram.generateProgram, EXERCISE_DB: mockExercises.EXERCISE_DB },
    );
    expect(mockStoreUtils.resetMeso).toHaveBeenCalled();
    expect(mockConstants.resetMesoCache).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.completedDays.size).toBe(0);
    expect(result.current.currentWeek).toBe(1);
    expect(setView).toHaveBeenCalledWith('home');
  });

  it('activeDays generates program from profile', () => {
    mockStoreUtils.loadProfile.mockReturnValue(defaultProfile);
    mockStore.get.mockReturnValue(null);

    const { result } = renderHook(() =>
      useMesoState({ setView, setOnboarded }),
    );

    expect(result.current.activeDays).toHaveLength(3);
    expect(result.current.activeDays[0].label).toBe('Push');
    expect(result.current.activeDays[1].label).toBe('Pull');
    expect(result.current.activeDays[2].label).toBe('Legs');
    expect(mockProgram.generateProgram).toHaveBeenCalledWith(
      defaultProfile,
      mockExercises.EXERCISE_DB,
    );
  });
});
