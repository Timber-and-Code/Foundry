import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react';
import { supabase } from '../utils/supabase';
import { pullFromSupabase, pushToSupabase } from '../utils/sync';

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
          if (session?.user) Sentry.setUser({ email: session.user.email, id: session.user.id });
          pullFromSupabase();
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
