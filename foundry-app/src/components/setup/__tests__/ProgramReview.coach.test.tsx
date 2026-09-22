import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ToastProvider } from '../../../contexts/ToastContext';
import ProgramReview from '../ProgramReview';
import type { TrainingDay } from '../../../types';

const program = [
  { dayNum: 1, label: 'Full Body A', tag: 'FULL', exercises: [{ id: 'bb_flat_bench', name: 'Barbell Flat Bench Press', muscle: 'Chest', sets: 3, reps: '6-10' }] },
] as unknown as TrainingDay[];

const render = (ui: ReactElement) => rtlRender(<ToastProvider>{ui}</ToastProvider>);

const base = { program, subtitle: 'NEXT MESO', onConfirm: vi.fn(), onBack: vi.fn() };

// The coach pass runs inside "Build My Meso" and used to leave no trace:
// success looked identical to failure, and the failure message was cleared
// on the way to this screen.
describe('ProgramReview — says how the coach pass went', () => {
  it('shows COACH-TUNED with the coach note', () => {
    render(<ProgramReview {...base} coach={{ status: 'tuned', note: 'Built around your bench.' }} />);
    expect(screen.getByText('COACH-TUNED')).toBeInTheDocument();
    expect(screen.getByText(/built around your bench/i)).toBeInTheDocument();
  });

  it('says so when the coach failed, and offers the way back', () => {
    const onBack = vi.fn();
    render(<ProgramReview {...base} onBack={onBack} coach={{ status: 'failed', reason: 'The coach took too long to respond.' }} />);
    expect(screen.getByText('STANDARD BUILD')).toBeInTheDocument();
    expect(screen.getByText(/took too long/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try the coach again/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('says nothing for a hand-built program', () => {
    render(<ProgramReview {...base} />);
    expect(screen.queryByText('COACH-TUNED')).toBeNull();
    expect(screen.queryByText('STANDARD BUILD')).toBeNull();
  });
});
