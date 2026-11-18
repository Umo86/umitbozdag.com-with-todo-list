# Installed app updates

The Android app opens `https://umitbozdag.com` in Capacitor. Deploying the website delivers the same task and Finance screens to existing installations. The app checks the web build on startup, every minute while visible, on reconnect, and on Android resume. It waits if a dialog, changed form, active editor, save or drag is in progress. The Update now button uses the same guard. No storage or database is cleared by a web refresh.

Native updates are separate: `App.getInfo().build` is compared with the published APK build and its verified compatibility range. Only a newer build in that signing chain offers **Download update**; legacy APKs without compatibility metadata never trigger the prompt. The user downloads it and approves installation in Android. This does not silently install an APK or use Google Play. Reminders and push registration retain their existing code paths.

The phone layout uses a viewport-height shell with a separately scrolling page and navigation outside that scroll area. Settings > Check this device reports screen dimensions, zoom, installed build and reminder permissions on-device only; it does not transmit diagnostics or change settings.

## Safe Android releases

The Android workflow requires the original `ANDROID_KEYSTORE_B64` and `ANDROID_KEYSTORE_PASSWORD` repository secrets. `ANDROID_KEY_ALIAS` is optional (default `backstage`). Never create a replacement key to work around a missing original. A key that differs from the installed app cannot update that installation in place.

Before publication, `scripts/verify-android-update.sh` verifies the APK signature and compares its certificate, application ID and version code with the current `android-latest` APK. Missing keys, incompatible certificates or a non-increasing build stop publication. The previous download remains available. Each compatible build is uploaded to its own release before replacing the stable download; the stable release is no longer deleted.

If older installs were signed with different temporary debug keys, matching the latest published APK alone cannot guarantee compatibility with those older installs. Recover the key for each installed version. Do not recommend uninstalling: that removes local app data and scheduled reminders.

## Android layout checks

Phone navigation uses Today, Tasks, Calendar, Us and More. Finance, Joint and Wedding remain available in More. Work keeps only its three work sections. The task entry box is part of the page, so it cannot cover the list; the + button opens the full task form while scrolling. Keyboard viewport changes hide the bottom navigation and resize sheets while their actions remain reachable. Touch targets and safe-area padding are applied through `mobile.css`; desktop keeps the full workspace.

Task forms receive initial focus once, rather than refocusing on each background refresh. Android Back and Escape share the top-dialog close path, wait during saves, and flush the active task field before closing the task editor. The browser checks cover 320 px and 393 px widths and a reduced keyboard-sized viewport. Actual Android keyboard, installer and notification behaviour still need a physical-device check.

## Data and deployment

These update changes do not migrate, reset or overwrite the database. Finance setup is a separate additive migration described in `FINANCE.md`; it has not been run against production by this change. Deploy the web changes through the existing hosting connection. Verify `/api/backstage/version` reports the deployed build, then open an existing installation and check tasks, reminders and private Finance. A physical-device installation test is still required; browser previews cannot verify Android's installer or phone notifications.
