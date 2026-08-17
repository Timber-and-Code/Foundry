import Foundation
import Capacitor
import HealthKit

/**
 * Writes completed Foundry sessions to HealthKit as real workouts, so they
 * appear in Apple Fitness → Workouts and their energy reaches the Move ring.
 *
 * This exists because `@capgo/capacitor-health` — which handles our body
 * weight sync — exposes only steps / distance / calories / heartRate /
 * weight. It has no HKWorkout API, and there is no way to express a
 * strength session through it.
 *
 * Registered from MainViewController.capacitorDidLoad() via
 * `registerPluginInstance`. NOT via `registerPluginType`, which returns
 * early while Capacitor's autoRegisterPlugins is on — that path only reads
 * the generated capacitor.config.json packageClassList, and an app-local
 * plugin never appears in it.
 */
@objc(FoundryHealthPlugin)
public class FoundryHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FoundryHealthPlugin"
    public let jsName = "FoundryHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestWorkoutPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkWorkoutPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveStrengthWorkout", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    /// Workout envelope plus the active-energy samples inside it. The Move
    /// ring is driven by the energy samples, not by the workout alone, so
    /// both need share authorization or the session lands with no calories.
    private var shareTypes: Set<HKSampleType> {
        var types: Set<HKSampleType> = [HKObjectType.workoutType()]
        if let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            types.insert(energy)
        }
        return types
    }

    // MARK: - Permissions

    @objc func requestWorkoutPermission(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        store.requestAuthorization(toShare: shareTypes, read: []) { [weak self] _, error in
            if let error = error {
                CAPLog.print("[FoundryHealth] auth request failed: \(error.localizedDescription)")
            }
            // `success` only reports that the sheet completed, not what the
            // lifter chose, so read back the actual share status instead.
            call.resolve(["granted": self?.isWorkoutShareAuthorized() ?? false])
        }
    }

    @objc func checkWorkoutPermission(_ call: CAPPluginCall) {
        call.resolve(["granted": isWorkoutShareAuthorized()])
    }

    /// HealthKit hides READ denial to avoid leaking what a user withholds,
    /// but share status is reported honestly — so this is a real answer.
    private func isWorkoutShareAuthorized() -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else { return false }
        return store.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized
    }

    // MARK: - Writing a session

    @objc func saveStrengthWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["saved": false])
            return
        }
        guard isWorkoutShareAuthorized() else {
            call.resolve(["saved": false])
            return
        }

        let startMs = call.getDouble("startMs") ?? 0
        let endMs = call.getDouble("endMs") ?? 0
        guard startMs > 0, endMs > startMs else {
            call.reject("startMs and endMs must describe a positive interval")
            return
        }

        let start = Date(timeIntervalSince1970: startMs / 1000)
        let end = Date(timeIntervalSince1970: endMs / 1000)
        let kcal = call.getDouble("kcal") ?? 0

        let config = HKWorkoutConfiguration()
        config.activityType = .traditionalStrengthTraining

        // HKWorkoutBuilder rather than the HKWorkout(...) initializer: that
        // initializer is deprecated as of iOS 17, and the builder is the
        // supported path all the way back to iOS 12 (we target 15).
        let builder = HKWorkoutBuilder(healthStore: store, configuration: config, device: .local())

        builder.beginCollection(withStart: start) { [weak self] began, error in
            guard began else {
                self?.finish(call, saved: false, error: error)
                return
            }
            self?.attachMetadata(builder, call: call) {
                self?.attachEnergy(builder, kcal: kcal, start: start, end: end) {
                    builder.endCollection(withEnd: end) { ended, endError in
                        guard ended else {
                            self?.finish(call, saved: false, error: endError)
                            return
                        }
                        builder.finishWorkout { workout, finishError in
                            guard let workout = workout else {
                                self?.finish(call, saved: false, error: finishError)
                                return
                            }
                            call.resolve([
                                "saved": true,
                                "uuid": workout.uuid.uuidString
                            ])
                        }
                    }
                }
            }
        }
    }

    /// Freeform metadata so a session can be traced back to the mesocycle
    /// that produced it. Apple's keys are length-limited, so this stays small.
    private func attachMetadata(
        _ builder: HKWorkoutBuilder,
        call: CAPPluginCall,
        then: @escaping () -> Void
    ) {
        var metadata: [String: Any] = [HKMetadataKeyWasUserEntered: false]
        if let mesoId = call.getString("mesoId") { metadata["FoundryMesocycleId"] = mesoId }
        if let label = call.getString("dayLabel") { metadata["FoundryDayLabel"] = label }
        if let week = call.getInt("weekIndex") { metadata["FoundryWeekIndex"] = week }
        if let sets = call.getInt("totalSets") { metadata["FoundryTotalSets"] = sets }
        if let volume = call.getInt("totalVolumeLbs") { metadata["FoundryTotalVolumeLbs"] = volume }

        builder.addMetadata(metadata) { _, error in
            if let error = error {
                CAPLog.print("[FoundryHealth] metadata rejected: \(error.localizedDescription)")
            }
            // Metadata is decoration — a session with none is still valid,
            // so never abandon the write over it.
            then()
        }
    }

    /// The active-energy sample is what actually credits the Move ring;
    /// without it the workout shows up in Apple Fitness reading 0 calories.
    private func attachEnergy(
        _ builder: HKWorkoutBuilder,
        kcal: Double,
        start: Date,
        end: Date,
        then: @escaping () -> Void
    ) {
        guard kcal > 0,
              let energyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) else {
            then()
            return
        }
        let quantity = HKQuantity(unit: .kilocalorie(), doubleValue: kcal)
        let sample = HKQuantitySample(type: energyType, quantity: quantity, start: start, end: end)
        builder.add([sample]) { _, error in
            if let error = error {
                CAPLog.print("[FoundryHealth] energy sample rejected: \(error.localizedDescription)")
            }
            // Same reasoning as metadata: a workout with no calories still
            // beats no workout at all.
            then()
        }
    }

    private func finish(_ call: CAPPluginCall, saved: Bool, error: Error?) {
        if let error = error {
            CAPLog.print("[FoundryHealth] workout write failed: \(error.localizedDescription)")
        }
        call.resolve(["saved": saved])
    }
}
