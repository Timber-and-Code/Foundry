import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';
import { useToast } from '../../contexts/ToastContext';
import { getHealthService } from '../../utils/health';
import type { AuthorizationStatus } from '../../utils/health';

const TOGGLE_KEY = 'foundry:health:enabled';

type Availability = 'unknown' | 'available' | 'unavailable';

export default function HealthSection() {
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(() => store.get(TOGGLE_KEY) === '1');
  const [availability, setAvailability] = useState<Availability>('unknown');
  const [auth, setAuth] = useState<AuthorizationStatus | null>(null);
  const [workoutPerm, setWorkoutPerm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const health = getHealthService();
      const avail = await health.isAvailable();
      if (cancelled) return;
      setAvailability(avail ? 'available' : 'unavailable');
      if (!avail) return;
      const current = await health.checkPermissions({ read: ['weight'], write: ['weight'] });
      if (!cancelled) setAuth(current);
      // Separate grant from the weight permissions, and revocable on its
      // own in iOS Settings — so it needs its own read on mount.
      const workouts = await health.checkWorkoutPermission();
      if (!cancelled) setWorkoutPerm(workouts);
    })();
    return () => { cancelled = true; };
  }, []);

  const hasReadPerm = !!auth?.readAuthorized.includes('weight');

  const handleToggle = async () => {
    if (busy) return;
    setBusy(true);
    const health = getHealthService();

    if (enabled) {
      // Turning off — just flip the flag. We can't revoke HK perms from here;
      // the user does that in iOS Settings. Surfacing that is out of scope.
      store.set(TOGGLE_KEY, '0');
      setEnabled(false);
      showToast('Apple Health sync turned off', 'info');
      setBusy(false);
      return;
    }

    // ONE sheet for body weight and workouts together.
    //
    // This used to be two chained requests — @capgo/capacitor-health for
    // weight, then ours for workouts the moment the first promise resolved.
    // That promise resolves while the first sheet is still dismissing, and
    // HealthKit silently drops an authorization request made while another
    // is on screen. The workout sheet never appeared, its status stayed
    // .notDetermined, and no session ever reached Apple Fitness — with the
    // failure swallowed, it looked exactly like the lifter had declined.
    let workoutsGranted = false;
    try {
      const res = await health.requestAllPermissions();
      workoutsGranted = res.workouts;
    } catch (e) {
      // A missing native plugin lands here. Say so plainly rather than
      // reporting it as a denied permission — they are different problems
      // and only one of them is the lifter's to fix.
      console.warn('[Foundry Health] native permission request failed', e);
      Sentry.captureException(e, { tags: { context: 'health', operation: 'request_permissions' } });
      showToast('Apple Health is unavailable on this build. Please report this.', 'warning');
      setBusy(false);
      return;
    }

    // Re-read weight status through the existing plugin so the rest of the
    // section keeps rendering off one source of truth.
    try {
      setAuth(await health.checkPermissions({ read: ['weight'], write: ['weight'] }));
    } catch {
      /* status display only — never block the toggle on it */
    }
    setWorkoutPerm(workoutsGranted);

    store.set(TOGGLE_KEY, '1');
    setEnabled(true);
    showToast(
      workoutsGranted
        ? 'Apple Health on — bodyweight syncs, workouts post to Apple Fitness'
        : 'Apple Health on for bodyweight. Allow Workouts in iOS Settings to post sessions to Apple Fitness.',
      'success',
    );
    setBusy(false);
  };

  if (availability === 'unknown') return null;

  const sectionLabel = (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: 'var(--text-dim)',
        marginBottom: 4,
        marginTop: 6,
        textTransform: 'uppercase' as const,
      }}
    >
      APPLE HEALTH
    </div>
  );

  const divider = (
    <div
      style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(232,101,26,0.2), transparent)',
        margin: '4px 0',
      }}
    />
  );

  if (availability === 'unavailable') {
    return (
      <>
        {divider}
        {sectionLabel}
        <div
          style={{
            padding: '10px 12px',
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.55,
            background: 'var(--bg-inset)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
          }}
        >
          Apple Health sync is available in the native app. Open The Foundry from your home screen
          to enable it.
        </div>
      </>
    );
  }

  const subtitle = !enabled
    ? 'Sync bodyweight with Apple Health, and post finished workouts to Apple Fitness so they count toward your rings.'
    : hasReadPerm
      ? workoutPerm
        ? 'Active. Bodyweight syncs both ways; finished workouts post to Apple Fitness.'
        : 'Active for bodyweight. Allow Workouts in iOS Settings → Health to post sessions to Apple Fitness.'
      : 'Enabled, but we lost read access. Toggle off and back on, or check iOS Settings → Health.';

  const statusColor = enabled && hasReadPerm ? '#4ade80' : enabled ? 'var(--stalling)' : 'var(--text-muted)';
  const statusText = enabled && hasReadPerm ? 'ON' : enabled ? 'PAUSED' : 'OFF';

  return (
    <>
      {divider}
      {sectionLabel}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={handleToggle}
          disabled={busy}
          aria-pressed={enabled}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '11px 12px',
            background: 'var(--bg-inset)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sync bodyweight</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: tokens.radius.full,
                background: statusColor,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, color: statusColor, fontWeight: 600, letterSpacing: '0.05em' }}>
              {statusText}
            </span>
          </span>
        </button>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.55,
            padding: '0 4px',
          }}
        >
          {subtitle}
        </div>
      </div>
    </>
  );
}
