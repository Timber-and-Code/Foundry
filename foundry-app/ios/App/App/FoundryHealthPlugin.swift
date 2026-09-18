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
 *
 * Errors are logged with NSLog, not CAPLog: CAPLog is silent in Release
 * builds, which made every failure on a TestFlight device invisible.
 */
@objc(FoundryHealthPlugin)
public class FoundryHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FoundryHealthPlugin"
    public let jsName = "FoundryHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestHealthPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getHealthAuthorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestWorkoutPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkWorkoutPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveStrengthWorkout", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    private var bodyMassType: HKQuantityType? {
        HKObjectType.quantityType(forIdentifier: .bodyMass)
    }

    private var activeEnergyType: HKQuantityType? {
        HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)
    }

    /// Workout envelope plus the active-energy samples inside it. The Move
    /// ring is driven by the energy samples, not by the workout alone, so
    /// both need share authorization or the session lands with no calories.
    private var shareTypes: Set<HKSampleType> {
        var types: Set<HKSampleType> = [HKObjectType.workoutType()]
        if let energy = activeEnergyType { types.insert(energy) }
        // Body weight rides along so ONE sheet covers everything — see
        // requestHealthPermissions for why that matters.
        if let mass = bodyMassType { types.insert(mass) }
        return types
    }

    private var readTypes: Set<HKObjectType> {
        guard let mass = bodyMassType else { return [] }
        return [mass]
    }

    // MARK: - Status

    /// HealthKit reports SHARE status honestly (it only hides READ status),
    /// so each of these is a real answer.
    private func shareStatus(_ type: HKObjectType?) -> String {
        guard let type = type else { return "unavailable" }
        switch store.authorizationStatus(for: type) {
        case .sharingAuthorized: return "authorized"
        case .sharingDenied: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "notDetermined"
        }
    }

    private func statusPayload(needsPrompt: Bool) -> [String: Any] {
        let workouts = shareStatus(HKObjectType.workoutType())
        let weight = shareStatus(bodyMassType)
        return [
            "available": true,
            "weight": weight,
            "workouts": workouts,
            "activeEnergy": shareStatus(activeEnergyType),
            // True when iOS WOULD show the sheet for at least one of our
            // types — i.e. something has never been asked. A lifter who
            // enabled Health on a build that dropped the workout request is
            // exactly this state, and only a new request can fix it: iOS
            // Settings has no switch for a type the app never asked about.
            "needsPrompt": needsPrompt
        ]
    }

    private static let unavailablePayload: [String: Any] = [
        "available": false,
        "weight": "unavailable",
        "workouts": "unavailable",
        "activeEnergy": "unavailable",
        "needsPrompt": false
    ]

    /// Current share status of every type we use, without prompting.
    @objc func getHealthAuthorizationStatus(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(Self.unavailablePayload)
            return
        }
        store.getRequestStatusForAuthorization(toShare: shareTypes, read: readTypes) { [weak self] status, error in
            guard let self = self else { return }
            if let error = error {
                NSLog("[FoundryHealth] request-status query failed: \(error.localizedDescription)")
                call.reject(error.localizedDescription, "STATUS_FAILED", error)
                return
            }
            call.resolve(self.statusPayload(needsPrompt: status == .shouldRequest))
        }
    }

    // MARK: - Permissions

    /// Ask for body weight AND workouts in a single sheet.
    ///
    /// The app used to chain two requests: @capgo/capacitor-health for weight,
    /// then ours for workouts, fired the moment the first promise resolved.
    /// That promise resolves as the first sheet is still dismissing, and
    /// HealthKit silently drops an authorization request made while another is
    /// on screen — so the workout sheet never appeared, the status stayed
    /// .notDetermined, and no session ever reached Apple Fitness. One call,
    /// one sheet, no race.
    ///
    /// Resolves with the per-type share status after the sheet closes (the
    /// `success` flag only says the sheet completed, not what was chosen).
    /// Rejects when HealthKit itself refuses the request — a missing
    /// entitlement, a bad usage string — so JS can report it instead of
    /// mistaking it for a lifter tapping "Don't Allow".
    @objc func requestHealthPermissions(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(Self.unavailablePayload)
            return
        }
        store.requestAuthorization(toShare: shareTypes, read: readTypes) { [weak self] _, error in
            guard let self = self else { return }
            if let error = error {
                NSLog("[FoundryHealth] auth request failed: \(error.localizedDescription)")
                call.reject(error.localizedDescription, "AUTH_FAILED", error)
                return
            }
            call.resolve(self.statusPayload(needsPrompt: false))
        }
    }

    @objc func requestWorkoutPermission(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        store.requestAuthorization(toShare: shareTypes, read: readTypes) { [weak self] _, error in
            if let error = error {
                NSLog("[FoundryHealth] auth request failed: \(error.localizedDescription)")
                call.reject(error.localizedDescription, "AUTH_FAILED", error)
                return
            }
            call.resolve(["granted": self?.isWorkoutShareAuthorized() ?? false])
        }
    }

    @objc func checkWorkoutPermission(_ call: CAPPluginCall) {
        call.resolve(["granted": isWorkoutShareAuthorized()])
    }

    private func isWorkoutShareAuthorized() -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else { return false }
        return store.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized
    }

    // MARK: - Writing a session

    /// Resolves `{ saved: false, reason }` for the expected no-ops (no
    /// HealthKit, workouts not shared) and REJECTS on a real HealthKit
    /// failure, so the JS side can tell "not allowed" from "broken".
    @objc func saveStrengthWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["saved": false, "reason": "unavailable"])
            return
        }
        guard isWorkoutShareAuthorized() else {
            call.resolve(["saved": false, "reason": "not_authorized"])
            return
        }

        let startMs = call.getDouble("startMs") ?? 0
        let endMs = call.getDouble("endMs") ?? 0
        guard startMs > 0, endMs > startMs else {
            call.reject("startMs and endMs must describe a positive interval", "BAD_INTERVAL")
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
                self?.fail(call, stage: "beginCollection", error: error)
                return
            }
            self?.attachMetadata(builder, call: call) {
                self?.attachEnergy(builder, kcal: kcal, start: start, end: end) {
                    builder.endCollection(withEnd: end) { ended, endError in
                        guard ended else {
                            self?.fail(call, stage: "endCollection", error: endError)
                            return
                        }
                        builder.finishWorkout { workout, finishError in
                            guard let workout = workout else {
                                self?.fail(call, stage: "finishWorkout", error: finishError)
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
                NSLog("[FoundryHealth] metadata rejected: \(error.localizedDescription)")
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
        guard kcal > 0, let energyType = activeEnergyType else {
            then()
            return
        }
        // Writing a sample of a type the lifter refused fails the whole
        // add; skip it up front so the workout itself still lands.
        guard store.authorizationStatus(for: energyType) == .sharingAuthorized else {
            NSLog("[FoundryHealth] active energy not shared — saving workout without calories")
            then()
            return
        }
        let quantity = HKQuantity(unit: .kilocalorie(), doubleValue: kcal)
        let sample = HKQuantitySample(type: energyType, quantity: quantity, start: start, end: end)
        builder.add([sample]) { _, error in
            if let error = error {
                NSLog("[FoundryHealth] energy sample rejected: \(error.localizedDescription)")
            }
            // Same reasoning as metadata: a workout with no calories still
            // beats no workout at all.
            then()
        }
    }

    private func fail(_ call: CAPPluginCall, stage: String, error: Error?) {
        let message = "\(stage) failed: \(error?.localizedDescription ?? "no error given")"
        NSLog("[FoundryHealth] workout write \(message)")
        call.reject(message, "WRITE_FAILED", error)
    }
}
