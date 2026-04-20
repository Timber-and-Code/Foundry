/**
 * Tests for SaveProgressSheet — retimed for onboarding v2.
 * Verifies trigger-specific copy and dismissal flag behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const flags = new Map<string, string>();
const { signupMock, showToastMock } = vi.hoisted(() => ({
  signupMock: vi.fn(async () => ({ error: null })),
  showToastMock: vi.fn(),
}));

vi.mock('../../../utils/store', () => ({
  store: {
    get: vi.fn((k: string) => flags.get(k) ?? null),
    set: vi.fn((k: string, v: string) => void flags.set(k, v)),
    remove: vi.fn((k: string) => void flags.delete(k)),
  },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ signup: signupMock, user: null }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

import SaveProgressSheet from '../SaveProgressSheet';

describe('SaveProgressSheet', () => {
  beforeEach(() => {
    flags.clear();
    vi.clearAllMocks();
  });

  it('first_set trigger renders the first-set copy', () => {
    render(<SaveProgressSheet trigger="first_set" onDismiss={() => {}} />);
    expect(screen.getByText(/don't lose this/i)).toBeInTheDocument();
    expect(screen.getByText(/first set/i)).toBeInTheDocument();
  });

  it('first_week_done trigger renders the full-week copy', () => {
    render(<SaveProgressSheet trigger="first_week_done" onDismiss={() => {}} />);
    expect(screen.getByText(/a week of work/i)).toBeInTheDocument();
    expect(screen.getByText(/create an account to back it up/i)).toBeInTheDocument();
  });

  it('settings trigger renders the sync-across-devices copy', () => {
    render(<SaveProgressSheet trigger="settings" onDismiss={() => {}} />);
    expect(screen.getByText(/sync across devices/i)).toBeInTheDocument();
  });

  it('"Maybe later" sets save_progress_dismissed for auto triggers', () => {
    const onDismiss = vi.fn();
    render(<SaveProgressSheet trigger="first_set" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /maybe later/i }));
    expect(flags.get('foundry:save_progress_dismissed')).toBe('1');
    expect(onDismiss).toHaveBeenCalled();
  });

  it('"Maybe later" does NOT set dismissed for the settings trigger', () => {
    const onDismiss = vi.fn();
    render(<SaveProgressSheet trigger="settings" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /maybe later/i }));
    expect(flags.get('foundry:save_progress_dismissed')).toBeUndefined();
    expect(onDismiss).toHaveBeenCalled();
  });
});
