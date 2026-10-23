# DriverFlow — isolated Android debug compilation audit

Date: 2026-10-23
Repository: `arismend1/driverflow-mobile`
Branch: `security-mobile-phase1-2026-10`

## Goal and scope

Validate that the secured mobile match acceptance interface can be compiled
into an Android **debug-only** APK under Android API 36 without any production
credentials, release-signing, Stripe invocation, Render deployment, or Google Play
publishing. This is not an authorized release or device test.

The workflow is `.github/workflows/mobile-android-debug-validation.yml`.
It uses the RN app's existing `android/app/build.gradle` and runs
`./gradlew :app:assembleDebug --no-daemon --stacktrace
-PreactNativeArchitectures=arm64-v8a` in GitHub Actions on the mobile security
branch. Gradle's debug signing config uses only the checked-in
`android/app/debug.keystore`; the workflow has no upload keystore or
deployment credentials, no artifact-upload step, and no write permissions.

The React Native screen uses the existing, authenticated GET match listings and
POST `/matches/:id/accept` flow. No application API base-URL or Stripe settings
are changed by this build job.

## Build environment safeguards

- Runner: `ubuntu-latest`, Node.js 22, Java 17, Android compile/target SDK 36.
- Dependencies installed via
  `npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund`, to preserve
  this repo's locked React Native dependency graph and not execute npm
  install-time scripts.
- Installs Android NDK 27.1.12297006, CMake 3.22.1 and build tools 36.0.0
  on the runner. No Android SDK or Gradle changes are committed to the app.
- The repository intentionally omits `android/app/google-services.json`.
  Only inside the ephemeral runner, CI creates a dummy Firebase config for
  package `com.driverflow.official` with non-production project
  `driverflow-ci-debug-only` and an unusable API key.
- Produces **debug** only; checks that `app-debug.apk` exists but does not
  upload it, publish it or install it on a device.

## Verified Android API 36 debug compilation — October 23, 2026

**Confirmed successful:** [GitHub Actions run 39946934796](https://github.com/arismend1/driverflow-mobile/actions/runs/39946934796), job `Compile isolated Android debug APK`, checked out commit `138aa3e`. The complete job passed. The real Gradle log includes `:app:assembleDebug` and `BUILD SUCCESSFUL in 7m 13s`, followed by a successful non-empty-file test of `android/app/build/outputs/apk/debug/app-debug.apk`. No release signing, APK upload or device install took place.

The debug build uses a dummy Firebase configuration created only inside the ephemeral CI runner; it must not be distributed as a usable application. Java 17, Android compile/target API 36 and ARM64 debug compilation passed under the runner environment. This does **not** test an actual phone, login against production, notification delivery, Stripe or user flows.

Also verified separately: the actual [mobile Jest run 39946361299](https://github.com/arismend1/driverflow-mobile/actions/runs/39946361299) passed **10/10 match acceptance helper unit tests**, zero failures. The backend companion [security run 39947822432](https://github.com/arismend1/driverflow-backend/actions/runs/39947822432) passed **116 active isolated checks**, including locked company-candidate state compatibility checks that preserve acceptance/consent dates while keeping contacts and driver documents masked.

The earlier pending status below is historical and superseded by this verified outcome. **No production deployment or publishing was performed.**

## Execution / evidence

The first new build run, `39946834110` (commit `b190695`), failed before
Gradle because the third-party `android-actions/setup-android@v3` attempted
to fetch the removed Android SDK package `tools`. This is a CI setup error,
not an application compilation result.

The workflow was corrected in commit `138aa3e` to invoke the existing
runner's `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager` directly.
The follow-up build run is
[GitHub Actions run 39946934796](https://github.com/arismend1/driverflow-mobile/actions/runs/39946934796).

**Build outcome pending verification.** Do not assume success without a
completed workflow job and an explicit successful APK verification step.

## Release blockers

Even if an isolated debug compilation passes, full app QA still requires a
real-device run, TypeScript and broader Jest coverage, correct authentication
and consent UI, match acceptance against an isolated backend, and authorized
end-to-end payment testing with test-only Stripe accounts. A dummy-Firebase
debug build must never be distributed as a production app. Nothing here
changes the stable branch, `main`, production API, Render, production
databases, Stripe or Play Store.
