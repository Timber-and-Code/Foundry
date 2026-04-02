import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import Button from '../ui/Button';
import { FOUNDRY_ANVIL_IMG } from '../../data/images-core';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
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
    } catch (err) {
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
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root, #141414)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <img
          src={typeof FOUNDRY_ANVIL_IMG !== 'undefined' ? FOUNDRY_ANVIL_IMG : ''}
          alt="Foundry"
          style={{
            width: 64,
            height: 64,
            objectFit: 'cover',
            borderRadius: 12,
            boxShadow: '0 0 32px rgba(232,101,26,0.3)',
          }}
        />
        <div
          style={{
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: '0.25em',
            color: 'var(--text-primary, #e5e5e5)',
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
          }}
        >
          THE FOUNDRY
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: 'rgba(232,101,26,0.7)',
            textTransform: 'uppercase',
          }}
        >
          Forge your strength
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--bg-card, #1a1a1a)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: 12,
          padding: '28px 24px',
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
                padding: '8px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                transition: 'background 0.15s, color 0.15s',
                background: mode === m ? 'rgba(232,101,26,0.15)' : 'transparent',
                color: mode === m ? 'rgba(232,101,26,0.9)' : 'var(--text-muted, #666)',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-muted, #666)',
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              style={{
                width: '100%',
                padding: '11px 12px',
                background: 'var(--bg-root, #141414)',
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                borderRadius: 8,
                color: 'var(--text-primary, #e5e5e5)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-muted, #666)',
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '11px 12px',
                background: 'var(--bg-root, #141414)',
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                borderRadius: 8,
                color: 'var(--text-primary, #e5e5e5)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '10px 12px',
                background: 'rgba(220,38,38,0.1)',
                border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 6,
                color: '#f87171',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {info && (
            <div
              style={{
                padding: '10px 12px',
                background: 'rgba(232,101,26,0.1)',
                border: '1px solid rgba(232,101,26,0.3)',
                borderRadius: 6,
                color: 'rgba(232,101,26,0.9)',
                fontSize: 13,
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
  );
}
