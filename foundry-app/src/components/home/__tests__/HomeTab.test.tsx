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
  mockGetReadinessScore,
  mockGetReadinessLabel,
  mockGetTimeGreeting,
  mockGetMeso,
} = vi.hoisted(() => ({
  mockStoreGet: vi.fn(() => null),
  mockLoadCardioSession: vi.fn(() => null),
  mockLoadMobilitySession: vi.fn(() => null),
  mockGetWorkoutDaysForWeek: vi.fn((): number[] => []),
  mockGetReadinessScore: vi.fn(() => 0),
  mockGetReadinessLabel: vi.fn(() => ({ label: 'Not Set', advice: '' })),
  mockGetTimeGreeting: vi.fn(() => 'Good morning'),
  mockGetMeso: vi.fn(() => ({ weeks: 6, days: ['Push', 'Pull', 'Legs'] })),
}));

vi.mock('../../../utils/store', () => ({
  store: { get: mockStoreGet },
  loadCardioSession: mockLoadCardioSession,
  loadMobilitySession: mockLoadMobilitySession,
  getWorkoutDaysForWeek: mockGetWorkoutDaysForWeek,
  getReadinessScore: mockGetReadinessScore,
  getReadinessLabel: mockGetReadinessLabel,
  getTimeGreeting: mockGetTimeGreeting,
}));

vi.mock('../../../data/constants', () => ({
  TAG_ACCENT: { PUSH: '#FF6B6B', PULL: '#4ECDC4', LEGS: '#FFD93D' },
  getMeso: mockGetMeso,
  DAILY_MOBILITY: [],
  CARDIO_WORKOUTS: [],
  FOUNDRY_COOLDOWN: {},
}));

vi.mock('../../../data/exercises', () => ({
  EXERCISE_DB: [],
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
    exercises: [{ name: 'Bench Press', sets: 3, reps: '8-10', rest: '2 min' }],
    type: 'strength',
  },
  {
    label: 'Pull Day',
    tag: 'PULL',
    exercises: [{ name: 'Barbell Row', sets: 3, reps: '8-10', rest: '2 min' }],
    type: 'strength',
  },
  {
    label: 'Leg Day',
    tag: 'LEGS',
    exercises: [{ name: 'Squat', sets: 3, reps: '6-8', rest: '3 min' }],
    type: 'strength',
  },
];

function makeProps(overrides: Record<string, any> = {}) {
  return {
    profile: {
      name: 'Alex',
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
    phase: 'Accumulation',
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
  mockGetMeso.mockReturnValue({ weeks: 6, days: ['Push', 'Pull', 'Legs'] });
  mockLoadCardioSession.mockReturnValue(null);
});

describe('HomeTab', () => {
  it('renders greeting with user name', () => {
    render(<HomeTab {...makeProps()} />);
    expect(screen.getByText(/Good morning/)).toBeDefined();
    expect(screen.getByText('Alex')).toBeDefined();
  });

  it('shows meso progress ring with correct percentage', () => {
    render(<HomeTab {...makeProps({ mesoPct: 42 })} />);
    expect(screen.getByText('42%')).toBeDefined();
  });

  it('renders day buttons for each active day', () => {
    render(<HomeTab {...makeProps()} />);
    // PPL days render abbreviated tags: PU, PL, LE
    expect(screen.getByText('PU')).toBeDefined();
    expect(screen.getByText('PL')).toBeDefined();
    expect(screen.getByText('LE')).toBeDefined();
  });

  it('clicking a day pill calls onSelectDayWeek', () => {
    const props = makeProps();
    render(<HomeTab {...props} />);
    // Click the "PU" (Push) day pill — day pills are divs with onClick
    const puPill = screen.getByText('PU').closest('div[style]');
    expect(puPill).toBeTruthy();
    fireEvent.click(puPill!);
    expect(props.goBack).toHaveBeenCalled();
    expect(props.onSelectDayWeek).toHaveBeenCalledWith(0, 0);
  });

  it('shows today workout card when today is a workout day', () => {
    // Make getWorkoutDaysForWeek return today's dow so sessionDateMap maps
    // today to a valid session
    const todayDow = new Date().getDay();
    mockGetWorkoutDaysForWeek.mockReturnValue([todayDow]);

    // Use a startDate that ensures today falls within the meso window.
    // Set startDate to today so the very first session maps to today.
    const today = new Date();
    const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const props = makeProps({
      profile: {
        name: 'Alex',
        startDate,
        cardioSchedule: [],
        splitType: 'PPL',
        daysPerWeek: 3,
        weight: 180,
        workoutDays: [todayDow],
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
    const todayDow = new Date().getDay();
    mockGetWorkoutDaysForWeek.mockReturnValue([todayDow]);

    const today = new Date();
    const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const props = makeProps({
      profile: {
        name: 'Alex',
        startDate,
        cardioSchedule: [],
        splitType: 'PPL',
        daysPerWeek: 3,
        weight: 180,
        workoutDays: [todayDow],
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
    expect(props.setCurrentWeek).toHaveBeenCalledWith(0);
    expect(props.onSelectDay).toHaveBeenCalledWith(0);
  });
});
