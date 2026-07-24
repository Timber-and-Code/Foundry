/**
 * playTimerCompleteChime — iOS interruption handling.
 *
 * WKWebView parks the AudioContext in 'interrupted' (WebKit-only state)
 * after screen lock / phone call / backgrounding; scheduling oscillators
 * against a non-running context is a silent no-op. The chime must:
 *  - play immediately on a running context
 *  - resume-then-play on suspended/interrupted contexts
 *  - rebuild the context once when the old session is dead
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../helpers', () => ({ haptic: vi.fn() }));

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state = 'running';
  currentTime = 0;
  resumeImpl: () => Promise<void> = async () => {
    this.state = 'running';
  };
  started: number[] = [];
  constructor() {
    MockAudioContext.instances.push(this);
  }
  resume() {
    return this.resumeImpl();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  createOscillator() {
    const self = this;
    return {
      connect: vi.fn(),
      frequency: { value: 0 },
      type: 'sine',
      start: (t: number) => self.started.push(t),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    };
  }
}

async function freshAudioModule() {
  vi.resetModules();
  MockAudioContext.instances = [];
  (window as unknown as { AudioContext: unknown }).AudioContext =
    MockAudioContext as unknown as typeof AudioContext;
  return await import('../audio');
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('playTimerCompleteChime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules both notes immediately on a running context', async () => {
    const audio = await freshAudioModule();
    audio.playTimerCompleteChime();
    expect(MockAudioContext.instances).toHaveLength(1);
    expect(MockAudioContext.instances[0].started).toHaveLength(2);
  });

  it("resumes an 'interrupted' context BEFORE scheduling (screen-lock case)", async () => {
    const audio = await freshAudioModule();
    audio.unlockAudio(); // create the ctx
    const ctx = MockAudioContext.instances[0];
    ctx.state = 'interrupted';
    audio.playTimerCompleteChime();
    // Nothing scheduled synchronously against the frozen clock…
    expect(ctx.started).toHaveLength(0);
    await flush();
    // …but after resume() settles the notes play.
    expect(ctx.state).toBe('running');
    expect(ctx.started).toHaveLength(2);
  });

  it('rebuilds the context when resume fails (dead audio session)', async () => {
    const audio = await freshAudioModule();
    audio.unlockAudio();
    const dead = MockAudioContext.instances[0];
    dead.state = 'interrupted';
    dead.resumeImpl = () => Promise.reject(new Error('session gone'));
    audio.playTimerCompleteChime();
    await flush();
    await flush();
    // Fresh context created; chime scheduled there, not on the dead one.
    expect(MockAudioContext.instances).toHaveLength(2);
    expect(dead.started).toHaveLength(0);
    expect(MockAudioContext.instances[1].started).toHaveLength(2);
  });

  it('unlockAudio recreates a closed context', async () => {
    const audio = await freshAudioModule();
    audio.unlockAudio();
    MockAudioContext.instances[0].state = 'closed';
    audio.unlockAudio();
    expect(MockAudioContext.instances).toHaveLength(2);
  });
});
