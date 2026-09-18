import { describe, it, expect } from 'vitest';
import { describeHealthState } from '../health/describeHealthState';
import type { HealthAccessStatus } from '../health/types';

function access(over: Partial<HealthAccessStatus> = {}): HealthAccessStatus {
  return {
    available: true,
    weight: 'authorized',
    workouts: 'authorized',
    activeEnergy: 'authorized',
    needsPrompt: false,
    ...over,
  };
}

describe('describeHealthState', () => {
  it('is OFF, and a tap asks for permission, while disabled', () => {
    const v = describeHealthState(false, access());
    expect(v.status).toBe('OFF');
    expect(v.tapRequests).toBe(true);
  });

  it('is ON only when bodyweight and workouts are both shared', () => {
    const v = describeHealthState(true, access());
    expect(v.status).toBe('ON');
    expect(v.tapRequests).toBe(false); // a tap turns it off
  });

  it('asks to finish setup — not green ON — when workouts were never requested', () => {
    // The shipped bug: this state read "ON" and pointed at an iOS Settings
    // switch that does not exist for a never-requested type.
    const v = describeHealthState(
      true,
      access({ workouts: 'notDetermined', activeEnergy: 'notDetermined', needsPrompt: true }),
    );
    expect(v.status).toBe('SET UP');
    expect(v.tapRequests).toBe(true);
  });

  it('points to the Health app when workouts were refused', () => {
    const v = describeHealthState(true, access({ workouts: 'denied', activeEnergy: 'denied' }));
    expect(v.status).toBe('PARTIAL');
    expect(v.subtitle).toContain('Workouts are off');
    expect(v.subtitle).toContain('Health app');
    expect(v.tapRequests).toBe(false);
  });

  it('flags bodyweight when only workouts are shared', () => {
    const v = describeHealthState(true, access({ weight: 'denied' }));
    expect(v.status).toBe('PARTIAL');
    expect(v.subtitle).toContain('Bodyweight is off');
  });

  it('is PAUSED when everything was refused', () => {
    const v = describeHealthState(
      true,
      access({ weight: 'denied', workouts: 'denied', activeEnergy: 'denied' }),
    );
    expect(v.status).toBe('PAUSED');
  });

  it('does not claim anything before the status has loaded', () => {
    const v = describeHealthState(true, null);
    expect(v.subtitle).toMatch(/Checking/);
    expect(v.tapRequests).toBe(false);
  });
});
