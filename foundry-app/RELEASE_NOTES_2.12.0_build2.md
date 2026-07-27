# The Foundry 2.12.0 (build 2)

One fix since build 1. Cut 2026-07-27.

## What to Test

**Mid-workout navigation (the real fix this time)**
- Start a workout. The ← Back button, SESSION timer, and STOP button must be visible in a bar directly under THE FOUNDRY banner — immediately on entering the workout, and while scrolling the exercise list.
- Minimize the rest timer — the REST countdown chip appears in the same bar; tapping it re-expands the timer.
- Build 1's fix still hid the bar on real iPhones. The bar is no longer positioned with assumed banner geometry (hard-coded height + safe-area math); it now pins to the banner's measured on-screen edge, so it lands correctly on any device.

Everything else is identical to build 1 — its test list still applies if unverified.
