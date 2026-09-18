import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../utils/sync', () => ({}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import NextMesoCard from '../NextMesoCard';
import { on } from '../../../utils/events';

const draft = {
  v: 1,
  savedAt: '2026-09-17T00:00:00Z',
  profile: { splitType: 'upper_lower', workoutDays: [1, 2, 4, 5], mesoLength: 4 },
  program: [
    { name: 'Upper A', tag: 'UPPER', exercises: [{ id: 'bench', name: 'Bench Press' }] },
    { name: 'Lower A', tag: 'LOWER', exercises: [{ id: 'squat', name: 'Back Squat' }] },
  ],
};

describe('NextMesoCard', () => {
  beforeEach(() => localStorage.clear());

  it('offers to plan when there is no draft', () => {
    const fired = vi.fn();
    const off = on('foundry:plan-next-meso', fired);
    render(<NextMesoCard />);
    fireEvent.click(screen.getByRole('button', { name: /plan next meso/i }));
    expect(fired).toHaveBeenCalledTimes(1);
    off();
  });

  it('summarises a saved plan and previews its days', () => {
    localStorage.setItem('foundry:next_meso_draft', JSON.stringify(draft));
    render(<NextMesoCard />);
    expect(screen.getByText('Upper / Lower')).toBeTruthy();
    expect(screen.getByText('4 days/wk · 4 weeks + deload')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /preview days/i }));
    expect(screen.getByText('Bench Press')).toBeTruthy();
  });

  it('asks before starting early, and only then starts', () => {
    localStorage.setItem('foundry:next_meso_draft', JSON.stringify(draft));
    const fired = vi.fn();
    const off = on('foundry:start-planned-meso', fired);
    render(<NextMesoCard />);
    fireEvent.click(screen.getByRole('button', { name: /start now/i }));
    expect(fired).not.toHaveBeenCalled();
    expect(screen.getByText(/End this meso now\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /start next meso/i }));
    expect(fired).toHaveBeenCalledTimes(1);
    off();
  });
});
