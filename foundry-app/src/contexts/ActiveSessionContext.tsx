import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession as clearActiveSessionStore,
  type ActiveSession,
} from '../utils/store';

export type { ActiveSession };

interface ActiveSessionContextValue {
  session: ActiveSession | null;
  setActiveSession: (session: ActiveSession) => void;
  /**
   * Merge-patch the currently-running session. No-op when no session is
   * active — callers don't have to null-check before every set toggle.
   */
  updateActiveSession: (patch: Partial<ActiveSession>) => void;
  clearActiveSession: () => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue | null>(null);

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  // Hydrate on mount — loadActiveSession() already drops stale (>6h) entries.
  const [session, setSession] = useState<ActiveSession | null>(() => loadActiveSession());

  // Defensive re-check in case the module loaded before the 6h threshold
  // crossed (e.g. user reopened the PWA after 6.5h on the same tab).
  useEffect(() => {
    const fresh = loadActiveSession();
    if (!fresh && session) {
      setSession(null);
    }
    // We intentionally only run this once on mount. Staleness is also
    // re-checked on every loadActiveSession() call from other callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveSession = useCallback((next: ActiveSession) => {
    saveActiveSession(next);
    setSession(next);
  }, []);

  const updateActiveSession = useCallback((patch: Partial<ActiveSession>) => {
    setSession((prev) => {
      if (!prev) return prev;
      // Only allow patches within the same kind — flipping kind mid-session
      // would be a bug. Callers should clear then set instead.
      const merged = { ...prev, ...patch } as ActiveSession;
      saveActiveSession(merged);
      return merged;
    });
  }, []);

  const clear = useCallback(() => {
    clearActiveSessionStore();
    setSession(null);
  }, []);

  return (
    <ActiveSessionContext.Provider
      value={{ session, setActiveSession, updateActiveSession, clearActiveSession: clear }}
    >
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession(): ActiveSessionContextValue {
  const ctx = useContext(ActiveSessionContext);
  if (!ctx) throw new Error('useActiveSession must be used within ActiveSessionProvider');
  return ctx;
}
