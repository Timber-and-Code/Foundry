import { useCallback, useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';
import { App } from '@capacitor/app';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';
import { useToast } from '../../contexts/ToastContext';
import { getHealthService } from '../../utils/health';
import type { HealthAccessStatus } from '../../utils/health';
import { HEALTH_TOGGLE_KEY } from '../../utils/health/reconcileAccess';
import { describeHealthState, HEALTH_SETTINGS_PATH } from '../../utils/health/describeHealthState';

type Availability = 'unknown' | 'available' | 'unavailable';

function reportHealthError(e: unknown, operation: string) {
  console.warn(`[Foundry Health] ${operation} failed`, e);
  Sentry.captureException(e, { tags: { context: 'health', operation } });
}

export default function HealthSection() {
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(() => store.get(HEALTH_TOGGLE_KEY) === '1');
  const [availability, setAvailability] = useState<Availability>('unknown');
  const [access, setAccess] = useState<HealthAccessStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const health = getHealthService();
    const avail = await health.isAvailable();
    setAvailability(avail ? 'available' : 'unavailable');
    if (!avail) return;
    setAccess(await health.getAccessStatus());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      refresh().catch((e) => {
        if (!cancelled) reportHealthError(e, 'read_status');
      });
    };
    load();
    // Permissions change in the Health app, outside ours — re-read on return.
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && !cancelled) load();
    });
    return () => {
      cancelled = true;
      listener.then((l) => l.remove()).catch(() => {});
    };
  }, [refresh]);

  const view = describeHealthState(enabled, access);

  const handleToggle = async () => {
    if (busy) return;

    if (enabled && !view.tapRequests) {
      // Turning off — just flip the flag. We can't revoke HK perms from here;
      // the user does that in the Health app.
      store.set(HEALTH_TOGGLE_KEY, '0');
      setEnabled(false);
      showToast('Apple Health sync turned off', 'info');
      return;
    }

    setBusy(true);
    // ONE sheet for body weight and workouts together.
    //
    // This used to be two chained requests — @capgo/capacitor-health for
    // weight, then ours for workouts the moment the first promise resolved.
    // That promise resolves while the first sheet is still dismissing, and
    // HealthKit silently drops an authorization request made while another
    // is on screen, so the workout type was never asked. iOS shows the sheet
    // only for never-asked types, which is why a tap in the SET UP state is
    // how such a lifter finally gets asked.
    let result: HealthAccessStatus;
    try {
      result = await getHealthService().requestAllPermissions();
    } catch (e) {
      // A missing native plugin or a HealthKit refusal (e.g. entitlement)
      // lands here. Say so plainly rather than reporting it as a denied
      // permission — only one of those is the lifter's to fix.
      reportHealthError(e, 'request_permissions');
      showToast('Apple Health is unavailable on this build. Please report this.', 'warning');
      setBusy(false);
      return;
    }

    setAccess(result);
    store.set(HEALTH_TOGGLE_KEY, '1');
    setEnabled(true);
    const weight = result.weight === 'authorized';
    const workouts = result.workouts === 'authorized';
    showToast(
      weight && workouts
        ? 'Apple Health on — bodyweight syncs, workouts post to Apple Fitness'
        : workouts
          ? 'Apple Health on for workouts. Bodyweight is off in Apple Health.'
          : weight
            ? `Apple Health on for bodyweight. To post workouts, turn them on in ${HEALTH_SETTINGS_PATH}.`
            : `Apple Health access is off. Turn it on in ${HEALTH_SETTINGS_PATH}.`,
      weight || workouts ? 'success' : 'warning',
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

  const statusColor =
    view.status === 'ON' ? '#4ade80' : view.status === 'OFF' ? 'var(--text-muted)' : 'var(--stalling)';

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
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sync with Apple Health</span>
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
              {view.status}
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
          {view.subtitle}
        </div>
      </div>
    </>
  );
}
