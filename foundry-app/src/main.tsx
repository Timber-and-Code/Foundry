import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './styles/theme.css';
import './styles/global.css';
import { _setMarkDirty } from './utils/storage';
import { markDirty, flushDirty } from './utils/sync';
import { preloadExerciseDBQuietly } from './data/exerciseDB';

// Start loading the exercise DB immediately — it'll be ready by the time
// components need it (~200ms), but won't block the critical render path.
// Quiet variant: a failed chunk fetch is reported to Sentry inside, retried on
// the next access, and must not bubble out here as an unhandled rejection.
preloadExerciseDBQuietly();

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
});

// Wire dirty-tracking and online flush
_setMarkDirty(markDirty);
window.addEventListener('online', () => flushDirty());

// Dev-only console toggles for the Big-Big v2 storage feature flags. Flags
// live in localStorage so they survive reloads but stay scoped per-device.
//   __foundryEnableDayV2Writes(true|false)   // Phase 1 dual-write
//   __foundryEnableDayV2Reads(true|false)    // Phase 3 read-from-v2
if (import.meta.env.DEV) {
  type FlagSetter = (on: boolean) => void;
  type DevToggles = {
    __foundryEnableDayV2Writes?: FlagSetter;
    __foundryEnableDayV2Reads?: FlagSetter;
  };
  const w = window as unknown as DevToggles;
  w.__foundryEnableDayV2Writes = (on: boolean) => {
    try {
      localStorage.setItem('foundry:flag:day_v2_writes', on ? '1' : '0');
      console.log(`[Foundry] day_v2 dual-writes ${on ? 'ENABLED' : 'disabled'}`);
    } catch (e) {
      console.warn('[Foundry] Failed to toggle day_v2 writes flag', e);
    }
  };
  w.__foundryEnableDayV2Reads = (on: boolean) => {
    try {
      localStorage.setItem('foundry:flag:day_v2_reads', on ? '1' : '0');
      console.log(`[Foundry] day_v2 reads ${on ? 'ENABLED' : 'disabled'}`);
    } catch (e) {
      console.warn('[Foundry] Failed to toggle day_v2 reads flag', e);
    }
  };
}

// Request persistent storage
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
