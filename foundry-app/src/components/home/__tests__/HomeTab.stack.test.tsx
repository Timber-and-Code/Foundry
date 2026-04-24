/**
 * Tests for HomeTab when today carries 2 scheduled sessions (stack mode).
 * Verifies the banner and the secondary card both render with their
 * correct labels and that clicking either navigates via onSelectDayWeek.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const {
  mockStoreGet,
  mockLoadCardioSession,
  mockGetTimeGreeting,
  mockBuildSessionDateMap,
  mockGetMeso,
} = vi.hoisted(() => ({
  mockStoreGet: vi.fn(() => null),
  mockLoadCardioSession: vi.fn(() => null),
  mockGetTimeGreeting: vi.fn(() => 'Good morning'),
  mockBuildSessionDateMap: vi.fn(
    (): Record<string, string | string[]> => ({}),
  ),
  mockGetMeso: vi.fn(() => ({ weeks: 6, days: ['Push', 'Pull', 'Legs'] })),
}));

vi.mock('../../../utils/store', () => ({
  store: { get: mockStoreGet },
  loadCardioSession: mockLoadCardioSession,
  loadMobilitySession: vi.fn(() => null),
  getTimeGreeting: mockGetTimeGreeting,
  getWeekSets: (sets: number) => sets,
  buildSessionDateMap: mockBuildSessionDateMap,
  computeMobilityStreak: vi.fn(() => 0),
}));

vi.mock('../../../data/constants', () => ({
  TAG_ACCENT: { PUSH: '#FF0', PULL: '#0FF', LEGS: '#F0F', CARDIO: '#AAA', MOBILITY: '#D4983C' },
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

vi.mock('../../../data/exerciseDB', () => ({ findExercise: () => null }));
vi.mock('../../../data/exercises', () => ({ EXERCISE_DB: [], SAMPLE_PROGRAMS: [] }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../../utils/events', () => ({ emit: vi.fn(), on: vi.fn(() => () => {}) }));

vi.mock('../../../styles/tokens', () => ({
  tokens: {
    colors: { gold: '#FFD700', overlay: 'rgba(0,0,0,0.5)' },
    radius: { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, xxl: 16, full: 99 },
  },
}));

import HomeTab from '../HomeTab';

const ACTIVE_DAYS = [
  {
    label: 'Push Day',
    tag: 'PUSH',
    exercises: [{ name: 'Bench Press', muscle: 'chest', sets: 3, reps: '8-10' }],
  },
  {
    label: 'Pull Day',
    tag: 'PULL',
    exercises: [{ name: 'Row', muscle: 'back', sets: 3, reps: '8-10' }],
  },
  {
    label: 'Leg Day',
    tag: 'LEGS',
    exercises: [{ name: 'Squat', muscle: 'quads', sets: 3, reps: '6-8' }],
  },
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    profile: {
      name: 'Alex',
      experience: 'intermediate',
      startDate: todayStr(),
      cardioSchedule: [],
      splitType: 'PPL',
      daysPerWeek: 3,
      workoutDays: [0, 1, 2, 3, 4, 5, 6],
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
    mesoPct: 0,
    doneSessions: 0,
    totalSessions: 18,
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
    onSelectDayWeek: vi.fn(),
    setShowSkipConfirm: vi.fn(),
    onOpenCardio: vi.fn(),
    onOpenMobility: vi.fn(),
    setShowPricing: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreGet.mockReturnValue(null);
  mockLoadCardioSession.mockReturnValue(null);
  mockGetTimeGreeting.mockReturnValue('Good morning');
  mockGetMeso.mockReturnValue({ weeks: 6, days: ['Push', 'Pull', 'Legs'] });
});

describe('HomeTab stacked (2 sessions today)', () => {
  it('renders the 2-workouts banner when today has two session keys', () => {
    mockBuildSessionDateMap.mockReturnValue({ [todayStr()]: ['0:0', '1:0'] });
    render(<HomeTab {...makeProps()} />);
    expect(screen.getByTestId('today-double-banner')).toBeDefined();
  });

  it('renders the secondary card with the second session label', () => {
    mockBuildSessionDateMap.mockReturnValue({ [todayStr()]: ['0:0', '1:0'] });
    render(<HomeTab {...makeProps()} />);
    const secondary = screen.getByTestId('today-secondary-card');
    expect(secondary).toBeDefined();
    expect(secondary.textContent).toContain('Pull Day');
  });

  it('tapping the secondary card navigates via onSelectDayWeek(1, 0)', () => {
    mockBuildSessionDateMap.mockReturnValue({ [todayStr()]: ['0:0', '1:0'] });
    const props = makeProps();
    render(<HomeTab {...props} />);
    const secondary = screen.getByTestId('today-secondary-card');
    const btn = secondary.querySelector('button');
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    expect(props.goBack).toHaveBeenCalled();
    expect(props.onSelectDayWeek).toHaveBeenCalledWith(1, 0);
  });

  it('does NOT render the secondary card when only one session today', () => {
    mockBuildSessionDateMap.mockReturnValue({ [todayStr()]: '0:0' });
    render(<HomeTab {...makeProps()} />);
    expect(screen.queryByTestId('today-double-banner')).toBeNull();
    expect(screen.queryByTestId('today-secondary-card')).toBeNull();
  });
});
