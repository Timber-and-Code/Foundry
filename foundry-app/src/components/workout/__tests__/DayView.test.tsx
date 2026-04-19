import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
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
  saveProfile: vi.fn(),
  loadBwLog: vi.fn(() => []),
  bwPromptShownThisWeek: vi.fn(() => true),
  getWarmupDetail: vi.fn(),
  generateWarmupSteps: vi.fn(),
  loadArchive: vi.fn(() => []),
  detectStallingLifts: vi.fn(() => []),
  getWeekSets: vi.fn((sets: number) => sets),
  loadExerciseHistory: vi.fn(() => []),

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

vi.mock('../../utils/store', () => ({
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

vi.mock('../../data/constants', () => ({
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

vi.mock('../../data/exercises', () => ({
  EXERCISE_DB: [{ id: 'bench', name: 'Bench Press', muscle: 'chest' }],
  SAMPLE_PROGRAMS: [],
}));

vi.mock('../../utils/helpers', () => ({
  haptic: mocks.haptic,
}));

vi.mock('../../styles/tokens', () => ({
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
  default: ({ exercise }: { exercise: { name: string } }) => (
    <div data-testid="exercise-card">{exercise.name}</div>
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
    // Restore default implementations after clearAllMocks
    mocks.store.get.mockReturnValue(null);
    mocks.loadDayWeek.mockReturnValue({});
    mocks.loadDayWeekWithCarryover.mockReturnValue({});
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

  it('shows "Begin Workout" button when workout has not started', () => {
    render(<DayView {...defaultProps()} />);
    const beginButtons = screen.getAllByText('Begin Workout');
    expect(beginButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders exercise cards for each exercise in the day', () => {
    // Simulate workout already started so we get the main view with ExerciseCards
    mocks.store.get.mockImplementation((key: string) => {
      if (key === 'foundry:sessionStart:d0:w0') return String(Date.now() - 60000);
      return null;
    });

    render(<DayView {...defaultProps()} />);
    const cards = screen.getAllByTestId('exercise-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Bench Press');
    expect(cards[1]).toHaveTextContent('Overhead Press');
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
    // In locked state, the "Begin Workout" button should not appear
    // and "Add Exercise" should not appear.
    const props = defaultProps();
    props.weekIdx = 2;
    render(<DayView {...props} />);

    // The component renders the pre-workout view for locked sessions too,
    // but should not render Begin Workout since isLocked = true
    // (showMesoOverlay is false when isLocked)
    const beginButtons = screen.queryAllByText('Begin Workout');
    // In locked state, the bottom Begin Workout is gated by !isLocked
    // The overlay Begin Workout is gated by showMesoOverlay which is false when isLocked
    expect(beginButtons).toHaveLength(0);
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

    // When workoutStarted is true, the started view renders with
    // a Back button and an elapsed timer. Check if workoutStarted
    // is true by looking for the "Begin Workout" button (absent in started view).
    const beginButtons = screen.queryAllByText('Begin Workout');
    if (beginButtons.length === 0) {
      // We're in the started view — look for timer
      const timerEl = container.querySelector('[aria-live="polite"]');
      expect(timerEl).toBeInTheDocument();
      expect(timerEl!.textContent).toMatch(/\d+:\d{2}/);
    } else {
      // workoutStarted is false — verify Begin Workout is present
      // and click it to start, which should add timer
      fireEvent.click(beginButtons[0]);
      // After clicking, the component re-renders with started view
      const timerEl = container.querySelector('[aria-live="polite"]');
      expect(timerEl).toBeInTheDocument();
      expect(timerEl!.textContent).toMatch(/\d+:\d{2}/);
    }
  });

  it('notes persistence - clicking Begin Workout stores session start', () => {
    // Readiness must be complete in real localStorage — DayView's readiness
    // check reads the real store, not the mock (the mock registers at a path
    // the real DayView import doesn't resolve to). Seeding localStorage is
    // the working path.
    localStorage.setItem(todayReadinessKey(), completeReadiness());

    // Render the pre-workout view
    render(<DayView {...defaultProps()} />);
    expect(screen.getByText(/Push Day/)).toBeInTheDocument();

    // Click "Begin Workout" to start the session
    const beginButtons = screen.getAllByText('Begin Workout');
    fireEvent.click(beginButtons[0]);

    // After starting, the component stores the session start time in localStorage.
    const sessionKey = 'foundry:sessionStart:d0:w0';
    const stored = localStorage.getItem(sessionKey);
    expect(stored).not.toBeNull();
    expect(Number(stored)).toBeGreaterThan(0);
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
});
