import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react';
import { supabase } from '../utils/supabase';
import { store } from '../utils/storage';
import {
  pullFromSupabase,
  pushToSupabase,
  flushDirty,
  migrateLocalWorkoutsToSupabase,
} from '../utils/sync';

// TODO(perf): Lazy-load sync.ts for anonymous users — deferred (v9 review #8)
//
// sync.ts is ~2,400 LOC and currently imported eagerly by three critical-path
// modules: AuthContext.tsx (here), main.tsx, and store.js. This means it loads
// for ALL users — including anonymous visitors who never sign in.
//
// The opportunity: sync.ts should not appear in the initial JS bundle for
// anonymous users. It should only load when the user is authenticated.
//
// Why it was deferred: the refactor touches all three entry points simultaneously
// and is riskier than a simple import swap:
//
//   1. main.tsx needs `markDirty` synchronously at startup to wire the storage
//      dirty-tracking callback (`_setMarkDirty(markDirty)`). This must happen
//      before any component mounts, so a dynamic import() here would require
//      converting the wiring to an async init and ensuring it completes before
//      the first localStorage write.
//
//   2. store.js re-exports `pullFromSupabase` and `pushToSupabase` from sync.ts
//      as a convenience. Any component that does `import { pullFromSupabase }
//      from '../../utils/store'` will cause sync.ts to be in the initial chunk.
//      Those re-exports would need to be removed and call sites updated to import
//      directly from sync.ts wrapped in a dynamic import.
//
//   3. AuthContext.tsx (here) uses four sync functions only in the SIGNED_IN
//      branch of onAuthStateChange. This is the easiest of the three — a dynamic
//      import(() => import('../utils/sync')) inside the SIGNED_IN handler would
//      work cleanly without touching the module graph.
//
// Recommended approach when picking this up:
//   Step 1: Remove the `pullFromSupabase`/`pushToSupabase` re-exports from
//           store.js and migrate call sites to a lazy wrapper.
//   Step 2: Replace the static import in AuthContext with a dynamic import
//           inside the onAuthStateChange SIGNED_IN handler.
//   Step 3: Extract `markDirty` into a separate tiny module (e.g.
//           utils/syncDirty.ts) that doesn't import the rest of sync.ts, so
//           main.tsx can import it eagerly without pulling the whole 2.4 KB file.
//
// Estimated savings: ~15–20 KB gzip off the critical-path bundle for anonymous
// users, which is the majority of initial visitors.

// Multi-user safety: when a different user signs in than was last cached
// on this device, wipe the prior user's local data BEFORE migrate runs.
// Otherwise migrateLocalWorkoutsToSupabase walks User A's day/week keys
// and pushes them into User B's Supabase rows.
//
// Preserves a tiny set of keys that aren't user data: welcomed (no
// re-splash), the onboarding-v2 feature flag opt-out, the one-time
// ppl→foundry migration latch, and the currently-selected theme.
//
// Sign-out itself does NOT wipe — that would lose debounced unsynced
// edits if the same user signs back in (the more common case).
const PRESERVE_ON_USER_SWITCH = new Set([
  'foundry:welcomed',
  'foundry:onboarding_v2',
  'foundry:migrated_from_ppl',
  'foundry:last_user_id',
]);

function clearPriorUserData(): void {
  try {
    for (const key of store.keys('foundry:')) {
      if (PRESERVE_ON_USER_SWITCH.has(key)) continue;
      store.remove(key);
    }
  } catch (e) {
    console.warn('[Foundry Auth] Failed to clear prior user data', e);
  }
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authUnavailable: boolean;
  signup: (email: string, password: string) => ReturnType<typeof supabase.auth.signUp>;
  login: (email: string, password: string) => ReturnType<typeof supabase.auth.signInWithPassword>;
  logout: () => ReturnType<typeof supabase.auth.signOut>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUnavailable, setAuthUnavailable] = useState(false);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch(() => {
        setAuthUnavailable(true);
      })
      .finally(() => setLoading(false));

    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (event === 'SIGNED_IN') {
          if (session?.user) {
            Sentry.setUser({ email: session.user.email, id: session.user.id });
            // Multi-user safety: if a DIFFERENT user signed in than was
            // last on this device, wipe prior local data before migrate
            // walks it into the new user's Supabase rows.
            const lastUserId = store.get('foundry:last_user_id');
            if (lastUserId && lastUserId !== session.user.id) {
              clearPriorUserData();
            }
            store.set('foundry:last_user_id', session.user.id);
          }
          // Pull remote state first (merges into local, marks local-newer
          // keys dirty), then walk local dayWeek keys and migrate any
          // pre-auth workout sessions/sets (onboarding v2 defer-auth),
          // then flush the dirty queue for everything else (readiness,
          // cardio, profile edits). migrateLocalWorkoutsToSupabase is
          // idempotent, so running on every sign-in is safe.
          pullFromSupabase()
            .then(() => migrateLocalWorkoutsToSupabase())
            .then(() => flushDirty());
        } else if (event === 'USER_UPDATED') {
          pullFromSupabase();
        } else if (event === 'SIGNED_OUT') {
          Sentry.setUser(null);
        }
      });
      subscription = data.subscription;
    } catch {
      // ignore if Supabase is unavailable
    }

    return () => subscription?.unsubscribe();
  }, []);

  const signup = async (email: string, password: string) => {
    const result = await supabase.auth.signUp({ email, password });
    if (result.data?.user) {
      pushToSupabase();
    }
    return result;
  };

  const login = (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
  const logout = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{ user, session, loading, authUnavailable, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
