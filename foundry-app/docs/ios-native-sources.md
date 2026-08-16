# iOS: which native files are tracked, and why

`foundry-app/ios/` is in `.gitignore`. That was correct while the folder
held nothing but `npx cap add ios` + `npx cap sync ios` output — throw it
away, regenerate it, lose nothing.

That stopped being true when we hand-wrote a HealthKit plugin. A handful
of files under `ios/` are now **authored**, not generated, and cannot be
recovered by re-running Capacitor.

## Tracked despite the ignore rule

Added with `git add -f`. Once a file is tracked, `.gitignore` no longer
applies to it, so ordinary `git add`/`commit` picks up later edits.

| File | Why it can't be regenerated |
|---|---|
| `App/App/FoundryHealthPlugin.swift` | The HKWorkout plugin. Entirely ours. |
| `App/App/MainViewController.swift` | Registers the plugin from `capacitorDidLoad()`. |
| `App/App/Base.lproj/Main.storyboard` | Points the view controller at `MainViewController` instead of `CAPBridgeViewController`. `cap add ios` writes the stock version. |
| `App/App/Info.plist` | Hand-edited: HealthKit usage strings, orientations, `ITSAppUsesNonExemptEncryption`. |
| `App/App/App.entitlements` | HealthKit + `applinks:thefoundry.coach`. |
| `App/App/AppDelegate.swift` | Hand-edited over time. |
| `App/App.xcodeproj/project.pbxproj` | Target membership for the two Swift files. Without it a fresh clone compiles neither, and the plugin silently doesn't exist at runtime. |
| `App/Podfile` | Pod list including `CapgoCapacitorHealth`. |

## Still ignored, on purpose

`Pods/`, `DerivedData/`, `App/App/public/` (the synced web build),
`Podfile.lock`, and the `config N.xml` scratch files Xcode leaves behind.
All genuinely regenerable.

## Setting up a fresh machine

```bash
npm install
npm run build
npx cap sync ios          # regenerates Pods + public/, leaves tracked files alone
cd ios/App && pod install
```

Then open `App.xcworkspace` and confirm **FoundryHealthPlugin.swift** and
**MainViewController.swift** appear under the App target's *Compile
Sources* build phase. They should, because `project.pbxproj` is tracked —
but check, because a `cap sync` that rewrites the project file is the one
failure mode that turns this plugin off without any error.

## Why `project.pbxproj` will produce diff noise

Xcode and `cap sync` both rewrite it, sometimes reordering unrelated
entries. Expect churn on that one file and read its diffs with suspicion;
the useful signal is whether the two `FoundryHealth*` / `MainView*` lines
survive in the `PBXSourcesBuildPhase` block.

## The registration detail that matters

Capacitor auto-registers plugins from `packageClassList` in the generated
`capacitor.config.json`, which is built from installed **npm** plugins. An
app-local plugin never appears there, and `bridge.registerPluginType()`
returns early whenever auto-registration is on. `registerPluginInstance()`
from `capacitorDidLoad()` is the one path that actually works — which is
why `MainViewController` exists at all.
