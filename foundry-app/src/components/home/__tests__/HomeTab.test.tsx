/**
 * Tests for HomeTab component.
 * All heavy dependencies are mocked so no real store/data access occurs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockStoreGet,
  mockLoadCardioSession,
  mockLoadMobilitySession,
  mockGetWorkoutDaysForWeek,
  mockBuildSessionDateMap,
  mockGetReadinessScore,
  mockGetReadinessLabel,
  mockGetTimeGreeting,
  mockGetMeso,
  mockComputeMobilityStreak,
} = vi.hoisted(() => ({
  mockStoreGet: vi.fn(() => null),
  mockLoadCardioSession: vi.fn(() => null),
  mockLoadMobilitySession: vi.fn(() => null),
  mockGetWorkoutDaysForWeek: vi.fn((): number[] => []),
  mockBuildSessionDateMap: vi.fn((): Record<string, string | string[]> => ({})),
  mockGetReadinessScore: vi.fn(() => 0),
  mockGetReadinessLabel: vi.fn(() => ({ label: 'Not Set', advice: '' })),
  mockGetTimeGreeting: vi.fn(() => 'Good morning'),
  mockGetMeso: vi.fn(() => ({ weeks: 6, days: ['Push', 'Pull', 'Legs'] })),
  mockComputeMobilityStreak: vi.fn(() => 0),
}));

vi.mock('../../../utils/store', () => ({
  store: { get: mockStoreGet },
  loadCardioSession: mockLoadCardioSession,
  loadMobilitySession: mockLoadMobilitySession,
  getWorkoutDaysForWeek: mockGetWorkoutDaysForWeek,
  buildSessionDateMap: mockBuildSessionDateMap,
  getReadinessScore: mockGetReadinessScore,
  getReadinessLabel: mockGetReadinessLabel,
  getTimeGreeting: mockGetTimeGreeting,
  getWeekSets: vi.fn((sets: number) => sets),
  computeMobilityStreak: mockComputeMobilityStreak,
}));

vi.mock('../../../data/constants', () => ({
  TAG_ACCENT: { PUSH: '#FF6B6B', PULL: '#4ECDC4', LEGS: '#FFD93D', MOBILITY: '#D4983C', CARDIO: '#5B8FA8' },
  getMeso: mockGetMeso,
  DAILY_MOBILITY: [],
  CARDIO_WORKOUTS: [
    {
      id: 'easy_walk',
      label: 'Easy Walk',
      description: 'Zone 2 recovery walk',
      category: 'Endurance',
      recommendedFor: ['build_muscle', 'build_strength', 'general_health'],
    },
  ],
  FOUNDRY_COOLDOWN: {},
  MOBILITY_PROTOCOLS: [
    { id: 'daily_warmup', name: 'Daily Mobility', duration: '3 min', category: 'warmup', description: '', moves: [] },
  ],
}));

vi.mock('../../../data/exercises', () => ({
  EXERCISE_DB: [],
  SAMPLE_PROGRAMS: [],
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../../../utils/events', () => ({
  emit: vi.fn(),
  on: vi.fn(() => () => {}),
}));

vi.mock('../../../styles/tokens', () => ({
  tokens: {
    colors: {
      gold: '#FFD700',
      amber: '#FFA000',
      overlay: 'rgba(0,0,0,0.5)',
      textPrimary: '#E8E4DC',
      textSecondary: '#A8A4A0',
      textMuted: '#9A8A78',
      accent: '#E8651A',
      accentMuted: 'rgba(232,101,26,0.15)',
      bgCard: '#1A1814',
      bgInset: '#0A0A0C',
      success: '#4caf50',
      danger: '#f44336',
      phaseAccum: '#E8E4DC',
      phaseDeload: '#5B8FA8',
    },
    radius: { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, xxl: 16, round: 20, pill: 99 },
    spacing: { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 },
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import HomeTab from '../HomeTab';

const ACTIVE_DAYS = [
  {
    label: 'Push Day',
    tag: 'PUSH',
    exercises: [{ name: 'Bench Press', muscle: 'chest', sets: 3, reps: '8-10', rest: '2 min' }],
    type: 'strength',
  },
  {
    label: 'Pull Day',
    tag: 'PULL',
    exercises: [{ name: 'Barbell Row', muscle: 'back', sets: 3, reps: '8-10', rest: '2 min' }],
    type: 'strength',
  },
  {
    label: 'Leg Day',
    tag: 'LEGS',
    exercises: [{ name: 'Squat', muscle: 'quads', sets: 3, reps: '6-8', rest: '3 min' }],
    type: 'strength',
  },
];

function makeProps(overrides: Record<string, any> = {}) {
  return {
    profile: {
      name: 'Alex',
      experience: 'intermediate',
      startDate: '2025-01-01',
      cardioSchedule: [],
      splitType: 'PPL',
      daysPerWeek: 3,
      weight: 180,
      workoutDays: [1, 3, 5],
      mesoLength: 6,
    },
    activeDays: ACTIVE_DAYS,
    completedDays: new Set<string>(),
    activeWeek: 0,
    displayWeek: 0,
    phase: 'Establish',
    pc: '#FF6B6B',
    rir: '3 RIR',
    weekDone: 0,
    weekTotal: 3,
    weekPct: 0,
    mesoPct: 42,
    doneSessions: 5,
    totalSessions: 18,
    readiness: null,
    readinessOpen: false,
    setReadinessOpen: vi.fn(),
    updateReadiness: vi.fn(),
    showRecoveryMorning: false,
    setShowRecoveryMorning: vi.fn(),
    showRecoveryTag: false,
    setShowRecoveryTag: vi.fn(),
    showNextSession: false,
    setShowNextSession: vi.fn(),
    showMorningMobility: false,
    setShowMorningMobility: vi.fn(),
    goTo: vi.fn(),
    goBack: vi.fn(),
    onSelectDay: vi.fn(),
    onSelectDayWeek: vi.fn(),
    setCurrentWeek: vi.fn(),
    setShowSkipConfirm: vi.fn(),
    onOpenCardio: vi.fn(),
    onOpenMobility: vi.fn(),
    setShowPricing: vi.fn(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTimeGreeting.mockReturnValue('Good morning');
  mockGetReadinessScore.mockReturnValue(0);
  mockGetReadinessLabel.mockReturnValue({ label: 'Not Set', advice: '' });
  mockGetWorkoutDaysForWeek.mockReturnValue([]);
  mockBuildSessionDateMap.mockReturnValue({});
  mockGetMeso.mockReturnValue({ weeks: 6, days: ['Push', 'Pull', 'Legs'] });
  mockLoadCardioSession.mockReturnValue(null);
  mockComputeMobilityStreak.mockReturnValue(0);
});

describe('HomeTab', () => {
  it('renders greeting with user name', () => {
    render(<HomeTab {...makeProps()} />);
    expect(screen.getByText(/Good morning/)).toBeDefined();
    expect(screen.getByText('Alex')).toBeDefined();
  });

  it('renders weekly workout bar labels for each active day', () => {
    render(<HomeTab {...makeProps()} />);
    // Segment labels use day.label (falling back to day.tag). "Push Day" can
    // also appear in the next-session preview so we assert "at least one".
    expect(screen.getAllByText('Push Day').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Leg Day').length).toBeGreaterThan(0);
  });

  it('clicking the dashboard card navigates to Progress', () => {
    const props = makeProps();
    render(<HomeTab {...props} />);
    // The dashboard card has aria-label="Open progress"
    const card = screen.getByLabelText('Open progress');
    fireEvent.click(card);
    expect(props.goTo).toHaveBeenCalledWith('progress');
  });

  it('shows today workout card when today is a workout day', () => {
    // Stub the sessionDateMap to place session 0:0 on today. The HomeTab
    // reads from buildSessionDateMap directly.
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    mockBuildSessionDateMap.mockReturnValue({ [todayStr]: '0:0' });

    const props = makeProps({
      profile: {
        name: 'Alex',
        experience: 'intermediate',
        startDate: todayStr,
        cardioSchedule: [],
        splitType: 'PPL',
        daysPerWeek: 3,
        weight: 180,
        workoutDays: [today.getDay()],
        mesoLength: 6,
      },
    });

    render(<HomeTab {...props} />);
    // When today is a workout day and not yet completed, the card shows "TODAY"
    expect(screen.getByText('TODAY')).toBeDefined();
  });

  it('shows rest state when no workout today', () => {
    // Default props: getWorkoutDaysForWeek returns [] so today is not a workout day
    // This means isRestState = true, so RestStateCard renders with "REST DAY"
    render(<HomeTab {...makeProps()} />);
    expect(screen.getByText('REST DAY')).toBeDefined();
  });

  it('clicking Start Workout area calls navigation callbacks', () => {
    // Set up so today IS a workout day (same as test 5)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    mockBuildSessionDateMap.mockReturnValue({ [todayStr]: '0:0' });

    const props = makeProps({
      profile: {
        name: 'Alex',
        experience: 'intermediate',
        startDate: todayStr,
        cardioSchedule: [],
        splitType: 'PPL',
        daysPerWeek: 3,
        weight: 180,
        workoutDays: [today.getDay()],
        mesoLength: 6,
      },
    });

    render(<HomeTab {...props} />);

    // The today card has a button with "TODAY" label that triggers navigation
    const todayLabel = screen.getByText('TODAY');
    const todayButton = todayLabel.closest('button');
    expect(todayButton).toBeTruthy();
    fireEvent.click(todayButton!);

    expect(props.goBack).toHaveBeenCalled();
    expect(props.onSelectDayWeek).toHaveBeenCalledWith(0, 0);
  });

  it('hides the mobility streak pill when streak is 0', () => {
    mockComputeMobilityStreak.mockReturnValue(0);
    render(<HomeTab {...makeProps()} />);
    expect(screen.queryByText(/MOBILITY STREAK/)).toBeNull();
  });

  it('renders "1 DAY" (singular) when mobility streak is 1', () => {
    mockComputeMobilityStreak.mockReturnValue(1);
    render(<HomeTab {...makeProps()} />);
    expect(screen.getByText(/MOBILITY STREAK · 1 DAY$/)).toBeDefined();
  });

  it('renders "N DAYS" (plural) for streak > 1 with aria-label', () => {
    mockComputeMobilityStreak.mockReturnValue(7);
    render(<HomeTab {...makeProps()} />);
    expect(screen.getByText(/MOBILITY STREAK · 7 DAYS/)).toBeDefined();
    expect(screen.getByLabelText('Mobility streak 7 days')).toBeDefined();
  });
});
