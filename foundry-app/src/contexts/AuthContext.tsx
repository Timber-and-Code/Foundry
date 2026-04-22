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
