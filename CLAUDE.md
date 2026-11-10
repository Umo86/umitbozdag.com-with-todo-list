# Working on this repo

## Shipping a feature (Backstage / Android app)
1. Add an entry at the top of `lib/changelog.json` (`date`, `title`, `items`) describing the change in plain words.
2. Push to `main`. Vercel deploys the site; the installed Android app picks it up on its next open (version check, no reinstall).
3. The same push runs `.github/workflows/android.yml`, which builds a new APK and replaces the `android-latest` release asset `Backstage.apk`, with the changelog entry as its notes.
4. The download page `/app` (and `/app/download`) always serves that newest APK and shows its version and "What's new".

Never commit passwords, keystores or secrets: the repo is public.
