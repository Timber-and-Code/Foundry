import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useToast } from '../../contexts/ToastContext';
import Button from '../ui/Button';
import { FOUNDRY_ANVIL_IMG } from '../../data/images-core';
import { tokens } from '../../styles/tokens';

/**
 * ResetPasswordPage — landing page for the Supabase password-recovery email.
 *
 * Flow:
 *   1. AuthPage's "Forgot password?" sends an email with a redirect to
 *      `${origin}/reset-password#access_token=...&type=recovery`.
 *   2. supabase-js auto-detects the hash on load and sets the session.
 *      The PASSWORD_RECOVERY event fires from onAuthStateChange.
 *   3. We render this page and call `supabase.auth.updateUser({ password })`
 *      with the new password the user types in.
 *   4. On success we navigate('/') — the user is now signed in normally and
 *      the app's standard auth gate takes them to home/setup.
 *
 * Mounted from AuthGate via a path-prefix check that runs BEFORE the normal
 * "do they have a session?" gate, so the recovery session doesn't get
 * misinterpreted as a fresh sign-in.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setHasSession(!!data.session);
        if (!data.session) {
          setError(
            'This password reset link has expired or is invalid. Request a new one from the sign-in screen.',
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasSession(false);
          setError('Could not verify the reset link. Try requesting a new one.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollFocusedIntoView = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
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
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        showToast('Password updated. Welcome back.', 'success');
        navigate('/', { replace: true });
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
          NEW PASSWORD
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
          Pick something you'll remember
        </h2>
      </header>

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
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label
                htmlFor="new-password"
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
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={scrollFocusedIntoView}
                required
                minLength={6}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="••••••••"
                disabled={hasSession === false}
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
                  opacity: hasSession === false ? 0.5 : 1,
                }}
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
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
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onFocus={scrollFocusedIntoView}
                required
                minLength={6}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="••••••••"
                disabled={hasSession === false}
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
                  opacity: hasSession === false ? 0.5 : 1,
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

            <Button type="submit" fullWidth disabled={loading || hasSession === false} style={{ marginTop: 4 }}>
              {loading ? 'Saving…' : 'Update password'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
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
            Back to sign in
          </button>
        </div>
      </div>
    </main>
  );
}
