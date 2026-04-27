import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../utils/supabase';
import Button from '../ui/Button';
import { FOUNDRY_ANVIL_IMG } from '../../data/images-core';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';
import { emit } from '../../utils/events';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Keyboard handling: on iOS (Capacitor), when the keyboard opens, scroll the
  // active input into view so the user can see what they're typing. We load
  // the plugin lazily + defensively — on web builds the dynamic import resolves
  // but `addListener` is a no-op, and if anything throws we silently fall back
  // to the onFocus scrollIntoView handler on each input.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import('@capacitor/keyboard');
        if (cancelled || !mod?.Keyboard?.addListener) return;
        const handle = await mod.Keyboard.addListener('keyboardWillShow', () => {
          const el = document.activeElement as HTMLElement | null;
          if (el && typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        });
        cleanup = () => {
          try {
            handle?.remove?.();
          } catch {
            /* noop */
          }
        };
      } catch {
        // Plugin not available (web build, test env, etc.) — onFocus fallback covers us.
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // onFocus fallback — works everywhere (web + native) and is cheap. The
  // Capacitor listener above is the primary fix on iOS because the keyboard
  // animates in AFTER the focus event fires; keyboardWillShow gives us the
  // right moment to re-scroll.
  const scrollFocusedIntoView = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    // Defer slightly so the layout settles (iOS resizes the viewport on focus).
    window.setTimeout(() => {
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const fn = mode === 'login' ? login : signup;
      const { error: authError } = await fn(email, password);
      if (authError) {
        setError(authError.message);
      } else if (mode === 'signup') {
        setInfo('Check your email for a confirmation link.');
        showToast('Account created!', 'success');
      } else {
        showToast('Welcome back!', 'success');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email address first.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // redirectTo MUST point at our /reset-password route. Without it,
      // Supabase falls back to the project Site URL — which on this app
      // lands the user on Setup (the auth gate routes signed-in users
      // without a profile straight to onboarding) instead of an
      // update-password screen.
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/reset-password`
          : undefined;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        redirectTo ? { redirectTo } : undefined,
      );
      if (resetError) {
        setError(resetError.message);
      } else {
        setInfo('Password reset email sent.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        // Full viewport column: header (logo) stays put, form area scrolls
        // independently so the iOS keyboard never hides the inputs.
        height: '100vh',
        maxHeight: '100vh',
        background: 'var(--bg-root, #141414)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        fontFamily: tokens.fontFamily.body,
        overflow: 'hidden',
      }}
    >
      {/* Back-to-app link — only shown when the user reached AuthPage via an
          explicit request flag (e.g. profile drawer's "Sync across devices").
          Onboarding-path users can still proceed normally; this just gives
          them a way out. Clears the flag and emits a cancel event so
          AuthGate re-renders the anonymous app shell. */}
      {store.get('foundry:wants_auth') === '1' && (
        <button
          type="button"
          onClick={() => {
            store.remove('foundry:wants_auth');
            emit('foundry:auth-cancelled');
          }}
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            left: 16,
            padding: '8px 12px',
            minHeight: 36,
            background: 'transparent',
            border: '1px solid var(--border, rgba(255,255,255,0.12))',
            borderRadius: tokens.radius.md,
            color: 'var(--text-muted, #888)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            zIndex: 2,
          }}
          aria-label="Back to app"
        >
          <span aria-hidden="true">←</span> Back
        </button>
      )}

      {/* Logo — fixed-height header, honors notch */}
      <header
        style={{
          flex: '0 0 auto',
          maxHeight: '30vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: `calc(${tokens.spacing.lg}px + env(safe-area-inset-top, 0px)) ${tokens.spacing.lg}px ${tokens.spacing.lg}px`,
        }}
      >
        <img
          src={typeof FOUNDRY_ANVIL_IMG !== 'undefined' ? FOUNDRY_ANVIL_IMG : ''}
          alt="The Foundry"
          style={{
            width: 64,
            height: 64,
            objectFit: 'cover',
            borderRadius: tokens.radius.xl,
            boxShadow: '0 0 32px rgba(232,101,26,0.3)',
          }}
        />
        {/* Typography pass: 0.25em stretched the F off the right edge on
            iPhone SE. 0.16em matches the locked WelcomeScreen/CTA spec. */}
        <h1
          style={{
            fontSize: tokens.fontSize.xxl,
            fontWeight: tokens.fontWeight.normal,
            letterSpacing: '0.16em',
            color: 'var(--text-primary, #e5e5e5)',
            fontFamily: tokens.fontFamily.display,
            margin: 0,
          }}
        >
          THE FOUNDRY
        </h1>
        <h2
          style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--accent)',
            textTransform: 'uppercase',
            margin: 0,
            fontWeight: 600,
          }}
        >
          Forge your strength
        </h2>
      </header>

      {/* Scrollable form region. paddingBottom uses env(keyboard-inset-height)
          which modern iOS WebKit exposes — it expands as the keyboard rises so
          there's always room to scroll the focused input into view. */}
      <div
        style={{
          flex: '1 1 auto',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
          paddingBottom:
            'max(24px, env(keyboard-inset-height, 0px), env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Card */}
        <div
          style={{
            width: '100%',
            maxWidth: 400,
            background: 'var(--bg-card, #1a1a1a)',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
            borderRadius: tokens.radius.xl,
            padding: `28px ${tokens.spacing.xl}px`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {/* Mode toggle */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-root, #141414)',
              borderRadius: tokens.radius.lg,
              padding: 3,
              marginBottom: 24,
            }}
          >
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setInfo(''); }}
                style={{
                  flex: 1,
                  minHeight: 44,
                  padding: `${tokens.spacing.sm}px`,
                  borderRadius: tokens.radius.md,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: tokens.fontSize.sm,
                  fontWeight: tokens.fontWeight.bold,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  transition: 'background 0.15s, color 0.15s',
                  background: mode === m ? tokens.colors.accentMuted : 'transparent',
                  color: mode === m ? tokens.colors.accentDim : 'var(--text-muted, #666)',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: tokens.fontSize.xs,
                  fontWeight: tokens.fontWeight.semibold,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted, #666)',
                  marginBottom: 6,
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={scrollFocusedIntoView}
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="email"
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  minHeight: 44,
                  padding: '11px 12px',
                  background: 'var(--bg-root, #141414)',
                  border: '1px solid var(--border, rgba(255,255,255,0.1))',
                  borderRadius: tokens.radius.lg,
                  color: 'var(--text-primary, #e5e5e5)',
                  fontSize: tokens.fontSize.base,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: tokens.fontSize.xs,
                  fontWeight: tokens.fontWeight.semibold,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted, #666)',
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={scrollFocusedIntoView}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="••••••••"
                style={{
                  width: '100%',
                  minHeight: 44,
                  padding: '11px 12px',
                  background: 'var(--bg-root, #141414)',
                  border: '1px solid var(--border, rgba(255,255,255,0.1))',
                  borderRadius: tokens.radius.lg,
                  color: 'var(--text-primary, #e5e5e5)',
                  fontSize: tokens.fontSize.base,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: `10px ${tokens.spacing.md}px`,
                  background: tokens.colors.dangerBg,
                  border: `1px solid ${tokens.colors.dangerBorder}`,
                  borderRadius: tokens.radius.md,
                  color: tokens.colors.dangerText,
                  fontSize: tokens.fontSize.md,
                }}
              >
                {error}
              </div>
            )}

            {info && (
              <div
                style={{
                  padding: `10px ${tokens.spacing.md}px`,
                  background: tokens.colors.accentSubtle,
                  border: `1px solid ${tokens.colors.accentBorder}`,
                  borderRadius: tokens.radius.md,
                  color: tokens.colors.accentDim,
                  fontSize: tokens.fontSize.md,
                }}
              >
                {info}
              </div>
            )}

            <Button type="submit" fullWidth disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {mode === 'login' && (
            <button
              onClick={handleForgotPassword}
              disabled={loading}
              style={{
                display: 'block',
                margin: '16px auto 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text-muted, #666)',
                textDecoration: 'underline',
                letterSpacing: '0.02em',
                padding: '12px 16px',
                minHeight: 44,
              }}
            >
              Forgot password?
            </button>
          )}
        </div>

        {/* Ember line decoration */}
        <div
          style={{
            marginTop: 32,
            width: 120,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(232,101,26,0.4), transparent)',
          }}
        />
      </div>
    </main>
  );
}
