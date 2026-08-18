import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { App } from './app';
import './styles/index.css';

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|authorization|cookie|apikey|api[-_]?key|email|jwt|session)/i;
const SENSITIVE_VALUE_PATTERN = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;

function scrubValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return '[REDACTED]';
  if (typeof value === 'string' && SENSITIVE_VALUE_PATTERN.test(value)) return '[REDACTED]';
  return value;
}

function scrub(entry: unknown, key = ''): unknown {
  if (Array.isArray(entry)) return entry.map((item) => scrub(item, key));
  if (entry && typeof entry === 'object') {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(entry)) {
      out[childKey] = scrub(childValue, childKey);
    }
    return out;
  }
  return scrubValue(key, entry);
}

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    beforeSend(event) {
      return scrub(event) as Sentry.ErrorEvent;
    },
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
