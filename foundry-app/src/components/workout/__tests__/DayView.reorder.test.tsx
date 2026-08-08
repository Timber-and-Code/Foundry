/**
 * DayView's half of the reorder contract.
 *
 * reorderPersistence.test.ts covers the permutation maths. This covers the
 * wiring around it, which is where the judgement calls live: the baseline is
 * captured when the sheet OPENS (so superset pairing doesn't raise the
 * question), the prompt only appears for a real change, and choosing "just
 * today" must leave storage completely alone.
 *
 * ReorderSheet is stubbed because the real one drags via dnd-kit pointer
 * sensors with a 400ms hold — untestable in jsdom, and not what's under test
 * here anyway.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  store: {
    get: vi.fn((key: string): string | null => localStorage.getItem(key)),
    set: vi.fn((key: string, val: string): void => {
      localStorage.setItem(key, val);
    }),
    remove: vi.fn((key: string): void => {
      localStorage.removeItem(key);
    }),
    keys: vi.fn((prefix?: string): string[] =>
      Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix)),
    ),
  },
  syncDayExercisesRemote: vi.fn(async () => true),
  readProgramRole: vi.fn((): 'solo' | 'owner' | 'member' => 'solo'),
  showToast: vi.fn(),
}));

vi.mock('../../../utils/store', () => ({
  store: mocks.store,
  loadDayWeek: vi.fn(() => ({})),
  loadDayWeekWithCarryover: vi.fn(() => ({})),
  saveDayWeek: vi.fn(),
  loadNotes: vi.fn(() => ''),
  saveNotes: vi.fn(),
  loadExNotes: vi.fn(() => ({})),
  saveExNotes: vi.fn(),
  markComplete: vi.fn(),
  loadProfile: vi.fn(() => ({ weight: 185 })),
  snapshotData: vi.fn(),
  loadExOverride: vi.fn(() => null),
  saveExOverride: vi.fn(),
  loadSupersets: vi.fn(() => []),
  saveSupersets: vi.fn(),
  loadSetCounts: vi.fn(() => ({})),
  saveSetCount: vi.fn(),
  saveProfile: vi.fn(),
  loadBwLog: vi.fn(() => []),
  bwPromptShownThisWeek: vi.fn(() => true),
  getWarmupDetail: vi.fn(),
  generateWarmupSteps: vi.fn(),
  loadArchive: vi.fn(() => []),
  detectStallingLifts: vi.fn(() => []),
  getWeekSets: vi.fn((sets: number) => sets),
}));

// reorderPersistence imports `store` from utils/storage (the real module the
// barrel re-exports), so point that at the same shim or its writes land in a
// different place than the assertions read.
vi.mock('../../../utils/storage', () => ({ store: mocks.store }));

vi.mock('../../../data/constants', () => ({
  PHASE_COLOR: { accumulation: '#4CAF50' },
  TAG_ACCENT: { PUSH: '#FF6B6B' },
  RECOVERY_TIPS: [],
  randomQuote: vi.fn(() => ({ text: 'x', author: 'y' })),
  randomCongrats: vi.fn(() => 'nice'),
  getMeso: vi.fn(() => ({ weeks: 6, days: ['Push'], phases: ['accumulation'] })),
  getWeekPhase: vi.fn(() => ['accumulation']),
  getProgTargets: vi.fn(() => ({ linear: ['5x5'] })),
  resetMesoCache: vi.fn(),
}));

vi.mock('../../../data/exercises', () => ({
  EXERCISE_DB: [{ id: 'bench', name: 'Bench Press', muscle: 'chest' }],
  SAMPLE_PROGRAMS: [],
}));

vi.mock('../../../utils/helpers', () => ({ haptic: vi.fn() }));

vi.mock('../../../utils/sync', () => ({
  syncExerciseSwapRemote: vi.fn(),
  upsertWorkoutSessionRemote: vi.fn(),
  upsertWorkoutSetRemote: vi.fn(),
  deleteWorkoutSetRemote: vi.fn(),
  getOrCreateWorkoutSessionId: vi.fn(() => 'session-1'),
  debouncedSync: vi.fn(),
  readProgramRole: mocks.readProgramRole,
  syncDayExercisesRemote: mocks.syncDayExercisesRemote,
}));

vi.mock('../../../contexts/RestTimerContext', () => ({
  useRestTimer: () => ({
    restTimer: null,
    restTimerMinimized: false,
    setRestTimerMinimized: vi.fn(),
    startRestTimer: vi.fn(),
    dismissRestTimer: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../ExerciseCard', () => ({
  default: ({ exercise }: { exercise: { name: string } }) => (
    <div data-testid="exercise-card">{exercise.name}</div>
  ),
}));

vi.mock('../../shared/HammerIcon', () => ({ default: () => <div /> }));

// Stub the drag sheet with plain buttons for the moves under test.
vi.mock('../ReorderSheet', () => ({
  default: ({
    onClose,
    onMove,
  }: {
    onClose: () => void;
    onMove: (from: number, to: number) => void;
  }) => (
    <div data-testid="reorder-sheet">
      <button data-testid="move-0-to-2" onClick={() => onMove(0, 2)}>
        move
      </button>
      <button data-testid="close-reorder" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

import DayView from '../DayView';

const EXERCISES = [
  { name: 'Bench Press', id: 'bench', sets: 3, reps: '8-12', rest: '90', anchor: true, muscle: 'chest' },
  { name: 'Overhead Press', id: 'ohp', sets: 3, reps: '8-12', rest: '90', anchor: false, muscle: 'shoulders' },
  { name: 'Dips', id: 'dips', sets: 3, reps: '8-12', rest: '90', anchor: false, muscle: 'chest' },
];

const day = () => ({ name: 'Push Day', label: 'Push Day', tag: 'PUSH', type: 'strength', exercises: EXERCISES });

const props = () => ({
  dayIdx: 0,
  weekIdx: 0,
  onBack: vi.fn(),
  onComplete: vi.fn(),
  onNextDay: vi.fn(),
  completedDays: new Set<string>(),
  profile: { weight: 185, experience: 'intermediate', sessionDuration: 60, addedDayExercises: {} },
  activeDays: [day()],
  onProfileUpdate: vi.fn(),
});

const seedProgram = () =>
  localStorage.setItem(
    'foundry:storedProgram',
    JSON.stringify([{ dayNum: 1, label: 'Push Day', tag: 'PUSH', exercises: EXERCISES }]),
  );

const storedIds = () =>
  JSON.parse(localStorage.getItem('foundry:storedProgram')!)[0].exercises.map(
    (e: { id: string }) => e.id,
  );

const openReorder = () => {
  fireEvent.click(
    screen.getByLabelText(/Open session — reorder, add, or complete workout/i),
  );
};

describe('DayView — reorder scope', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.store.get.mockImplementation((k: string) => localStorage.getItem(k));
    mocks.store.set.mockImplementation((k: string, v: string) => {
      localStorage.setItem(k, v);
    });
    mocks.store.remove.mockImplementation((k: string) => {
      localStorage.removeItem(k);
    });
    mocks.store.keys.mockImplementation((prefix?: string) =>
      Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix)),
    );
    mocks.readProgramRole.mockReturnValue('solo');
    mocks.syncDayExercisesRemote.mockResolvedValue(true);
    // pushReorderRemote no-ops without an active meso, so a test asserting
    // the push has to look like a signed-in lifter mid-cycle.
    localStorage.setItem('foundry:active_meso_id', 'meso-1');
    seedProgram();
  });

  it('asks about scope after a move', () => {
    render(<DayView {...props()} />);
    openReorder();
    fireEvent.click(screen.getByTestId('move-0-to-2'));
    fireEvent.click(screen.getByTestId('close-reorder'));

    expect(screen.getByTestId('reorder-persist')).toBeInTheDocument();
  });

  it('stays quiet when the sheet is opened and closed without moving', () => {
    render(<DayView {...props()} />);
    openReorder();
    fireEvent.click(screen.getByTestId('close-reorder'));

    expect(screen.queryByTestId('reorder-persist')).not.toBeInTheDocument();
  });

  it('writes the new order and pushes it when kept', async () => {
    render(<DayView {...props()} />);
    openReorder();
    fireEvent.click(screen.getByTestId('move-0-to-2'));
    fireEvent.click(screen.getByTestId('close-reorder'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('reorder-persist'));
    });

    expect(storedIds()).toEqual(['ohp', 'dips', 'bench']);
    expect(mocks.syncDayExercisesRemote).toHaveBeenCalledTimes(1);
    const [, dayIdx, pushed] = mocks.syncDayExercisesRemote.mock.calls[0] as unknown as [
      string,
      number,
      { id: string }[],
    ];
    expect(dayIdx).toBe(0);
    expect(pushed.map((e) => e.id)).toEqual(['ohp', 'dips', 'bench']);
  });

  it('touches nothing when the lifter picks "just today"', async () => {
    render(<DayView {...props()} />);
    openReorder();
    fireEvent.click(screen.getByTestId('move-0-to-2'));
    fireEvent.click(screen.getByTestId('close-reorder'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('reorder-session-only'));
    });

    expect(storedIds()).toEqual(['bench', 'ohp', 'dips']);
    expect(mocks.syncDayExercisesRemote).not.toHaveBeenCalled();
  });

  it('carries a swap override to the slot its exercise moved to', async () => {
    localStorage.setItem('foundry:exov:d0:ex0', 'incline_bench');
    render(<DayView {...props()} />);
    openReorder();
    fireEvent.click(screen.getByTestId('move-0-to-2'));
    fireEvent.click(screen.getByTestId('close-reorder'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('reorder-persist'));
    });

    // 'bench' moved from slot 0 to slot 2, so its override must follow it.
    expect(localStorage.getItem('foundry:exov:d0:ex2')).toBe('incline_bench');
    expect(localStorage.getItem('foundry:exov:d0:ex0')).toBeNull();
  });

  it('warns when the push failed, rather than reporting a clean save', async () => {
    mocks.syncDayExercisesRemote.mockResolvedValue(false);
    render(<DayView {...props()} />);
    openReorder();
    fireEvent.click(screen.getByTestId('move-0-to-2'));
    fireEvent.click(screen.getByTestId('close-reorder'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('reorder-persist'));
    });

    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.stringMatching(/hasn't reached the server/i),
      'warning',
    );
  });

  it('tells a shared-program owner that everyone is affected', () => {
    mocks.readProgramRole.mockReturnValue('owner');
    render(<DayView {...props()} />);
    openReorder();
    fireEvent.click(screen.getByTestId('move-0-to-2'));
    fireEvent.click(screen.getByTestId('close-reorder'));

    expect(screen.getByText(/Everyone training it will see this order/i)).toBeInTheDocument();
  });
});
