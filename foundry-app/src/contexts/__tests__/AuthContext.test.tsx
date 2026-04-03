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
