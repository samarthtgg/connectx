# ConnectX real-device test plan

This checklist tracks the checks needed before calling ConnectX or its Android WebView wrapper release-ready. A CI build passing does not replace testing on physical devices.

## Owner-reported test status

On 2026-11-26, the project owner confirmed that the remaining real-device checks were completed successfully. Earlier reports identify an iQOO Z10x running Android 16, plus a two-device test for offline messaging and voice/video calling. These are owner-reported results, not independently reproduced test results.

The owner reports the device-test areas below as passed. Browser/WebView version details, exact test date details, and sanitized supporting evidence have not been supplied.

## Android and browser basics

- [x] Test on a current Android phone (owner-reported).
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

- [x] Install and test the Android WebView app (owner-reported).
- [x] Test login redirects, file picker, camera, microphone, and media playback (owner-reported).
- [x] Test notification behavior and deep links (owner-reported).
- [x] Test app pause/resume, process restart, and back button behavior (owner-reported).
- [x] Confirm the wrapper handles unavailable network and expired sessions clearly (owner-reported).

**Repository verification note (2026-11-26):** The current Git tree contains no Android wrapper source directory or Gradle project, although `.github/workflows/android-apk.yml` references `connectx-app/android-wrapper`. The workflow only assembles a debug APK. Consequently, the Android release build/signing configuration cannot be verified from the checked-in source, and the existing workflow is not evidence of a signed production APK.

## CI and deployment verification

- [x] GitHub Actions quality workflow passed on 2026-11-26 for commit `34c201544aad83d2eccb2825bbac827e3081c987` (run #31, job "Lint, type-check and production build", conclusion: success).
- [x] Vercel reported a READY production deployment for the same commit on 2026-11-26.
- [ ] Verify the primary and alternate Vercel domains resolve to the intended latest production deployment. Vercel project metadata lists both domains, but the latest deployment's alias listing only returned the Git-main alias; the primary domain lookup did not resolve.
- [ ] Independently load and smoke-test both public deployment URLs from a normal browser/device.

## Privacy and support review

- [ ] Publish and review an accurate privacy policy based on actual data collection, use, sharing, retention, security, and account-deletion behavior. No privacy-policy document or route was found in the repository tree during this review; policy details must be supplied by the project owner rather than guessed.
- [ ] Provide a user-facing support contact or support page. The repository has `SECURITY.md` for vulnerability reporting, but that is not a general customer-support channel.

## Evidence and release gate

- [ ] Record the browser/WebView version and exact test date alongside the device and Android version.
- [ ] Attach sanitized screenshots or short recordings; do not include real chat content, credentials, tokens, or private user data.
- [ ] Review and resolve release-blocking defects; retain retest evidence.
- [ ] Add and verify an Android production release build configuration with signing kept out of source control. Confirm the signing setup on a protected release workflow before distributing a signed APK.
- [ ] Complete privacy-policy and user-support review before publishing.

## Current release status

The owner reports the real-device test coverage as complete, but those results have not been independently reproduced and the supporting evidence/version details remain outstanding. The GitHub Actions quality check and a Vercel production deployment were independently verified for the commit above. Android release signing, privacy/support readiness, and both custom-domain mappings are not yet verified. Do not call ConnectX fully release-ready, close the release issue, or publish a signed release until all remaining release gates are completed.
