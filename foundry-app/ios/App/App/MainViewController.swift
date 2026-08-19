import UIKit
import Capacitor

/**
 * Bridge view controller subclass whose only job is registering plugins
 * that live inside the app rather than in an npm package.
 *
 * Capacitor auto-registers from the `packageClassList` in the generated
 * capacitor.config.json, which `npx cap sync` rebuilds from installed npm
 * plugins. An app-local plugin is never in that list, and
 * `bridge.registerPluginType` bails out early whenever auto-registration
 * is on — so `registerPluginInstance` from this hook is the one path that
 * actually works.
 *
 * Wired up by Base.lproj/Main.storyboard, whose view controller's custom
 * class points here instead of at CAPBridgeViewController.
 */
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        // Logged unconditionally: registration failing here is invisible from
        // JS — `registerPlugin` hands back a proxy that throws only when a
        // method is called, and the caller swallows it. Without this line the
        // difference between "never registered" and "user declined" is
        // indistinguishable on a device.
        guard let bridge = bridge else {
            CAPLog.print("⚡️ [FoundryHealth] bridge was nil in capacitorDidLoad — plugin NOT registered")
            return
        }
        bridge.registerPluginInstance(FoundryHealthPlugin())
        CAPLog.print("⚡️ [FoundryHealth] plugin registered as jsName=FoundryHealth")
    }
}
