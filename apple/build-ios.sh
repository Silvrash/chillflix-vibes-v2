#!/bin/bash
# Builds the iPhone/iPad app and puts it on a device, or runs it in a simulator.
#
#   apple/build-ios.sh "Benjamin's iPad"      # build, sign, install, launch on that device
#   apple/build-ios.sh Okane --team ABCDE12345
#   apple/build-ios.sh --simulator            # build for the booted simulator and launch there
#
# The device is named the way Xcode names it (or by UDID). The team comes from
# --team, then $APPLE_TEAM_ID, then a one-line apple/.team file — which is
# gitignored, so a team id lives in the checkout that uses it and nowhere else.
#
# Signing is automatic. The first build for a device registers it with the team
# and mints the profile; that needs Xcode signed in to the team's Apple ID.
set -euo pipefail
cd "$(dirname "$0")"

BUNDLE_ID=com.nyeova.chillflixvibes
TARGET=""; TEAM="${APPLE_TEAM_ID:-}"; SIMULATOR=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --team) TEAM="$2"; shift 2 ;;
    --simulator) SIMULATOR=1; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) TARGET="$1"; shift ;;
  esac
done
[[ -z "$TEAM" && -f .team ]] && TEAM="$(tr -d '[:space:]' < .team)"

command -v xcodegen >/dev/null || { echo "xcodegen is needed: brew install xcodegen" >&2; exit 1; }
[[ -d ChillFlixVibes.xcodeproj ]] || xcodegen generate >/dev/null

if [[ $SIMULATOR -eq 1 ]]; then
  UDID=$(xcrun simctl list devices booted | grep -o '[0-9A-F-]\{36\}' | head -1)
  [[ -n "$UDID" ]] || { echo "No simulator is booted." >&2; exit 1; }
  xcodebuild -project ChillFlixVibes.xcodeproj -scheme ChillFlixVibes -configuration Debug \
    -destination "id=$UDID" -derivedDataPath .build/ios build CODE_SIGNING_ALLOWED=NO \
    | grep -E "error:|BUILD (SUCCEEDED|FAILED)" || true
  APP=$(find .build/ios -name ChillFlixVibes.app -path '*iphonesimulator*' | head -1)
  xcrun simctl install "$UDID" "$APP"
  xcrun simctl launch "$UDID" "$BUNDLE_ID"
  exit 0
fi

[[ -n "$TARGET" ]] || { echo "Which device? apple/build-ios.sh \"<device name or UDID>\"" >&2; exit 1; }
[[ -n "$TEAM" ]] || { echo "Which team? --team <id>, \$APPLE_TEAM_ID, or apple/.team" >&2; exit 1; }

# Name → the device's hardware UDID (what xcodebuild wants) and its CoreDevice
# id (what devicectl wants), both from devicectl's own list. Not from
# `xcodebuild -showdestinations`: a device on Wi-Fi drops out of that list for
# seconds at a time, and devicectl keeps hold of it.
resolve() {
  # To a file: with stdout as the target, devicectl prints its table there too.
  local json; json=$(mktemp)
  xcrun devicectl list devices --json-output "$json" >/dev/null 2>&1
  python3 -c '
import json, sys
want = sys.argv[1]
for d in json.load(sys.stdin)["result"]["devices"]:
    hw = d.get("hardwareProperties", {})
    if want in (d.get("deviceProperties", {}).get("name", ""), hw.get("udid", ""), d["identifier"]):
        print(hw.get("udid", ""), d["identifier"], d.get("connectionProperties", {}).get("tunnelState", "?"))
        break
' "$1" < "$json" || true
  rm -f "$json"
}
read -r UDID DEVICE TUNNEL <<< "$(resolve "$TARGET")"
[[ -n "${UDID:-}" ]] || { echo "No iOS device named \"$TARGET\" is known to this Mac. Plugged in and unlocked?" >&2; exit 1; }
[[ "$TUNNEL" == "connected" ]] || { echo "\"$TARGET\" is known but not reachable right now (tunnel: $TUNNEL). Unlock it, or use a cable." >&2; exit 1; }

echo "→ building for $TARGET ($UDID) under team $TEAM"
xcodebuild -project ChillFlixVibes.xcodeproj -scheme ChillFlixVibes -configuration Release \
  -destination "id=$UDID" -derivedDataPath .build/ios-device \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic build \
  | grep -E "error:|Provisioning Profile|BUILD (SUCCEEDED|FAILED)" || true

APP=.build/ios-device/Build/Products/Release-iphoneos/ChillFlixVibes.app
[[ -d "$APP" ]] || { echo "Build failed." >&2; exit 1; }

echo "→ installing"
xcrun devicectl device install app --device "$DEVICE" "$APP" | grep -E "installed|rror" || true
echo "→ launching"
xcrun devicectl device process launch --device "$DEVICE" "$BUNDLE_ID" | grep -E "Launched|rror|Denied" || true
echo "done — if it would not open, trust the developer once under Settings → General → VPN & Device Management."
