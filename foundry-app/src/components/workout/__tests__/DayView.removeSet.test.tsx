/**
 * Removing a set has to keep the REMOTE row numbering in step with local.
 *
 * The local blob reindexes on removal but `set_number` on the already-pushed
 * rows does not, and `rebuildDayData` keys the rebuilt blob by set_number. So
 * a mid-list removal left remote holding {0,1,3} against local {0,1,2}, and
 * the next pull wrote that gap back down. ExerciseCard renders
 * `Array.from({length: sets})` so it never showed the set stranded at 3 —
 * but MesoHistoryView walks Object.keys and calcMuscleSetsByTag counts every
 * entry with reps. One removal, a permanently inflated history and volume.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
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
  upsertWorkoutSetRemote: vi.fn(),
  deleteWorkoutSetRemote: vi.fn(),
  cancelDebouncedSync: vi.fn(),
  saveDayWeek: vi.fn(),
  weekData: {} as Record<string, Record<string, Record<string, unknown>>>,
}));

vi.mock('../../../utils/store', () => ({
  store: mocks.store,
  loadDayWeek: vi.fn(() => mocks.weekData),
  loadDayWeekWithCarryover: vi.fn(() => mocks.weekData),
  saveDayWeek: mocks.saveDayWeek,
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
  loadSetCountWeeks: vi.fn(() => []),
  pickSetCount: vi.fn((_weeks, _exId, weekIdx, baseFor) => baseFor(weekIdx)),
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

vi.mock('../../../utils/storage', () => ({ store: mocks.store }));

vi.mock('../../../data/constants', () => ({
  PHASE_COLOR: { accumulation: '#4CAF50' },
  TAG_ACCENT: { PUSH: '#FF6B6B' },
  RECOVERY_TIPS: [],
  randomQuote: vi.fn(() => ({ text: 'x', author: 'y' })),
  randomCongrats: vi.fn(() => 'nice'),
  getMeso: vi.fn(() => ({ weeks: 6, totalWeeks: 6, days: ['Push'], phases: ['accumulation'] })),
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
  upsertWorkoutSetRemote: mocks.upsertWorkoutSetRemote,
  deleteWorkoutSetRemote: mocks.deleteWorkoutSetRemote,
  getOrCreateWorkoutSessionId: vi.fn(() => 'session-1'),
  debouncedSync: vi.fn(),
  cancelDebouncedSync: mocks.cancelDebouncedSync,
  readProgramRole: vi.fn(() => 'solo'),
  syncDayExercisesRemote: vi.fn(async () => true),
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
  useToast: () => ({ showToast: vi.fn() }),
}));

// Expose one remove button per set index so the test can pick which row goes.
vi.mock('../ExerciseCard', () => ({
  default: ({
    exercise,
    exIdx,
    onRemoveSet,
  }: {
    exercise: { name: string; sets: number };
    exIdx: number;
    onRemoveSet?: (exIdx: number, setIdx: number) => void;
  }) => (
    <div data-testid="exercise-card">
      {exercise.name}
      {Array.from({ length: Number(exercise.sets) }).map((_, s) => (
        <button
          key={s}
          data-testid={`rm-${exIdx}-${s}`}
          onClick={() => onRemoveSet?.(exIdx, s)}
        >
          remove {s}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../shared/HammerIcon', () => ({ default: () => <div /> }));
vi.mock('../ReorderSheet', () => ({ default: () => <div /> }));

import DayView from '../DayView';

const EXERCISES = [
  { name: 'Bench Press', id: 'bench', sets: 4, reps: '8-12', rest: '90', anchor: true, muscle: 'chest' },
];

const day = () => ({
  name: 'Push Day',
  label: 'Push Day',
  tag: 'PUSH',
  type: 'strength',
  exercises: EXERCISES,
});

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

/** Four logged sets, all pushed remotely (id + reps). */
const seedFourLoggedSets = () => {
  mocks.weekData = {
    0: {
      0: { id: 'set-a', weight: '135', reps: '10', confirmed: true, _exId: 'bench' },
      1: { id: 'set-b', weight: '135', reps: '9', confirmed: true, _exId: 'bench' },
      2: { id: 'set-c', weight: '135', reps: '8', confirmed: true, _exId: 'bench' },
      3: { id: 'set-d', weight: '135', reps: '7', confirmed: true, _exId: 'bench' },
    },
  };
};

/** (setId, newSetNumber) pairs the component pushed. */
const renumbered = () =>
  mocks.upsertWorkoutSetRemote.mock.calls.map((c) => [c[1], c[3]]).sort();

describe('removing a set keeps remote set_number in step with local', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    seedFourLoggedSets();
  });

  it('renumbers every row after the one removed', () => {
    render(<DayView {...props()} />);
    fireEvent.click(screen.getByTestId('rm-0-1')); // drop the SECOND set

    expect(mocks.deleteWorkoutSetRemote).toHaveBeenCalledWith('set-b');
    // c was 2 → 1, d was 3 → 2. Without this the remote kept {0,2,3}.
    expect(renumbered()).toEqual([
      ['set-c', 1],
      ['set-d', 2],
    ]);
  });

  it('leaves the rows before the removed one alone', () => {
    render(<DayView {...props()} />);
    fireEvent.click(screen.getByTestId('rm-0-2')); // drop the THIRD set

    expect(mocks.deleteWorkoutSetRemote).toHaveBeenCalledWith('set-c');
    expect(renumbered()).toEqual([['set-d', 2]]); // only d moved (3 → 2)
  });

  it('pushes nothing when the LAST set goes — nothing shifted', () => {
    render(<DayView {...props()} />);
    fireEvent.click(screen.getByTestId('rm-0-3'));

    expect(mocks.deleteWorkoutSetRemote).toHaveBeenCalledWith('set-d');
    expect(mocks.upsertWorkoutSetRemote).not.toHaveBeenCalled();
  });

  it('cancels each renumbered row\'s pending debounce', () => {
    render(<DayView {...props()} />);
    fireEvent.click(screen.getByTestId('rm-0-1'));

    // A queued write still carries the OLD index; firing it after the
    // renumber would put the gap straight back.
    expect(mocks.cancelDebouncedSync).toHaveBeenCalledWith('set:set-c');
    expect(mocks.cancelDebouncedSync).toHaveBeenCalledWith('set:set-d');
  });

  it('does not create rows for sets that were never pushed', () => {
    // set-c has an id but no reps — handleUpdateSet's `hasData` gate means
    // it has no remote row. Upserting it here would CREATE the phantom this
    // whole fix exists to prevent. set-d has no id at all.
    mocks.weekData = {
      0: {
        0: { id: 'set-a', weight: '135', reps: '10', confirmed: true, _exId: 'bench' },
        1: { id: 'set-b', weight: '135', reps: '9', confirmed: true, _exId: 'bench' },
        2: { id: 'set-c', weight: '135', reps: '', _exId: 'bench' },
        3: { weight: '135', reps: '8', _exId: 'bench' },
      },
    };
    render(<DayView {...props()} />);
    fireEvent.click(screen.getByTestId('rm-0-1'));

    expect(mocks.upsertWorkoutSetRemote).not.toHaveBeenCalled();
  });

  it('carries the row\'s own values through the renumber', () => {
    render(<DayView {...props()} />);
    fireEvent.click(screen.getByTestId('rm-0-1'));

    const cCall = mocks.upsertWorkoutSetRemote.mock.calls.find((c) => c[1] === 'set-c');
    expect(cCall?.[0]).toBe('session-1');
    expect(cCall?.[2]).toBe('bench');
    expect(cCall?.[4]).toEqual({ weight: 135, reps: 8, rpe: null, isWarmup: false });
  });
});
