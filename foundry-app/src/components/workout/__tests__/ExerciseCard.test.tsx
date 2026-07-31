import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks (vi.hoisted pattern)                                        */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => ({
  // Pass-through localStorage shim — tests 9b/9c seed `foundry:day0:week0`
  // and rely on ExerciseCard's prevWeekRaw memo reading it through `store.get`.
  store: {
    get: vi.fn((key: string): string | null => localStorage.getItem(key)),
    set: vi.fn((key: string, val: string): void => {
      localStorage.setItem(key, val);
    }),
  },
  getWarmupDetail: vi.fn(),
  generateWarmupSteps: vi.fn(),
  loadArchive: vi.fn(),
  getProgTargets: vi.fn(() => ({
    linear: ['5x5', '5x5', '3x5', '3x3', '1x5'],
  })),
  getWeekPhase: vi.fn(() => 'accumulation'),
}));

// Test file lives at src/components/workout/__tests__/, so utils/store
// is 3 levels up — the prior `'../../utils/store'` resolved to a
// non-existent `src/components/utils/store` and was a silent no-op.
vi.mock('../../../utils/store', () => ({
  store: mocks.store,
  getWarmupDetail: mocks.getWarmupDetail,
  generateWarmupSteps: mocks.generateWarmupSteps,
  loadArchive: mocks.loadArchive,
  // MesoHistoryView (rendered when the LAST WK chip is tapped) reads
  // prior week data through `loadDayWeek` — pass through real
  // localStorage so tests that seed `foundry:day0:week0` round-trip.
  loadDayWeek: vi.fn((dayIdx: number, weekIdx: number) => {
    const raw = localStorage.getItem(`foundry:day${dayIdx}:week${weekIdx}`);
    return raw ? JSON.parse(raw) : {};
  }),
  // Med (2.8.3): id-based lookup helper for prior-week data. Default
  // mock falls through to position lookup so existing tests keep their
  // prior-week shape; the prescribed-weight regression suite exercises
  // the id-match path with seeded `_exId` tags.
  findPrevSlotForExercise: vi.fn((data: Record<string, unknown> | null | undefined, _exId: string | number | undefined, exIdx: number) => {
    return (data?.[exIdx] as Record<string, unknown>) || {};
  }),
}));

vi.mock('../../../data/constants', () => ({
  PHASE_COLOR: {},
  TAG_ACCENT: {},
  getProgTargets: mocks.getProgTargets,
  getWeekPhase: mocks.getWeekPhase,
  // MesoHistoryView (mounted via ExerciseCard's tap-to-history button) reads
  // totalWeeks from this — mock returns the deload-inclusive default.
  getMeso: vi.fn(() => ({ totalWeeks: 7, workWeeks: 6 })),
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
    muscle: 'chest',
    sets: 3,
    progression: 'linear',
    warmup: '',
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
    // Restore pass-through behavior after clearAllMocks. Tests that seed
    // `foundry:day0:week0` rely on `store.get` reading real localStorage.
    mocks.store.get.mockImplementation((key: string) => localStorage.getItem(key));
    mocks.store.set.mockImplementation((key: string, val: string) => {
      localStorage.setItem(key, val);
    });
    mocks.loadArchive.mockReturnValue([]);
    mocks.generateWarmupSteps.mockReturnValue([]);
    mocks.getWarmupDetail.mockReturnValue({ detail: 'warmup detail' });
    // Clear any seeded keys from prior tests.
    localStorage.clear();
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

  // 9. The legacy "History" button has been replaced by tapping on the
  // LAST WK chip itself (#2). The bare-named History button never renders.
  it('does not render a standalone History button', () => {
    render(<ExerciseCard {...defaultProps()} />);
    expect(screen.queryByRole('button', { name: /^History$/ })).toBeNull();
  });

  // 9b. Last-week stat reformat (#2) — `${count}-${weight}×${reps}` with the
  // sets count at the front. With 3 sets last week (e.g. 30 / 30 / 30 × 12),
  // the chip should read "3-30×12".
  it('renders the LAST WK chip as ${count}-${weight}×${reps} (#2)', () => {
    // Seed prior week data via real localStorage. The mocked `store.get`
    // is a pass-through to localStorage (see beforeEach), so the
    // prevWeekRaw memo reads this value through the mock.
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({
        0: {
          0: { weight: 30, reps: 12 },
          1: { weight: 30, reps: 11 },
          2: { weight: 30, reps: 10 },
        },
      }),
    );
    render(
      <ExerciseCard
        {...defaultProps({
          weekIdx: 1,
          exercise: makeExercise({ sets: 3, reps: '8-12' }),
        })}
      />,
    );
    expect(screen.getByText('3-30×12')).toBeInTheDocument();
  });

  // 9c. Tapping the LAST WK chip opens the MesoHistoryView modal (#2).
  it('opens the history modal when LAST WK chip is tapped (#2)', () => {
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: 30, reps: 10 } } }),
    );
    render(
      <ExerciseCard
        {...defaultProps({ weekIdx: 1, exercise: makeExercise({ sets: 3, reps: '8-12' }) })}
      />,
    );
    const trigger = screen.getByRole('button', { name: /View .* history/i });
    fireEvent.click(trigger);
    // Modal renders the exercise name as the title.
    expect(screen.getAllByText('Bench Press').length).toBeGreaterThanOrEqual(1);
    // Close button is exposed by aria-label.
    expect(screen.getByRole('button', { name: 'Close history' })).toBeInTheDocument();
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

  // 11. Shows rep range + rest subtitle in header
  it('shows rep range and rest interval subtitle in header', () => {
    const props = defaultProps({
      exercise: makeExercise({ reps: '8-12', rest: '2-3 min' }),
    });
    render(<ExerciseCard {...props} />);
    expect(screen.getByText(/8-12 reps/)).toBeInTheDocument();
    expect(screen.getByText(/2-3 min/)).toBeInTheDocument();
  });

  // 12. Weight auto-fill calls onWeightAutoFill on set 0 blur
  it('calls onWeightAutoFill when set 0 weight blurs with a value', () => {
    const onWeightAutoFill = vi.fn();
    // Provide weekData with set 0 weight so the blur handler sees a value
    const props = defaultProps({
      onWeightAutoFill,
      weekData: { 0: { 0: { weight: '135', reps: '' } } },
    });
    render(<ExerciseCard {...props} />);
    const weightInputs = screen.getAllByLabelText(/Set \d+ weight in pounds/);
    fireEvent.blur(weightInputs[0]);
    expect(onWeightAutoFill).toHaveBeenCalledWith(0, '135', 3);
  });

  // 13. Does NOT call onWeightAutoFill for non-first sets
  it('does not call onWeightAutoFill when set 2 weight blurs', () => {
    const onWeightAutoFill = vi.fn();
    const props = defaultProps({
      onWeightAutoFill,
      weekData: { 0: { 1: { weight: '135', reps: '' } } },
    });
    render(<ExerciseCard {...props} />);
    const weightInputs = screen.getAllByLabelText(/Set \d+ weight in pounds/);
    fireEvent.blur(weightInputs[1]);
    expect(onWeightAutoFill).not.toHaveBeenCalled();
  });

  // 14. Emits first-miss when a set is confirmed with reps < target
  it('emits first-miss when a non-final set is confirmed with reps < target', () => {
    mocks.store.get.mockImplementation(() => null);
    const handler = vi.fn();
    window.addEventListener('foundry:first-miss', handler);
    // Target is "8-12" → min 8. Entering 5 reps is a miss.
    const props = defaultProps({
      exercise: makeExercise({ reps: '8-12', sets: 3 }),
      weekData: { 0: { 0: { weight: '135', reps: '5' } } },
    });
    render(<ExerciseCard {...props} />);
    fireEvent.click(screen.getByLabelText('Mark set 1 complete'));
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('foundry:first-miss', handler);
  });

  // 15. Does NOT emit first-miss when reps meet or exceed target
  it('does not emit first-miss when reps >= target', () => {
    mocks.store.get.mockImplementation(() => null);
    const handler = vi.fn();
    window.addEventListener('foundry:first-miss', handler);
    const props = defaultProps({
      exercise: makeExercise({ reps: '8-12', sets: 3 }),
      weekData: { 0: { 0: { weight: '135', reps: '10' } } },
    });
    render(<ExerciseCard {...props} />);
    fireEvent.click(screen.getByLabelText('Mark set 1 complete'));
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('foundry:first-miss', handler);
  });

  /* ── SUPERSET WITH chip — editorial header (#3, #4) ────────────────── */

  // 16. When the eligible-to-pair callback is provided, the editorial
  // header renders a "+ SUPERSET WITH" chip and tapping fires the callback.
  it('renders + SUPERSET WITH chip when onPairSuperset is provided (#3, #4)', () => {
    const onPairSuperset = vi.fn();
    render(
      <ExerciseCard
        {...defaultProps({
          editorial: true,
          totalExercises: 3,
          onPairSuperset,
        })}
      />,
    );
    const chip = screen.getByRole('button', { name: /\+ SUPERSET WITH/i });
    expect(chip).toBeInTheDocument();
    fireEvent.click(chip);
    expect(onPairSuperset).toHaveBeenCalledTimes(1);
  });

  // 17. When the card is already in a superset group, the chip becomes a
  // solid SUPERSET <label> badge with an unpair × button.
  it('renders SUPERSET A1 chip + unpair × when supersetLabel is set (#3, #4)', () => {
    const onUnpairSuperset = vi.fn();
    render(
      <ExerciseCard
        {...defaultProps({
          editorial: true,
          totalExercises: 3,
          supersetLabel: 'A1',
          onUnpairSuperset,
        })}
      />,
    );
    expect(screen.getByText(/Superset A1/i)).toBeInTheDocument();
    const unpair = screen.getByRole('button', { name: 'Unpair superset' });
    fireEvent.click(unpair);
    expect(onUnpairSuperset).toHaveBeenCalledTimes(1);
  });

  // 18. With neither prop, no superset chip renders — only the
  // "Exercise N of M" label on the top row of the editorial header.
  it('does not render superset chip when neither prop is set', () => {
    render(
      <ExerciseCard
        {...defaultProps({
          editorial: true,
          totalExercises: 3,
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: /SUPERSET/i })).toBeNull();
    expect(screen.queryByText(/Superset A\d/i)).toBeNull();
    // Sanity: the N/M label is still visible.
    expect(screen.getByText(/Exercise 1 of 3/i)).toBeInTheDocument();
  });

  // 19. The pre-rename "Pair as superset" / "Pair with X" strings are
  // gone from the rendered UI — only "SUPERSET WITH" should appear.
  it('does NOT render the pre-rename "Pair with" string', () => {
    render(
      <ExerciseCard
        {...defaultProps({
          editorial: true,
          totalExercises: 3,
          onPairSuperset: vi.fn(),
        })}
      />,
    );
    expect(screen.queryByText(/Pair with/i)).toBeNull();
    expect(screen.queryByText(/Pair as superset/i)).toBeNull();
  });
});
