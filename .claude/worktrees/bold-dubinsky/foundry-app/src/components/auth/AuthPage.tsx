import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import Button from '../ui/Button';
import { FOUNDRY_ANVIL_IMG } from '../../data/images-core';
import { tokens } from '../../styles/tokens';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

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
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
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
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) {
        setError(resetError.message);
      } else {
        setInfo('Password reset email sent.');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root, #141414)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${tokens.spacing.xl}px ${tokens.spacing.lg}px`,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Logo */}
      <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <img
          src={typeof FOUNDRY_ANVIL_IMG !== 'undefined' ? FOUNDRY_ANVIL_IMG : ''}
          alt="Foundry"
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
            letterSpacing: '0.25em',
            color: 'var(--text-primary, #e5e5e5)',
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            margin: 0,
          }}
        >
          THE FOUNDRY
        </h1>
        <h2
          style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: 'rgba(232,101,26,0.7)',
            textTransform: 'uppercase',
            margin: 0,
            fontWeight: 400,
          }}
        >
          Forge your strength
        </h2>
      </header>

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
            borderRadius: 8,
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
              required
              autoComplete="email"
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
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
    </main>
  );
}
