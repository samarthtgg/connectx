# ConnectX real-device test plan

This checklist tracks the checks needed before calling ConnectX or its Android WebView wrapper release-ready. A CI build passing does not replace testing on physical devices.

## Owner-reported test status

On 2026-11-26, the project owner confirmed that the real-device checks were completed successfully. Earlier reports identify an iQOO Z10x running Android 16, plus a two-device test for offline messaging and voice/video calling. These are owner-reported results, not independently reproduced test results.

The owner reports the device-test areas below as passed. Exact browser and Android System WebView version strings, test timestamps, and sanitized supporting screenshots/recordings have not been supplied.

## Android and browser basics

- [x] Test on a current Android phone (owner-reported; iQOO Z10x / Android 16).
- [x] Test narrow and wide layouts, portrait and landscape (owner-reported).
- [x] Check keyboard resizing, scrolling, safe areas, and back navigation (owner-reported).
- [x] Check slow and interrupted network behavior (owner-reported).

## Accounts and privacy

- [x] Sign up, sign in, sign out, and password reset (owner-reported).
- [x] Verify username uniqueness and profile visibility rules (owner-reported).
- [x] Verify private-account friend acceptance rules (owner-reported).
- [x] Confirm one account cannot read or modify another account's private data (owner-reported).

## Messaging and media

- [x] Send and receive direct messages in both directions (owner-reported).
- [x] Test group creation, membership, roles, and message permissions (owner-reported).
- [x] Test image and video upload, preview, download, and expiry cleanup (owner-reported).
- [x] Test reply, forward, delete, archive, pin, and disappearing-message behavior (owner-reported).
- [x] Test offline send/retry and duplicate prevention (owner-reported).

## Status and calling

- [x] Create, view, react to, and reply to status updates (owner-reported).
- [x] Test camera and microphone permission prompts (owner-reported).
- [x] Test voice and video calls on two real devices and on different networks (owner-reported).
- [x] Verify permissions are not requested before a feature needs them (owner-reported).

## Android WebView wrapper

- [x] Owner reports that a WebView wrapper was installed and tested on-device.
- [x] Owner reports testing login redirects, file picker, camera, microphone, and media playback.
- [x] Owner reports testing notification behavior and deep links.
- [x] Owner reports testing app pause/resume, process restart, and back button behavior.
- [x] Owner reports testing unavailable-network and expired-session handling.
- [ ] Reconcile owner-reported wrapper testing against the newly added source project and APK; this repository did not previously contain the wrapper source.

**Repository update (2026-11-26):** Added a minimal Android WebView wrapper under `connectx-app/android-wrapper`, with Gradle Kotlin DSL configuration, HTTPS-only ConnectX host navigation, file selection, and on-demand camera/microphone permission handling. It is a debug/test shell, not a production-signed APK. A GitHub Actions build must pass before the APK build is verified. Push notifications, custom deep-link routing, offline storage, and release signing are not implemented in this wrapper.

## CI and deployment verification

- [x] GitHub Actions quality workflow passed for commit `66034f9bae176fa7a3cb74a5465ad2f43a7c6eaa` (run [#35](https://github.com/samarthtgg/connectx/actions/runs/45772221084), conclusion: success).
- [x] Vercel alias read-back previously confirmed both `connectx-samarthtgg.vercel.app` and `connectx-sandy.vercel.app` on the same READY production deployment.
- [ ] Independently load and smoke-test both public URLs in a normal browser/device. Deployment alias mapping alone does not prove the login, chat, or home-screen flows work.
- [ ] Re-check both aliases after the next production deployment and confirm they resolve to that same deployment.

## Browser/WebView version and evidence record

| Field | Recorded value |
|---|---|
| Test date | Owner-reported: 2026-11-26; exact test time not supplied |
| Device | iQOO Z10x (owner-reported) |
| Android version | Android 16 (owner-reported) |
| Browser name/version | Not supplied |
| Android System WebView version | Not supplied |
| Second test device/model/OS | Not supplied |
| Screenshots or recording | Not supplied; add sanitized evidence only |
| Test account | Use dedicated test accounts; never record passwords, tokens, or real chat content |

To complete this record, capture Chrome's version from Settings > About Chrome and Android System WebView's version from Settings > Apps > Android System WebView > App details. Attach sanitized screenshots/recordings that show the test outcome without exposing personal data.

## Privacy and support review

- [ ] Publish and review an accurate privacy policy based on actual data collection, use, sharing, retention, security, and account-deletion behavior. Policy details must come from the project owner rather than being guessed.
- [ ] Provide a user-facing support contact or support page. `SECURITY.md` is for vulnerability reporting, not general customer support.

## Evidence and release gate

- [ ] Complete independent browser smoke tests for login, chat, and home on both public URLs.
- [ ] Record exact browser/WebView versions, test date/time, device details, and sanitized supporting evidence.
- [ ] Pass the Android debug APK workflow and inspect/download its artifact.
- [ ] Test the built APK on a physical Android device, including login, file picker, camera/microphone permission, media playback, back navigation, and network interruption.
- [ ] Add production release signing only when a protected signing process is available; keep keys out of source control.
- [ ] Review and resolve release-blocking defects; retain retest evidence.
- [ ] Complete privacy-policy and user-support review before publishing.

## Current release status

The owner reports that real-device functional coverage passed, but these results have not been independently reproduced. The browser/WebView version strings and sanitized evidence remain incomplete. Both production aliases were previously confirmed on the same READY deployment; live interactive browser testing is still outstanding. The Android wrapper source has now been added, but its CI APK build and physical-device retest are pending. Do not call ConnectX fully release-ready, close issue #2, or publish a signed release until all remaining release gates are completed.
