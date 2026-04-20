/**
 * Tests for IntakeCard — 3-field progressive-reveal onboarding.
 *
 * Verifies:
 *   - Progressive reveal: experience hidden until name entered; goal hidden
 *     until experience selected
 *   - All four goal pills write correct storage values
 *   - "Build muscle and strength" writes the anchor_strength_bias flag
 *   - "Show me how this works" opens MicroTour
 *   - onDone fires with correct side effects after full submission
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockStoreGet, mockStoreSet, mockStoreRemove } = vi.hoisted(() => ({
  mockStoreGet: vi.fn(() => null),
  mockStoreSet: vi.fn(),
  mockStoreRemove: vi.fn(),
}));

vi.mock('../../../utils/store', () => ({
  store: { get: mockStoreGet, set: mockStoreSet, remove: mockStoreRemove },
}));

// Mock MicroTour so we don't pull in PhaseBar + MiniDemoCard
vi.mock('../MicroTour', () => ({
  default: ({ onDone: _onDone, onSkip }: any) => (
    <div>
      <div>MICROTOUR_MOCK</div>
      <button onClick={onSkip}>skip-tour</button>
    </div>
  ),
}));

import IntakeCard from '../IntakeCard';

describe('IntakeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows only the name field on first render', () => {
    render(<IntakeCard onDone={() => {}} />);
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    // Experience pills are wrapped in a Reveal with aria-hidden=true, so
    // getByRole will not find them while name is empty.
    expect(screen.queryByRole('radio', { name: /under 1 year/i })).toBeNull();
  });

  it('reveals gender pills when name is entered, experience pills after gender', () => {
    render(<IntakeCard onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Tim' } });
    // Gender reveals first
    expect(screen.getByRole('radio', { name: /^Male$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Female$/i })).toBeInTheDocument();
    // Experience still hidden
    expect(screen.queryByRole('radio', { name: /under 1 year/i })).toBeNull();
    // Pick a gender, experience reveals
    fireEvent.click(screen.getByRole('radio', { name: /^Male$/i }));
    expect(screen.getByRole('radio', { name: /under 1 year/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /1–3 years/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^3\+ years$/i })).toBeInTheDocument();
  });

  it('CTA is disabled until all four fields are answered (name, gender, experience, goal)', () => {
    render(<IntakeCard onDone={() => {}} />);
    const cta = screen.getByRole('button', { name: /build my program/i });
    expect(cta).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Tim' } });
    expect(cta).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /^Male$/i }));
    expect(cta).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /1–3 years/i }));
    expect(cta).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /lose fat/i }));
    expect(cta).not.toBeDisabled();
  });

  it('writes onboarding_data and onboarding_goal on submit (lose_fat path)', () => {
    const onDone = vi.fn();
    render(<IntakeCard onDone={onDone} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Tim' } });
    fireEvent.click(screen.getByRole('radio', { name: /^Male$/i }));
    fireEvent.click(screen.getByRole('radio', { name: /1–3 years/i }));
    fireEvent.click(screen.getByRole('button', { name: /lose fat/i }));
    fireEvent.click(screen.getByRole('button', { name: /build my program/i }));

    expect(mockStoreSet).toHaveBeenCalledWith(
      'foundry:onboarding_data',
      expect.stringContaining('"name":"Tim"'),
    );
    expect(mockStoreSet).toHaveBeenCalledWith(
      'foundry:onboarding_data',
      expect.stringContaining('"gender":"m"'),
    );
    expect(mockStoreSet).toHaveBeenCalledWith('foundry:onboarding_goal', 'lose_fat');
    expect(mockStoreSet).toHaveBeenCalledWith('foundry:onboarded', '1');
    expect(mockStoreSet).toHaveBeenCalledWith('foundry:path', 'direct');
    // Lose fat is not a muscle+strength pill, flag should be removed
    expect(mockStoreRemove).toHaveBeenCalledWith('foundry:anchor_strength_bias');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('writes anchor_strength_bias flag for "Build muscle and strength"', () => {
    render(<IntakeCard onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Tim' } });
    fireEvent.click(screen.getByRole('radio', { name: /^Female$/i }));
    fireEvent.click(screen.getByRole('radio', { name: /1–3 years/i }));
    fireEvent.click(screen.getByRole('button', { name: /build muscle and strength/i }));
    fireEvent.click(screen.getByRole('button', { name: /build my program/i }));

    expect(mockStoreSet).toHaveBeenCalledWith('foundry:onboarding_goal', 'build_muscle');
    expect(mockStoreSet).toHaveBeenCalledWith('foundry:anchor_strength_bias', '1');
  });

  it('maps sport performance to sport_conditioning', () => {
    render(<IntakeCard onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Tim' } });
    fireEvent.click(screen.getByRole('radio', { name: /^Male$/i }));
    fireEvent.click(screen.getByRole('radio', { name: /^3\+ years$/i }));
    fireEvent.click(screen.getByRole('button', { name: /sport performance/i }));
    fireEvent.click(screen.getByRole('button', { name: /build my program/i }));

    expect(mockStoreSet).toHaveBeenCalledWith('foundry:onboarding_goal', 'sport_conditioning');
  });

  it('experience pill writes "new" for Just starting (matches existing storage contract)', () => {
    render(<IntakeCard onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Tim' } });
    fireEvent.click(screen.getByRole('radio', { name: /prefer not to say/i }));
    fireEvent.click(screen.getByRole('radio', { name: /under 1 year/i }));
    fireEvent.click(screen.getByRole('button', { name: /lose fat/i }));
    fireEvent.click(screen.getByRole('button', { name: /build my program/i }));

    const dataCall = mockStoreSet.mock.calls.find(
      (c) => c[0] === 'foundry:onboarding_data',
    );
    expect(dataCall?.[1]).toContain('"experience":"new"');
    expect(dataCall?.[1]).toContain('"gender":"nb"');
  });

  it('"Show me how this works" opens MicroTour', async () => {
    render(<IntakeCard onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /show me how this works/i }));
    // MicroTour is lazy-loaded; wait for the Suspense to resolve
    expect(await screen.findByText('MICROTOUR_MOCK')).toBeInTheDocument();
  });

  it('tour skip returns to IntakeCard', async () => {
    render(<IntakeCard onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /show me how this works/i }));
    const skipBtn = await screen.findByText('skip-tour');
    fireEvent.click(skipBtn);
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
  });
});
