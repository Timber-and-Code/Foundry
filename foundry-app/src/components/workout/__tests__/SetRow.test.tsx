/**
 * SetRow — extracted set-row component used by both ExerciseCard and
 * SupersetRoundView. These tests cover the variant switch (editorial vs
 * legacy), keyboard hints, and remove-intent emission.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../styles/tokens', () => ({
  tokens: { radius: { sm: 4, md: 6, lg: 8, xxl: 16 } },
}));

import SetRow from '../SetRow';

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    exIdx: 0,
    setIdx: 0,
    weight: '',
    reps: '',
    isDone: false,
    isActive: false,
    isSuggestedWeight: false,
    isSuggestedReps: false,
    isMissedRow: false,
    canRemove: true,
    readOnly: false,
    exerciseName: 'Bench Press',
    onUpdateWeight: vi.fn(),
    onUpdateReps: vi.fn(),
    onWeightBlur: vi.fn(),
    onCheckmark: vi.fn(),
    onRequestRemove: vi.fn(),
    ...overrides,
  };
}

describe('SetRow', () => {
  it('renders weight + reps inputs with correct inputMode', () => {
    render(<SetRow {...defaultProps()} />);
    const weight = screen.getByLabelText(/Set 1 weight in pounds/);
    const reps = screen.getByLabelText(/Set 1 reps/);
    expect(weight).toHaveAttribute('inputmode', 'decimal');
    expect(reps).toHaveAttribute('inputmode', 'numeric');
  });

  it('emits onUpdateWeight + onUpdateReps with the typed value', () => {
    const onUpdateWeight = vi.fn();
    const onUpdateReps = vi.fn();
    render(
      <SetRow
        {...defaultProps({ onUpdateWeight, onUpdateReps })}
      />,
    );
    fireEvent.change(screen.getByLabelText(/weight/), { target: { value: '135' } });
    fireEvent.change(screen.getByLabelText(/reps/), { target: { value: '10' } });
    expect(onUpdateWeight).toHaveBeenCalledWith('135');
    expect(onUpdateReps).toHaveBeenCalledWith('10');
  });

  it('emits onCheckmark when the done button is clicked', () => {
    const onCheckmark = vi.fn();
    render(<SetRow {...defaultProps({ onCheckmark })} />);
    fireEvent.click(screen.getByLabelText(/Mark set 1 complete/));
    expect(onCheckmark).toHaveBeenCalledTimes(1);
  });

  it('renders done state with checkmark + aria-pressed', () => {
    render(<SetRow {...defaultProps({ isDone: true })} />);
    const btn = screen.getByLabelText(/Set 1 complete — tap to undo/);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('emits onRequestRemove when the minus button is clicked', () => {
    const onRequestRemove = vi.fn();
    render(<SetRow {...defaultProps({ onRequestRemove })} />);
    fireEvent.click(screen.getByLabelText(/Remove set 1/));
    expect(onRequestRemove).toHaveBeenCalledTimes(1);
  });

  it('hides remove button when canRemove is false', () => {
    render(<SetRow {...defaultProps({ canRemove: false })} />);
    expect(screen.queryByLabelText(/Remove set 1/)).toBeNull();
  });

  it('disables inputs when readOnly', () => {
    render(<SetRow {...defaultProps({ readOnly: true })} />);
    expect(screen.getByLabelText(/weight/)).toBeDisabled();
    expect(screen.getByLabelText(/reps/)).toBeDisabled();
  });

  it('disables inputs when isDone', () => {
    render(<SetRow {...defaultProps({ isDone: true })} />);
    expect(screen.getByLabelText(/weight/)).toBeDisabled();
    expect(screen.getByLabelText(/reps/)).toBeDisabled();
  });

  it('renders the editorial badge with zero-padded set number when no rowNumber override', () => {
    const { container } = render(
      <SetRow {...defaultProps({ setIdx: 4, variant: 'editorial' })} />,
    );
    expect(container.textContent).toMatch(/05/);
  });

  it('uses rowNumber + rowLabel overrides when provided (round-grouped variant)', () => {
    const { container } = render(
      <SetRow
        {...defaultProps({
          setIdx: 0,
          variant: 'editorial',
          rowNumber: 'A',
          rowLabel: 'BENCH',
        })}
      />,
    );
    expect(container.textContent).toMatch(/A/);
    expect(container.textContent).toMatch(/BENCH/);
  });

  it('marks the row as missed via data-coach when isMissedRow is true', () => {
    render(<SetRow {...defaultProps({ isMissedRow: true })} />);
    const row = screen.getByTestId('set-row-0');
    expect(row).toHaveAttribute('data-coach', 'missed-row');
  });
});
