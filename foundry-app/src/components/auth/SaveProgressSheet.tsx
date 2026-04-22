import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { tokens } from '../../styles/tokens';
import { store, ageFromDob, isEduEmail } from '../../utils/store';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
    body: "You're two exercises in. Save your progress to the cloud so it follows you — every set, every meso, every device.",
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
  const { signup, login } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // DOB + student are collected at signup (moved out of the About You
  // step in onboarding v2). They drive free-tier eligibility.
  const [dob, setDob] = useState<{ month: string; day: string; year: string }>(() => {
    try {
      const p = JSON.parse(store.get('foundry:profile') || '{}');
      if (p.birthdate) {
        const [y, m, d] = String(p.birthdate).split('-');
        return { year: y || '', month: String(parseInt(m || '0')) || '', day: String(parseInt(d || '0')) || '' };
      }
    } catch { /* parse fallback */ }
    return { month: '', day: '', year: '' };
  });
  const [isStudent, setIsStudent] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [studentEmailError, setStudentEmailError] = useState('');

  // Mirror AuthPage's iOS keyboard handling. The sheet is bottom-anchored
  // (alignItems: flex-end), so when the software keyboard rises it covers
  // the email/password inputs. env(keyboard-inset-height) on the outer
  // container lifts the sheet on modern iOS WebKit; the Capacitor listener
  // covers older WKWebView builds where that env var isn't exposed.
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
        // Plugin not available (web build, test env). onFocus fallback covers us.
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
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

  const selectStyle: React.CSSProperties = {
    padding: '14px 10px',
    borderRadius: tokens.radius.md,
    border: '1px solid var(--border)',
    background: 'var(--bg-inset)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
  };

  const copy = COPY_BY_TRIGGER[trigger];
  const age = ageFromDob(dob);
  const ageYoung = age !== null && age < 18;
  const ageSenior = age !== null && age >= 62;
  const ageQualifies = ageYoung || ageSenior;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // Signup-only: DOB required for free-tier determination.
    if (mode === 'signup') {
      if (!dob.month || !dob.day || !dob.year) {
        setError('Please enter your full date of birth.');
        return;
      }
      if (isStudent && studentEmail.trim() && !isEduEmail(studentEmail)) {
        setStudentEmailError('Enter a valid .edu email address');
        return;
      }
    }
    setLoading(true);
    try {
      const fn = mode === 'signup' ? signup : login;
      const { error: authError } = await fn(email, password);
      if (authError) {
        setError(authError.message);
      } else {
        // On signup, enrich the local profile with birthdate + student
        // status. Existing sync pipeline will carry these to Supabase.
        if (mode === 'signup') {
          try {
            const p = JSON.parse(store.get('foundry:profile') || '{}');
            const m = String(dob.month).padStart(2, '0');
            const d = String(dob.day).padStart(2, '0');
            p.birthdate = `${dob.year}-${m}-${d}`;
            if (isStudent && studentEmail.trim() && isEduEmail(studentEmail)) {
              p.isStudent = true;
              p.studentEmail = studentEmail.trim().toLowerCase();
              p.studentVerifiedAt = new Date().toISOString();
            }
            store.set('foundry:profile', JSON.stringify(p));
          } catch { /* profile enrich fallback */ }
        }
        store.set('foundry:save_progress_dismissed', '1');
        showToast(
          mode === 'signup' ? 'Account created! Your data will sync.' : 'Welcome back! Syncing…',
          'success',
        );
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
        // Lift the sheet above the iOS software keyboard so email/password
        // inputs stay visible while the user types.
        paddingBottom: 'env(keyboard-inset-height, 0px)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
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
          maxHeight: '100%',
          overflowY: 'auto',
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

        {/* Auth form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {/* DOB — signup only */}
          {mode === 'signup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: 'var(--phase-intens)',
                  textTransform: 'uppercase',
                }}
              >
                Date of Birth
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1.5fr',
                  gap: 8,
                }}
              >
                <select
                  value={dob.month}
                  onChange={(e) => setDob((d) => ({ ...d, month: e.target.value }))}
                  aria-label="Month"
                  style={selectStyle}
                >
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => (
                    <option key={i} value={String(i + 1)}>{m}</option>
                  ))}
                </select>
                <select
                  value={dob.day}
                  onChange={(e) => setDob((d) => ({ ...d, day: e.target.value }))}
                  aria-label="Day"
                  style={selectStyle}
                >
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>{d}</option>
                  ))}
                </select>
                <select
                  value={dob.year}
                  onChange={(e) => setDob((d) => ({ ...d, year: e.target.value }))}
                  aria-label="Year"
                  style={selectStyle}
                >
                  <option value="">Year</option>
                  {Array.from(
                    { length: new Date().getFullYear() - 1929 },
                    (_, i) => new Date().getFullYear() - i,
                  ).map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
              {ageQualifies && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--phase-accum)',
                    fontWeight: 600,
                    lineHeight: 1.4,
                    padding: '8px 10px',
                    borderRadius: tokens.radius.md,
                    background: 'var(--phase-accum)12',
                    border: '1px solid var(--phase-accum)44',
                  }}
                >
                  {ageYoung
                    ? 'The Foundry is permanently free for users under 18.'
                    : 'The Foundry is permanently free for adults 62 and over.'}
                </div>
              )}

              {/* Student checkbox — hidden when user already qualifies by age */}
              {!ageQualifies && age !== null && (
                <div style={{ marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsStudent(!isStudent);
                      if (isStudent) { setStudentEmail(''); setStudentEmailError(''); }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 0, width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: 20, height: 20,
                        borderRadius: tokens.radius.sm,
                        border: `2px solid ${isStudent ? 'var(--phase-accum)' : 'var(--border)'}`,
                        background: isStudent ? 'var(--phase-accum)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.15s',
                      }}
                    >
                      {isStudent && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      I'm a student
                    </span>
                  </button>
                  {isStudent && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="email"
                        inputMode="email"
                        placeholder="your.name@school.edu"
                        value={studentEmail}
                        onFocus={scrollFocusedIntoView}
                        autoCapitalize="none"
                        autoCorrect="off"
                        onChange={(e) => { setStudentEmail(e.target.value); setStudentEmailError(''); }}
                        onBlur={() => {
                          if (studentEmail.trim() && !isEduEmail(studentEmail)) {
                            setStudentEmailError('Enter a valid .edu email address');
                          }
                        }}
                        style={{
                          padding: '14px 16px',
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${studentEmailError ? 'var(--danger)' : 'var(--border)'}`,
                          background: 'var(--bg-inset)',
                          color: 'var(--text-primary)',
                          fontSize: 14,
                          width: '100%',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                      {studentEmailError && (
                        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                          {studentEmailError}
                        </div>
                      )}
                      {studentEmail.trim() && isEduEmail(studentEmail) && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '8px 10px',
                            borderRadius: tokens.radius.md,
                            background: 'var(--phase-accum)12',
                            border: '1px solid var(--phase-accum)44',
                            fontSize: 12,
                            color: 'var(--phase-accum)',
                            fontWeight: 600,
                          }}
                        >
                          The Foundry is free for students. Welcome aboard.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={scrollFocusedIntoView}
            required
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
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
            onFocus={scrollFocusedIntoView}
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            autoCapitalize="none"
            autoCorrect="off"
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
            {loading
              ? mode === 'signup' ? 'Creating account...' : 'Signing in...'
              : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Mode toggle */}
        <button
          type="button"
          onClick={() => { setMode((m) => (m === 'signup' ? 'login' : 'signup')); setError(''); }}
          style={{
            width: '100%',
            marginTop: 10,
            padding: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text-accent)',
            fontWeight: 600,
          }}
        >
          {mode === 'signup'
            ? 'Already have an account? Sign in'
            : 'New here? Create an account'}
        </button>

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
