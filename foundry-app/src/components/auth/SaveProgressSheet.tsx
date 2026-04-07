import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';

interface SaveProgressSheetProps {
  onDismiss: () => void;
}

export default function SaveProgressSheet({ onDismiss }: SaveProgressSheetProps) {
  const { signup } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await signup(email, password);
      if (authError) {
        setError(authError.message);
      } else {
        store.set('foundry:save_progress_dismissed', '1');
        showToast('Account created! Your data will sync.', 'success');
        onDismiss();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    store.set('foundry:save_progress_dismissed', '1');
    onDismiss();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={handleSkip}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          borderRadius: `${tokens.radius.xl}px ${tokens.radius.xl}px 0 0`,
          padding: '28px 24px 32px',
          maxWidth: 480,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 6 }}>
            Save your progress
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
            Create an account to sync across devices and never lose your training data.
          </div>
        </div>

        {/* Signup form */}
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{
              padding: '14px 16px',
              borderRadius: tokens.radius.md,
              border: '1px solid var(--border)',
              background: 'var(--bg-inset)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            style={{
              padding: '14px 16px',
              borderRadius: tokens.radius.md,
              border: '1px solid var(--border)',
              background: 'var(--bg-inset)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
            }}
          />

          {error && (
            <div style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px',
              borderRadius: tokens.radius.md,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 800,
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
              opacity: loading ? 0.6 : 1,
              marginTop: 4,
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Skip */}
        <button
          onClick={handleSkip}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '10px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
