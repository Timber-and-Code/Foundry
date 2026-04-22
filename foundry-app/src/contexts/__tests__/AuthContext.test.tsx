/**
 * Tests for AuthContext.jsx — AuthProvider + useAuth hook.
 * Supabase is mocked so no network calls are made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { AuthProvider, useAuth } from '../AuthContext';

// ─── Mock supabase ──────────────────────────────────────────────────────────
// vi.mock is hoisted to top of file, so mock fns must be defined via vi.hoisted()

const {
  mockGetSession,
  mockOnAuthStateChange,
  mockSignInWithPassword,
  mockSignUp,
  mockSignOut,
  mockUnsubscribe,
} = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  return {
    mockUnsubscribe,
    mockGetSession: vi.fn(),
    mockOnAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    })),
    mockSignInWithPassword: vi.fn(),
    mockSignUp: vi.fn(),
    mockSignOut: vi.fn(),
  };
});

vi.mock('../../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
      // Stubbed for SIGNED_IN tests that trigger pullFromSupabase. Returning
      // null user makes the pull early-return cleanly.
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  },
}));

// ─── Render helper ──────────────────────────────────────────────────────────

let capturedCtx: ReturnType<typeof useAuth> | null = null;

function ContextCapture() {
  capturedCtx = useAuth();
  return null;
}

async function mountProvider() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: any;
  await act(async () => {
    root = createRoot(container);
    root.render(
      <AuthProvider>
        <ContextCapture />
      </AuthProvider>
    );
  });
  return {
    cleanup: async () => {
      await act(async () => root.unmount());
      document.body.removeChild(container);
    },
  };
}

// ============================================================================
// useAuth outside AuthProvider
// ============================================================================
describe('useAuth', () => {
  it('throws an error when used outside of AuthProvider', () => {
    function BadConsumer() {
      useAuth();
      return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    expect(() => {
      act(() => {
        createRoot(container).render(<BadConsumer />);
      });
    }).toThrow();
    document.body.removeChild(container);
  });
});

// ============================================================================
// AuthProvider — initial state
// ============================================================================
describe('AuthProvider — null session', () => {
  beforeEach(() => {
    capturedCtx = null;
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('provides user=null when session is null', async () => {
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.user).toBeNull();
    await cleanup();
  });

  it('provides session=null when getSession returns null', async () => {
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.session).toBeNull();
    await cleanup();
  });

  it('sets loading=false after getSession resolves', async () => {
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.loading).toBe(false);
    await cleanup();
  });

  it('provides authUnavailable=false when supabase is reachable', async () => {
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.authUnavailable).toBe(false);
    await cleanup();
  });
});

// ============================================================================
// AuthProvider — with active session
// ============================================================================
describe('AuthProvider — with session', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockSession = { user: mockUser, access_token: 'tok' };

  beforeEach(() => {
    capturedCtx = null;
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  afterEach(() => vi.clearAllMocks());

  it('provides the user from the session', async () => {
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.user).toEqual(mockUser);
    await cleanup();
  });

  it('provides the full session object', async () => {
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.session).toEqual(mockSession);
    await cleanup();
  });
});

// ============================================================================
// AuthProvider — authUnavailable when getSession throws
// ============================================================================
describe('AuthProvider — supabase unavailable', () => {
  beforeEach(() => {
    capturedCtx = null;
    mockGetSession.mockRejectedValue(new Error('Network error'));
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  afterEach(() => vi.clearAllMocks());

  it('sets authUnavailable=true when getSession throws', async () => {
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.authUnavailable).toBe(true);
    await cleanup();
  });

  it('sets loading=false even when getSession throws', async () => {
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.loading).toBe(false);
    await cleanup();
  });
});

// ============================================================================
// Auth action delegates
// ============================================================================
describe('AuthProvider — action delegates to supabase', () => {
  beforeEach(() => {
    capturedCtx = null;
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockSignUp.mockResolvedValue({ data: {}, error: null });
    mockSignOut.mockResolvedValue({});
  });

  afterEach(() => vi.clearAllMocks());

  it('login calls supabase.auth.signInWithPassword with correct args', async () => {
    const { cleanup } = await mountProvider();
    await capturedCtx!.login('user@test.com', 'password123');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'password123',
    });
    await cleanup();
  });

  it('signup calls supabase.auth.signUp with correct args', async () => {
    const { cleanup } = await mountProvider();
    await capturedCtx!.signup('new@test.com', 'secret');
    expect(mockSignUp).toHaveBeenCalledWith({ email: 'new@test.com', password: 'secret' });
    await cleanup();
  });

  it('logout calls supabase.auth.signOut', async () => {
    const { cleanup } = await mountProvider();
    await capturedCtx!.logout();
    expect(mockSignOut).toHaveBeenCalled();
    await cleanup();
  });
});

// ============================================================================
// Multi-user safety on SIGNED_IN — wipe prior user's data when a different
// user signs in. Prevents User A's local data from being pushed to User B's
// Supabase rows during migrateLocalWorkoutsToSupabase.
// ============================================================================
describe('AuthProvider — SIGNED_IN multi-user wipe', () => {
  let onAuthCallback: ((event: string, session: any) => void) | null = null;

  beforeEach(() => {
    capturedCtx = null;
    onAuthCallback = null;
    mockGetSession.mockResolvedValue({ data: { session: null } });
    (mockOnAuthStateChange as unknown as { mockImplementation: (fn: (...args: any[]) => unknown) => void }).mockImplementation(
      (cb: (e: string, s: any) => void) => {
        onAuthCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('wipes prior user data when a DIFFERENT user signs in, preserves UI flags', async () => {
    // Seed prior user's data + UI flags.
    localStorage.setItem('foundry:last_user_id', 'user-A');
    localStorage.setItem('foundry:welcomed', '1');
    localStorage.setItem('foundry:onboarding_v2', '0');
    localStorage.setItem('foundry:migrated_from_ppl', '1');
    localStorage.setItem('foundry:profile', JSON.stringify({ name: 'Atlas' }));
    localStorage.setItem('foundry:day0:week0', JSON.stringify({}));
    localStorage.setItem('foundry:active_meso_id', 'meso-xyz');

    const { cleanup } = await mountProvider();
    expect(onAuthCallback).not.toBeNull();
    await act(async () => {
      onAuthCallback!('SIGNED_IN', { user: { id: 'user-B', email: 'b@example.com' } });
    });

    // UI flags preserved
    expect(localStorage.getItem('foundry:welcomed')).toBe('1');
    expect(localStorage.getItem('foundry:onboarding_v2')).toBe('0');
    expect(localStorage.getItem('foundry:migrated_from_ppl')).toBe('1');
    // Prior user data wiped
    expect(localStorage.getItem('foundry:profile')).toBeNull();
    expect(localStorage.getItem('foundry:day0:week0')).toBeNull();
    expect(localStorage.getItem('foundry:active_meso_id')).toBeNull();
    // last_user_id updated to the new user
    expect(localStorage.getItem('foundry:last_user_id')).toBe('user-B');

    await cleanup();
  });

  it('preserves local data when the SAME user signs back in (resume case)', async () => {
    localStorage.setItem('foundry:last_user_id', 'user-A');
    localStorage.setItem('foundry:profile', JSON.stringify({ name: 'Atlas' }));
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ '0': { '0': { reps: '8' } } }));

    const { cleanup } = await mountProvider();
    await act(async () => {
      onAuthCallback!('SIGNED_IN', { user: { id: 'user-A', email: 'a@example.com' } });
    });

    expect(localStorage.getItem('foundry:profile')).toBe(JSON.stringify({ name: 'Atlas' }));
    expect(localStorage.getItem('foundry:day0:week0')).toBe(
      JSON.stringify({ '0': { '0': { reps: '8' } } }),
    );
    expect(localStorage.getItem('foundry:last_user_id')).toBe('user-A');

    await cleanup();
  });
});
