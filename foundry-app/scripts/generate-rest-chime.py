#!/usr/bin/env python3
"""
Generate the rest-complete two-note chime as a 16-bit PCM WAV file.

Matches the in-app WebAudio chime in src/utils/audio.ts:
  - G5 (784 Hz) at  t = 0.00s, duration 0.42s
  - C6 (1047 Hz) at t = 0.34s, duration 0.60s   (overlaps tail of G5)

Per-note envelope (mirrors gain.exponentialRampToValueAtTime in audio.ts):
  - 0.0001 at note start
  - 0.55 at start + 0.02s   (fast attack)
  - 0.0001 at start + dur   (exponential decay)

Output: a mono 44.1 kHz, 16-bit WAV file ~1 second long.

Drops two copies:
  - ios/App/App/rest-complete.wav        (Capacitor iOS bundles from here)
  - android/app/src/main/res/raw/rest_complete.wav
    (Android raw resource — lowercase + underscores, no dashes)

Run once:
  cd foundry-app && python3 scripts/generate-rest-chime.py

The output files are platform binaries; iOS lives under the gitignored
ios/ tree, Android under the gitignored android/ tree. Re-run after any
cap sync that wipes them.
"""
import math
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 44_100
DURATION_SEC = 1.0
TOTAL_SAMPLES = int(SAMPLE_RATE * DURATION_SEC)

NOTES = [
    {"freq": 784.0,  "start": 0.00, "dur": 0.42},   # G5
    {"freq": 1047.0, "start": 0.34, "dur": 0.60},   # C6
]

ATTACK_SEC = 0.02
PEAK_GAIN = 0.55
FLOOR_GAIN = 1e-4


def envelope(t: float, start: float, dur: float) -> float:
    """Exponential attack to PEAK_GAIN at start+ATTACK, exponential decay
    to FLOOR_GAIN at start+dur. Outside the note window: silence."""
    if t < start or t > start + dur:
        return 0.0
    rel = t - start
    if rel < ATTACK_SEC:
        # Exponential ramp FLOOR_GAIN → PEAK_GAIN
        ratio = rel / ATTACK_SEC
        return FLOOR_GAIN * (PEAK_GAIN / FLOOR_GAIN) ** ratio
    # Exponential decay PEAK_GAIN → FLOOR_GAIN
    rel_decay = rel - ATTACK_SEC
    decay_dur = dur - ATTACK_SEC
    ratio = rel_decay / decay_dur if decay_dur > 0 else 1.0
    return PEAK_GAIN * (FLOOR_GAIN / PEAK_GAIN) ** ratio


def synthesize() -> bytes:
    pcm = bytearray()
    for i in range(TOTAL_SAMPLES):
        t = i / SAMPLE_RATE
        sample = 0.0
        for n in NOTES:
            g = envelope(t, n["start"], n["dur"])
            if g <= 0.0:
                continue
            sample += g * math.sin(2.0 * math.pi * n["freq"] * t)
        # Soft-clip to [-1, 1] (two overlapping notes can exceed 1.0 briefly)
        if sample > 1.0:
            sample = 1.0
        elif sample < -1.0:
            sample = -1.0
        # 16-bit signed PCM
        s16 = int(sample * 32_767)
        pcm += struct.pack("<h", s16)
    return bytes(pcm)


def write_wav(path: Path, pcm: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)        # 16-bit
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    pcm = synthesize()
    targets = [
        root / "ios" / "App" / "App" / "rest-complete.wav",
        root / "android" / "app" / "src" / "main" / "res" / "raw" / "rest_complete.wav",
    ]
    for target in targets:
        write_wav(target, pcm)
        size = target.stat().st_size
        print(f"  wrote {target.relative_to(root)} ({size:,} bytes)")
    print(f"Done. {len(pcm):,} PCM bytes per file, ~{DURATION_SEC:.1f}s @ {SAMPLE_RATE} Hz.")


if __name__ == "__main__":
    main()
