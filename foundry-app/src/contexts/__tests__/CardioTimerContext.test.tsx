/**
 * Tests for CardioTimerContext (Group D / C1) — count-up tick, target-met
 * fires once, no auto-end, extendByMinutes, endEarly returns elapsed,
 * background-tab restore.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

// Stub the Capacitor haptic dynamic-import path that helpers.haptic uses on
// some platforms. helpers itself is fine in jsdom.
vi.mock('../../utils/helpers', async () => {
  const actual = await vi.importActual<typeof import('../../utils/helpers')>(
    '../../utils/helpers',
  );
  return { ...actual, haptic: vi.fn() };
});

import {
  CardioTimerProvider,
  useCardioTimer,
} from '../CardioTimerContext';

let captured: ReturnType<typeof useCardioTimer> | null = null;

function ContextCapture() {
  captured = useCardioTimer();
  return null;
}

async function mountProvider() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(
      <CardioTimerProvider>
        <ContextCapture />
      </CardioTimerProvider>,
    );
  });
  return {
    cleanup: async () => {
      await act(async () => root?.unmount());
      document.body.removeChild(container);
    },
  };
}

describe('CardioTimerContext', () => {
  let originalAudio: typeof window.AudioContext;
  let oscStartSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    captured = null;
    vi.useFakeTimers();
    // Mock AudioContext so the chime path doesn't blow up + so we can
    // assert it fired at most once per target-met.
    oscStartSpy = vi.fn();
    originalAudio = window.AudioContext;
    class MockAudioContext {
      currentTime = 0;
      destination = {} as AudioDestinationNode;
      createOscillator() {
        return {
          frequency: { value: 0 },
          type: 'sine',
          connect: vi.fn(),
          start: oscStartSpy,
          stop: vi.fn(),
        } as unknown as OscillatorNode;
      }
      createGain() {
        return {
          connect: vi.fn(),
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
        } as unknown as GainNode;
      }
    }
    (window as unknown as { AudioContext: typeof window.AudioContext }).AudioContext =
      MockAudioContext as unknown as typeof window.AudioContext;
  });

  afterEach(() => {
    (window as unknown as { AudioContext: typeof window.AudioContext }).AudioContext = originalAudio;
    vi.useRealTimers();
  });

  it('returns a no-op context when used outside the provider', () => {
    let observed: ReturnType<typeof useCardioTimer> | null = null;
    function BareConsumer() {
      observed = useCardioTimer();
      return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      createRoot(container).render(<BareConsumer />);
    });
    expect(observed).not.toBeNull();
    expect(observed!.isActive).toBe(false);
    document.body.removeChild(container);
  });

  it('start sets initial state', async () => {
    const { cleanup } = await mountProvider();
    await act(async () => {
      captured!.startCardio({ protocolId: 'zone2_run', targetSeconds: 60 });
    });
    expect(captured!.isActive).toBe(true);
    expect(captured!.protocolId).toBe('zone2_run');
    expect(captured!.targetSeconds).toBe(60);
    expect(captured!.elapsedSeconds).toBe(0);
    expect(captured!.isComplete).toBe(false);
    await cleanup();
  });

  it('counts up over time (tick uses wall-clock not counter)', async () => {
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'));
    const { cleanup } = await mountProvider();
    await act(async () => {
      captured!.startCardio({ protocolId: 'p', targetSeconds: null });
    });
    // advanceTimersByTime advances vitest's fake clock AND fires interval
    // callbacks — Date.now() inside recompute() reads off the same mocked
    // clock so we don't need a separate setSystemTime here.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(captured!.elapsedSeconds).toBe(5);
    expect(captured!.isComplete).toBe(false);
    await cleanup();
  });

  it('fires complete + chime ONCE when target is hit, does not auto-end', async () => {
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'));
    const { cleanup } = await mountProvider();
    await act(async () => {
      captured!.startCardio({ protocolId: 'p', targetSeconds: 3 });
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(captured!.elapsedSeconds).toBe(3);
    expect(captured!.isComplete).toBe(true);
    expect(captured!.isActive).toBe(true);          // not auto-ended
    // The completion chime is a two-note rising tone, so one chime is
    // multiple osc.start() calls. Snapshot the count, then assert it does
    // not change — i.e. the chime fired exactly once.
    const startsAfterChime = oscStartSpy.mock.calls.length;
    expect(startsAfterChime).toBeGreaterThan(0);
    // Keep ticking — chime must NOT fire again.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(captured!.elapsedSeconds).toBe(8);
    expect(captured!.isActive).toBe(true);
    expect(oscStartSpy).toHaveBeenCalledTimes(startsAfterChime);
    await cleanup();
  });

  it('extendByMinutes pushes target out and clears isComplete when below new target', async () => {
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'));
    const { cleanup } = await mountProvider();
    await act(async () => {
      captured!.startCardio({ protocolId: 'p', targetSeconds: 60 });
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(captured!.isComplete).toBe(true);
    const startsAfterFirstChime = oscStartSpy.mock.calls.length;
    expect(startsAfterFirstChime).toBeGreaterThan(0);
    await act(async () => {
      captured!.extendByMinutes(2);
    });
    expect(captured!.targetSeconds).toBe(60 + 120);
    expect(captured!.isComplete).toBe(false);
    // Chime fires again at the new target.
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(captured!.isComplete).toBe(true);
    expect(oscStartSpy.mock.calls.length).toBeGreaterThan(startsAfterFirstChime);
    await cleanup();
  });

  it('endEarly returns the actual elapsed seconds and tears down', async () => {
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'));
    const { cleanup } = await mountProvider();
    await act(async () => {
      captured!.startCardio({ protocolId: 'p', targetSeconds: 600 });
    });
    // Don't fire the 1Hz tick — we want to confirm endEarly itself is the
    // path that recomputes elapsed from wall-clock, not the interval.
    await act(async () => {
      vi.setSystemTime(new Date('2026-05-05T12:00:42Z'));
    });
    let returned = 0;
    await act(async () => {
      returned = captured!.endEarly();
    });
    expect(returned).toBe(42);
    expect(captured!.isActive).toBe(false);
    expect(captured!.protocolId).toBeNull();
    await cleanup();
  });

  it('complete returns final elapsed and tears down', async () => {
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'));
    const { cleanup } = await mountProvider();
    await act(async () => {
      captured!.startCardio({ protocolId: 'p', targetSeconds: 30 });
    });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    let returned = 0;
    await act(async () => {
      returned = captured!.complete();
    });
    expect(returned).toBe(30);
    expect(captured!.isActive).toBe(false);
    await cleanup();
  });

  it('background-tab restore: visibilitychange recomputes elapsed from wall-clock', async () => {
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'));
    const { cleanup } = await mountProvider();
    await act(async () => {
      captured!.startCardio({ protocolId: 'p', targetSeconds: null });
    });
    expect(captured!.elapsedSeconds).toBe(0);
    // Simulate tab going to background, then resurfacing 90s later via
    // pure setSystemTime (no interval ticks fire). The visibilitychange
    // recompute path must catch up on its own.
    await act(async () => {
      vi.setSystemTime(new Date('2026-05-05T12:01:30Z'));
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(captured!.elapsedSeconds).toBe(90);
    await cleanup();
  });
});
