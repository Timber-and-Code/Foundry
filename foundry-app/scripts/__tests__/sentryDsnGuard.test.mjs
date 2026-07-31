import { describe, it, expect, afterEach } from 'vitest';
import { describeDsnProblem, sentryDsnGuard, BYPASS_ENV_VAR } from '../sentry-dsn-guard.mjs';

const VALID = 'https://80b4452be93b05273c1ba33abd25ccdf@o4511175706083328.ingest.us.sentry.io/4511175713947648';

describe('describeDsnProblem', () => {
  it('accepts a real DSN', () => {
    expect(describeDsnProblem(VALID)).toBeNull();
  });

  it('accepts a self-hosted / non-us-region host', () => {
    expect(describeDsnProblem('https://abc123@sentry.example.com/42')).toBeNull();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
  ])('rejects %s as not set', (_label, value) => {
    expect(describeDsnProblem(value)).toBe('not set');
  });

  it('rejects the .env.example placeholder', () => {
    // .env.example ships `VITE_SENTRY_DSN=your_sentry_dsn`; copying that file
    // verbatim must not read as a configured DSN.
    expect(describeDsnProblem('your_sentry_dsn')).toMatch(/not a Sentry DSN/);
  });

  it('rejects a DSN with an embedded line break', () => {
    // The Supabase anon key incident: a credential pasted into the Cloudflare
    // build command with line breaks in the middle of it.
    const broken = VALID.replace('@', '\n   @');
    expect(describeDsnProblem(broken)).toMatch(/whitespace/);
  });

  it('rejects surrounding whitespace rather than trimming it', () => {
    expect(describeDsnProblem(` ${VALID} `)).toMatch(/whitespace/);
  });

  it('rejects a DSN missing the project id', () => {
    expect(describeDsnProblem('https://abc123@o1.ingest.us.sentry.io/')).toMatch(/not a Sentry DSN/);
  });

  it('rejects a DSN missing the public key', () => {
    expect(describeDsnProblem('https://o1.ingest.us.sentry.io/42')).toMatch(/not a Sentry DSN/);
  });

  it('rejects a non-string', () => {
    expect(describeDsnProblem(42)).toMatch(/not a string/);
  });
});

describe('sentryDsnGuard plugin', () => {
  const originalBypass = process.env[BYPASS_ENV_VAR];
  afterEach(() => {
    if (originalBypass === undefined) delete process.env[BYPASS_ENV_VAR];
    else process.env[BYPASS_ENV_VAR] = originalBypass;
  });

  const warnings = [];
  const configFor = (dsn, isProduction = true) => ({
    isProduction,
    env: dsn === undefined ? {} : { VITE_SENTRY_DSN: dsn },
    logger: { warn: (m) => warnings.push(m) },
  });

  it('only applies to builds, so dev servers are untouched', () => {
    expect(sentryDsnGuard().apply).toBe('build');
  });

  it('passes a production build with a valid DSN', () => {
    expect(() => sentryDsnGuard().configResolved(configFor(VALID))).not.toThrow();
  });

  it('fails a production build with no DSN', () => {
    expect(() => sentryDsnGuard().configResolved(configFor(undefined))).toThrow(
      /VITE_SENTRY_DSN not set/
    );
  });

  it('fails a production build with a malformed DSN', () => {
    expect(() => sentryDsnGuard().configResolved(configFor('your_sentry_dsn'))).toThrow(
      /not a Sentry DSN/
    );
  });

  it('ignores a non-production build even with no DSN', () => {
    // `main.tsx` gates Sentry on import.meta.env.PROD, so a dev/test bundle
    // without a DSN is correct, not broken.
    expect(() => sentryDsnGuard().configResolved(configFor(undefined, false))).not.toThrow();
  });

  it('downgrades to a warning when the bypass is set', () => {
    process.env[BYPASS_ENV_VAR] = '1';
    warnings.length = 0;
    expect(() => sentryDsnGuard().configResolved(configFor(undefined))).not.toThrow();
    expect(warnings.join('\n')).toMatch(/NO errors and NO telemetry/);
  });

  it('does not accept an arbitrary truthy bypass value', () => {
    process.env[BYPASS_ENV_VAR] = 'true';
    expect(() => sentryDsnGuard().configResolved(configFor(undefined))).toThrow();
  });
});
