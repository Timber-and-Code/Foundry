#!/usr/bin/env bash
# One-shot iOS scaffold + configure for Foundry TestFlight prep.
# Run AFTER Xcode.app is installed from the Mac App Store.
#
# What it does:
#   1. Verifies Xcode + CocoaPods
#   2. Builds web bundle (required for `cap add ios` to succeed)
#   3. Runs `npx cap add ios` to scaffold the native project
#   4. Copies forged-F icon into AppIcon.appiconset
#   5. Injects HealthKit usage strings into Info.plist
#   6. Locks portrait orientation on iPhone + iPad
#   7. Sets CFBundleShortVersionString to match package.json
#   8. Runs `pod install`
#
# After success: open ios/App/App.xcworkspace in Xcode,
# set Signing Team, Product > Archive, Distribute > TestFlight.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# --- 1. Preflight ----------------------------------------------------------
log "Preflight checks"

XCODE_DEV="$(xcode-select -p 2>/dev/null || true)"
case "$XCODE_DEV" in
  *Xcode.app*) : ;;
  *) die "Full Xcode not selected. Install Xcode from App Store, then:
       sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
       sudo xcodebuild -license accept" ;;
esac

command -v pod >/dev/null 2>&1 || die "CocoaPods missing. Install with:
       sudo gem install cocoapods"

[ -f public/foundry-f.png ] || die "public/foundry-f.png missing"

VERSION="$(node -p "require('./package.json').version")"
log "Target version: $VERSION"

# --- 2. Web build ----------------------------------------------------------
if [ ! -d dist ] || [ -z "$(ls -A dist 2>/dev/null)" ]; then
  log "Building web bundle (dist/ missing or empty)"
  npm run build
else
  log "dist/ already present — skipping build (delete dist/ to force)"
fi

# --- 3. Scaffold iOS -------------------------------------------------------
if [ -d ios ]; then
  log "ios/ already exists — skipping scaffold"
else
  log "Running: npx cap add ios"
  npx cap add ios
fi

APP_DIR="ios/App/App"
PLIST="$APP_DIR/Info.plist"
ICONSET="$APP_DIR/Assets.xcassets/AppIcon.appiconset"

[ -f "$PLIST" ] || die "Info.plist not found at $PLIST after cap add"
[ -d "$ICONSET" ] || die "AppIcon.appiconset not found at $ICONSET"

# --- 4. Icon ---------------------------------------------------------------
log "Installing forged-F icon (1024x1024)"
cp public/foundry-f.png "$ICONSET/AppIcon-512@2x.png"

# --- 5. Info.plist edits ---------------------------------------------------
PB=/usr/libexec/PlistBuddy

set_or_add() {
  local key="$1" type="$2" value="$3"
  if "$PB" -c "Print :$key" "$PLIST" >/dev/null 2>&1; then
    "$PB" -c "Set :$key $value" "$PLIST"
  else
    "$PB" -c "Add :$key $type $value" "$PLIST"
  fi
}

log "Adding HealthKit usage descriptions"
set_or_add NSHealthShareUsageDescription string \
  "Foundry reads your workouts and body metrics to track training progress."
set_or_add NSHealthUpdateUsageDescription string \
  "Foundry writes completed workouts to Apple Health so your training history stays in one place."

log "Locking portrait orientation (iPhone)"
"$PB" -c "Delete :UISupportedInterfaceOrientations" "$PLIST" 2>/dev/null || true
"$PB" -c "Add :UISupportedInterfaceOrientations array" "$PLIST"
"$PB" -c "Add :UISupportedInterfaceOrientations: string UIInterfaceOrientationPortrait" "$PLIST"

log "iPad orientations (all 4 required for App Store multitasking compliance)"
"$PB" -c "Delete :UISupportedInterfaceOrientations~ipad" "$PLIST" 2>/dev/null || true
"$PB" -c "Add :UISupportedInterfaceOrientations~ipad array" "$PLIST"
"$PB" -c "Add :UISupportedInterfaceOrientations~ipad: string UIInterfaceOrientationPortrait" "$PLIST"
"$PB" -c "Add :UISupportedInterfaceOrientations~ipad: string UIInterfaceOrientationPortraitUpsideDown" "$PLIST"
"$PB" -c "Add :UISupportedInterfaceOrientations~ipad: string UIInterfaceOrientationLandscapeLeft" "$PLIST"
"$PB" -c "Add :UISupportedInterfaceOrientations~ipad: string UIInterfaceOrientationLandscapeRight" "$PLIST"

log "Setting CFBundleShortVersionString=$VERSION"
set_or_add CFBundleShortVersionString string "$VERSION"

# --- 5b. Associated Domains (Universal Links) -----------------------------
# Adds `applinks:thefoundry.coach` so /friend/:code invite deep links
# open inside the app instead of Safari. Requires the AASA file served
# at https://thefoundry.coach/.well-known/apple-app-site-association
# (see foundry-app/public/.well-known/). Idempotent — checks before add.
ENTITLEMENTS="$APP_DIR/App.entitlements"
if [ ! -f "$ENTITLEMENTS" ]; then
  die "App.entitlements missing at $ENTITLEMENTS"
fi

log "Adding com.apple.developer.associated-domains (applinks:thefoundry.coach)"
if "$PB" -c "Print :com.apple.developer.associated-domains" "$ENTITLEMENTS" >/dev/null 2>&1; then
  log "  associated-domains array already exists — ensuring applinks entry"
  if "$PB" -c "Print :com.apple.developer.associated-domains" "$ENTITLEMENTS" | grep -q "applinks:thefoundry.coach"; then
    log "  applinks:thefoundry.coach already present — skip"
  else
    "$PB" -c "Add :com.apple.developer.associated-domains: string applinks:thefoundry.coach" "$ENTITLEMENTS"
  fi
else
  "$PB" -c "Add :com.apple.developer.associated-domains array" "$ENTITLEMENTS"
  "$PB" -c "Add :com.apple.developer.associated-domains: string applinks:thefoundry.coach" "$ENTITLEMENTS"
fi

# --- 6. Sync + pods --------------------------------------------------------
log "Running: npx cap sync ios"
npx cap sync ios

log "Running: pod install"
( cd ios/App && pod install )

# --- 7. Done ---------------------------------------------------------------
cat <<EOF

\033[1;32mDone.\033[0m Next steps in Xcode:
  open ios/App/App.xcworkspace

  1. Select "App" target > Signing & Capabilities
  2. Check "Automatically manage signing", pick your Team
  3. Change Bundle Identifier if com.thefoundry.app is taken
  4. Product > Archive
  5. Distribute App > App Store Connect > Upload > TestFlight

Verify in Xcode before archive:
  - General tab: Version = $VERSION, Build = 1
  - Signing: Team set, no red errors
  - Capabilities: add "HealthKit" via + Capability button (script can't do this)
EOF
