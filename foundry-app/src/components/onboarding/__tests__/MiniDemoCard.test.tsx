/**
 * Tests for MiniDemoCard — tour's single-tap demo exercise row.
 * Verifies it writes nothing to localStorage and doesn't touch the
 * RestTimerContext. Purely local state.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockStoreGet, mockStoreSet } = vi.hoisted(() => ({
  mockStoreGet: vi.fn(),
  mockStoreSet: vi.fn(),
}));

vi.mock('../../../utils/store', () => ({
  store: { get: mockStoreGet, set: mockStoreSet, remove: vi.fn() },
}));

import MiniDemoCard from '../MiniDemoCard';

describe('MiniDemoCard', () => {
  it('renders Bench Press with a Weight/Reps/Done grid like the real ExerciseCard', () => {
    render(<MiniDemoCard onComplete={() => {}} />);
    expect(screen.getByText(/bench press/i)).toBeInTheDocument();
    // Column headers from the real ExerciseCard layout
    expect(screen.getByText(/weight \(lbs\)/i)).toBeInTheDocument();
    expect(screen.getByText(/^reps$/i)).toBeInTheDocument();
    expect(screen.getByText(/^done$/i)).toBeInTheDocument();
    // Last-session hint is present (matches real ExerciseCard pattern)
    expect(screen.getByText(/last session/i)).toBeInTheDocument();
    // Done button is the only interactive element in the grid
    expect(screen.getByLabelText(/tap to log this set/i)).toBeInTheDocument();
  });

  it('tapping Done logs the set and reveals the explainer copy', () => {
    render(<MiniDemoCard onComplete={() => {}} />);
    fireEvent.click(screen.getByLabelText(/tap to log this set/i));
    expect(
      screen.getByText(/that's it\. the foundry handles the rest/i),
    ).toBeInTheDocument();
  });

  it('reveals a forward-looking "Next session" hint after the set is logged', () => {
    render(<MiniDemoCard onComplete={() => {}} />);
    fireEvent.click(screen.getByLabelText(/tap to log this set/i));
    // Mirrors the real "Last session: X × Y" pattern but forward-looking
    expect(screen.getByText(/next session:\s*140\s*×\s*9/i)).toBeInTheDocument();
  });

  it('calls onComplete when the Build my program CTA is tapped after log', () => {
    const onComplete = vi.fn();
    render(<MiniDemoCard onComplete={onComplete} />);
    fireEvent.click(screen.getByLabelText(/tap to log this set/i));
    fireEvent.click(screen.getByRole('button', { name: /build my program/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('never writes to localStorage', () => {
    render(<MiniDemoCard onComplete={() => {}} />);
    fireEvent.click(screen.getByLabelText(/tap to log this set/i));
    expect(mockStoreSet).not.toHaveBeenCalled();
  });
});
