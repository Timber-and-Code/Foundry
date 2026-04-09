import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks (vi.hoisted pattern)                                        */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => ({
  store: { get: vi.fn() },
  getWarmupDetail: vi.fn(),
  generateWarmupSteps: vi.fn(),
  loadArchive: vi.fn(),
  loadExerciseHistory: vi.fn(),
  getProgTargets: vi.fn(() => ({
    linear: ['5x5', '5x5', '3x5', '3x3', '1x5'],
  })),
  getWeekPhase: vi.fn(() => 'accumulation'),
}));

vi.mock('../../utils/store', () => ({
  store: mocks.store,
  getWarmupDetail: mocks.getWarmupDetail,
  generateWarmupSteps: mocks.generateWarmupSteps,
  loadArchive: mocks.loadArchive,
  loadExerciseHistory: mocks.loadExerciseHistory,
}));

vi.mock('../../data/constants', () => ({
  PHASE_COLOR: {},
  TAG_ACCENT: {},
  getProgTargets: mocks.getProgTargets,
  getWeekPhase: mocks.getWeekPhase,
}));

vi.mock('../../styles/tokens', () => ({
  tokens: { colors: { amberHighlight: '#fff3cd' } },
}));

vi.mock('../../shared/HammerIcon', () => ({
  default: (props: any) => <div data-testid="hammer-icon" {...props} />,
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

import ExerciseCard from '../ExerciseCard';

function makeExercise(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Bench Press',
    sets: 3,
    progression: 'linear',
    warmup: false,
    anchor: false,
    modifier: '',
    cardio: false,
    description: '',
    howTo: '',
    ...overrides,
  };
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    exercise: makeExercise(),
    exIdx: 0,
    dayIdx: 0,
    weekIdx: 0,
    weekData: {},
    onUpdateSet: vi.fn(),
    onWeightAutoFill: vi.fn(),
    onLastSetFilled: vi.fn(),
    expanded: true,
    onToggle: vi.fn(),
    done: false,
    readOnly: false,
    onSwapClick: vi.fn(),
    onSetLogged: vi.fn(),
    bodyweight: 180,
    note: '',
    onNoteChange: vi.fn(),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ExerciseCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.get.mockReturnValue(null);
    mocks.loadArchive.mockReturnValue([]);
    mocks.generateWarmupSteps.mockReturnValue([]);
    mocks.getWarmupDetail.mockReturnValue({ detail: 'warmup detail' });
  });

  // 1. Renders exercise name when expanded
  it('renders exercise name when expanded', () => {
    render(<ExerciseCard {...defaultProps()} />);
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
  });

  // 2. Renders correct number of set input rows based on exercise.sets
  it('renders correct number of set input rows based on exercise.sets', () => {
    const props = defaultProps({ exercise: makeExercise({ sets: 4 }) });
    render(<ExerciseCard {...props} />);
    const weightInputs = screen.getAllByLabelText(/Set \d+ weight in pounds/);
    expect(weightInputs).toHaveLength(4);
  });

  // 3. Calls onToggle when header is clicked
  it('calls onToggle when header is clicked', () => {
    const onToggle = vi.fn();
    render(<ExerciseCard {...defaultProps({ onToggle })} />);
    const header = screen.getByRole('button', { name: /Bench Press/ });
    fireEvent.click(header);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // 4. Shows warmup button when exercise.warmup is truthy and not done
  it('shows warmup button when exercise.warmup is truthy and not done', () => {
    const props = defaultProps({
      exercise: makeExercise({ warmup: 'standard' }),
      done: false,
    });
    render(<ExerciseCard {...props} />);
    expect(screen.getByText(/Warmup Guide/)).toBeInTheDocument();
  });

  // 5. Hides warmup buttons when done=true
  it('hides warmup buttons when done is true', () => {
    const props = defaultProps({
      exercise: makeExercise({ warmup: 'standard' }),
      done: true,
    });
    render(<ExerciseCard {...props} />);
    expect(screen.queryByText(/Warmup Guide/)).not.toBeInTheDocument();
  });

  // 6. Shows anchor badge (HammerIcon) when exercise.anchor is true
  it('shows anchor badge when exercise.anchor is true', () => {
    const props = defaultProps({
      exercise: makeExercise({ anchor: true }),
    });
    render(<ExerciseCard {...props} />);
    expect(screen.getByTestId('hammer-icon')).toBeInTheDocument();
  });

  // 7. Shows modifier badge text when exercise.modifier is set
  it('shows modifier badge text when exercise.modifier is set', () => {
    const props = defaultProps({
      exercise: makeExercise({ modifier: 'Paused' }),
    });
    render(<ExerciseCard {...props} />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  // 8. Read-only mode disables inputs
  it('disables inputs in read-only mode', () => {
    const props = defaultProps({ readOnly: true });
    render(<ExerciseCard {...props} />);
    const weightInputs = screen.getAllByLabelText(/Set \d+ weight in pounds/);
    weightInputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
    const repsInputs = screen.getAllByLabelText(/Set \d+ reps$/);
    repsInputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  // 9. History modal opens when history button clicked
  it('opens history modal when history button is clicked', () => {
    render(<ExerciseCard {...defaultProps()} />);
    const historyBtn = screen.getByText(/History/);
    fireEvent.click(historyBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Bench Press - History/)).toBeInTheDocument();
  });

  // 10. Note textarea appears and onNoteChange fires
  it('shows note textarea and fires onNoteChange', () => {
    const onNoteChange = vi.fn();
    const props = defaultProps({ note: 'existing note', onNoteChange });
    render(<ExerciseCard {...props} />);
    const textarea = screen.getByLabelText('Exercise notes');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('existing note');
    fireEvent.change(textarea, { target: { value: 'updated note' } });
    expect(onNoteChange).toHaveBeenCalledWith(0, 'updated note');
  });
});
