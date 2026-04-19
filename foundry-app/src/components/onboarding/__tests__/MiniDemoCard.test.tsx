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
  it('renders with Bench Press and a tappable set row', () => {
    render(<MiniDemoCard onComplete={() => {}} />);
    expect(screen.getByText(/bench press/i)).toBeInTheDocument();
    expect(screen.getByText(/140 lb/)).toBeInTheDocument();
  });

  it('a single tap logs the set and reveals the copy', () => {
    render(<MiniDemoCard onComplete={() => {}} />);
    const setRow = screen.getByLabelText(/tap to log this set/i);
    fireEvent.click(setRow);
    expect(screen.getByText(/that's it\. foundry handles the rest/i)).toBeInTheDocument();
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
