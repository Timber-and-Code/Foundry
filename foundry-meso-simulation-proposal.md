# THE FOUNDRY — Meso Simulation Tool Proposal
**Date:** April 3, 2026
**Purpose:** Design a simulation tool that mimics a real user progressing through a full mesocycle, populating localStorage with realistic workout data so all app features can be verified without waiting for real user feedback.

---

## The Problem

Features like 1RM sparklines, volume tracking, weight progression carryover, stalling detection, PR badges, and week completion summaries only become testable after multiple weeks of logged workouts. Currently, the only way to verify these is to either:
- Wait for real users to report issues
- Manually tap through dozens of sets across multiple days/weeks in the UI

Both are slow and error-prone.

---

## The Solution: Meso Simulation Script

A script that programmatically writes realistic workout data directly into localStorage using the exact same key patterns and data shapes the app uses. After running, you open the app and it looks like a real user has been training for weeks.

---

## What Gets Simulated

### 1. Profile & Program
- Seeds a complete profile (name, age, gender, weight, experience, goal, split, equipment, meso length)
- Generates the program using the existing `generateProgram()` function
- Stores to `foundry:profile` and `foundry:storedProgram`

### 2. Workout Sessions (per day, per week)
For each training day across the configured weeks:

| localStorage Key | Data Written |
|-----------------|-------------|
| `foundry:day{d}:week{w}` | Full DayData — weight/reps/RPE per set per exercise |
| `foundry:done:d{d}:w{w}` | `'1'` (marks session complete) |
| `foundry:completedDate:d{d}:w{w}` | Realistic date based on start date + week offset |
| `foundry:sessionStart:d{d}:w{w}` | Timestamp (session start) |
| `foundry:sess:lift:d{d}:w{w}` | Duration in minutes (45-75 min range) |

### 3. Realistic Weight Progression
The simulation models how a real intermediate lifter progresses:

| Exercise Type | Weekly Progression | Example |
|--------------|-------------------|---------|
| Barbell compounds (bench, squat, deadlift) | +5 lbs/week | 185 → 190 → 195 → 200 → 205 → 205 |
| Dumbbell compounds (DB press, rows) | +2.5-5 lbs/week | 50 → 52.5 → 55 → 57.5 → 60 → 60 |
| Cable/machine isolation | +5 lbs/week | 40 → 45 → 50 → 55 → 55 → 55 |
| Bodyweight (pull-ups, dips) | +1-2 reps/week | 8 → 9 → 10 → 11 → 11 → 12 |

### 4. Rep Ranges & RPE
- Compounds: Start at low end of rep range (e.g., 4 reps of 4-6), progress toward top
- Accessories: Start mid-range (e.g., 10 of 8-12), progress toward top
- RPE progresses with RIR targets: Week 1 RPE ~6, Week 5 RPE ~9
- Warmup sets included with appropriate lighter weights

### 5. Readiness Checkins
Seeds `foundry:readiness:{YYYY-MM-DD}` entries:

| Week | Pattern | Score Range |
|------|---------|-------------|
| 1-2 | Mostly good sleep, low soreness, high energy | 4-6 |
| 3-4 | Mixed — some moderate soreness, ok sleep | 3-5 |
| 5-6 | Accumulated fatigue — more "moderate" and occasional "poor" | 2-4 |
| Deload | Recovery — back to good | 5-6 |

### 6. Body Weight Log
Seeds `foundry:bwlog` with weekly weigh-ins:

| Goal | Trend |
|------|-------|
| Build Muscle | +0.3-0.5 lbs/week (175 → 177.5 over 6 weeks) |
| Lose Fat | -0.8-1.2 lbs/week (200 → 194 over 6 weeks) |
| Build Strength | +0.1-0.3 lbs/week (mostly stable) |

### 7. Imperfections (Realistic Edge Cases)
To test error handling and edge case features:

| Scenario | What It Tests |
|----------|--------------|
| **1 missed session** (skip week 3, day 4) | Skipped day handling, partial week completion |
| **Stall on overhead press** (same weight weeks 3-5) | Stalling detection UI, deload suggestion |
| **Rep regression on leg press** (week 5 drops 2 reps) | Regression detection, fatigue signal |
| **1 exercise swap** (swap DB curl for hammer curl in week 3) | Exercise override persistence via `foundry:exov:` |
| **Low readiness day** (poor sleep + high soreness + low energy) | Readiness score < 3, load reduction suggestion |
| **Session notes** on 2-3 sessions | Notes display in history |

---

## Configuration Options

The script should accept a config object so you can customize the simulation:

```javascript
const simConfig = {
  // Profile
  name: 'Test User',
  age: 28,
  gender: 'male',
  weight: 180,
  experience: 'intermediate',
  goal: 'build_muscle',         // 'build_muscle' | 'lose_fat' | 'build_strength' | 'sport_conditioning' | 'improve_fitness'
  splitType: 'ppl',             // 'ppl' | 'upper_lower' | 'full_body' | 'push_pull'
  daysPerWeek: 6,
  mesoLength: 6,                // weeks (not counting deload)
  equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
  sessionDuration: 60,

  // Simulation depth
  simulateWeeks: 4,             // How many weeks to fill (1 to mesoLength)
                                // e.g., 4 = simulate weeks 0-3, play week 4 live

  // Imperfections
  includeStall: true,           // Stall on one compound lift
  includeMissedSession: true,   // Skip one session
  includeRegression: true,      // One lift drops reps
  includeSwap: true,            // One exercise swap mid-meso
  includeLowReadiness: true,    // Seed some bad readiness days
  includeNotes: true,           // Add session notes to a few workouts

  // Starting weights (auto-generated if not provided)
  startingWeights: {
    // Optional overrides — otherwise estimated from experience level
    'bb_flat_bench': 185,
    'bb_back_squat': 225,
    'bb_conventional_deadlift': 275,
    'bb_overhead_press': 115,
  },
};
```

---

## Delivery Options

### Option A: Browser Console Script
A self-contained `.js` file you paste into the browser console (or load via a bookmark). Writes directly to localStorage and reloads the page.

**Pros:** Zero code changes to the app, works on any deployed version
**Cons:** Have to paste it manually each time

### Option B: Dev-Only Settings Button
A "Simulate Meso" button in the Settings page, only visible in development mode (`import.meta.env.DEV`). Opens a config form, runs the simulation, reloads.

**Pros:** Integrated into the app, easy to re-run, config UI
**Cons:** Adds code to the app (even if dev-only)

### Option C: Standalone Test File
A Vitest test file (`src/__tests__/meso-simulation.test.ts`) that populates a mock localStorage and runs assertions against all the feature functions (1RM calc, stalling detection, volume tracking, carryover logic).

**Pros:** Automated, repeatable, catches regressions in CI
**Cons:** Doesn't test the actual UI rendering — only the data/logic layer

### Option D: Hybrid (Recommended)
- **Option C** for automated regression testing of the data layer (1RM formulas, carryover logic, stalling detection, volume calculations)
- **Option B** for visual QA — seed the app with realistic data and manually walk through the UI

---

## What Each Approach Validates

| Feature | Console Script (A) | Settings Button (B) | Test File (C) |
|---------|:------------------:|:-------------------:|:-------------:|
| 1RM sparklines render correctly | Visual | Visual | -- |
| Weight carryover suggests right increment | Visual | Visual | Automated |
| Volume bars show MEV/MAV/MRV progression | Visual | Visual | -- |
| Stalling detection fires at right time | Visual | Visual | Automated |
| PR badges show on session complete | Visual | Visual | Automated |
| Week completion modal stats are accurate | Visual | Visual | Automated |
| Readiness score affects UI recommendations | Visual | Visual | Automated |
| Exercise swap persists across weeks | Visual | Visual | Automated |
| Archive captures full meso data | Visual | Visual | Automated |
| Regression detection UI renders | Visual | Visual | Automated |
| Session notes display in history | Visual | Visual | -- |
| Body weight trend shows on dashboard | Visual | Visual | -- |

---

## Decisions Needed

1. **Which delivery option?** A (console), B (settings button), C (test file), or D (hybrid)?

2. **How many weeks deep?** Full meso simulation, or configurable depth so you can play the remaining weeks live?

3. **Imperfection level?** Should the default include all edge cases (stalls, missed sessions, regressions), or start with clean progression and have imperfections as opt-in toggles?

4. **Multiple profiles?** Should it support simulating different user types (beginner female doing full body 3x/week vs. advanced male doing PPL 6x/week) to test across configurations?

5. **Reset capability?** Should there be a "Clear Simulation" function that wipes all simulated data and returns to a fresh state?

---

## Implementation Estimate

| Component | Scope |
|-----------|-------|
| Core simulation engine (weight/rep generation, localStorage writes) | ~300 LOC |
| Config parsing + validation | ~50 LOC |
| Imperfection injection (stalls, misses, regressions) | ~100 LOC |
| Readiness + body weight seeding | ~50 LOC |
| Settings UI (if Option B) | ~150 LOC |
| Test assertions (if Option C) | ~200 LOC |

---

> **Next step:** Pick your preferred approach and configuration, and I'll build it.
