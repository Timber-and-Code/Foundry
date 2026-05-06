import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './styles/theme.css';
import './styles/global.css';
import { _setMarkDirty } from './utils/storage';
import { markDirty, flushDirty } from './utils/sync';
import { preloadExerciseDB } from './data/exerciseDB';

// Start loading the exercise DB immediately — it'll be ready by the time
// components need it (~200ms), but won't block the critical render path.
preloadExerciseDB();

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

// Dev-only console toggle for the Big-Big Phase 1 v2 dual-write feature
// flag. The flag lives in localStorage so it survives reloads but stays
// scoped per-device. Flip via:
//   __foundryEnableDayV2Writes(true)   // turn dual-write on
//   __foundryEnableDayV2Writes(false)  // turn it off
if (import.meta.env.DEV) {
  (window as unknown as { __foundryEnableDayV2Writes?: (on: boolean) => void })
    .__foundryEnableDayV2Writes = (on: boolean) => {
    try {
      localStorage.setItem('foundry:flag:day_v2_writes', on ? '1' : '0');
      console.log(`[Foundry] day_v2 dual-writes ${on ? 'ENABLED' : 'disabled'}`);
    } catch (e) {
      console.warn('[Foundry] Failed to toggle day_v2 flag', e);
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
