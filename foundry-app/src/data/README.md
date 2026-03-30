# Foundry Data Module

This directory contains extracted data from the monolithic Foundry HTML file, converted to ES6 modules for use in a Vite+React application.

## Files

### exercises.js
Contains the complete exercise database with all movement definitions.

**Export:** `EXERCISE_DB` (Array)
- 187 individual exercise objects
- Schema per exercise:
  - `id`: unique string identifier
  - `name`: display name
  - `muscle`: primary muscle label
  - `muscles`: array of muscle groups targeted
  - `tag`: movement category (PUSH, PULL, LEGS, CORE, CARDIO)
  - `equipment`: barbell, dumbbell, cable, machine, bodyweight, kettlebell, band
  - `pattern`: push, pull, hinge, squat, isolation, carry
  - `fatigue`: high, medium, or low
  - `anchor`: boolean - can be primary lift for session
  - `diff`: difficulty 1 (beginner) to 3 (advanced)
  - `sets`: default working sets
  - `reps`: default rep range (string)
  - `rest`: default rest period
  - `warmup`: warmup protocol note
  - `description`: detailed form and technique cues
  - `splits`: compatible split types (ppl, upper, full, upper_lower, etc.)
  - `videoUrl`: link to form reference video

### constants.js
Configuration objects, color maps, and training templates.

**Color Maps:**
- `PHASE_COLOR`: Training phases → hex colors (Accumulation, Intensification, Peak, Deload)
- `TAG_ACCENT`: Movement tags → hex colors (PUSH, PULL, LEGS, UPPER, LOWER, FULL, CARDIO)
- `DAY_COLORS`: Array of 4 rotating day colors

**Configuration Objects:**
- `VOLUME_LANDMARKS`: Weekly set targets per muscle group (mev, mavLow, mavHigh, mrv)
- `WARMUP`: Standard 4-step progressive loading protocol
- `FOUNDRY_MOBILITY`: Tag-based mobility routines (PUSH, PULL, LEGS)
- `DAILY_MOBILITY`: 5 neutral mobility moves for any day

**Data Arrays:**
- `GOAL_OPTIONS`: 5 training goal profiles with descriptions
- `CARDIO_WORKOUTS`: 7 pre-built cardio templates (easy walk, zone2, tempo, HIIT, etc.)
- `MOBILITY_PROTOCOLS`: 4 structured longer mobility routines

## Usage

```javascript
import { EXERCISE_DB } from './data/exercises.js';
import {
  PHASE_COLOR,
  TAG_ACCENT,
  VOLUME_LANDMARKS,
  DAY_COLORS,
  WARMUP,
  FOUNDRY_MOBILITY,
  DAILY_MOBILITY,
  GOAL_OPTIONS,
  CARDIO_WORKOUTS,
  MOBILITY_PROTOCOLS,
} from './data/constants.js';

// Find an exercise
const benchPress = EXERCISE_DB.find(ex => ex.id === 'bb_flat_bench');

// Get color for a phase
const peakColor = PHASE_COLOR.Peak; // "#D4983C"

// Get training goals
const muscleGoal = GOAL_OPTIONS.find(g => g.id === 'build_muscle');

// Get mobility moves for a tag
const pushMobility = FOUNDRY_MOBILITY.PUSH;

// Get volume targets for a muscle
const chestTargets = VOLUME_LANDMARKS.Chest;
```

## Source

All data extracted from: `/mnt/Foundry/Foundry_1_35_0.html`
- EXERCISE_DB: lines 279–2845 (2,567 lines)
- Constants: lines 4168–4530 (scattered throughout script tag)

## Migration Notes

- Removed buildMesoConfig function (kept as function in main app)
- CARDIO_WORKOUTS replaces CARDIO_TEMPLATES
- MOBILITY_PROTOCOLS replaces MOBILITY_ROUTINES
- All const declarations converted to ES6 named exports
- Ready for tree-shaking and code splitting
