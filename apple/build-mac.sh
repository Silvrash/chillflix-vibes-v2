#!/bin/bash
# Builds the Mac app and assembles the bundle the site's install page ships.
#
# SwiftPM produces a bare executable; the bundle around it — the plist, the
# icon, the ad-hoc signature — is put together here so a fresh checkout can
# make the same artefact. Run from anywhere:
#
#   apple/build-mac.sh            # builds, bundles, signs
#   apple/build-mac.sh --zip      # …and refreshes public/ChillFlixVibes-mac.zip
set -euo pipefail
cd "$(dirname "$0")"

swift build -c release
APP=ChillFlixVibes.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp .build/release/ChillFlixVibes "$APP/Contents/MacOS/ChillFlixVibes"
cp Mac/Info.plist "$APP/Contents/Info.plist"
cp AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
# Ad-hoc: the app is not notarised, and the install page says how to open it.
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"
echo "built $APP"

if [[ "${1:-}" == "--zip" ]]; then
  rm -f ../public/ChillFlixVibes-mac.zip
  ditto -c -k --sequesterRsrc --keepParent "$APP" ../public/ChillFlixVibes-mac.zip
  echo "refreshed public/ChillFlixVibes-mac.zip ($(du -h ../public/ChillFlixVibes-mac.zip | cut -f1))"
fi
