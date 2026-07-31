// Build-time guard for VITE_SENTRY_DSN.
//
// `Sentry.init({ dsn: undefined })` does not throw and does not warn — the SDK
// just silently no-ops. The instrumentation code still ships in the bundle, so
// grepping for marker strings finds them and everything *looks* wired. On
// 2026-07-31 that cost a full week of the Big-Big Phase 4 `day_v2` soak: every
// TestFlight build had been shipping with no DSN because the Mac's .env only
// carried the two Supabase vars, so "zero fallback events" measured web traffic
// only. .env is gitignored, so the gap is per-machine and invisible to git.
//
// The DSN is a public write-only key that ships in the JS bundle, so there is
// nothing secret to protect here — the only failure mode is absence.

/** Shape of a Sentry DSN: https://<publicKey>@<host>/<projectId> */
const DSN_SHAPE = /^https:\/\/[^:@/\s]+@[^/\s]+\/\d+$/;

/**
 * Describe why `dsn` is unusable, or return null when it looks valid.
 *
 * Whitespace is rejected rather than trimmed on purpose: the same
 * inline-vars-in-the-build-command setup that feeds this value once shipped a
 * Supabase anon key with line breaks pasted into the middle of it, which 401'd
 * every auth call in production for days. A credential that arrives with
 * whitespace in it is a paste accident, not something to quietly repair.
 *
 * @param {string | undefined} dsn
 * @returns {string | null}
 */
export function describeDsnProblem(dsn) {
  if (dsn === undefined || dsn === null || dsn === '') {
    return 'not set';
  }
  if (typeof dsn !== 'string') {
    return `not a string (got ${typeof dsn})`;
  }
  if (dsn !== dsn.trim() || /\s/.test(dsn)) {
    return 'contains whitespace — likely pasted with a line break';
  }
  if (!DSN_SHAPE.test(dsn)) {
    return `not a Sentry DSN (expected https://<key>@<host>/<projectId>, got "${dsn}")`;
  }
  return null;
}

export const BYPASS_ENV_VAR = 'ALLOW_MISSING_SENTRY_DSN';

/**
 * Vite plugin: fail production builds that would ship without working Sentry.
 *
 * Scoped to `apply: 'build'` + `isProduction` so dev servers and test runs are
 * untouched — `main.tsx` gates Sentry on `import.meta.env.PROD` anyway, so a
 * missing DSN is only a real defect for a production bundle.
 *
 * Reads the DSN off Vite's own resolved `config.env` rather than `process.env`,
 * so it sees exactly what gets inlined into the bundle no matter which layer
 * supplied it: a local `.env` file (native iOS/Android builds) or inline vars
 * on the build command (Cloudflare Pages).
 *
 * Escape hatch: set ALLOW_MISSING_SENTRY_DSN=1 to downgrade to a warning, for
 * a machine that legitimately has no DSN yet and just needs a bundle out.
 */
export function sentryDsnGuard() {
  return {
    name: 'foundry-sentry-dsn-guard',
    apply: 'build',
    configResolved(config) {
      if (!config.isProduction) return;

      const dsn = config.env?.VITE_SENTRY_DSN;
      const problem = describeDsnProblem(dsn);
      if (!problem) return;

      if (process.env[BYPASS_ENV_VAR] === '1') {
        config.logger.warn(
          `\n[foundry] WARNING: VITE_SENTRY_DSN ${problem}. Building anyway ` +
            `because ${BYPASS_ENV_VAR}=1.\n` +
            `[foundry] This bundle will report NO errors and NO telemetry.\n`
        );
        return;
      }

      throw new Error(
        `\n\nVITE_SENTRY_DSN ${problem}.\n\n` +
          `A production bundle built without it silently reports nothing — ` +
          `Sentry.init() no-ops, with no error and no warning.\n\n` +
          `Fix: add VITE_SENTRY_DSN to foundry-app/.env on this machine ` +
          `(gitignored, so every build machine needs its own copy).\n` +
          `The DSN is public — copy it out of a deployed bundle, or from the ` +
          `Cloudflare Pages build command.\n\n` +
          `To build anyway without telemetry: ${BYPASS_ENV_VAR}=1 npm run build\n`
      );
    },
  };
}
