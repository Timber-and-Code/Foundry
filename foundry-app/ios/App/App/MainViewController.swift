import UIKit
import Capacitor

/**
 * Bridge view controller subclass: registers plugins that live inside the
 * app rather than in an npm package, and turns off the WebView's document
 * bounce.
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
        // The banner is sticky and the tab bar is fixed against the DOCUMENT.
        // When the WebView's scroll view rubber-bands, both slide with it
        // instead of staying pinned. CSS `overscroll-behavior: none` covers
        // iOS 16+; this covers iOS 15 and is the belt to that pair of braces.
        // Sheets and pickers scroll inside their own elements and still bounce.
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false

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
