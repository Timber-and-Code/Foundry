import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';

export type SaveProgressTrigger =
  | 'first_set'
  | 'first_week_done'
  | 'meso_complete'
  | 'settings';

interface SaveProgressSheetProps {
  onDismiss: () => void;
  trigger?: SaveProgressTrigger;
}

interface TriggerCopy {
  title: string;
  body: string;
}

const COPY_BY_TRIGGER: Record<SaveProgressTrigger, TriggerCopy> = {
  first_set: {
    title: "Don't lose this",
    body: 'You just logged your first set. Save it to the cloud so your progress follows you.',
  },
  first_week_done: {
    title: 'A week of work, saved',
    body: "You've logged a full week. Create an account to back it up — your program, your sets, your PRs, all on every device.",
  },
  meso_complete: {
    title: 'Mesocycle complete — lock it in',
    body: "You finished a full mesocycle. Create an account now so this meso, every PR, and your next block carry forward.",
  },
  settings: {
    title: 'Sync across devices',
    body: 'Create an account and your workouts, PRs, and program history travel with you.',
  },
};

export default function SaveProgressSheet({
  onDismiss,
  trigger = 'settings',
}: SaveProgressSheetProps) {
  const { signup } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const copy = COPY_BY_TRIGGER[trigger];

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Manual settings trigger does not set the permanent dismiss flag — the
    // user explicitly opened it and may want to re-open later.
    if (trigger !== 'settings') {
      store.set('foundry:save_progress_dismissed', '1');
    }
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
          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: 'var(--text-primary)',
              marginBottom: 6,
            }}
          >
            {copy.title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              maxWidth: 320,
              margin: '0 auto',
            }}
          >
            {copy.body}
          </div>
        </div>

        {/* Signup form */}
        <form
          onSubmit={handleSignup}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
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
