# Morning Kickoff — 2026-04-08

## Task: Deep Code Review v8 + Feature Audit + Cardio Rethink

Work from: `C:\Users\TIMBE\Documents\AI PROJECT\Foundry`

### Phase 1: Deep Code Review v8

Run a comprehensive code review of the entire Foundry codebase. Compare findings against all prior reviews:
- `foundry-code-review-v4-final.md`
- `foundry-code-review-v5.md`
- `foundry-code-review-v6.md`
- `foundry-code-review-v7.md`

Focus areas:
- Has anything regressed since the last review?
- What items were flagged previously but never addressed?
- New code quality issues introduced by recent features (Train with Friends, workout completion flow, exercise accordion, sync overhauls)
- Performance concerns (bundle size, unnecessary re-renders, sync chattiness)
- Security: RLS coverage, auth edge cases, input validation
- Error handling: are sync failures surfaced properly? Any silent swallows?
- TypeScript: remaining `:any` hotspots, type safety gaps
- Accessibility: WCAG compliance, touch targets, screen reader support

Score it like prior reviews and produce `foundry-code-review-v8.md`.

### Phase 2: Feature Audit

Look at Foundry as a product, not just code. Compare against competitor fitness apps (Strong, Hevy, JEFIT, RP Hypertrophy, MacroFactor). Ask:
- What features do we have that they don't? (Our differentiators)
- What features do they all have that we're missing? (Table stakes gaps)
- What would make the biggest user impact for the least engineering effort?
- Are there quick wins hiding in existing code that just need polish or exposure?

Produce a prioritized feature gap analysis in the review doc.

### Phase 3: Cardio Deep Dive

The cardio system (CardioSessionView, CardioSetup, cardio protocols, cardio sync) feels like it could be set up better. Do a deep analysis:
- How does the cardio flow currently work end-to-end? (Setup → session → logging → history)
- What's the UX like? Is it intuitive for a user who wants to add cardio to their lifting?
- How does it integrate with the rest of the app? (DayView, workout completion, weekly schedule)
- What do competing apps do for cardio that we don't?
- Concrete recommendations: restructure, simplify, or expand?

Include the cardio analysis as a dedicated section in the review doc.

### Phase 4: Apple Health + Google Health Connect Integration Plan

Foundry is a PWA today but will go native via Capacitor. Plan the integration with both health platforms:

**Apple Health (HealthKit)**
- What data should Foundry WRITE? (workouts, exercise minutes, weight lifted, body weight, active calories)
- What data should Foundry READ? (body weight, resting heart rate, sleep, active energy — for readiness checks)
- How does HealthKit work with Capacitor? (plugins, permissions, background sync)
- Privacy/permission UX — what does the prompt flow look like?

**Google Health Connect (formerly Google Fit)**
- Same read/write mapping as Apple Health
- How does Health Connect work with Capacitor? (plugins, API differences from HealthKit)
- Android-specific gotchas (permissions model, background restrictions)

**Architecture**
- Abstraction layer so the app code doesn't care which platform it's on
- When to sync (after workout completion? on app open? background?)
- Offline handling — queue health writes like we queue Supabase writes?
- What's the MVP vs full integration?
- Estimated effort and dependencies

Include the health integration plan as a dedicated section in the review doc.

### Output

Single file: `foundry-code-review-v8.md` in the project root, covering all four phases.
