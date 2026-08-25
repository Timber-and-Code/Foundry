/**
 * supabase-js re-fires SIGNED_IN on token refresh and on return-to-
 * foreground, not only on a real login. The post-sign-in chain ends in
 * migrateLocalWorkoutsToSupabase, which re-pushes every set of every logged
 * day/week — so repeat fires turned a single workout into thousands of
 * upserts (3,115 in one hour, to persist 15 sets), and at that volume the
 * transient failures behind "Cloud sync failed (workout_set)" were
 * effectively guaranteed.
 *
 * Repeat fires for the same user must flush the dirty queue and nothing else.
 *
 * Separate file from AuthContext.test.tsx on purpose: the latch lives at
 * module scope, so it needs a fresh module registry to be observable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { AuthProvider } from '../AuthContext';

const {
  mockGetSession, mockOnAuthStateChange, mockUnsubscribe,
  mockPull, mockMigrate, mockFlushDirty, mockDetectConflict,
} = vi.hoisted(() => ({
  mockUnsubscribe: vi.fn(),
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockPull: vi.fn(() => Promise.resolve()),
  mockMigrate: vi.fn(() => Promise.resolve()),
  mockFlushDirty: vi.fn(() => Promise.resolve()),
  mockDetectConflict: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('../../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  },
}));

vi.mock('../../utils/sync', () => ({
  pullFromSupabase: mockPull,
  pushToSupabase: vi.fn(() => Promise.resolve()),
  flushDirty: mockFlushDirty,
  migrateLocalWorkoutsToSupabase: mockMigrate,
  detectSignInMesoConflict: mockDetectConflict,
}));

const sessionFor = (id: string) => ({
  user: { id, email: `${id}@example.com` },
  access_token: 't',
});

/** The callback AuthContext handed to onAuthStateChange. */
let fire: (event: string, session: unknown) => void;

async function mountProvider() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: ReturnType<typeof createRoot>;
  await act(async () => {
    root = createRoot(container);
    root.render(<AuthProvider><span /></AuthProvider>);
  });
  return {
    cleanup: async () => {
      await act(async () => root.unmount());
      document.body.removeChild(container);
    },
  };
}

describe('SIGNED_IN re-fires do not re-run the migration walk', () => {
  let mounted: Awaited<ReturnType<typeof mountProvider>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockImplementation((cb: typeof fire) => {
      fire = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });
    mounted = await mountProvider();
  });

  afterEach(async () => { await mounted.cleanup(); });

  // The latch is module scope, so it survives between tests in this file —
  // each case needs an id no earlier case has already adopted.
  it('runs pull + migrate once on the first SIGNED_IN', async () => {
    await act(async () => { fire('SIGNED_IN', sessionFor('u1')); });
    expect(mockPull).toHaveBeenCalledTimes(1);
    expect(mockMigrate).toHaveBeenCalledTimes(1);
  });

  it('re-fires for the SAME user only flush the dirty queue', async () => {
    await act(async () => { fire('SIGNED_IN', sessionFor('u2')); });
    expect(mockMigrate).toHaveBeenCalledTimes(1);

    // Token refresh, app resume, another resume...
    for (let i = 0; i < 5; i++) {
      await act(async () => { fire('SIGNED_IN', sessionFor('u2')); });
    }

    expect(mockMigrate).toHaveBeenCalledTimes(1); // still once
    expect(mockPull).toHaveBeenCalledTimes(1);
    expect(mockFlushDirty).toHaveBeenCalledTimes(6); // 1 chain + 5 re-fires
  });

  it('a DIFFERENT user signing in runs the full chain again', async () => {
    await act(async () => { fire('SIGNED_IN', sessionFor('u3a')); });
    await act(async () => { fire('SIGNED_IN', sessionFor('u3b')); });
    expect(mockMigrate).toHaveBeenCalledTimes(2);
    expect(mockPull).toHaveBeenCalledTimes(2);
  });

  it('sign-out clears the latch so a real re-login re-runs the chain', async () => {
    await act(async () => { fire('SIGNED_IN', sessionFor('u4')); });
    await act(async () => { fire('SIGNED_OUT', null); });
    await act(async () => { fire('SIGNED_IN', sessionFor('u4')); });
    expect(mockMigrate).toHaveBeenCalledTimes(2);
  });
});
