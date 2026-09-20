/**
 * In-progress setup survives an iOS web-view reload — but must never leak
 * into a different kind of setup, a different meso, or come back days later.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadSetupSession, saveSetupSession, clearSetupSession } from '../setupSession';
import { wipeMesoSessionData } from '../storage';

describe('setupSession', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('foundry:active_meso_id', 'meso-1');
  });
  afterEach(() => vi.useRealTimers());

  it('round-trips state for the same mode', () => {
    saveSetupSession('after-meso', { pathMode: 'auto', autoForm: { split: 'upper_lower' } });
    expect(loadSetupSession('after-meso')?.state).toEqual({ pathMode: 'auto', autoForm: { split: 'upper_lower' } });
  });

  it('is not offered to a different kind of setup', () => {
    saveSetupSession('plan-next', { pathMode: 'manual' });
    expect(loadSetupSession('after-meso')).toBeNull();
    expect(loadSetupSession('new')).toBeNull();
  });

  it('is ignored once the meso underneath has changed', () => {
    saveSetupSession('plan-next', { pathMode: 'auto' });
    localStorage.setItem('foundry:active_meso_id', 'meso-2');
    expect(loadSetupSession('plan-next')).toBeNull();
  });

  it('expires after three days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T12:00:00Z'));
    saveSetupSession('after-meso', { pathMode: 'auto' });
    vi.setSystemTime(new Date('2026-09-21T11:00:00Z'));
    expect(loadSetupSession('after-meso')).not.toBeNull();
    vi.setSystemTime(new Date('2026-09-21T13:00:00Z'));
    expect(loadSetupSession('after-meso')).toBeNull();
  });

  it('is cleared explicitly, and dropped when the meso ends', () => {
    saveSetupSession('after-meso', { pathMode: 'auto' });
    clearSetupSession();
    expect(loadSetupSession('after-meso')).toBeNull();
    saveSetupSession('after-meso', { pathMode: 'auto' });
    wipeMesoSessionData();
    expect(localStorage.getItem('foundry:setup_session')).toBeNull();
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('foundry:setup_session', '{not json');
    expect(loadSetupSession('new')).toBeNull();
  });
});
