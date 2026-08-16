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
        bridge?.registerPluginInstance(FoundryHealthPlugin())
    }
}
