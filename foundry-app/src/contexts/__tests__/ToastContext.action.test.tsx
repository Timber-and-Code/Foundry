import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider } from '../ToastContext';
import { emit } from '../../utils/events';

describe('ToastContext — inline action', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders the action, runs it on tap, and dismisses the toast', () => {
    const onClick = vi.fn();
    render(<ToastProvider><div /></ToastProvider>);
    act(() => {
      emit('foundry:toast', {
        message: 'Push A logged.',
        type: 'success',
        action: { label: 'Share', onClick },
        durationMs: 8000,
      });
    });
    expect(screen.getByText('Push A logged.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Push A logged.')).not.toBeInTheDocument();
  });

  it('honours a custom duration', () => {
    render(<ToastProvider><div /></ToastProvider>);
    act(() => {
      emit('foundry:toast', { message: 'Stays a while.', type: 'info', durationMs: 8000 });
    });
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('Stays a while.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3500));
    expect(screen.queryByText('Stays a while.')).not.toBeInTheDocument();
  });

  it('a plain toast still dismisses on tap and has no action button', () => {
    render(<ToastProvider><div /></ToastProvider>);
    act(() => emit('foundry:toast', { message: 'Saved.', type: 'success' }));
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /dismiss: saved\./i }));
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });
});
