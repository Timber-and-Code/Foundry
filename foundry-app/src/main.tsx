import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './styles/theme.css';
import './styles/global.css';
import { _setMarkDirty } from './utils/storage';
import { markDirty, flushDirty } from './utils/sync';

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

// Request persistent storage
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
