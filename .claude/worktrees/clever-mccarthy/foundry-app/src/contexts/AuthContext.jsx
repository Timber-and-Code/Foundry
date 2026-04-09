import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { pullFromSupabase, pushToSupabase } from '../utils/sync';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // true when Supabase was unreachable on startup — app runs in offline/localStorage mode
  const [authUnavailable, setAuthUnavailable] = useState(false);

  useEffect(() => {
    let subscription = null;

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
          pullFromSupabase();
        } else if (event === 'USER_UPDATED') {
          pullFromSupabase();
        }
      });
      subscription = data.subscription;
    } catch {
      // ignore if Supabase is unavailable
    }

    return () => subscription?.unsubscribe();
  }, []);

  const signup = async (email, password) => {
    const result = await supabase.auth.signUp({ email, password });
    if (result.data?.user) {
      pushToSupabase();
    }
    return result;
  };

  const login = (email, password) => supabase.auth.signInWithPassword({ email, password });

  const logout = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{ user, session, loading, authUnavailable, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
