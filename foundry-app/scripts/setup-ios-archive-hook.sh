#!/usr/bin/env bash
#
# setup-ios-archive-hook.sh
#
# Installs the Xcode Archive pre-action that runs `npm run build && npx
# cap sync ios` before every Archive build. Without this, it's easy to
# Archive against stale dist/ assets — see foundry/feedback_ios_build_preflight
# for the build-4 incident that prompted this script.
#
# Run after `npx cap add ios` on a fresh machine, or any time
# ios/App/App.xcodeproj/xcshareddata/xcschemes/ is missing the App scheme.
#
# Idempotent — safe to re-run.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

XCODEPROJ="$REPO_ROOT/ios/App/App.xcodeproj"
SCHEMES_DIR="$XCODEPROJ/xcshareddata/xcschemes"
TARGET="$SCHEMES_DIR/App.xcscheme"
TEMPLATE="$SCRIPT_DIR/templates/App.xcscheme"

if [[ ! -d "$XCODEPROJ" ]]; then
  echo "iOS project not found at $XCODEPROJ"
  echo "Run 'npx cap add ios' first."
  exit 1
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template not found at $TEMPLATE — script is broken."
  exit 1
fi

# Skip if the live scheme already has our PreAction marker.
if [[ -f "$TARGET" ]] && grep -q "foundry archive pre-action" "$TARGET"; then
  echo "App.xcscheme already has the archive PreAction — nothing to do."
  exit 0
fi

mkdir -p "$SCHEMES_DIR"
cp "$TEMPLATE" "$TARGET"

echo "Installed Archive PreAction at $TARGET"
echo
echo "From now on, Xcode → Product → Archive will automatically run"
echo "  npm run build && npx cap sync ios"
echo "before building. Pre-action logs land in /tmp/foundry-archive-prep.log."
echo
echo "If the BlueprintIdentifier ever changes (after a major Capacitor"
echo "upgrade or fresh 'cap add ios'), regenerate the template by"
echo "comparing against ios/App/App.xcodeproj/project.pbxproj."
