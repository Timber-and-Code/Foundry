# Foundry Utility Modules

Four cleanly extracted ES modules for the Foundry training app. All localStorage operations, training logic, program generation, and AI API calls.

## Files

### store.js
localStorage wrapper and session data persistence.

```javascript
import { store, loadDayWeek, saveDayWeek, exportData, importData } from './utils/store.js';

// Store wrapper
store.get('ppl:profile')
store.set('ppl:currentWeek', '3')

// Training data
loadDayWeek(dayIdx, weekIdx)  // => { 0: { 0: { weight: 185, reps: 8 }, ... }, ... }
saveDayWeek(dayIdx, weekIdx, data)

// Smart carry-over with progression
loadDayWeekWithCarryover(dayIdx, weekIdx, day, profile)
// Returns weighted suggestions: nudged up weight + adjusted reps per experience level

// Backup
exportData()  // Download JSON
importData(file, onDone)  // Restore from backup
snapshotData()  // Auto-rotate 3 snapshots in localStorage
```

### training.js
Training logic: warmup generation, progression, phase management, tracking.

```javascript
import {
  getWeekSets, generateWarmupSteps, getWarmupDetail,
  shuffle, loadProfile, markComplete, loadSparklineData
} from './utils/training.js';

// Phase-aware set adjustment
getWeekSets(5, weekIdx, 6)  // => 4 sets (adjust by phase)

// Warmup protocols
const steps = generateWarmupSteps(exercise, workingWeight)
// => [{ label: "Bar only (0%)", reps: "10 reps", detail: "..." }, ...]

const detail = getWarmupDetail("Full protocol", "Squat")
// => { title: "Full Ramp Protocol", rationale: "...", steps: [...] }

// Session tracking
markComplete(dayIdx, weekIdx)  // Stamp completed + date
loadSparklineData(dayIdx, exIdx, mesoWeeks)  // => historical points for chart

// Utilities
shuffle([1,2,3,4,5])  // => randomized array
```

### program.js
Program generation for all split types.

```javascript
import { generateProgram } from './utils/program.js';

const profile = {
  equipment: ['barbell', 'dumbbell', 'cable'],
  experience: 'intermediate',
  splitType: 'ppl',
  daysPerWeek: 6,
  sessionDuration: 60,
};

const days = generateProgram(profile, EXERCISE_DB);
// => [
//   {
//     dayNum: 1, label: "Push Day 1", tag: "PUSH",
//     exercises: [
//       { id: 'bp', name: 'Bench Press', anchor: true, sets: 4, reps: '4-6', ... },
//       { id: 'inc', name: 'Incline DB Press', anchor: false, sets: 3, reps: '8-10', ... }
//     ]
//   },
//   ...
// ]
```

**Supported splits:**
- `ppl` - Push/Pull/Legs (3, 5, 6 days)
- `upper_lower` - Upper/Lower (2, 4 days)
- `full_body` - Full Body (2, 3 days)
- `push_pull` - Push/Pull (4 days)

### api.js
AI program generation via Cloudflare Worker.

```javascript
import { callFoundryAI } from './utils/api.js';

const result = await callFoundryAI({
  split: 'ppl',
  daysPerWeek: 6,
  mesoLength: 6,
  experience: 'intermediate',
  equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
  name: 'Alex',
  goal: 'build_muscle',
  goalNote: 'Focus on chest and back',
}, EXERCISE_DB);

// => { days: [...], coachNote: "..." }
```

**Environment variables required:**
```
VITE_FOUNDRY_AI_WORKER_URL=https://foundry-ai.your-domain.workers.dev
VITE_FOUNDRY_APP_KEY=your-api-key-here
```

## Usage Notes

### Dependencies
These modules assume:
- `EXERCISE_DB`: Global array of exercise definitions
- `localStorage`: Browser storage (silently fails with error handling)
- `fetch`: For API calls

### Cross-imports
- `training.js` imports from `store.js`
- `api.js` uses standalone (imports from store for context if needed)
- `program.js` is standalone

### Error Handling
All localStorage operations wrap in try/catch. Network errors in API calls throw and should be caught by caller.

### Experience-aware Logic
- **Beginner**: 3 anchor sets, 2 acc sets, 8-15 reps
- **Intermediate**: 4 anchor sets, 3 acc sets, 6-12 reps
- **Experienced**: 5 anchor sets, 4 acc sets, 3-12 reps

Weight nudges: Barbell always 5 lbs, DB <25 lbs gets 2.5 lbs, advanced machines 2.5 lbs, others 5 lbs.

## Testing

```javascript
// Test carry-over progression
const profile = { experience: 'intermediate' };
const day = { exercises: [{ sets: 4, reps: '4-6', equipment: 'barbell' }] };
const result = loadDayWeekWithCarryover(0, 1, day, profile);

// Test program generation
const days = generateProgram(profile, EXERCISE_DB);
console.assert(days.length === 6, 'PPL should generate 6 days');
console.assert(days[0].exercises[0].anchor === true, 'First exercise should be anchor');
```

## Files Location
- `/src/utils/store.js` - 275 lines
- `/src/utils/training.js` - 309 lines
- `/src/utils/program.js` - 334 lines
- `/src/utils/api.js` - 227 lines

Total: 1,145 lines of clean, extracted utility code.
