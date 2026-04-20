/**
 * Tests for AnonLocalBanner — ambient reminder for anonymous users.
 *
 * Verifies the three visibility gates (user, onboarded flag, dismissed
 * flag) and the two tap actions (open save-sheet, persist dismissal).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const flags = new Map<string, string>();
type AuthState = { user: { id: string } | null };
const { mockUseAuth, mockEmit } = vi.hoisted(() => {
  const authState: { current: AuthState } = { current: { user: null } };
  return {
    mockUseAuth: Object.assign(
      (): AuthState => authState.current,
      {
        mockReturnValue: (v: AuthState) => {
          authState.current = v;
        },
      },
    ),
    mockEmit: vi.fn(),
  };
});

vi.mock('../../../utils/store', () => ({
  store: {
    get: vi.fn((k: string) => flags.get(k) ?? null),
    set: vi.fn((k: string, v: string) => void flags.set(k, v)),
    remove: vi.fn((k: string) => void flags.delete(k)),
  },
}));

vi.mock('../../../utils/events', () => ({
  emit: mockEmit,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

import AnonLocalBanner from '../AnonLocalBanner';

describe('AnonLocalBanner', () => {
  beforeEach(() => {
    flags.clear();
    flags.set('foundry:onboarded', '1');
    mockEmit.mockClear();
    mockUseAuth.mockReturnValue({ user: null });
  });

  it('renders when anonymous, onboarded, and not dismissed', () => {
    render(<AnonLocalBanner />);
    expect(screen.getByText(/saved on this device only/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it('hides when a Supabase user is present', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const { container } = render(<AnonLocalBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides when onboarding has not completed', () => {
    flags.delete('foundry:onboarded');
    const { container } = render(<AnonLocalBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides when already dismissed', () => {
    flags.set('foundry:anon_banner_dismissed', '1');
    const { container } = render(<AnonLocalBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('tapping the body emits a save-sheet-request with the settings trigger', () => {
    render(<AnonLocalBanner />);
    fireEvent.click(screen.getByText(/saved on this device only/i));
    expect(mockEmit).toHaveBeenCalledWith('foundry:save-sheet-request', {
      trigger: 'settings',
    });
  });

  it('tapping × persists the dismissal flag and hides the banner', () => {
    render(<AnonLocalBanner />);
    fireEvent.click(screen.getByLabelText(/dismiss device-only reminder/i));
    expect(flags.get('foundry:anon_banner_dismissed')).toBe('1');
    expect(screen.queryByText(/saved on this device only/i)).toBeNull();
  });
});
