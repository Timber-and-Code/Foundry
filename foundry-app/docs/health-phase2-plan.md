# Health Phase 2 — Custom Capacitor Plugin for HKWorkout

> **Status:** planning. Phase 1 (weight write) shipped 2026-04-25 in commit `031d146`. Phase 2 makes Foundry workouts appear as real entries in Apple Fitness + contribute to the Activity rings.

---

## Why we need a custom plugin

`@capgo/capacitor-health@7.2.15` only exposes these data types:

```
steps | distance | calories | heartRate | weight
```

There's no `HKWorkout` API. To write a real strength workout that:

- Appears in **Apple Fitness → Workouts** with proper duration, type, and date.
- Contributes to the **Move ring** (when `totalEnergyBurned` is set).
- Optionally records **per-set boundaries** as `HKWorkoutEvent` markers.
- Optionally records **heart rate samples** if Apple Watch was paired.

…we need to call HealthKit directly via Swift. The cleanest path is a custom Capacitor plugin we own.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  TS layer (web/native shared)                   │
│  src/utils/health/CapacitorHealthService.ts     │
│   ├─ existing weight read/write (phase 1)       │
│   └─ NEW: writeStrengthWorkout(opts)            │
└────────────────────┬────────────────────────────┘
                     │ Capacitor bridge
                     ▼
┌─────────────────────────────────────────────────┐
│  iOS native (Swift)                             │
│  ios/App/App/FoundryHealthPlugin.swift          │
│   ├─ implements @objc CAPPlugin                 │
│   ├─ requestAuth(types: [HKWorkoutType()])      │
│   └─ saveStrengthWorkout(start, end, kcal,     │
│       events, metadata)                         │
└─────────────────────────────────────────────────┘
```

Two plugin options:

### Option A: Inline plugin (recommended for v1)

Keep the Swift code inside `ios/App/App/` (next to `AppDelegate.swift`), register it from `AppDelegate`. **No npm package, no fork, no publishing.** Just one Swift file + one TS wrapper.

Pros: zero dependency overhead, ships with the app.
Cons: not reusable across other Foundry projects; Android needs a separate Kotlin file.

### Option B: Separate npm package

Generate via `npm init @capacitor/plugin@latest`. Lives at `packages/foundry-capacitor-health/`. Published privately or to npm.

Pros: clean reuse, easier to fork/maintain.
Cons: extra build step, monorepo or local-link complexity.

**Recommendation:** start with Option A. Migrate to B only if we end up needing more native bridges (Live Activities, Lock Screen widgets, etc.).

---

## File-by-file scope

### 1. `ios/App/App/FoundryHealthPlugin.swift` *(new, ~80 LOC)*

```swift
import Capacitor
import HealthKit

@objc(FoundryHealthPlugin)
public class FoundryHealthPlugin: CAPPlugin {
  private let store = HKHealthStore()

  @objc func requestWorkoutPermission(_ call: CAPPluginCall) {
    guard HKHealthStore.isHealthDataAvailable() else {
      call.resolve(["granted": false]); return
    }
    let toShare: Set = [HKObjectType.workoutType()]
    let toRead: Set<HKObjectType> = [HKObjectType.workoutType()]
    store.requestAuthorization(toShare: toShare, read: toRead) { ok, _ in
      call.resolve(["granted": ok])
    }
  }

  @objc func saveStrengthWorkout(_ call: CAPPluginCall) {
    let startMs = call.getDouble("startMs") ?? 0
    let endMs = call.getDouble("endMs") ?? 0
    let kcal = call.getDouble("kcal") ?? 0
    let mesoId = call.getString("mesoId")
    let dayLabel = call.getString("dayLabel")

    let start = Date(timeIntervalSince1970: startMs / 1000)
    let end = Date(timeIntervalSince1970: endMs / 1000)

    var energy: HKQuantity? = nil
    if kcal > 0 {
      energy = HKQuantity(unit: .kilocalorie(), doubleValue: kcal)
    }

    var metadata: [String: Any] = ["AppName": "The Foundry"]
    if let m = mesoId { metadata["MesocycleId"] = m }
    if let d = dayLabel { metadata["DayLabel"] = d }

    let workout = HKWorkout(
      activityType: .traditionalStrengthTraining,
      start: start,
      end: end,
      workoutEvents: nil,            // optional: per-set markers (v2)
      totalEnergyBurned: energy,
      totalDistance: nil,
      metadata: metadata
    )

    store.save(workout) { ok, err in
      if let err = err { call.reject(err.localizedDescription); return }
      call.resolve(["saved": ok, "uuid": workout.uuid.uuidString])
    }
  }
}
```

### 2. `ios/App/App/AppDelegate.swift` — register the plugin *(1-line change)*

Add to `application(_:didFinishLaunchingWithOptions:)`:

```swift
CAPBridgeViewController.registerCustomPlugin(FoundryHealthPlugin.self)
```

### 3. `src/utils/health/foundryWorkoutPlugin.ts` *(new, ~20 LOC)*

```ts
import { registerPlugin } from '@capacitor/core';

export interface FoundryHealthPlugin {
  requestWorkoutPermission(): Promise<{ granted: boolean }>;
  saveStrengthWorkout(opts: {
    startMs: number;
    endMs: number;
    kcal?: number;
    mesoId?: string;
    dayLabel?: string;
  }): Promise<{ saved: boolean; uuid: string }>;
}

export const FoundryHealth = registerPlugin<FoundryHealthPlugin>('FoundryHealthPlugin');
```

### 4. `src/utils/health/CapacitorHealthService.ts` — add wrapper *(~20 LOC)*

```ts
async writeStrengthWorkout(opts: WorkoutWriteOpts): Promise<boolean> {
  try {
    const res = await FoundryHealth.saveStrengthWorkout({
      startMs: opts.startedAt,
      endMs: opts.endedAt,
      kcal: opts.estimatedKcal,
      mesoId: opts.mesoId,
      dayLabel: opts.dayLabel,
    });
    return res.saved;
  } catch {
    return false;
  }
}
```

Update `HealthService` interface in `types.ts` with the new method signature.

### 5. `src/components/workout/DayView.tsx` — call on completion

In `handleComplete` (or the `useCompletionFlow` hook), after the local + Supabase saves succeed:

```ts
if (store.get('foundry:health:enabled') === '1') {
  const startMs = sessionStartRef.current ?? Date.now();
  const endMs = Date.now();
  const totalSets = countConfirmedSets(weekData);
  const totalVolume = countTotalVolume(weekData);  // lbs × reps
  const kcal = estimateKcal({ startMs, endMs, totalVolume, profile });
  void getHealthService().writeStrengthWorkout({
    startedAt: startMs,
    endedAt: endMs,
    estimatedKcal: kcal,
    mesoId: store.get('foundry:active_meso_id') || undefined,
    dayLabel: day.label,
  });
}
```

### 6. `src/utils/health/calorieEstimate.ts` *(new, ~30 LOC)*

```ts
/**
 * Strength-training calorie estimate. Uses the MET-equivalent formula:
 *   kcal = METs × weight(kg) × duration(hours)
 *
 * METs for strength training:
 *   - Light  (~3.5)  bodyweight, easy circuits
 *   - Moderate (~5)  typical hypertrophy block
 *   - Vigorous (~6)  heavy strength, max-effort sets
 *
 * We default to 5 (moderate) — Foundry sessions sit there 80% of the time.
 * Apple Watch users get a more accurate estimate via heart-rate-based
 * computation; this fills in for users without a Watch.
 */
export function estimateKcal(opts: {
  startMs: number;
  endMs: number;
  weightLbs: number;  // user's bodyweight
  intensity?: 'light' | 'moderate' | 'vigorous';
}): number {
  const METS = { light: 3.5, moderate: 5, vigorous: 6 };
  const mets = METS[opts.intensity ?? 'moderate'];
  const weightKg = opts.weightLbs / 2.20462;
  const hours = Math.max(0, (opts.endMs - opts.startMs) / 3600000);
  return Math.round(mets * weightKg * hours);
}
```

---

## Permissions flow

When the user first toggles on Apple Health (existing `HealthSection.tsx` toggle):

1. Existing weight read/write permission prompt fires (already shipped).
2. **NEW:** Foundry calls `FoundryHealth.requestWorkoutPermission()` which surfaces a separate iOS sheet for `HKWorkoutType`.
3. Once granted, every completed workout writes a `HKWorkout` until the user revokes via iOS Settings.

If they decline workout permission but allow weight, weight sync still works. The two are independent.

---

## Per-set markers (v2)

For richer Apple Fitness display, attach `HKWorkoutEvent` samples per set:

```swift
let event = HKWorkoutEvent(
  type: .segment,
  dateInterval: DateInterval(start: setStart, end: setEnd),
  metadata: ["ExerciseName": "Bench Press", "Weight": 185, "Reps": 8]
)
```

Pass an array of these as the third arg to `HKWorkout(workoutEvents:)`. Apple Fitness shows them as workout segments.

**Defer to v2** — v1 ships with just the workout envelope (start/end/kcal/type). Per-set events are nice-to-have polish.

---

## Test plan

1. Implement the 5 file changes above.
2. `npm run build && npx cap sync ios`.
3. Open Xcode workspace, add `FoundryHealthPlugin.swift` to the App target (drag into the project navigator, check "Copy items if needed").
4. Re-Archive → upload to TestFlight.
5. On a real device:
   - Settings → Health → Data Access → The Foundry → ensure "Workouts" → Allow Writing is on.
   - Complete a workout in Foundry.
   - Open Apple Fitness app → Workouts → confirm a "Traditional Strength Training" entry shows up dated today, with the duration matching the session.
   - Optional: open Apple Health → Browse → Activity → Workouts → tap the Foundry workout → confirm metadata (mesoId, dayLabel).

---

## Time estimate

| Task | LOC | Time |
|---|---|---|
| Swift plugin file | 80 | 2h |
| AppDelegate registration | 1 | 5min |
| TS plugin wrapper | 20 | 30min |
| Service method + interface | 20 | 30min |
| DayView completion hook | 15 | 30min |
| Calorie estimate util | 30 | 30min |
| Xcode project add + manual test | — | 1h |
| **Total** | **~165** | **~5h focused** |

Realistically with debugging + iteration: **1–2 days**.

---

## Order of operations

1. Write the Swift plugin file in isolation (verify it compiles in Xcode).
2. Wire AppDelegate registration.
3. Build the TS wrapper + service method.
4. Hook into `handleComplete`.
5. Manual TestFlight build, verify workout appears in Apple Fitness.
6. v2 polish: add `HKWorkoutEvent` per-set markers, write to Health Connect on Android (mirrors via `androidx.health.connect.client.records.ExerciseSessionRecord`).

---

## Android / Health Connect parity

Same architecture, different file. Kotlin lives at `android/app/src/main/java/coach/thefoundry/app/FoundryHealthPlugin.kt`. Health Connect's `ExerciseSessionRecord` maps cleanly to `HKWorkout`. **Only relevant once you cut an Android build** — if Foundry stays iOS-first, defer indefinitely.

---

## Open questions

- **Workout activity type:** `.traditionalStrengthTraining` vs `.functionalStrengthTraining`. Traditional = barbells + machines (what most lifters do). Functional = bodyweight, kettlebells, mobility. Default to traditional, expose a setting later.
- **Calorie source:** trust our MET estimate, or surface "use Apple Watch" guidance? Probably both — write our estimate, let Watch HR override on the user's end.
- **Metadata schema:** what should we encode? Suggested keys: `MesocycleId`, `DayLabel`, `WeekIndex`, `TotalSets`, `TotalVolumeLbs`. Apple's metadata is freeform but length-limited.
