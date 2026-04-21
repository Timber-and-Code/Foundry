/**
 * Tests for AuthPage — focused on the iOS keyboard fix (Agent D).
 * Verifies the email/password inputs carry the attrs iOS needs to avoid
 * auto-capitalizing, auto-correcting, or triggering the wrong software
 * keyboard. The keyboardWillShow / scrollIntoView behavior is intentionally
 * not covered here — it requires a real Capacitor runtime and viewport
 * resize, which jsdom can't simulate. See manual-test note in the commit.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

const { loginMock, signupMock, showToastMock } = vi.hoisted(() => ({
  loginMock: vi.fn(async () => ({ error: null })),
  signupMock: vi.fn(async () => ({ error: null })),
  showToastMock: vi.fn(),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: loginMock, signup: signupMock, user: null }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

vi.mock('../../../utils/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail: vi.fn(async () => ({ error: null })) } },
}));

vi.mock('../../../data/images-core', () => ({ FOUNDRY_ANVIL_IMG: 'data:,' }));

// Keep the dynamic @capacitor/keyboard import from blowing up in jsdom.
vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    addListener: vi.fn(async () => ({ remove: vi.fn() })),
  },
}));

import AuthPage from '../AuthPage';

describe('AuthPage — keyboard-safe input attrs', () => {
  it('email input has iOS-friendly attributes', () => {
    render(<AuthPage />);
    const email = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(email).toBeInTheDocument();
    expect(email.type).toBe('email');
    expect(email.getAttribute('autocapitalize')).toBe('none');
    expect(email.getAttribute('autocorrect')).toBe('off');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(email.getAttribute('inputmode')).toBe('email');
  });

  it('password input has iOS-friendly attributes in login mode', () => {
    render(<AuthPage />);
    const pw = screen.getByLabelText(/password/i) as HTMLInputElement;
    expect(pw).toBeInTheDocument();
    expect(pw.type).toBe('password');
    expect(pw.getAttribute('autocapitalize')).toBe('none');
    expect(pw.getAttribute('autocorrect')).toBe('off');
    // login is the default mode
    expect(pw.getAttribute('autocomplete')).toBe('current-password');
  });
});
