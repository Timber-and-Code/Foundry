import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks (vi.hoisted pattern)                                        */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => ({
  // Pass-through localStorage shim — the tests assert against the real
  // localStorage (because some hooks like useWorkoutTimer read it directly),
  // so the mocked `store` must mirror writes/reads to the real store.
  store: {
    get: vi.fn((key: string): string | null => localStorage.getItem(key)),
    set: vi.fn((key: string, val: string): void => {
      localStorage.setItem(key, val);
    }),
    remove: vi.fn((key: string): void => {
      localStorage.removeItem(key);
    }),
  },
  // loadDayWeek / saveDayWeek pass through to real localStorage too, so
  // tests can seed `foundry:day{n}:week{n}` and assert against it after
  // DayView writes back.
  loadDayWeek: vi.fn((dayIdx: number, weekIdx: number) => {
    const raw = localStorage.getItem(`foundry:day${dayIdx}:week${weekIdx}`);
    return raw ? JSON.parse(raw) : {};
  }),
  loadDayWeekWithCarryover: vi.fn((dayIdx: number, weekIdx: number) => {
    const raw = localStorage.getItem(`foundry:day${dayIdx}:week${weekIdx}`);
    return raw ? JSON.parse(raw) : {};
  }),
  saveDayWeek: vi.fn((dayIdx: number, weekIdx: number, data: unknown) => {
    localStorage.setItem(`foundry:day${dayIdx}:week${weekIdx}`, JSON.stringify(data));
  }),
  loadNotes: vi.fn(() => ''),
  saveNotes: vi.fn(),
  loadExNotes: vi.fn(() => ({})),
  saveExNotes: vi.fn(),
  markComplete: vi.fn(),
  loadProfile: vi.fn(() => ({ weight: 185 })),
  snapshotData: vi.fn(),
  loadExOverride: vi.fn(() => null),
  saveExOverride: vi.fn(),
  saveProfile: vi.fn(),
  loadBwLog: vi.fn(() => []),
  bwPromptShownThisWeek: vi.fn(() => true),
  getWarmupDetail: vi.fn(),
  generateWarmupSteps: vi.fn(),
  loadArchive: vi.fn(() => []),
  detectStallingLifts: vi.fn(() => []),
  getWeekSets: vi.fn((sets: number) => sets),
  loadExerciseHistory: vi.fn(() => []),
  loadSupersets: vi.fn(() => []),
  saveSupersets: vi.fn(),
  loadSetCounts: vi.fn(() => ({})),
  saveSetCount: vi.fn(),

  getMeso: vi.fn(() => ({
    weeks: 6,
    days: ['Push', 'Pull', 'Legs'],
    phases: ['accumulation'],
  })),
  getWeekPhase: vi.fn(() => ['accumulation', 'accumulation', 'accumulation', 'accumulation', 'accumulation', 'accumulation']),
  getProgTargets: vi.fn(() => ({ linear: ['5x5', '5x5'] })),
  resetMesoCache: vi.fn(),

  haptic: vi.fn(),
  useRestTimer: vi.fn(() => ({
    restTimer: null,
    restTimerMinimized: false,
    setRestTimerMinimized: vi.fn(),
    startRestTimer: vi.fn(),
    dismissRestTimer: vi.fn(),
  })),
}));

// Test file lives at src/components/workout/__tests__/, so utils/* and
// data/* are 3 levels up — the prior `'../../utils/store'` etc. resolved
// to non-existent `src/components/utils/...` and were silent no-ops.
vi.mock('../../../utils/store', () => ({
  store: mocks.store,
  loadDayWeek: mocks.loadDayWeek,
  loadDayWeekWithCarryover: mocks.loadDayWeekWithCarryover,
  saveDayWeek: mocks.saveDayWeek,
  loadNotes: mocks.loadNotes,
  saveNotes: mocks.saveNotes,
  loadExNotes: mocks.loadExNotes,
  saveExNotes: mocks.saveExNotes,
  markComplete: mocks.markComplete,
  loadProfile: mocks.loadProfile,
  snapshotData: mocks.snapshotData,
  loadExOverride: mocks.loadExOverride,
  saveExOverride: mocks.saveExOverride,
  loadSupersets: mocks.loadSupersets,
  saveSupersets: mocks.saveSupersets,
  loadSetCounts: mocks.loadSetCounts,
  saveSetCount: mocks.saveSetCount,
  saveProfile: mocks.saveProfile,
  loadBwLog: mocks.loadBwLog,
  bwPromptShownThisWeek: mocks.bwPromptShownThisWeek,
  getWarmupDetail: mocks.getWarmupDetail,
  generateWarmupSteps: mocks.generateWarmupSteps,
  loadArchive: mocks.loadArchive,
  detectStallingLifts: mocks.detectStallingLifts,
  getWeekSets: mocks.getWeekSets,
  loadExerciseHistory: mocks.loadExerciseHistory,
}));

vi.mock('../../../data/constants', () => ({
  PHASE_COLOR: { accumulation: '#4CAF50' },
  TAG_ACCENT: { PUSH: '#FF6B6B', PULL: '#4ECDC4' },
  RECOVERY_TIPS: [],
  randomQuote: vi.fn(() => ({ text: 'Stay strong', author: 'Coach' })),
  randomCongrats: vi.fn(() => 'Great job!'),
  getMeso: mocks.getMeso,
  getWeekPhase: mocks.getWeekPhase,
  getProgTargets: mocks.getProgTargets,
  resetMesoCache: mocks.resetMesoCache,
}));

vi.mock('../../../data/exercises', () => ({
  EXERCISE_DB: [{ id: 'bench', name: 'Bench Press', muscle: 'chest' }],
  SAMPLE_PROGRAMS: [],
}));

vi.mock('../../../utils/helpers', () => ({
  haptic: mocks.haptic,
}));

vi.mock('../../../styles/tokens', () => ({
  tokens: {
    colors: {
      amberHighlight: '#fff3cd',
      gold: '#FFD700',
      overlayHeavy: 'rgba(0,0,0,0.7)',
      overlayMed: 'rgba(0,0,0,0.5)',
      overlayLight: 'rgba(0,0,0,0.3)',
    },
    radius: { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, xxl: 16 },
  },
}));

// The import path in DayView.tsx is '../../contexts/RestTimerContext'
// which resolves to src/contexts/RestTimerContext from src/components/workout/.
// vi.mock resolves relative to the test file, so we need ../../../ contexts.
vi.mock('../../../contexts/RestTimerContext', () => ({
  useRestTimer: () => mocks.useRestTimer(),
  RestTimerProvider: ({ children }: any) => children,
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}));

vi.mock('../ExerciseCard', () => ({
  default: ({
    exercise,
    exIdx,
    onAddSet,
    onSetLogged,
  }: {
    exercise: { name: string; rest?: string; sets?: number };
    exIdx: number;
    onAddSet?: (exIdx: number) => void;
    onSetLogged?: (
      restStr: string,
      exName: string,
      setIdx: number,
      isLastSet?: boolean,
    ) => void;
  }) => (
    <div data-testid="exercise-card">
      {exercise.name}
      {onAddSet && (
        <button
          data-testid={`add-set-${exIdx}`}
          onClick={() => onAddSet(exIdx)}
        >
          Add set
        </button>
      )}
      {onSetLogged && (
        <>
          {/* Test handles for invoking the rest-timer wiring without
              recreating the full ExerciseCard checkmark UX. Mid set =
              isLastSet=false (rest fires for non-superset); last set =
              isLastSet=true (NextUpCard handoff for non-superset). */}
          <button
            data-testid={`log-mid-set-${exIdx}`}
            onClick={() =>
              onSetLogged(exercise.rest || '90', exercise.name, 0, false)
            }
          >
            log mid set
          </button>
          <button
            data-testid={`log-last-set-${exIdx}`}
            onClick={() =>
              onSetLogged(
                exercise.rest || '90',
                exercise.name,
                Number(exercise.sets ?? 1) - 1,
                true,
              )
            }
          >
            log last set
          </button>
        </>
      )}
    </div>
  ),
}));

vi.mock('../../shared/HammerIcon', () => ({
  default: (props: any) => <div data-testid="hammer-icon" {...props} />,
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

import DayView from '../DayView';

function makeDay(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Push Day',
    label: 'Push Day',
    tag: 'PUSH',
    type: 'strength',
    exercises: [
      { name: 'Bench Press', id: 'bench', sets: 3, reps: '8-12', rest: '90', anchor: true, bw: false, warmup: '2 ramp sets', progression: 'weight', muscle: 'chest' },
      { name: 'Overhead Press', id: 'ohp', sets: 3, reps: '8-12', rest: '90', anchor: false, bw: false, warmup: '1 feeler set', progression: 'weight', muscle: 'shoulders' },
    ],
    ...overrides,
  };
}

// Today's readiness key — tests that click Begin Workout must mock this as
// complete so DayView doesn't intercept with the ReadinessSheet.
const todayReadinessKey = () => {
  const d = new Date();
  return `foundry:readiness:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const completeReadiness = () => JSON.stringify({ sleep: 7, soreness: 2, energy: 7 });

const defaultProps = () => ({
  dayIdx: 0,
  weekIdx: 0,
  onBack: vi.fn(),
  onComplete: vi.fn(),
  onNextDay: vi.fn(),
  completedDays: new Set<string>(),
  profile: { weight: 185, experience: 'intermediate', sessionDuration: 60, addedDayExercises: {} },
  activeDays: [makeDay(), makeDay({ name: 'Pull Day', label: 'Pull Day', tag: 'PULL' })],
  onProfileUpdate: vi.fn(),
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('DayView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default implementations after clearAllMocks. Keep the store
    // shim and loadDayWeek/saveDayWeek as real-localStorage pass-throughs
    // so tests that assert against `localStorage.getItem(...)` see the
    // writes DayView makes through the mocked module.
    mocks.store.get.mockImplementation((key: string) => localStorage.getItem(key));
    mocks.store.set.mockImplementation((key: string, val: string) => {
      localStorage.setItem(key, val);
    });
    mocks.store.remove.mockImplementation((key: string) => {
      localStorage.removeItem(key);
    });
    mocks.loadDayWeek.mockImplementation((dayIdx: number, weekIdx: number) => {
      const raw = localStorage.getItem(`foundry:day${dayIdx}:week${weekIdx}`);
      return raw ? JSON.parse(raw) : {};
    });
    mocks.loadDayWeekWithCarryover.mockImplementation((dayIdx: number, weekIdx: number) => {
      const raw = localStorage.getItem(`foundry:day${dayIdx}:week${weekIdx}`);
      return raw ? JSON.parse(raw) : {};
    });
    mocks.saveDayWeek.mockImplementation((dayIdx: number, weekIdx: number, data: unknown) => {
      localStorage.setItem(`foundry:day${dayIdx}:week${weekIdx}`, JSON.stringify(data));
    });
    mocks.loadNotes.mockReturnValue('');
    mocks.loadExNotes.mockReturnValue({});
    mocks.loadExOverride.mockReturnValue(null);
    mocks.loadBwLog.mockReturnValue([]);
    mocks.bwPromptShownThisWeek.mockReturnValue(true);
    mocks.loadArchive.mockReturnValue([]);
    mocks.detectStallingLifts.mockReturnValue([]);
    mocks.getWeekSets.mockImplementation((sets: number) => sets);
    mocks.loadExerciseHistory.mockReturnValue([]);
    mocks.getMeso.mockReturnValue({ weeks: 6, days: ['Push', 'Pull', 'Legs'], phases: ['accumulation'] });
    mocks.getWeekPhase.mockReturnValue(['accumulation', 'accumulation', 'accumulation', 'accumulation', 'accumulation', 'accumulation']);
    mocks.getProgTargets.mockReturnValue({ linear: ['5x5', '5x5'] });
    mocks.useRestTimer.mockReturnValue({
      restTimer: null,
      restTimerMinimized: false,
      setRestTimerMinimized: vi.fn(),
      startRestTimer: vi.fn(),
      dismissRestTimer: vi.fn(),
    });
    // Clear localStorage to prevent state leaking between tests
    localStorage.clear();
  });

  it('renders day name from activeDays[dayIdx]', () => {
    render(<DayView {...defaultProps()} />);
    expect(screen.getByText(/Push Day/)).toBeInTheDocument();
  });

  it('auto-starts the workout on mount (no splash gate)', () => {
    // Splash gate removed 2026-04-29 — workout auto-starts on mount via a
    // useEffect. The "START WORKOUT" CTA no longer exists in DayView.
    render(<DayView {...defaultProps()} />);
    expect(screen.queryByText(/^START WORKOUT$/i)).toBeNull();
    // Auto-start writes a sessionStart key to localStorage.
    const sessionKey = 'foundry:sessionStart:d0:w0';
    expect(localStorage.getItem(sessionKey)).not.toBeNull();
  });

  it('renders one focused exercise card at a time (Focus Mode)', () => {
    // Simulate workout already started so splash is skipped AND the main view
    // (which gates on workoutStarted) renders the focused ExerciseCard. The
    // splash check reads via the mocked store; useWorkoutTimer reads the REAL
    // localStorage. Focus Mode shows only the current exercise (others live in
    // the progress strip + up-next peek), so we expect exactly one card.
    const startTime = String(Date.now() - 60000);
    localStorage.setItem('foundry:sessionStart:d0:w0', startTime);
    mocks.store.get.mockImplementation((key: string) => {
      if (key === 'foundry:sessionStart:d0:w0') return startTime;
      return null;
    });

    render(<DayView {...defaultProps()} />);
    const cards = screen.getAllByTestId('exercise-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Bench Press');
    // Second exercise is visible as the "Up next" peek rather than a full card
    expect(screen.getByLabelText(/Up next: Overhead Press/)).toBeInTheDocument();
  });

  it('back button calls onBack', () => {
    const props = defaultProps();
    render(<DayView {...props} />);
    const backButton = screen.getByRole('button', { name: /go back/i });
    fireEvent.click(backButton);
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('shows locked state when session is in the future (weekIdx > activeWeek)', () => {
    // activeWeek is computed as the first week that isn't fully complete.
    // With empty completedDays, activeWeek = 0. weekIdx = 2 means future/locked.
    // In locked state, neither the splash nor any start CTA should render.
    const props = defaultProps();
    props.weekIdx = 2;
    render(<DayView {...props} />);
    expect(screen.queryByText(/START WORKOUT/i)).toBeNull();
    expect(screen.queryByText('Begin Workout')).toBeNull();
  });

  it('shows elapsed timer once workout is started', () => {
    // Simulate a session that started 65 seconds ago — seed real localStorage
    // since the useWorkoutTimer hook reads the real store, not the mock.
    const startTime = Date.now() - 65000;
    localStorage.setItem('foundry:sessionStart:d0:w0', String(startTime));
    localStorage.setItem(todayReadinessKey(), completeReadiness());
    mocks.store.get.mockImplementation((key: string) => {
      if (key === 'foundry:sessionStart:d0:w0') return String(startTime);
      return null;
    });

    const { container } = render(<DayView {...defaultProps()} />);

    // When workoutStarted is true, the started view renders with a timer.
    // Splash is skipped via mocked + real sessionStart key. If for any reason
    // the splash is showing, click START WORKOUT to commit.
    const splashCta = screen.queryByText(/START WORKOUT/i);
    if (splashCta) {
      fireEvent.click(splashCta);
    }
    const timerEl = container.querySelector('[aria-live="polite"]');
    expect(timerEl).toBeInTheDocument();
    expect(timerEl!.textContent).toMatch(/\d+:\d{2}/);
  });

  it('stores session start in localStorage on mount (auto-start)', () => {
    // Splash and the readiness gate were removed 2026-04-29; DayView now
    // auto-starts the workout via a useEffect on mount. The session start
    // timestamp lands in localStorage without any user interaction.
    render(<DayView {...defaultProps()} />);
    expect(screen.getByText(/Push Day/)).toBeInTheDocument();

    const sessionKey = 'foundry:sessionStart:d0:w0';
    const stored = localStorage.getItem(sessionKey);
    expect(stored).not.toBeNull();
    expect(Number(stored)).toBeGreaterThan(0);
  });

  it('handleAddSet pre-fills the new set\'s weight from the previous set (#7)', () => {
    // Seed real localStorage with current-week data so the new (4th) set
    // gets pre-filled from the highest-index existing set's weight (95).
    const startTime = String(Date.now() - 60000);
    localStorage.setItem('foundry:sessionStart:d0:w0', startTime);
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({
        0: {
          0: { weight: '100', reps: '8' },
          1: { weight: '100', reps: '8' },
          2: { weight: '95', reps: '7' },
        },
      }),
    );

    render(<DayView {...defaultProps()} />);

    const btn = screen.getByTestId('add-set-0');
    act(() => {
      fireEvent.click(btn);
    });

    // saveDayWeek persists to localStorage at `foundry:day0:week0`. The new
    // (4th) set should be present with weight pre-filled from the prior set.
    const stored = localStorage.getItem('foundry:day0:week0');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as Record<string, Record<string, { weight?: string; reps?: string }>>;
    expect(parsed[0]).toBeDefined();
    expect(parsed[0][3]).toBeDefined();
    expect(parsed[0][3].weight).toBe('95');
    expect(parsed[0][3].reps).toBe('');
  });

  it('does not render the removed "End Early" header button', () => {
    mocks.store.get.mockImplementation((key: string) => {
      if (key === 'foundry:sessionStart:d0:w0') return String(Date.now() - 60000);
      return null;
    });

    render(<DayView {...defaultProps()} />);
    // End Early was removed — only "Complete Workout" should end a session.
    expect(screen.queryByRole('button', { name: /end workout early/i })).toBeNull();
  });

  it('Stop Workout does not re-arm the session while DayView is still mounted', () => {
    // Regression: performStopWorkout flips workoutStarted → false, which is
    // exactly the condition the auto-start effect watches. Navigation away is
    // a React Router transition, so the effect re-runs before unmount and —
    // without the stoppedRef guard — re-stamps sessionStart with a fresh
    // Date.now(), restarting the timer on Home at 0:00.
    const props = defaultProps();
    render(<DayView {...props} />);
    const sessionKey = 'foundry:sessionStart:d0:w0';
    expect(localStorage.getItem(sessionKey)).toBeTruthy();

    const stopBtn = screen.getByRole('button', {
      name: /stop workout without completing/i,
    });
    // No logged sets → stops silently, no confirm modal.
    act(() => {
      fireEvent.click(stopBtn);
    });

    expect(props.onBack).toHaveBeenCalledTimes(1);
    // The session key must stay cleared even though DayView is still mounted.
    expect(localStorage.getItem(sessionKey) || '').toBe('');
    expect(localStorage.getItem('foundry:active_session')).toBeNull();
  });

  /* ── Rest timer wiring regression (#1) ──────────────────────────────── */

  // Confirms `handleSetLogged` still calls startRestTimer when a
  // non-final, non-superset set is checked off — guards against the
  // "checking off a set no longer kicks off the rest timer" symptom.
  it('starts the rest timer when a mid-exercise set is logged (#1)', () => {
    const startRestTimer = vi.fn();
    mocks.useRestTimer.mockReturnValue({
      restTimer: null,
      restTimerMinimized: false,
      setRestTimerMinimized: vi.fn(),
      startRestTimer,
      dismissRestTimer: vi.fn(),
    });
    const startTime = String(Date.now() - 60000);
    localStorage.setItem('foundry:sessionStart:d0:w0', startTime);
    mocks.store.get.mockImplementation((key: string) => {
      if (key === 'foundry:sessionStart:d0:w0') return startTime;
      return null;
    });

    render(<DayView {...defaultProps()} />);

    const midBtn = screen.getByTestId('log-mid-set-0');
    act(() => {
      fireEvent.click(midBtn);
    });

    expect(startRestTimer).toHaveBeenCalledTimes(1);
    expect(startRestTimer).toHaveBeenCalledWith('90', 'Bench Press', 0, 0);
  });

  // Last set of a non-superset exercise still starts a rest timer — the
  // cue must fire after EVERY set. The NextUpCard auto-advance (expand +
  // scroll to the next card) runs alongside the timer.
  it('starts the rest timer on a last-set log when a next exercise follows', () => {
    const startRestTimer = vi.fn();
    mocks.useRestTimer.mockReturnValue({
      restTimer: null,
      restTimerMinimized: false,
      setRestTimerMinimized: vi.fn(),
      startRestTimer,
      dismissRestTimer: vi.fn(),
    });
    const startTime = String(Date.now() - 60000);
    localStorage.setItem('foundry:sessionStart:d0:w0', startTime);
    mocks.store.get.mockImplementation((key: string) => {
      if (key === 'foundry:sessionStart:d0:w0') return startTime;
      return null;
    });

    render(<DayView {...defaultProps()} />);

    const lastBtn = screen.getByTestId('log-last-set-0');
    act(() => {
      fireEvent.click(lastBtn);
    });

    expect(startRestTimer).toHaveBeenCalledTimes(1);
    expect(startRestTimer).toHaveBeenCalledWith('90', 'Bench Press', 0, 0);
  });
});
