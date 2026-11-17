#!/usr/bin/env bash
# Refuse an APK that would require uninstalling the currently published app.
set -euo pipefail
apk="mobile/android/app/build/outputs/apk/release/app-release.apk"
tools_dir="$(find "${ANDROID_HOME:?}/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
cert() { "$tools_dir/apksigner" verify --print-certs "$1" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p'; }
version() { "$tools_dir/aapt" dump badging "$1" | sed -n "s/^package:.*versionCode='\([0-9]*\)'.*/\1/p"; }
package_id() { "$tools_dir/aapt" dump badging "$1" | sed -n "s/^package: name='\([^']*\)'.*/\1/p"; }
new_cert="$(cert "$apk")"
new_version="$(version "$apk")"
test -n "$new_cert" && test "$new_version" = "$VERSION_CODE"
test "$(package_id "$apk")" = "com.umitbozdag.backstage"

release_data="$(gh api "repos/$GITHUB_REPOSITORY/releases/tags/android-latest")"
old_asset="$(printf '%s' "$release_data" | jq -r '.assets[] | select(.name == "Backstage.apk") | .id')"
test -n "$old_asset"
gh api -H 'Accept: application/octet-stream' "repos/$GITHUB_REPOSITORY/releases/assets/$old_asset" > "$RUNNER_TEMP/previous-backstage.apk"
old="$RUNNER_TEMP/previous-backstage.apk"
if [ "$(cert "$old")" != "$new_cert" ] || [ "$(package_id "$old")" != "$(package_id "$apk")" ]; then
  echo "::error::Signing certificate or app ID differs from the published APK. Release blocked to protect existing installations. Recover the original signing key; do not uninstall."
  exit 1
fi
if [ "$new_version" -le "$(version "$old")" ]; then
  echo "::error::The new version code must be higher than the published app."
  exit 1
fi
echo "Verified: same app, same signing certificate, newer version."
